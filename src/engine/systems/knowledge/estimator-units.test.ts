// Hand-computed fixtures of DESIGN §4.22 that need no world: the 4.4.7 measurement formulas, the confidence-gate
// boundaries of 4.8, the 4.10.2 selection offsets and the selection variance, and the 4.5.3 coarse-ratio prior.
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { MG_PER_OZ } from '../world/constants';
import { snapshotGenParams } from '../world/params';
import { classifyConfidence, type GateValues } from './confidence';
import { lowerTruncVar, selectionOffsets, upperTruncVar } from './depletion';
import { methodSpec } from './methods';
import { estimatorParams } from './params';
import { coarseRatioPrior } from './prior';
import { compositeObservation, type CompositePart } from './rows';
import type { Mass4 } from './samples';
import type { MethodId } from './types';

const gp = snapshotGenParams(baseTuning, ['northernFederal', 'aridFederal']);
const P = estimatorParams(baseTuning, gp);

describe('measurement formulas: three samples of the same ground (§4.4.7)', () => {
  // True G = 0.010, mid-reach mix 25/40/27/8 (Gnc = 0.0075), Tg 5 ft + B 1.5 ft → Vb = 10,485 bcy.
  const G = 0.01;
  const mix = [0.25, 0.4, 0.27, 0.08] as const;
  const gnc = G * (1 - mix[0]);
  const ncShare: Mass4 = [0, mix[1] / 0.75, mix[2] / 0.75, mix[3] / 0.75];
  const Vb = 6.5 * 1613.33;
  const K = {
    particleMeanMg: P.phys.particleMeanMg,
    massCv: P.phys.massCv,
    deWijsAlpha: P.phys.deWijsAlpha,
    smallCount: P.smallCount,
    modelErrorLogSd: P.modelErrorLogSd,
    coarseBlockLogSd: P.coarseBlockLogSd,
  };
  const obs = (id: MethodId, V: number) => {
    const d = methodSpec(id).draw;
    if (d === null) throw new Error(`no draw row for ${id}`);
    const cap: Mass4 = [d.captureBySize.coarse, d.captureBySize.medium, d.captureBySize.fine, d.captureBySize.ultrafine];
    // The expected recovered class masses (no draw noise): Gnc × share × V × capture.
    const mass: Mass4 = [0, 1, 2, 3].map((c) => (c === 0 ? 0 : gnc * (ncShare[c] as number) * MG_PER_OZ * V * (cap[c] as number))) as Mass4;
    const part: CompositePart = {
      V,
      pm: 1,
      vPos: P.posFullLogSd * P.posFullLogSd,
      shared: 0,
      cap,
      volumeCv: d.volumeCv,
      weighCv: d.weighCv,
      mass,
    };
    const o = compositeObservation([part], Vb, gnc, 0, mix[0], ncShare, K);
    if (o === null) throw new Error('no observation');
    return { o, coarseCaught: (G * mix[0] * MG_PER_OZ * V * cap[0]) / 150 };
  };
  const pit = obs('excavatorPit', 5);
  const sonic = obs('sonic', 6.5 * 0.0073);
  const bulk = obs('bulkSample', 500);

  it('gives μ* 3.63 / 3.43 / 3.72 mg and N_eff 321 / 3.2 / 31,349', () => {
    expect(pit.o.muStar).toBeCloseTo(3.63, 2);
    expect(sonic.o.muStar).toBeCloseTo(3.43, 2);
    expect(bulk.o.muStar).toBeCloseTo(3.72, 2);
    expect(pit.o.nEff / 321).toBeCloseTo(1, 2);
    expect(sonic.o.nEff).toBeCloseTo(3.2, 1);
    expect(bulk.o.nEff / 31349).toBeCloseTo(1, 2);
  });

  it('gives local CV² 0.239 / 0.411 / 0.089 and measurement CV² 0.029 / 0.013 / 0.009', () => {
    expect(pit.o.cvL).toBeCloseTo(0.239, 3);
    expect(sonic.o.cvL).toBeCloseTo(0.411, 2);
    expect(bulk.o.cvL).toBeCloseTo(0.089, 3);
    expect(pit.o.cvM).toBeCloseTo(0.029, 3);
    expect(sonic.o.cvM).toBeCloseTo(0.013, 3);
    expect(bulk.o.cvM).toBeCloseTo(0.009, 3);
  });

  it('gives total v 0.268 / 0.580 / 0.117', () => {
    expect(pit.o.v).toBeCloseTo(0.268, 2);
    expect(sonic.o.v).toBeCloseTo(0.58, 1);
    expect(bulk.o.v).toBeCloseTo(0.117, 2);
  });

  it('expects 2.46 / 0.024 / 246 coarse particles caught', () => {
    expect(pit.coarseCaught).toBeCloseTo(2.46, 2);
    expect(sonic.coarseCaught).toBeCloseTo(0.024, 3);
    expect(bulk.coarseCaught / 246).toBeCloseTo(1, 2);
  });
});

describe('confidence gates at each class boundary (§4.8, §4.22)', () => {
  const c = P.conf;
  // An indicated case with every gate exactly at its limit.
  const atLimit: GateValues = {
    spread: 1.9,
    cov0: 0.7,
    cov2: 1,
    coarseSd: 0.06,
    processedBcy: 75,
    bedrockSamples: 20,
    productionBcy: 0,
    bulkBlocks: 0,
  };
  const cls = (g: Partial<GateValues>) => classifyConfidence({ ...atLimit, ...g }, c).cls;

  it('passes indicated exactly at the limits', () => {
    expect(cls({})).toBe('indicated');
  });
  it('base spread 1.90 is indicated, 1.91 inferred', () => {
    expect(cls({ spread: 1.9 })).toBe('indicated');
    expect(cls({ spread: 1.91 })).toBe('inferred');
  });
  it('cov0 0.70 is indicated, 0.69 inferred', () => {
    expect(cls({ cov0: 0.7 })).toBe('indicated');
    expect(cls({ cov0: 0.69 })).toBe('inferred');
  });
  it('processed 75 bcy is indicated, 74 inferred', () => {
    expect(cls({ processedBcy: 75 })).toBe('indicated');
    expect(cls({ processedBcy: 74 })).toBe('inferred');
  });
  it('coarseSd 0.060 is indicated, 0.061 inferred, and names the failing gate', () => {
    expect(cls({ coarseSd: 0.06 })).toBe('indicated');
    const r = classifyConfidence({ ...atLimit, coarseSd: 0.061 }, c);
    expect(r.cls).toBe('inferred');
    expect(r.failing).toContainEqual({ cls: 'indicated', gate: 'coarse' });
  });
  it('needs every lower class: a measured-grade spread with too few bedrock samples is speculative', () => {
    expect(cls({ spread: 1.2, bedrockSamples: 5 })).toBe('speculative');
  });
  it('measured needs a second bulk block or production', () => {
    const m = { spread: 1.4, cov0: 0.95, coarseSd: 0.03 };
    expect(cls({ ...m, bulkBlocks: 1 })).toBe('indicated');
    expect(cls({ ...m, bulkBlocks: 2 })).toBe('measured');
    expect(cls({ ...m, productionBcy: 5000 })).toBe('measured');
  });
});

describe('old-timer selection (§4.10.2)', () => {
  it('reproduces the DESIGN offset table from q, σ_block and ℓ', () => {
    const drift = selectionOffsets(0.48, 0.5, -0.87);
    expect(drift.worked).toBeCloseTo(-0.45, 2);
    expect(drift.passed).toBeCloseTo(-0.38, 2);
    const hand = selectionOffsets(0.3, 0.5, -1.05);
    expect(hand.worked).toBeCloseTo(-0.47, 2);
    expect(hand.passed).toBeCloseTo(-0.25, 2);
    const dry = selectionOffsets(0.5, 0.65, -0.23);
    expect(dry.worked).toBeCloseTo(0.29, 2);
    expect(dry.passed).toBeCloseTo(-0.52, 2);
    expect(selectionOffsets(1, 0.5, -1.97)).toEqual({ worked: -1.97, passed: 0 });
  });

  it('narrows the block field on selected blocks: Var[Z | top half] = 1 − 2/π', () => {
    expect(upperTruncVar(0.5)).toBeCloseTo(1 - 2 / Math.PI, 6);
    expect(lowerTruncVar(0.5)).toBeCloseTo(1 - 2 / Math.PI, 6);
    expect(upperTruncVar(1)).toBe(1);
    // A narrower selection leaves less spread among the selected.
    expect(upperTruncVar(0.1)).toBeLessThan(upperTruncVar(0.5));
    expect(lowerTruncVar(0.1)).toBeGreaterThan(lowerTruncVar(0.5));
    // Mixture identity: total variance = within + between, Var[Z] = 1.
    for (const q of [0.2, 0.33, 0.5, 0.7]) {
      const z = selectionOffsets(q, 1, 0);
      const within = q * upperTruncVar(q) + (1 - q) * lowerTruncVar(q);
      const between = q * z.worked * z.worked + (1 - q) * z.passed * z.passed;
      expect(within + between).toBeCloseTo(1, 6);
    }
  });
});

describe('coarse-ratio prior (§4.5.3)', () => {
  it('gives R0 0.327 and sd 0.30 on mid-reach ground', () => {
    const r = coarseRatioPrior({ coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 }, 0.25);
    expect(Math.exp(r.meanLnR)).toBeCloseTo(0.327, 3);
    expect(Math.sqrt(r.varLnR)).toBeCloseTo(0.3, 2);
  });
});
