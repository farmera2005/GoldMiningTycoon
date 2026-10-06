// The balance scorecard (BALANCE §3.0 pass rules, §6.6 console, §6.7 regression tracking). Each clause of
// sim/balance/targets.ts is measured by its extractor from the run's cell summaries, scored against this phase's band,
// and compared with the committed baseline. A clause whose extractor is unimplemented, or whose cells the run lacks,
// measures null and scores N/A.
import type { TimingStats } from '../runner';
import type { CellSummary } from '../report';
import type { SimStart } from '../setup';
import { round6, Z95, type Estimate, type Proportion } from '../metrics/stats';
import { ruleFor, TARGETS, type Applicability, type Band, type ExtractorId, type TargetClause } from './targets';

/** PASS / AT-RISK / FAIL per §3.0; N/A not computable or not applicable; INFO measured with no band (reported). */
export type Status = 'PASS' | 'AT-RISK' | 'FAIL' | 'N/A' | 'INFO';

export interface TargetResult {
  id: string;
  target: string;
  /** This phase's applicability (null in P0, which BALANCE §7 does not cover). */
  applicability: Applicability | null;
  band: Band | null;
  value: number | null;
  ci: [number, number] | null;
  status: Status;
  note: string | null;
}

// --------------------------------------------------------------------------------------------- §3.0 pass rules

function inside(band: Band, x: number): boolean {
  const loOk = band.lo === null || (band.loOpen === true ? x > band.lo : x >= band.lo);
  const hiOk = band.hi === null || (band.hiOpen === true ? x < band.hi : x <= band.hi);
  return loOk && hiOk;
}

/**
 * §3.0: PASS when the point estimate is inside the band; AT-RISK when it is outside but the band edge it crossed lies
 * inside its 95% interval; FAIL when that edge lies outside the interval (or there is no interval).
 */
export function bandStatus(
  band: Band,
  value: number,
  ci: readonly [number, number] | null,
): 'PASS' | 'AT-RISK' | 'FAIL' {
  if (inside(band, value)) return 'PASS';
  if (ci === null) return 'FAIL';
  if (band.lo !== null && !(band.loOpen === true ? value > band.lo : value >= band.lo)) {
    return (band.loOpen === true ? ci[1] > band.lo : ci[1] >= band.lo) ? 'AT-RISK' : 'FAIL';
  }
  const hi = band.hi as number;
  return (band.hiOpen === true ? ci[0] < hi : ci[0] <= hi) ? 'AT-RISK' : 'FAIL';
}

const SEVERITY: Readonly<Record<Status, number>> = { PASS: 0, INFO: 0, 'N/A': 1, 'AT-RISK': 2, FAIL: 3 };

/** §3.0: a target with several clauses takes the status of its worst clause (FAIL > AT-RISK > N/A > PASS). */
export function worstStatus(statuses: readonly Status[]): Status {
  if (statuses.length === 0) return 'N/A';
  let worst: Status = statuses[0] as Status;
  for (const s of statuses) if (SEVERITY[s] > SEVERITY[worst]) worst = s;
  if (worst === 'INFO' || worst === 'PASS') return statuses.every((s) => s === 'INFO') ? 'INFO' : 'PASS';
  return worst;
}

/** §3.0: a target checked under two rule sets or start types that passes in one and not the other is AT-RISK. */
export function acrossVariants(statuses: readonly Status[]): Status {
  const passes = statuses.filter((s) => s === 'PASS').length;
  if (passes > 0 && passes < statuses.length) return 'AT-RISK';
  return worstStatus(statuses);
}

// --------------------------------------------------------------------------------------------------- extractors

export interface ScoreContext {
  phase: number;
  cells: readonly CellSummary[];
  /** Engine timing of the run; null when scoring for a deterministic output (timings stay out of summary.json). */
  timing: TimingStats | null;
}

type Measured = { value: number; ci: [number, number] | null } | null;

function cellFor(ctx: ScoreContext, bot: string, start: SimStart, over: Partial<CellSummary> = {}): CellSummary | null {
  const want = { difficulty: 'standard', background: 'none', entity: 'llc', ...over };
  return (
    ctx.cells.find(
      (c) =>
        c.bot === bot &&
        c.start === start &&
        c.difficulty === want.difficulty &&
        c.background === want.background &&
        c.entity === want.entity &&
        c.rules === ctx.phase,
    ) ?? null
  );
}

function fromEstimate(e: Estimate | undefined): Measured {
  return e === undefined || e.value === null ? null : { value: e.value, ci: e.ci };
}

/** An equal-weight pooled proportion with a normal-approximation interval (BALANCE O-01's pooling). */
function pooled(parts: readonly { w: number; p: Proportion }[]): Measured {
  if (parts.some((x) => x.p.value === null || x.p.n === 0)) return null;
  let value = 0;
  let variance = 0;
  for (const { w, p } of parts) {
    const v = p.value as number;
    value += w * v;
    variance += (w * w * v * (1 - v)) / p.n;
  }
  const half = Z95 * Math.sqrt(variance);
  return { value: round6(value), ci: [round6(Math.max(0, value - half)), round6(Math.min(1, value + half))] };
}

/** O-01's pooling: Bootstrapper, Backed (equity and royalty averaged) and Inheritor, equally weighted. */
const POOL: readonly { start: SimStart; w: number }[] = [
  { start: 'bootstrapper', w: 1 / 3 },
  { start: 'backedEquity', w: 1 / 6 },
  { start: 'backedRoyalty', w: 1 / 6 },
  { start: 'inheritor', w: 1 / 3 },
];

function pooledYear(ctx: ScoreContext, pick: (c: CellSummary) => Proportion | undefined): Measured {
  const parts: { w: number; p: Proportion }[] = [];
  for (const { start, w } of POOL) {
    const c = cellFor(ctx, 'cautious', start);
    const p = c === null ? undefined : pick(c);
    if (p === undefined) return null;
    parts.push({ w, p });
  }
  return pooled(parts);
}

/**
 * The core block's 13 cells (BALANCE §6.4): {cautious, balanced, aggressive} × the four starts, plus undercap on the
 * Bootstrapper; each at standard difficulty, background none, LLC and the phase's rules (cellFor's filter).
 */
const CORE_CELLS: readonly { bot: string; start: SimStart }[] = [
  ...(['cautious', 'balanced', 'aggressive'] as const).flatMap((bot) =>
    (['bootstrapper', 'backedEquity', 'backedRoyalty', 'inheritor'] as const).map((start) => ({ bot, start })),
  ),
  { bot: 'undercap', start: 'bootstrapper' },
];

/**
 * O-02's "every bot ≤ 45%" and "at least one bot ≥ 10%": the highest FSP among the core block's cells only. The
 * difficulty and background blocks also run cautious and undercap, but O-02's sample is the core matrix (standard,
 * background none, LLC), so an easy or Operator cell must neither fail nor rescue it.
 */
function maxFsp(ctx: ScoreContext): Measured {
  let best: Measured = null;
  for (const { bot, start } of CORE_CELLS) {
    const c = cellFor(ctx, bot, start);
    const m = c === null ? null : fromEstimate(c.metrics.fsp);
    if (m !== null && (best === null || m.value > best.value)) best = m;
  }
  return best;
}

function differenceOf(a: Proportion | undefined, b: Proportion | undefined): Measured {
  if (a === undefined || b === undefined || a.value === null || b.value === null || a.n === 0 || b.n === 0) return null;
  const d = Math.abs(a.value - b.value);
  const se = Math.sqrt((a.value * (1 - a.value)) / a.n + (b.value * (1 - b.value)) / b.n);
  return { value: round6(d), ci: [round6(Math.max(0, d - Z95 * se)), round6(d + Z95 * se)] };
}

function stopsPerYear(ctx: ScoreContext): Measured {
  const c = cellFor(ctx, 'cautious', 'bootstrapper');
  if (c === null) return null;
  const means = c.metrics.byYear.map((y) => y.stops.mean).filter((v): v is number => v !== null);
  if (means.length === 0) return null;
  return { value: round6(means.reduce((a, b) => a + b, 0) / means.length), ci: null };
}

function passiveB5(ctx: ScoreContext): Measured {
  let worst: Measured = null;
  for (const start of ['bootstrapper', 'backedEquity', 'backedRoyalty'] as SimStart[]) {
    const m = fromEstimate(cellFor(ctx, 'passive', start)?.metrics.byYear[4]?.B);
    if (m !== null && (worst === null || m.value < worst.value)) worst = m;
  }
  return worst;
}

const S2 = (c: CellSummary) => c.metrics.byYear[1]?.S;

const EXTRACTORS: Readonly<Record<ExtractorId, (ctx: ScoreContext) => Measured>> = {
  unimplemented: () => null,
  'o01.pooledS2': (ctx) => pooledYear(ctx, S2),
  'o01.pooledB2': (ctx) => pooledYear(ctx, (c) => c.metrics.byYear[1]?.B),
  'o02.pooledFsp': (ctx) => pooledYear(ctx, (c) => c.metrics.fsp),
  'o02.maxFsp': maxFsp,
  'o03.undercapS2': (ctx) => fromEstimate(cellFor(ctx, 'undercap', 'bootstrapper')?.metrics.byYear[1]?.S),
  'o03.undercapB2': (ctx) => fromEstimate(cellFor(ctx, 'undercap', 'bootstrapper')?.metrics.byYear[1]?.B),
  'o06a.bootstrapper': (ctx) => fromEstimate(S2OfCautious(ctx, 'bootstrapper')),
  'o06a.backedEquity': (ctx) => fromEstimate(S2OfCautious(ctx, 'backedEquity')),
  'o06a.backedRoyalty': (ctx) => fromEstimate(S2OfCautious(ctx, 'backedRoyalty')),
  'o06a.inheritor': (ctx) => fromEstimate(S2OfCautious(ctx, 'inheritor')),
  'o13.stopsPerYear': stopsPerYear,
  'o13.weekMeanMs': (ctx) => (ctx.timing?.meanMs == null ? null : { value: ctx.timing.meanMs, ci: null }),
  'o13.weekP95Ms': (ctx) => (ctx.timing?.p95Ms == null ? null : { value: ctx.timing.p95Ms, ci: null }),
  'o18.entityGap': (ctx) => {
    const sole = cellFor(ctx, 'cautious', 'bootstrapper', { entity: 'soleProp' });
    const llc = cellFor(ctx, 'cautious', 'bootstrapper');
    return differenceOf(sole === null ? undefined : S2(sole), llc === null ? undefined : S2(llc));
  },
  'g03.passiveB5': passiveB5,
};

function S2OfCautious(ctx: ScoreContext, start: SimStart): Proportion | undefined {
  const c = cellFor(ctx, 'cautious', start);
  return c === null ? undefined : S2(c);
}

/** Timing clauses are scored on the console only; summary.json records them as N/A (timings are not deterministic). */
export const TIMING_EXTRACTORS: readonly ExtractorId[] = ['o13.weekMeanMs', 'o13.weekP95Ms'];

function scoreClause(c: TargetClause, ctx: ScoreContext): TargetResult {
  const rule = ruleFor(c, ctx.phase);
  const base = { id: c.id, target: c.target, applicability: rule?.status ?? null, band: rule?.band ?? null };
  if (rule === null) return { ...base, value: null, ci: null, status: 'N/A', note: `no targets gate P${ctx.phase}` };
  if (rule.status === '—')
    return { ...base, value: null, ci: null, status: 'N/A', note: `not applicable in P${ctx.phase}` };
  const m = EXTRACTORS[c.extractor](ctx);
  if (m === null) {
    const why =
      c.extractor === 'unimplemented'
        ? 'extractor not implemented yet'
        : TIMING_EXTRACTORS.includes(c.extractor) && ctx.timing === null
          ? 'timing: see timing.json'
          : 'cells not in this run';
    return { ...base, value: null, ci: null, status: 'N/A', note: why };
  }
  const status: Status = rule.band === null ? 'INFO' : bandStatus(rule.band, m.value, m.ci);
  return { ...base, value: m.value, ci: m.ci, status, note: rule.status === 'R' ? 'reported' : null };
}

export function scoreTargets(ctx: ScoreContext, targets: readonly TargetClause[] = TARGETS): TargetResult[] {
  return targets.map((t) => scoreClause(t, ctx));
}

/** Target-level status: the worst of its clauses (§3.0). */
export function targetStatuses(results: readonly TargetResult[]): Record<string, Status> {
  const by: Record<string, Status[]> = {};
  for (const r of results) (by[r.target] ??= []).push(r.status);
  const out: Record<string, Status> = {};
  for (const t of Object.keys(by).sort()) out[t] = worstStatus(by[t] as Status[]);
  return out;
}

// ------------------------------------------------------------------------------------------ §6.7 baseline

export interface BaselineDelta {
  id: string;
  before: Status | null;
  after: Status;
  /** A gating clause whose status got worse (PASS → AT-RISK → FAIL). */
  worsened: boolean;
  /** FAIL now and not FAIL in the baseline (or no baseline). */
  newFail: boolean;
  /** |Δ| in combined standard errors, when both sides carry an interval. */
  movedSe: number | null;
}

const RANK: Partial<Record<Status, number>> = { PASS: 0, 'AT-RISK': 1, FAIL: 2 };

function seOf(ci: [number, number] | null): number | null {
  return ci === null ? null : (ci[1] - ci[0]) / 2 / Z95;
}

export function compareWithBaseline(
  current: readonly TargetResult[],
  baseline: readonly TargetResult[] | null,
): BaselineDelta[] {
  const before: Record<string, TargetResult> = {};
  for (const b of baseline ?? []) before[b.id] = b;
  return current.map((r) => {
    const b = before[r.id];
    const rb = b === undefined ? undefined : RANK[b.status];
    const ra = RANK[r.status];
    let movedSe: number | null = null;
    if (b !== undefined && b.value !== null && r.value !== null) {
      const s0 = seOf(b.ci);
      const s1 = seOf(r.ci);
      if (s0 !== null && s1 !== null && s0 + s1 > 0)
        movedSe = round6(Math.abs(r.value - b.value) / Math.sqrt(s0 * s0 + s1 * s1));
    }
    return {
      id: r.id,
      before: b?.status ?? null,
      after: r.status,
      worsened: r.applicability === 'G' && rb !== undefined && ra !== undefined && ra > rb,
      newFail: r.status === 'FAIL' && b?.status !== 'FAIL',
      movedSe,
    };
  });
}

/** §6.1 / §6.7: the run fails on a new FAIL or a worsened status among this phase's gating clauses. */
export function gatingFailures(results: readonly TargetResult[], deltas: readonly BaselineDelta[]): string[] {
  const gating: Record<string, boolean> = {};
  for (const r of results) gating[r.id] = r.applicability === 'G';
  return deltas.filter((d) => gating[d.id] === true && (d.newFail || d.worsened)).map((d) => d.id);
}

// ----------------------------------------------------------------------------------------------- console

function fmtValue(r: TargetResult): string {
  if (r.value === null) return 'n/a';
  const pct = r.band !== null && r.band.text.includes('%') && !r.band.text.includes('$');
  const f = (x: number) => (pct ? `${(100 * x).toFixed(1)}%` : Math.abs(x) >= 1000 ? x.toFixed(0) : x.toPrecision(4));
  return r.ci === null ? f(r.value) : `${f(r.value)} [${f(r.ci[0])}–${f(r.ci[1])}]`;
}

function padTo(s: string, w: number): string {
  return s.length >= w ? `${s} ` : s + ' '.repeat(w - s.length);
}

export function formatScorecard(
  phase: number,
  results: readonly TargetResult[],
  deltas: readonly BaselineDelta[],
): string[] {
  const lines: string[] = [];
  const byId: Record<string, BaselineDelta> = {};
  for (const d of deltas) byId[d.id] = d;
  lines.push(`Scorecard, phase ${phase} (BALANCE §3.0 rules; bands from §7)`);
  if (phase < 1) lines.push('  no targets gate P0: BALANCE §7 starts at P1, so every clause is N/A');
  lines.push(
    `  ${padTo('ID', 22)}${padTo('§7', 4)}${padTo('band', 18)}${padTo('measured [95%]', 30)}${padTo('status', 9)}change`,
  );
  for (const r of results) {
    const d = byId[r.id];
    const change =
      d === undefined || d.before === null
        ? '—'
        : d.before === r.status
          ? d.movedSe !== null && d.movedSe > 2
            ? `moved ${d.movedSe.toFixed(1)} SE`
            : 'same'
          : `${d.before} → ${r.status}`;
    const status = r.applicability === 'R' && r.status !== 'N/A' ? `(${r.status})` : r.status;
    lines.push(
      `  ${padTo(r.id, 22)}${padTo(r.applicability ?? '—', 4)}${padTo(r.band?.text ?? '—', 18)}${padTo(fmtValue(r), 30)}${padTo(status, 9)}${change}`,
    );
  }
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  lines.push(
    `  clauses: ${results.length} · ${(['PASS', 'AT-RISK', 'FAIL', 'INFO', 'N/A'] as Status[]).map((s) => `${s} ${counts[s] ?? 0}`).join(' · ')}`,
  );
  return lines;
}
