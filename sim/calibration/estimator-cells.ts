// Calibration cells and gates for the §4 estimator (DESIGN §4.22 "Calibration", §4.19 P0 gate): template × setting,
// old-timer kind, deep muck, 160-acre claims and the listing pool, each scored at every evidence mix. Gates per cell
// and mix: P10–P90 holds truth in 0.72–0.88 of claims; median ln(P50/truth) within ±0.10; block-level z sd within
// 0.85–1.15 (z = Φ⁻¹ of the truth's posterior CDF, which is N(0, 1) when calibrated, whatever the mixture's shape).
import { rng } from '../../src/engine/core/rng';
import { listingPoolWeights, type Claim, type ClaimId, type WorldSlice } from '../../src/engine/systems/world';
import { STAGES, type ClaimRun, type Stage } from './estimator-stages';

export const GATES = { coverLo: 0.72, coverHi: 0.88, biasAbs: 0.1, zsdLo: 0.85, zsdHi: 1.15 } as const;
/** Teeth test (§4.22 Listing pool): prior-only median bias with statusMult.listed = 1 minus the listed run. */
export const TEETH = { target: Math.log(1 / 0.92), tol: 0.02 } as const;

export type Population = 'held' | 'listed';

export function templateShort(templateId: string): string {
  return templateId === 'northernFederal' ? 'north' : templateId === 'aridFederal' ? 'arid' : templateId;
}

/** Cells a held claim belongs to (main cells use 20- and 40-acre claims; 160-acre claims have their own). */
export function heldCells(world: WorldSlice, claim: Claim): string[] {
  const d = world.districts[claim.districtId];
  if (d === undefined) return [];
  const t = templateShort(d.templateId);
  if (claim.acres === 160) return [`${t}.160ac`];
  if (claim.acres > 40) return [];
  const cells = [`${t}.${claim.setting}`, `${t}.ot.${claim.hidden.oldTimerKind}`];
  if (claim.hidden.depositType === 'deepMuck') cells.push(`${t}.deepMuck`);
  return cells;
}

export function listedCell(world: WorldSlice, claim: Claim): string | null {
  const d = world.districts[claim.districtId];
  if (d === undefined || claim.acres > 40) return null;
  return `${templateShort(d.templateId)}.listed`;
}

/**
 * Listing-pool membership (§3.7, §3.11): a held claim enters the calibration pool with probability ∝ its class's
 * steady-state listed share (truth's econClass is read for population selection only, never by the estimator).
 */
export function inListingPool(world: WorldSlice, claim: Claim, seed: string): boolean {
  const w = listingPoolWeights(world.genParams);
  const max = Math.max(w.uneconomic, w.marginal, w.good, w.excellent);
  const u = rng(seed, 'sample', 'calibrationPool', claim.id).next();
  return u < w[claim.hidden.econClass] / max;
}

export interface StageAcc {
  n: number;
  inBand: number;
  below: number;
  above: number;
  lnRatio: number[];
  zSum: number;
  zSq: number;
  zN: number;
  ms: number;
}

function newAcc(): StageAcc {
  return { n: 0, inBand: 0, below: 0, above: 0, lnRatio: [], zSum: 0, zSq: 0, zN: 0, ms: 0 };
}

export interface CellAcc {
  readonly cell: string;
  readonly population: Population;
  claims: number;
  readonly stages: Record<Stage, StageAcc>;
  /** Listed cells: prior-only ln(P50/truth) with the held prior (statusMult 1.0). */
  teethLnRatio: number[];
}

export function newCell(cell: string, population: Population): CellAcc {
  const stages = {} as Record<Stage, StageAcc>;
  for (const s of STAGES) stages[s] = newAcc();
  return { cell, population, claims: 0, stages, teethLnRatio: [] };
}

export function addRun(acc: CellAcc, run: ClaimRun): void {
  acc.claims++;
  for (const s of run.scores) {
    const a = acc.stages[s.stage];
    a.n++;
    if (s.truthOz < s.p10) a.below++;
    else if (s.truthOz > s.p90) a.above++;
    else a.inBand++;
    a.lnRatio.push(Math.log(s.p50 / s.truthOz));
    for (const z of s.blockZ) {
      a.zSum += z;
      a.zSq += z * z;
      a.zN++;
    }
    a.ms += s.ms;
  }
}

export interface StageResult {
  readonly stage: Stage;
  readonly n: number;
  readonly coverage: number;
  readonly coverLo: number;
  readonly coverHi: number;
  readonly belowP10: number;
  readonly aboveP90: number;
  readonly medianBias: number;
  readonly zMean: number;
  readonly zSd: number;
  readonly msPerEstimate: number;
  readonly pass: boolean;
  readonly failing: string[];
}

function median(xs: readonly number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : 0.5 * ((s[m - 1] as number) + (s[m] as number));
}

/** Wilson 95% interval for a proportion. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [NaN, NaN];
  const z = 1.959964;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [c - h, c + h];
}

export function stageResult(stage: Stage, a: StageAcc): StageResult {
  const coverage = a.n > 0 ? a.inBand / a.n : NaN;
  const [lo, hi] = wilson(a.inBand, a.n);
  const bias = median(a.lnRatio);
  const zMean = a.zN > 0 ? a.zSum / a.zN : NaN;
  const zSd = a.zN > 1 ? Math.sqrt(Math.max(0, a.zSq / a.zN - zMean * zMean)) : NaN;
  const failing: string[] = [];
  if (!(coverage >= GATES.coverLo && coverage <= GATES.coverHi)) failing.push('coverage');
  if (!(Math.abs(bias) <= GATES.biasAbs)) failing.push('bias');
  if (!(zSd >= GATES.zsdLo && zSd <= GATES.zsdHi)) failing.push('zsd');
  return {
    stage,
    n: a.n,
    coverage,
    coverLo: lo,
    coverHi: hi,
    belowP10: a.n > 0 ? a.below / a.n : NaN,
    aboveP90: a.n > 0 ? a.above / a.n : NaN,
    medianBias: bias,
    zMean,
    zSd,
    msPerEstimate: a.n > 0 ? a.ms / a.n : NaN,
    pass: failing.length === 0,
    failing,
  };
}

export interface CellResult {
  readonly cell: string;
  readonly population: Population;
  readonly claims: number;
  readonly stages: readonly StageResult[];
  readonly teeth?: { readonly delta: number; readonly pass: boolean };
  readonly pass: boolean;
}

export function cellResult(acc: CellAcc, stages: readonly Stage[]): CellResult {
  const rs = stages.map((s) => stageResult(s, acc.stages[s]));
  let teeth: CellResult['teeth'];
  if (acc.population === 'listed' && acc.teethLnRatio.length > 0) {
    const delta = median(acc.teethLnRatio) - median(acc.stages.prior.lnRatio);
    teeth = { delta, pass: Math.abs(delta - TEETH.target) <= TEETH.tol };
  }
  const pass = rs.every((r) => r.pass) && (teeth === undefined || teeth.pass);
  return { cell: acc.cell, population: acc.population, claims: acc.claims, stages: rs, ...(teeth !== undefined ? { teeth } : {}), pass };
}

export type { ClaimId };
