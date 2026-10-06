// genWater (DESIGN §3.3.4): the recorded senior right never exceeds the claim's low flow (§3.18), and it is the last
// draw on the stream, so a right retune changes no physical water field.
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { rng, type Rng } from '../../core/rng';
import type { GenClaim, GenCreek, GenDistrict } from './genTypes';
import { snapshotGenParams, templateOf } from './params';
import type { ClaimWater, GeoGenParams, RegionTemplateId } from './types';
import { genWater, lowFlowGpm } from './water';

const BASE_GP = snapshotGenParams(baseTuning, ['northernFederal', 'aridFederal']);
/** Every recent-operator claim rolls a right, so each draw exercises the cap. */
const GP: GeoGenParams = { ...BASE_GP, water: { ...BASE_GP.water, rightStubP: { subarctic: 1, arid: 1 } } };

function water(r: Rng, templateId: RegionTemplateId, upstreamMi: number, gp: GeoGenParams = GP): ClaimWater {
  const d = { tpl: templateOf(gp, templateId) } as unknown as GenDistrict;
  const K = { midRow: 0, depositType: 'creek' } as unknown as GenClaim;
  const c = { upstreamMiAtRow: [upstreamMi] } as unknown as GenCreek;
  return genWater(r, K, d, c, 'recentCat', 30, gp);
}

/** An Rng that answers its first `n` method calls from `a` and every later one from `b`. */
function switchAfter(n: number, a: Rng, b: Rng): Rng {
  let calls = 0;
  return new Proxy(a, {
    get(_target, prop): unknown {
      if (prop === 'drawCount') return a.drawCount + b.drawCount;
      const src = calls < n ? a : b;
      const v: unknown = Reflect.get(src, prop);
      if (typeof v !== 'function') return v;
      return (...args: unknown[]): unknown => {
        calls++;
        return (v as (...xs: unknown[]) => unknown).apply(src, args);
      };
    },
  });
}

describe('the recorded senior water right (§3.3.4)', () => {
  it('never exceeds the stored claim’s low flow, including when the low flow binds at a hundredths digit ≥ 5', () => {
    let binding = 0;
    let roundsUp = 0;
    for (let k = 0; k < 4000; k++) {
      // 0.2–0.8 upstream miles: a low flow of ≈ 10–45 gpm, below U(50, 300), so the cap binds.
      const w = water(rng('right-cap', 'world', 'water', k), 'northernFederal', 0.2 + (k % 7) / 10);
      const right = w.rightStub;
      if (right === undefined || right.source !== 'surface') throw new Error('expected a surface right');
      const cap = lowFlowGpm(w, GP);
      expect(right.gpm).toBeLessThanOrEqual(cap);
      if (right.gpm === cap) binding++;
      if (Math.round(cap * 10) / 10 > cap) roundsUp++;
    }
    expect(binding).toBeGreaterThan(3500);
    // The case a half-up rounding to 0.1 gpm got wrong (e.g. low flow 54.36 recorded as 54.4) is well represented.
    expect(roundsUp).toBeGreaterThan(1000);
  });

  it('records a drawn right to 0.1 gpm when the low flow does not bind, and a groundwater right uncapped', () => {
    for (let k = 0; k < 200; k++) {
      const w = water(rng('right-free', 'world', 'water', k), 'northernFederal', 40);
      const gpm = w.rightStub?.gpm ?? NaN;
      expect(gpm).toBeGreaterThanOrEqual(50);
      expect(gpm).toBeLessThanOrEqual(300);
      expect(Math.round(gpm * 10) / 10).toBe(gpm);
    }
    let groundwater = 0;
    for (let k = 0; k < 200; k++) {
      const w = water(rng('right-gw', 'world', 'water', k), 'aridFederal', 0);
      if (w.sourceKind !== 'none') continue;
      groundwater++;
      expect(w.rightStub?.source).toBe('groundwater');
      expect(Math.round((w.rightStub?.gpm ?? NaN) * 10) / 10).toBe(w.rightStub?.gpm);
    }
    expect(groundwater).toBeGreaterThan(100);
  });

  it.each([
    ['northernFederal', 3],
    ['aridFederal', 6],
  ] as const)('is drawn last on the %s stream: after its %i physical draws only the right changes', (templateId, n) => {
    let rightChanged = 0;
    for (let k = 0; k < 100; k++) {
      const pure = water(rng('last', 'world', 'water', k), templateId, 3);
      const switched = water(
        switchAfter(n, rng('last', 'world', 'water', k), rng('last-other', 'world', 'water', k)),
        templateId,
        3,
      );
      const { rightStub: ra, ...physA } = pure;
      const { rightStub: rb, ...physB } = switched;
      expect(physB).toEqual(physA);
      if (JSON.stringify(ra) !== JSON.stringify(rb)) rightChanged++;
    }
    expect(rightChanged).toBeGreaterThan(50);
  });
});
