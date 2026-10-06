// The fast version of the §4 estimator calibration (DESIGN §4.22 "Calibration", §4.19 P0 gate) and the engine
// version of the §4.9 worked example: a small seeded sample of §3's engine generator with every gate widened. The
// full harness runs on demand: `npm run calibrate:estimator` (1,000 claims per cell; ESTIMATOR_CALIBRATION_CLAIMS
// here raises the sample, and from 400 claims the strict gates apply).
import { describe, expect, it } from 'vitest';
import { addRun, cellResult, GATES, newCell, type CellAcc } from '../../sim/calibration/estimator-cells';
import type { Stage } from '../../sim/calibration/estimator-stages';
import { runWorld } from '../../sim/calibration/estimator-world';

const CLAIMS = Number(process.env['ESTIMATOR_CALIBRATION_CLAIMS'] ?? 40);
const STRICT = CLAIMS >= 400;
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
const STAGES: Stage[] = ['prior', 'records', 'pans', 'pitFences', 'pitGrid', 'bulk', 'sonic', 'sonicBulk'];

interface StageTally {
  readonly classes: Record<string, number>;
  readonly spreads: number[];
}

function median(xs: readonly number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
}

function run(): { accs: Record<string, CellAcc>; creek: Record<Stage, StageTally> } {
  const accs: Record<string, CellAcc> = {};
  for (const c of CELLS) accs[c] = newCell(c, 'held');
  const creek = {} as Record<Stage, StageTally>;
  for (const s of STAGES) creek[s] = { classes: {}, spreads: [] };
  const open = (): string[] => CELLS.filter((c) => (accs[c] as CellAcc).claims < CLAIMS).map((c) => `held:${c}`);
  for (let w = 0; w < 400 && open().length > 0; w++) {
    const r = runWorld({ worldIndex: w, seedBase: 1000, stages: STAGES, populations: ['held'], openCells: open() });
    for (const cr of r.results) {
      const vb = cr.cells.includes('north.valleyBottom') && (accs['north.valleyBottom'] as CellAcc).claims < CLAIMS;
      for (const sc of cr.run.scores) {
        if (!vb) break;
        const t = creek[sc.stage];
        t.classes[sc.confidence] = (t.classes[sc.confidence] ?? 0) + 1;
        t.spreads.push(sc.p90 / sc.p10);
      }
      for (const c of cr.cells) {
        const acc = accs[c];
        if (acc !== undefined && acc.claims < CLAIMS) addRun(acc, cr.run);
      }
    }
  }
  return { accs, creek };
}

describe(`estimator calibration on §3's engine generator (${CLAIMS} claims per cell, ${STRICT ? 'strict' : 'loose'} gates)`, () => {
  const { accs, creek } = run();

  it('fills every cell', () => {
    for (const c of CELLS) expect((accs[c] as CellAcc).claims).toBe(CLAIMS);
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
        if (!ok) failed.push(`${c} ${s.stage}: cover ${s.coverage.toFixed(3)} bias ${s.medianBias.toFixed(3)} z sd ${s.zSd.toFixed(2)}`);
      }
    }
    expect(failed).toEqual([]);
  });

  // §4.9, on the engine's north creek claims: records and pans cut the spread, fences of pits reach inferred, the
  // bulk sample lifts claims to indicated, sonic alone stays inferred (the coarse gate) and sonic + bulk is indicated.
  it('tightens like the §4.9 worked example', () => {
    const spread = (s: Stage): number => median(creek[s].spreads);
    const share = (s: Stage, cls: string): number => (creek[s].classes[cls] ?? 0) / creek[s].spreads.length;
    expect(share('prior', 'speculative')).toBe(1);
    expect(spread('records')).toBeLessThan(spread('prior'));
    expect(spread('pans')).toBeLessThan(spread('records'));
    expect(spread('pitFences')).toBeLessThan(spread('pans'));
    expect(spread('pitGrid')).toBeLessThan(spread('pitFences'));
    expect(share('pitFences', 'speculative')).toBeLessThan(0.6);
    expect(share('bulk', 'indicated')).toBeGreaterThan(share('pitGrid', 'indicated'));
    expect(share('sonic', 'indicated') + share('sonic', 'measured')).toBe(0);
    expect(share('sonic', 'inferred')).toBeGreaterThan(0.9);
    expect(share('sonicBulk', 'indicated')).toBeGreaterThan(0.3);
  });
}, 300_000);
