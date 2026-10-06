// Simulator outputs (DESIGN §2.12 "Outputs"; BALANCE §6.6): console tables per cell, summary.json, games.csv
// (RFC 4180, one row per game, BALANCE §6.6's columns in that order, empty for null) and weekly-sample.csv. Every
// output here is deterministic: no timings, no dates, no locale. Timings go to the console and timing.json only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Difficulty, EntityType, OwnerBackground, RulesPhase } from '../src/engine';
import type { TargetResult } from './balance/scorecard';
import type { CellRun, TimingStats } from './runner';
import { LIQUIDATION_CAUSES, REORG_SPLITS, type CellMetrics, type QuantileSet } from './metrics/aggregate';
import { STOP_KINDS, type GameResult } from './metrics/gameResult';
import type { Estimate, Proportion } from './metrics/stats';
import { round6 } from './metrics/stats';
import { bN, reorgStatusAt, sN } from './metrics/survival';
import type { SimStart } from './setup';
import { perfBudgets, simConfig } from './config';

// ---------------------------------------------------------------------------------------------------------- CSV

/** One RFC 4180 field: quoted when it holds a comma, a quote, CR or LF; quotes doubled; null is empty. */
export function csvField(v: string | number | boolean | null): string {
  if (v === null) return '';
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 text: CRLF after every record, including the last. */
export function toCsv(rows: readonly (readonly (string | number | boolean | null)[])[]): string {
  return rows.map((r) => r.map(csvField).join(',') + '\r\n').join('');
}

const usd2 = (cents: number | null): string | null => (cents === null ? null : (cents / 100).toFixed(2));
const num = (x: number | null): number | null => (x === null ? null : round6(x));
const perYear = (prefix: string, years: number): string[] =>
  Array.from({ length: years }, (_, i) => `${prefix}${i + 1}`);

/** games.csv header for files whose longest cell runs `years` years. */
export function gamesCsvHeader(years: number): string[] {
  return [
    'seed',
    'bot',
    'start',
    'difficulty',
    'background',
    'entity',
    'rules',
    'district',
    ...perYear('B', years),
    ...perYear('S', years),
    'lostWeek',
    'lossCause',
    'liquidationCause',
    'reorgFiledWeek',
    'reorgStatus',
    'reorgConsensual',
    ...perYear('netIncomeUsd', years),
    ...perYear('ownerNwUsd', years),
    ...perYear('washedBcy', years),
    ...perYear('fineOz', years),
    ...perYear('cashCostUsdPerOz', years),
    ...perYear('aiscUsdPerOz', years),
    'claimsAcquired',
    'claimsProfitable',
    'explorationSpendUsd',
    'firstSeasonCommitmentUsd',
    'ownerInjectionUsd',
    'minCashUsd',
    'minCashWeek',
    'eventsMinor',
    'eventsModerate',
    'eventsMajor',
    'eventsCatastrophic',
    'maxPlantLines',
    'smallCrewClaimWeeks',
    'poolMechanicWeeks',
    // Harness columns beyond BALANCE §6.6: pacing (O-13) and bot defects.
    ...perYear('stops', years),
    ...STOP_KINDS.filter((k) => k !== 'maxWeeks').map((k) => `stops_${k}`),
    'longestQuietWeeks',
    'rejectedActions',
    'abortReason',
  ];
}

export function gameCsvRow(g: GameResult, years: number): (string | number | boolean | null)[] {
  const y = (n: number) => g.byYear[n - 1] ?? null;
  const each = <T>(f: (n: number) => T): T[] => Array.from({ length: years }, (_, i) => f(i + 1));
  const inRun = (n: number): boolean => n <= g.years;
  return [
    g.seed,
    g.bot,
    g.start,
    g.difficulty,
    g.background,
    g.entity,
    `p${g.rules}`,
    g.district,
    ...each((n) => (inRun(n) ? bN(g, n) : null)),
    ...each((n) => (inRun(n) ? sN(g, n) : null)),
    g.lostTurn,
    g.lossCause,
    g.liquidationCause,
    g.reorg.filedTurn,
    reorgStatusAt(g, g.finalTurn),
    g.reorg.consensual,
    ...each((n) => usd2(y(n)?.netIncomeCents ?? null)),
    ...each((n) => usd2(y(n)?.ownerNwCents ?? null)),
    ...each((n) => num(y(n)?.washedBcy ?? null)),
    ...each((n) => num(y(n)?.fineOz ?? null)),
    ...each((n) => num(y(n)?.cashCostUsdPerOz ?? null)),
    ...each((n) => num(y(n)?.aiscUsdPerOz ?? null)),
    g.claimsAcquired,
    g.claimsProfitable,
    usd2(g.explorationSpendCents),
    usd2(g.firstSeasonCommitmentCents),
    usd2(g.ownerInjectionCents),
    usd2(g.minCashCents),
    g.minCashTurn,
    g.events?.minor ?? null,
    g.events?.moderate ?? null,
    g.events?.major ?? null,
    g.events?.catastrophic ?? null,
    g.options.maxPlantLines,
    g.options.smallCrewClaimWeeks,
    g.options.poolMechanicWeeks,
    ...each((n) => (inRun(n) ? (y(n)?.stops ?? null) : null)),
    ...STOP_KINDS.filter((k) => k !== 'maxWeeks').map((k) => g.stopsByKind[k]),
    g.longestQuietWeeks,
    g.rejectedActions,
    g.abortReason,
  ];
}

/** games.csv over every cell of a run, cells in run order, games in index order. */
export function gamesCsv(cells: readonly CellRun[]): string {
  const years = cells.reduce((a, c) => Math.max(a, c.spec.years), 0);
  const rows: (string | number | boolean | null)[][] = [gamesCsvHeader(years)];
  for (const c of cells) for (const g of c.results) rows.push(gameCsvRow(g, years));
  return toCsv(rows);
}

export const WEEKLY_SAMPLE_HEADER = [
  'bot',
  'start',
  'difficulty',
  'background',
  'entity',
  'rules',
  'seed',
  'turn',
  'year',
  'week',
  'cashUsd',
  'ownerNwUsd',
  'washedBcy',
  'weighedRawOz',
  'fineOz',
];

/** weekly-sample.csv: weekly cash, bcy and gold for the first `sim.weeklySampleSeeds` seeds of every cell. */
export function weeklySampleCsv(cells: readonly CellRun[]): string {
  const rows: (string | number | boolean | null)[][] = [WEEKLY_SAMPLE_HEADER];
  for (const c of cells) {
    const k = c.spec.cell;
    for (const sample of c.weekly) {
      for (const r of sample.rows) {
        rows.push([
          c.spec.botLabel,
          k.start,
          k.difficulty,
          k.background,
          k.entity,
          `p${c.spec.rulesPhase}`,
          sample.seed,
          r.turn,
          r.year,
          r.week,
          usd2(r.cashCents),
          usd2(r.ownerNwCents),
          num(r.washedBcy),
          num(r.weighedRawOz),
          num(r.fineOz),
        ]);
      }
    }
  }
  return toCsv(rows);
}

// --------------------------------------------------------------------------------------------------- summary.json

export interface CellSummary {
  bot: string;
  start: SimStart;
  difficulty: Difficulty;
  background: OwnerBackground;
  entity: EntityType;
  rules: RulesPhase;
  n: number;
  years: number;
  seedBase: number;
  tuningHash: string | null;
  metrics: CellMetrics;
}

export interface SimSummary {
  sha: string;
  tuningHash: string | null;
  botVersion: string;
  seedBase: number;
  gamesPerCell: number;
  rulesVersion: string;
  /** How intervals and quantiles are computed (BALANCE §3.0). */
  methods: { proportions: string; quantiles: string; quantileIntervals: string };
  cells: CellSummary[];
  targets: TargetResult[];
  /** Non-bot blocks of the run (the world-only block's collector results). */
  blocks: Record<string, unknown>;
}

export const SUMMARY_METHODS: SimSummary['methods'] = {
  proportions: '95% Wilson score interval',
  quantiles: 'Hyndman-Fan type 7 (linear interpolation of order statistics)',
  quantileIntervals: `95% percentile bootstrap, ${simConfig['sim.bootstrapResamples']} resamples, seeded by cell and metric`,
};

export function cellSummary(run: CellRun, metrics: CellMetrics): CellSummary {
  const k = run.spec.cell;
  return {
    bot: run.spec.botLabel,
    start: k.start,
    difficulty: k.difficulty,
    background: k.background,
    entity: k.entity,
    rules: run.spec.rulesPhase,
    n: run.results.length,
    years: run.spec.years,
    seedBase: run.spec.seedBase,
    tuningHash: run.results[0]?.tuningHash ?? null,
    metrics,
  };
}

/** The summary with its keys in BALANCE §6.6's order, whatever order the caller built it in. */
export function orderedSummary(s: SimSummary): SimSummary {
  return {
    sha: s.sha,
    tuningHash: s.tuningHash,
    botVersion: s.botVersion,
    seedBase: s.seedBase,
    gamesPerCell: s.gamesPerCell,
    rulesVersion: s.rulesVersion,
    methods: s.methods,
    cells: s.cells,
    targets: s.targets,
    blocks: s.blocks,
  };
}

export function summaryJson(summary: SimSummary): string {
  return `${JSON.stringify(orderedSummary(summary), null, 2)}\n`;
}

/** The cell's identity as one label: bot · start · difficulty · background · entity · pN. */
export function cellLabel(
  c: Pick<CellSummary, 'bot' | 'start' | 'difficulty' | 'background' | 'entity' | 'rules'>,
): string {
  return `${c.bot} · ${c.start} · ${c.difficulty} · ${c.background} · ${c.entity} · p${c.rules}`;
}

// -------------------------------------------------------------------------------------------------------- console

function groupThousands(int: string): string {
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return neg ? `-${out}` : out;
}

/** Whole dollars with thousands separators (statements style, BALANCE §6.6 console). */
export function fmtUsd(x: number | null): string {
  if (x === null) return 'n/a';
  // Half away from zero, the money rule of DESIGN §2.4 (Math.round would take −1,234.5 to −1,234).
  const whole = Math.sign(x) * Math.round(Math.abs(x));
  const s = groupThousands((whole === 0 ? 0 : whole).toFixed(0));
  return s.startsWith('-') ? `-$${s.slice(1)}` : `$${s}`;
}

export function fmtPct(p: Estimate): string {
  if (p.value === null) return 'n/a';
  const ci = p.ci === null ? '' : ` [${(100 * p.ci[0]).toFixed(1)}–${(100 * p.ci[1]).toFixed(1)}]`;
  return `${(100 * p.value).toFixed(1)}%${ci}`;
}

const fmtShort = (p: Proportion): string => (p.value === null ? 'n/a' : `${(100 * p.value).toFixed(1)}%`);

function fmtRatio(e: Estimate): string {
  return e.value === null ? 'n/a' : e.value.toFixed(2);
}

function fmtQuantilesUsd(q: QuantileSet): string {
  if (q.p50.value === null) return 'n/a';
  const ci = q.p50.ci === null ? '' : ` [${fmtUsd(q.p50.ci[0])}–${fmtUsd(q.p50.ci[1])}]`;
  return `${fmtUsd(q.p10.value)} / ${fmtUsd(q.p50.value)}${ci} / ${fmtUsd(q.p90.value)}`;
}

function pad(s: string, w: number): string {
  return s.length >= w ? `${s} ` : s + ' '.repeat(w - s.length);
}

/** The per-cell console tables of BALANCE §6.6 (n/a where not computable). */
export function formatCell(c: CellSummary): string[] {
  const m = c.metrics;
  const lines: string[] = [];
  lines.push(
    `━━ ${cellLabel(c)} ━━ ${c.n} games × ${c.years} yr · seed base ${c.seedBase} · tuning ${c.tuningHash ?? 'n/a'}`,
  );
  lines.push(`  ${pad('year', 6)}${pad('S_N', 22)}${pad('B_N', 22)}${pad('RS_N', 22)}retreated (B_N − S_N)`);
  for (const y of m.byYear) {
    lines.push(
      `  ${pad(String(y.year), 6)}${pad(fmtPct(y.S), 22)}${pad(fmtPct(y.B), 22)}${pad(fmtPct(y.RS), 22)}${fmtPct(y.retreated)}`,
    );
  }
  lines.push(
    '  bankruptcy BK_N · liquidations (filed / involuntary / converted / P1 counter) · reorganization filings (completed / converted / open)',
  );
  for (const y of m.byYear) {
    const liq = LIQUIDATION_CAUSES.map((k) => fmtShort(y.liquidations[k])).join(' / ');
    const reo = REORG_SPLITS.map((k) => fmtShort(y.reorgFilings[k])).join(' / ');
    lines.push(`  ${pad(String(y.year), 6)}${pad(fmtPct(y.BK), 22)}L ${pad(liq, 36)}R ${reo}`);
  }
  lines.push(
    '  owner NW (scoring) p10 / p50 [95%] / p90 · NW ratio p10 / p50 / p90 · owner-ahead · production attempt',
  );
  for (const y of m.byYear) {
    const ratio = `${fmtRatio(y.nwRatio.p10)} / ${fmtRatio(y.nwRatio.p50)} / ${fmtRatio(y.nwRatio.p90)}`;
    lines.push(
      `  ${pad(String(y.year), 6)}${pad(fmtQuantilesUsd(y.ownerNwUsd), 48)}${pad(ratio, 20)}${pad(fmtShort(y.ownerAhead), 10)}${fmtShort(y.productionAttempt)}`,
    );
  }
  const stops = m.byYear.map((y) => (y.stops.mean === null ? 'n/a' : y.stops.mean.toFixed(1))).join(' · ');
  lines.push(`  stops per year (mean, by year): ${stops} · longest quiet run ${m.longestQuietWeeksMax} weeks`);
  const kinds = STOP_KINDS.filter((k) => k !== 'maxWeeks')
    .map((k) => `${k} ${m.stopReasonsPerYear[k] === null ? 'n/a' : (m.stopReasonsPerYear[k] as number).toFixed(2)}`)
    .join(', ');
  lines.push(`  stop reasons per game-year: ${kinds}`);
  const y1 = m.byYear[0];
  const costs =
    y1 === undefined
      ? 'n/a'
      : `cash cost/oz ${y1.cashCostUsdPerOzP50.value === null ? 'n/a' : fmtUsd(y1.cashCostUsdPerOzP50.value)} · AISC/oz ${y1.aiscUsdPerOzP50.value === null ? 'n/a' : fmtUsd(y1.aiscUsdPerOzP50.value)}`;
  lines.push(
    `  FSP ${fmtPct(m.fsp)} · ${costs} (year 1) · claims profitable ${fmtPct(m.claimsProfitableShare)} · district split ${m.districtSplit === null ? 'n/a' : JSON.stringify(m.districtSplit)} · owner injections p50 ${m.ownerInjectionUsdP50.value === null ? 'n/a' : fmtUsd(m.ownerInjectionUsdP50.value)}`,
  );
  lines.push(
    `  causes of loss: liquidated ${m.lossCauses.liquidated}, ousted ${m.lossCauses.ousted}, scenario ${m.lossCauses.scenario} · minimum cash p10 ${fmtUsd(m.minCashUsd.p10)}, p50 ${fmtUsd(m.minCashUsd.p50)}`,
  );
  lines.push(
    `  multi-claim options: most plant lines ${m.options.maxPlantLines}, small-crew claim-weeks ${m.options.smallCrewClaimWeeks}, pool mechanic-weeks ${m.options.poolMechanicWeeks}`,
  );
  const codes = Object.keys(m.rejectionsByCode).sort();
  lines.push(
    `  bot defects: ${m.rejectedActions} rejected actions${codes.length > 0 ? ` (${codes.map((k) => `${k} ${m.rejectionsByCode[k]}`).join(', ')})` : ''}, ${m.abortedGames} aborted games`,
  );
  return lines;
}

/** One timing line (console only; never in a deterministic output). */
export function formatTiming(label: string, t: TimingStats): string {
  if (t.meanMs === null || t.p95Ms === null) return `  engine time ${label}: no weeks simulated`;
  const mean = perfBudgets['sim.perf.weekMeanMs'];
  const p95 = perfBudgets['sim.perf.weekCeilingMs'];
  const ok = t.meanMs <= mean && t.p95Ms <= p95 ? 'within' : 'OVER';
  return `  engine time ${label}: ${t.weeks} weeks, advanceWeek mean ${t.meanMs.toFixed(3)} ms, p95 ${t.p95Ms.toFixed(3)} ms (${ok} the §2.13 budget of ${mean} ms mean, ${p95} ms p95)`;
}

// --------------------------------------------------------------------------------------------------------- files

export interface OutputFiles {
  summary: SimSummary;
  gamesCsv: string;
  weeklyCsv: string;
  /** Written beside the others but never compared: wall-clock figures. */
  timing: unknown;
}

export function writeOutputs(dir: string, files: OutputFiles): string[] {
  mkdirSync(dir, { recursive: true });
  const written: [string, string][] = [
    ['summary.json', summaryJson(files.summary)],
    ['games.csv', files.gamesCsv],
    ['weekly-sample.csv', files.weeklyCsv],
    ['timing.json', `${JSON.stringify(files.timing, null, 2)}\n`],
  ];
  for (const [name, text] of written) writeFileSync(join(dir, name), text);
  return written.map(([name]) => join(dir, name));
}
