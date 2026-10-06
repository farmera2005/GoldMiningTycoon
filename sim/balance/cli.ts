// `npm run sim:balance -- [--phase N] [--quick] [--workers N] [--out dir] [--baseline file]` (BALANCE §6.1, §6.4–6.7):
// runs the phase's matrix, prints the scorecard and the per-cell tables, writes
// out/balance/p<N>/<sha>/{summary.json,games.csv,weekly-sample.csv} (plus timing.json), compares with the committed
// baseline and exits non-zero on any new FAIL or worsened gating status, or on a bot defect.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUILD_RULES_PHASE, RULES_VERSION, type RulesPhase } from '../../src/engine';
import { seedBaseForPhase } from '../../src/data/balance/seeds';
import { BOT_VERSION, implementedBot, type BotSpec } from '../bots/catalog';
import { simConfig } from '../config';
import { dominanceMatrix, dominanceStatus, type DominanceInput } from '../metrics/dominance';
import { formatWorldOnly, runWorldOnly, type WorldOnlyResult } from '../modes/worldOnly';
import { gitSha } from '../provenance';
import {
  formatCell,
  formatTiming,
  gamesCsv,
  SUMMARY_METHODS,
  weeklySampleCsv,
  writeOutputs,
  type CellSummary,
  type SimSummary,
} from '../report';
import {
  CliExit,
  EXIT_FAILED,
  EXIT_OK,
  EXIT_USAGE,
  cellRunSpec,
  playCell,
  processIo,
  type CliIo,
  type PlayedCell,
} from '../run';
import { createPool, resolveWorkerCount, timingStats, type SimPool } from '../runner';
import { setupForCell, type SimStart } from '../setup';
import { findBaseline } from './baseline';
import { buildMatrix, type MatrixBlock } from './matrix';
import { compareWithBaseline, formatScorecard, gatingFailures, scoreTargets } from './scorecard';

export interface BalanceOptions {
  phase: RulesPhase;
  quick: boolean;
  workers: number;
  out: string | null;
  baseline: string | null;
}

export const BALANCE_USAGE = `usage: npm run sim:balance -- [--phase N] [--quick] [--workers N] [--out dir] [--baseline file]
  --phase N        the phase whose matrix and bands to run (default: the build's phase, P${BUILD_RULES_PHASE})
  --quick          ${simConfig['sim.quickGames']} games per cell (development only, never sign-off)
  --workers N      worker processes, 0 = CPU cores (default ${simConfig['sim.workers']})
  --out dir        output directory (default out/balance/p<N>/<sha>)
  --baseline file  compare with this summary instead of docs/balance/baseline-phase-<N|N−1>.json`;

export function parseBalanceArgs(
  argv: readonly string[],
): { ok: true; options: BalanceOptions } | { ok: false; message: string } {
  const o: BalanceOptions = {
    phase: BUILD_RULES_PHASE,
    quick: false,
    workers: simConfig['sim.workers'],
    out: null,
    baseline: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const value = (): string | null => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return null;
      i++;
      return v;
    };
    if (a === '--quick') o.quick = true;
    else if (a === '--phase') {
      const v = value();
      const m = v === null ? null : /^[pP]?([0-6])$/.exec(v);
      if (m === null || m === undefined) return { ok: false, message: '--phase needs 0…6' };
      const p = Number(m[1]) as RulesPhase;
      if (p > BUILD_RULES_PHASE) {
        return {
          ok: false,
          message: `--phase ${p}: this is a P${BUILD_RULES_PHASE} build; phase ${p} is available from P${p}`,
        };
      }
      o.phase = p;
    } else if (a === '--workers') {
      const v = value();
      const n = v !== null && /^\d+$/.test(v) ? Number(v) : Number.NaN;
      if (!(n >= 0 && n <= 256)) return { ok: false, message: '--workers needs a whole number from 0 to 256' };
      o.workers = n;
    } else if (a === '--out' || a === '--baseline') {
      const v = value();
      if (v === null) return { ok: false, message: `${a} needs a path` };
      if (a === '--out') o.out = v;
      else o.baseline = v;
    } else return { ok: false, message: `unknown option '${a}'` };
  }
  return { ok: true, options: o };
}

const SPEC = (bot: string): BotSpec => ({ id: bot as BotSpec['id'], param: null });

/** BALANCE §5.9 per start type over the bots with a year-5 result (O-04; G-01, G-02, G-06, G-08 read it too). */
function dominanceByStart(cells: readonly CellSummary[]) {
  const starts: SimStart[] = [];
  for (const c of cells) if (!starts.includes(c.start)) starts.push(c.start);
  return starts.map((start) => {
    const inputs: DominanceInput[] = cells
      .filter(
        (c) =>
          c.start === start &&
          c.difficulty === 'standard' &&
          c.background === 'none' &&
          c.entity === 'llc' &&
          c.years >= 5,
      )
      .map((c) => ({
        bot: c.bot,
        s2: c.metrics.byYear[1]?.S ?? { value: null, ci: null, n: 0 },
        medianNwRatio5: c.metrics.byYear[4]?.nwRatio.p50 ?? { value: null, ci: null, n: 0 },
        p90NwRatio5: c.metrics.byYear[4]?.nwRatio.p90 ?? { value: null, ci: null, n: 0 },
      }));
    const pairs = dominanceMatrix(inputs);
    return { start, bots: inputs.map((i) => i.bot), status: dominanceStatus(pairs), pairs };
  });
}

async function runBlocks(
  blocks: readonly MatrixBlock[],
  phase: RulesPhase,
  seedBase: number,
  pool: SimPool,
  io: CliIo,
): Promise<{ played: PlayedCell[]; world: WorldOnlyResult | null }> {
  const played: PlayedCell[] = [];
  let world: WorldOnlyResult | null = null;
  for (const b of blocks) {
    if (b.unavailable !== null) {
      io.out(`block ${b.id}: skipped (${b.unavailable})`);
      continue;
    }
    if (b.id === 'world') {
      const setup = setupForCell({ start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' });
      world = await runWorldOnly(pool, { setup, rulesPhase: phase, overrides: {}, seedBase, games: b.games });
      io.out(`block world: ${world.worlds} worlds`);
      continue;
    }
    if (b.cells.length === 0) {
      io.out(`block ${b.id}: no runner in this build yet`);
      continue;
    }
    for (const c of b.cells) {
      const bot = SPEC(c.bot);
      if (implementedBot(bot) === null) {
        throw new CliExit(
          EXIT_FAILED,
          `block ${b.id}: bot ${c.bot} belongs to P${phase}'s catalog but is not implemented`,
        );
      }
      const { bot: _bot, ...cell } = c;
      played.push(
        await playCell(
          pool,
          cellRunSpec({ cell, bot, rulesPhase: phase, overrides: {}, years: b.years, seedBase, games: b.games }),
        ),
      );
    }
    io.out(`block ${b.id}: ${b.cells.length} cells × ${b.games} games × ${b.years} years`);
  }
  return { played, world };
}

/** Programmatic overrides for tests and debugging (never sign-off): games per cell in every block. */
export interface BalanceRunOverrides {
  games?: number;
}

export async function runBalanceCli(
  argv: readonly string[],
  io: CliIo = processIo,
  overrides: BalanceRunOverrides = {},
): Promise<number> {
  const parsed = parseBalanceArgs(argv);
  if (!parsed.ok) {
    io.err(parsed.message);
    io.err(BALANCE_USAGE);
    return EXIT_USAGE;
  }
  const o = parsed.options;
  const sha = gitSha(io.cwd);
  const seedBase = seedBaseForPhase(o.phase);
  const matrixOpts = overrides.games === undefined ? { quick: o.quick } : { quick: o.quick, games: overrides.games };
  const blocks = buildMatrix(o.phase, BUILD_RULES_PHASE, matrixOpts);
  const gamesPerCell = overrides.games ?? (o.quick ? simConfig['sim.quickGames'] : simConfig['sim.defaultGames']);
  const workers = resolveWorkerCount(o.workers);
  io.out(
    `sim:balance · phase ${o.phase} · P${BUILD_RULES_PHASE} build (rules ${RULES_VERSION}) · BOT_VERSION ${BOT_VERSION} · ` +
      `sha ${sha} · seed base ${seedBase} · ${gamesPerCell} games per cell${o.quick ? ' (--quick: not for sign-off)' : ''} · ` +
      `${workers === 1 ? 'in-process' : `${workers} workers`}`,
  );
  io.out(
    `matrix (BALANCE §6.4): ${blocks.map((b) => `${b.id}${b.unavailable === null ? '' : ' (skipped)'}`).join(', ')}`,
  );
  const pool = createPool(workers);
  try {
    const { played, world } = await runBlocks(blocks, o.phase, seedBase, pool, io);
    const cells = played.map((p) => p.summary);
    const timing = timingStats(Float64Array.from(played.flatMap((p) => Array.from(p.run.weekMs))));
    const targets = scoreTargets({ phase: o.phase, cells, timing: null });
    const consoleTargets = scoreTargets({ phase: o.phase, cells, timing });
    const baseline = findBaseline(io.cwd, o.phase, o.baseline);
    const deltas = compareWithBaseline(consoleTargets, baseline?.targets ?? null);

    io.out('');
    for (const line of formatScorecard(o.phase, consoleTargets, deltas)) io.out(line);
    io.out(`baseline: ${baseline === null ? 'none' : baseline.path}`);
    io.out('');
    if (cells.length === 0) {
      io.out(
        "per-cell survival (BALANCE §6.6): S_N · B_N · RS_N · retreated (B_N − S_N) — no bot cells in this phase's matrix",
      );
    }
    for (const c of cells) for (const line of formatCell(c)) io.out(line);
    const dominance = dominanceByStart(cells);
    for (const d of dominance) {
      const hits = d.pairs.filter((p) => p.verdict === 'dominates' || p.verdict === 'withinInterval');
      io.out(
        `dominance (${d.start}, ${d.bots.length} bots): ${d.status}${hits.length > 0 ? ` · ${hits.map((p) => `${p.a} ${p.verdict} ${p.b}`).join('; ')}` : ''}`,
      );
    }
    if (world !== null) for (const line of formatWorldOnly(world)) io.out(line);
    io.out(formatTiming('over the matrix (console and timing.json only)', timing));

    const summary: SimSummary = {
      sha,
      tuningHash: cells[0]?.tuningHash ?? world?.tuningHash ?? null,
      botVersion: BOT_VERSION,
      seedBase,
      gamesPerCell,
      rulesVersion: RULES_VERSION,
      methods: SUMMARY_METHODS,
      cells,
      targets,
      blocks: {
        matrix: blocks.map((b) => ({
          id: b.id,
          cells: b.cells.length,
          years: b.years,
          games: b.games,
          gating: b.gating,
          unavailable: b.unavailable,
        })),
        world,
        dominance,
      },
    };
    const outDir = o.out ?? join(io.cwd, 'out', 'balance', `p${o.phase}`, sha);
    const files = writeOutputs(outDir, {
      summary,
      gamesCsv: gamesCsv(played.map((p) => p.run)),
      weeklyCsv: weeklySampleCsv(played.map((p) => p.run)),
      timing: {
        sha,
        phase: o.phase,
        total: timing,
        cells: played.map((p) => ({ cell: p.summary.bot, start: p.summary.start, ...timingStats(p.run.weekMs) })),
      },
    });
    io.out(`wrote ${files.join(', ')}`);

    const failures = gatingFailures(consoleTargets, deltas);
    const defects = cells.reduce((a, c) => a + c.metrics.rejectedActions + c.metrics.abortedGames, 0);
    if (failures.length > 0) io.err(`new FAIL or worsened gating status: ${failures.join(', ')}`);
    if (defects > 0) io.err(`bot defects: ${defects} rejected actions or aborted games`);
    for (const d of deltas)
      if (d.movedSe !== null && d.movedSe > 2)
        io.err(`warning: ${d.id} moved ${d.movedSe.toFixed(1)} SE since the baseline`);
    return failures.length > 0 || defects > 0 ? EXIT_FAILED : EXIT_OK;
  } catch (e) {
    if (e instanceof CliExit) {
      io.err(e.message);
      return e.exitCode;
    }
    io.err(`sim:balance failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return EXIT_FAILED;
  } finally {
    await pool.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void runBalanceCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
