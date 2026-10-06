// `npm run sim -- [opts]` (DESIGN §2.12; CLAUDE.md "Commands"): one cell of bot games, or one mode. Exit codes: 0 ok;
// 1 a bot defect (a validator rejection or an unanswered blocking decision) or a failed run; 2 a usage error or an
// option this build cannot run yet ("available from Pn").
import { pathToFileURL } from 'node:url';
import { BUILD_RULES_PHASE, RULES_VERSION, type RulesPhase } from '../src/engine';
import { seedBaseForPhase } from '../src/data/balance/seeds';
import { parseSimArgs, modeAvailableFrom, USAGE, type SimOptions } from './args';
import { BOT_VERSION, botEntry, botLabel, implementedBot, type BotSpec } from './bots/catalog';
import { formatWorldOnly, runWorldOnly } from './modes/worldOnly';
import { gitSha } from './provenance';
import {
  formatCell,
  formatTiming,
  gamesCsv,
  SUMMARY_METHODS,
  weeklySampleCsv,
  writeOutputs,
  type SimSummary,
} from './report';
import { createPool, resolveWorkerCount, timingStats, type SimPool } from './runner';
import {
  CliExit,
  EXIT_FAILED,
  EXIT_OK,
  EXIT_USAGE,
  cellRunSpec,
  checkOverrides,
  loadOverrides,
  playCell,
  processIo,
  type CliIo,
} from './run';
import { checkSetup, setupForCell, type CellSetup } from './setup';

/**
 * D-2.51: an option of a later phase is "available from Pn"; one of a phase later than the run's `--rules` needs those
 * rules; one of this build's phase that its package has not delivered yet (the P1 Wave-0 build registers P1 before
 * implementing it) says so.
 */
function notAvailable(what: string, phase: number, rulesPhase: RulesPhase): CliExit {
  if (phase > BUILD_RULES_PHASE) {
    return new CliExit(EXIT_USAGE, `${what}: available from P${phase} (this is a P${BUILD_RULES_PHASE} build)`);
  }
  if (phase > rulesPhase) {
    return new CliExit(EXIT_USAGE, `${what}: needs phase-${phase} rules (this run plays --rules p${rulesPhase})`);
  }
  return new CliExit(EXIT_USAGE, `${what}: P${phase} work not implemented in this build yet`);
}

function cellOf(opts: SimOptions): CellSetup {
  return { start: opts.start, difficulty: opts.difficulty, background: opts.background, entity: opts.entity };
}

/** The setup this build can run, or the reason it cannot (DESIGN §1 1.6 codes via the engine's validateSetup). */
function checkedSetup(cell: CellSetup, rulesPhase: RulesPhase) {
  const setup = setupForCell(cell);
  const verdict = checkSetup(setup, rulesPhase);
  if (verdict.issues.length === 0) return setup;
  const codes = verdict.issues.map((i) => `${i.field} ${i.code}`).join(', ');
  if (verdict.availableFrom !== null) {
    throw notAvailable(`--start ${cell.start} (${codes})`, verdict.availableFrom, rulesPhase);
  }
  throw new CliExit(EXIT_USAGE, `invalid setup for this cell: ${codes}`);
}

function header(opts: SimOptions, sha: string, seedBase: number, workers: number): string {
  return (
    `Gold Mining Tycoon simulator · P${BUILD_RULES_PHASE} build (rules ${RULES_VERSION}) · rules p${opts.rulesPhase} · ` +
    `BOT_VERSION ${BOT_VERSION} · sha ${sha} · seed base ${seedBase} · ${workers === 1 ? 'in-process' : `${workers} workers`}`
  );
}

function baseSummary(sha: string, seedBase: number, games: number): Omit<SimSummary, 'tuningHash' | 'cells'> {
  return {
    sha,
    botVersion: BOT_VERSION,
    seedBase,
    gamesPerCell: games,
    rulesVersion: RULES_VERSION,
    methods: SUMMARY_METHODS,
    targets: [],
    blocks: {},
  };
}

/** The bot to run: it must exist, accept the start (§2.12.1), and be implemented in this build. */
function checkedStrategy(opts: SimOptions): BotSpec {
  const spec = opts.strategy;
  if (spec === null) throw new CliExit(EXIT_USAGE, '--strategy <botId> is required for a bot run');
  const entry = botEntry(spec.id);
  if (entry === null) throw new CliExit(EXIT_USAGE, `unknown bot ${spec.id}`);
  if (entry.starts !== null && !entry.starts.includes(opts.start)) {
    throw new CliExit(EXIT_USAGE, `--strategy ${spec.id} plays only ${entry.starts.join(', ')} (DESIGN §2.12.1)`);
  }
  if (implementedBot(spec) === null) throw notAvailable(`--strategy ${botLabel(spec)}`, entry.phase, opts.rulesPhase);
  return spec;
}

async function runBots(opts: SimOptions, io: CliIo, pool: SimPool, sha: string, seedBase: number): Promise<number> {
  const spec = checkedStrategy(opts);
  const cell = cellOf(opts);
  const setup = checkedSetup(cell, opts.rulesPhase);
  const overrides = loadOverrides(opts.tuningPath, io.cwd);
  checkOverrides(setup, overrides, opts.tuningPath);

  const played = await playCell(
    pool,
    cellRunSpec({
      cell,
      bot: spec,
      rulesPhase: opts.rulesPhase,
      overrides,
      years: opts.years,
      seedBase,
      games: opts.games,
    }),
  );
  for (const line of formatCell(played.summary)) io.out(line);
  const timing = timingStats(played.run.weekMs);
  io.out(formatTiming('(console only)', timing));

  const m = played.summary.metrics;
  if (opts.out !== null) {
    const summary: SimSummary = {
      ...baseSummary(sha, seedBase, opts.games),
      tuningHash: played.summary.tuningHash,
      cells: [played.summary],
    };
    const files = writeOutputs(opts.out, {
      summary,
      gamesCsv: gamesCsv([played.run]),
      weeklyCsv: weeklySampleCsv([played.run]),
      timing: { sha, cells: [{ cell: played.summary.bot, ...timing }], total: timing },
    });
    io.out(`wrote ${files.join(', ')}`);
  }
  if (m.rejectedActions > 0 || m.abortedGames > 0) {
    io.err(
      `bot defect: ${m.rejectedActions} rejected actions and ${m.abortedGames} games stopped on an unanswered blocking decision`,
    );
    return EXIT_FAILED;
  }
  return EXIT_OK;
}

async function runWorlds(opts: SimOptions, io: CliIo, pool: SimPool, sha: string, seedBase: number): Promise<number> {
  const setup = checkedSetup(cellOf(opts), opts.rulesPhase);
  const overrides = loadOverrides(opts.tuningPath, io.cwd);
  checkOverrides(setup, overrides, opts.tuningPath);
  const result = await runWorldOnly(pool, {
    setup,
    rulesPhase: opts.rulesPhase,
    overrides,
    seedBase,
    games: opts.games,
  });
  for (const line of formatWorldOnly(result)) io.out(line);
  if (opts.out !== null) {
    const summary: SimSummary = {
      ...baseSummary(sha, seedBase, opts.games),
      tuningHash: result.tuningHash,
      cells: [],
      blocks: { world: result },
    };
    const files = writeOutputs(opts.out, {
      summary,
      gamesCsv: gamesCsv([]),
      weeklyCsv: weeklySampleCsv([]),
      timing: { sha },
    });
    io.out(`wrote ${files.join(', ')}`);
  }
  return EXIT_OK;
}

export async function runSimCli(argv: readonly string[], io: CliIo = processIo): Promise<number> {
  const parsed = parseSimArgs(argv, BUILD_RULES_PHASE);
  if (!parsed.ok) {
    io.err(`${parsed.error.code}: ${parsed.error.message}`);
    io.err(USAGE);
    return EXIT_USAGE;
  }
  const opts = parsed.options;
  if (opts.help) {
    io.out(USAGE);
    return EXIT_OK;
  }
  let pool: SimPool | null = null;
  try {
    const later = modeAvailableFrom(opts);
    if (later !== null) {
      throw notAvailable(later.what, later.phase, opts.rulesPhase);
    }
    const rules: RulesPhase = opts.rulesPhase;
    const seedBase = opts.seedBase ?? seedBaseForPhase(rules);
    const sha = gitSha(io.cwd);
    const workers = Math.min(resolveWorkerCount(opts.workers), Math.max(1, opts.games));
    io.out(header(opts, sha, seedBase, workers));
    // Validate everything that can fail before the pool starts its threads.
    if (opts.mode === 'bots') checkedStrategy(opts);
    checkedSetup(cellOf(opts), opts.rulesPhase);
    pool = createPool(workers);
    return opts.mode === 'worldOnly'
      ? await runWorlds(opts, io, pool, sha, seedBase)
      : await runBots(opts, io, pool, sha, seedBase);
  } catch (e) {
    if (e instanceof CliExit) {
      io.err(e.message);
      return e.exitCode;
    }
    io.err(`simulator failed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return EXIT_FAILED;
  } finally {
    if (pool !== null) await pool.close();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void runSimCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
