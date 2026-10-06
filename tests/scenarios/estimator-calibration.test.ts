// The fast version of the §4 estimator calibration (DESIGN §4.22 "Calibration", §4.19 P0 gate) and the engine
// version of the §4.9 worked example: a seeded sample of §3's engine generator with every gate widened. The full
// harness runs on demand: `npm run calibrate:estimator` (1,000 claims per cell; ESTIMATOR_CALIBRATION_CLAIMS here
// raises the sample, and from 400 claims the strict gates apply).
//
// Sampling design. Claims of one district share its district and creek grade effects, so a cell filled from the first
// few worlds measures those few districts rather than the estimator: with 40 claims taken in id order (2–4 districts)
// a calibrated estimator failed the ±0.35 prior-stage bias band in 15–25% of draws per cell (cluster bootstrap over 75
// worlds; ≈ 80% for the whole test). Each world therefore gives each cell at most PER_WORLD claims, in a seeded random
// order, and the noisy early stages get the larger sample. With 150 claims at prior to pit grid and 60 at the bulk and
// sonic stages a calibrated estimator fails some band in about 0.5% of draws. The bands themselves are unchanged. The
// §4.9 progression follows every stage of the 150 north valley-bottom claims.
import { describe, expect, it } from 'vitest';
import { addRun, cellResult, GATES, heldCells, newCell, type CellAcc } from '../../sim/calibration/estimator-cells';
import {
  harnessContext,
  runClaim,
  STAGES,
  type ClaimRun,
  type Stage,
  type StageScore,
} from '../../sim/calibration/estimator-stages';
import { calibrationOrder, calibrationWorld } from '../../sim/calibration/estimator-world';
import type { Claim } from '../../src/engine/systems/world';

const CLAIMS = Number(process.env['ESTIMATOR_CALIBRATION_CLAIMS'] ?? 150);
const STRICT = CLAIMS >= 400;
/** Claims per cell at the bulk and sonic stages (the expensive ones, and the least noisy). */
const LATE_CLAIMS = STRICT ? CLAIMS : Math.min(CLAIMS, 60);
const PER_WORLD = 2;
const SEED_BASE = 1000;
const MAX_WORLDS = 2000;
const LOOSE = { coverLo: 0.6, coverHi: 0.97, biasAbs: 0.35, zsdLo: 0.75, zsdHi: 1.3 };
const BANDS = STRICT ? GATES : LOOSE;
const CELLS = [
  'north.valleyBottom',
  'north.bench',
  'north.noVisibleWorkings',
  'arid.fan',
  'arid.gulch',
  'arid.noVisibleWorkings',
] as const;
const EARLY: readonly Stage[] = ['prior', 'records', 'pans', 'pitFences', 'pitGrid'];
/** §4.9's claim: the cell whose claims the progression test follows (every stage on every claim). */
const PROGRESSION_CELL = 'north.valleyBottom';
const lateQuota = (cell: string): number => (cell === PROGRESSION_CELL ? CLAIMS : LATE_CLAIMS);
/** The inferred class's support gate (geology.confInferredMinBedrockSamples): fences that reach it reached bedrock. */
const FENCES_AT_BEDROCK = 6;

interface Sampled {
  readonly accs: Record<string, CellAcc>;
  /** Stage scores of every progression-cell claim, by stage. */
  readonly progression: ReadonlyArray<Partial<Record<Stage, StageScore>>>;
  readonly worlds: number;
}

function earlyOnly(run: ClaimRun): ClaimRun {
  return { ...run, scores: run.scores.filter((s) => EARLY.includes(s.stage)) };
}

function sample(): Sampled {
  const accs: Record<string, CellAcc> = {};
  const late: Record<string, number> = {};
  for (const c of CELLS) {
    accs[c] = newCell(c, 'held');
    late[c] = 0;
  }
  const progression: Partial<Record<Stage, StageScore>>[] = [];
  const open = (): boolean => CELLS.some((c) => (accs[c] as CellAcc).claims < CLAIMS);
  let w = 0;
  for (; w < MAX_WORLDS && open(); w++) {
    const seed = String(SEED_BASE + w);
    const world = calibrationWorld(seed);
    const h = harnessContext(world);
    const taken: Record<string, number> = {};
    for (const id of calibrationOrder(world, seed)) {
      const claim = world.claims[id] as Claim;
      if (claim.status !== 'heldNpc') continue;
      const cells = heldCells(world, claim).filter(
        (c) => accs[c] !== undefined && (accs[c] as CellAcc).claims < CLAIMS && (taken[c] ?? 0) < PER_WORLD,
      );
      if (cells.length === 0) continue;
      const wantsLate = cells.some((c) => (late[c] as number) < lateQuota(c));
      const run = runClaim(world, id, seed, h, 'held', wantsLate ? STAGES : EARLY);
      for (const c of cells) {
        taken[c] = (taken[c] ?? 0) + 1;
        const useLate = wantsLate && (late[c] as number) < lateQuota(c);
        if (useLate) late[c] = (late[c] as number) + 1;
        const counted = useLate ? run : earlyOnly(run);
        addRun(accs[c] as CellAcc, counted, w);
        if (c === PROGRESSION_CELL) {
          const byStage: Partial<Record<Stage, StageScore>> = {};
          for (const s of counted.scores) byStage[s.stage] = s;
          progression.push(byStage);
        }
      }
    }
  }
  return { accs, progression, worlds: w };
}

function median(xs: readonly number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

describe(`estimator calibration on §3's engine generator (${CLAIMS} claims per cell, ${LATE_CLAIMS} at bulk and sonic, ≤ ${PER_WORLD} per world, ${STRICT ? 'strict' : 'loose'} gates)`, () => {
  const { accs, progression } = sample();
  const at = (s: Stage): StageScore[] => progression.map((p) => p[s]).filter((x): x is StageScore => x !== undefined);

  it('fills every cell', () => {
    for (const c of CELLS) {
      expect((accs[c] as CellAcc).claims, c).toBe(CLAIMS);
      for (const s of STAGES) {
        expect((accs[c] as CellAcc).stages[s].n, `${c} ${s}`).toBe(EARLY.includes(s) ? CLAIMS : lateQuota(c));
      }
    }
  });

  it('holds coverage, median bias and block z sd in band at every evidence mix', () => {
    const failed: string[] = [];
    for (const c of CELLS) {
      for (const s of cellResult(accs[c] as CellAcc, STAGES).stages) {
        const ok =
          s.coverage >= BANDS.coverLo &&
          s.coverage <= BANDS.coverHi &&
          Math.abs(s.medianBias) <= BANDS.biasAbs &&
          s.zSd >= BANDS.zsdLo &&
          s.zSd <= BANDS.zsdHi;
        if (!ok)
          failed.push(
            `${c} ${s.stage}: cover ${s.coverage.toFixed(3)} bias ${s.medianBias.toFixed(3)} z sd ${s.zSd.toFixed(2)}`,
          );
      }
    }
    expect(failed).toEqual([]);
  });

  // §4.9, on the engine's north valley-bottom claims: records and pans cut the spread; two fences of pits do most of
  // the work, and on ground they can reach (§4.9's claim: bedrock within the 22-ft reach on most blocks) take the claim
  // to inferred; the bulk sample lifts claims to indicated; sonic alone stays inferred (the coarse gate) and sonic +
  // bulk is indicated. Deep ground (deep muck, or bedrock beyond reach) stays speculative after pits: §4.9's
  // deep-muck variant, where pits buy nothing.
  it('tightens like the §4.9 worked example', () => {
    const spread = (s: Stage): number => median(at(s).map((x) => x.p90 / x.p10));
    const share = (s: Stage, cls: string, xs: readonly StageScore[] = at(s)): number =>
      xs.filter((x) => x.confidence === cls).length / xs.length;
    expect(share('prior', 'speculative')).toBe(1);
    expect(spread('records')).toBeLessThan(spread('prior'));
    expect(spread('pans')).toBeLessThan(spread('records'));
    expect(spread('pitFences')).toBeLessThan(spread('pans'));
    expect(spread('pitGrid')).toBeLessThan(spread('pitFences'));
    expect(share('pitFences', 'speculative')).toBeLessThan(share('pans', 'speculative') - 0.15);
    const reached = at('pitFences').filter((x) => x.bedrockSamples >= FENCES_AT_BEDROCK);
    expect(reached.length).toBeGreaterThanOrEqual(20);
    expect(share('pitFences', 'speculative', reached)).toBeLessThan(0.25);
    const late = progression.filter((p) => p.bulk !== undefined);
    const lateAt = (s: Stage): StageScore[] => late.map((p) => p[s] as StageScore);
    expect(share('bulk', 'indicated', lateAt('bulk'))).toBeGreaterThan(
      share('pitGrid', 'indicated', lateAt('pitGrid')),
    );
    expect(share('sonic', 'indicated', lateAt('sonic')) + share('sonic', 'measured', lateAt('sonic'))).toBe(0);
    expect(share('sonic', 'inferred', lateAt('sonic'))).toBeGreaterThan(0.9);
    expect(share('sonicBulk', 'indicated', lateAt('sonicBulk'))).toBeGreaterThan(0.3);
  });
}, 600_000);
