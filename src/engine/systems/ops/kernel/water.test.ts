// DESIGN §7 7.6.6 water (7.23 "Water": the arid example, the hook applied once, bench stages) and the 7.2.1 plant-line
// water-sharing fixtures; 7.6.7 power (7.23 "Power: shed order is largest concentrator first").
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { allocatePower, generatorLoadFactor } from './power';
import { DESIGN_PARAMS as P } from './testing/designTuning';
import {
  MAX_WELLS_PER_CLAIM,
  circulatingGpm,
  drilledWellYieldGpm,
  freshShare,
  leanRateLimit,
  makeupFrac,
  pumpFlowGpm,
  pumpStages,
  recirculationShare,
  shareWater,
  sourceGpm,
  waterBalance,
  waterLimitedRate,
  waterNeedPerBcyHr,
  waterRatio,
  waterTruckSupply,
  wellCostUsd,
  wellDrilling,
  wellPumpGal,
  wellsSupplyGpm,
  type WaterBalanceInput,
} from './water';

const PUMP6 = { gpm: 1500, u: 1 };

describe('the arid worked example (7.6.6)', () => {
  const r = recirculationShare('closedLoop', 0.6, true, P);
  const q = waterNeedPerBcyHr({ clay: 0.3, prep: 'trommel', recycleShare: r, hasConcentrator: false }, P).value;
  const s = freshShare(r, makeupFrac('arid', P));
  const trucks = waterTruckSupply(1, 8, P);

  function rate(s3: number, wells: number[], nTrucks: number): number {
    const b = waterBalance(
      {
        s3AvailableGpm: s3,
        wellYieldsGpm: wells,
        streamFlowFactor: 1,
        waterAvailMult: 1,
        maxWaterGpm: null,
        waterTrucksPerDay: nTrucks,
        nearestFillMi: 8,
        benchLiftFt: 0,
        pumps: [PUMP6],
        freshShare: s,
      },
      P,
    ).value;
    return Math.min(50, waterLimitedRate(b.circGpm, q));
  }

  it('a 50 bcy/hr trommel on clay 0.3 in closed loop needs q = 27.3 gpm per bcy/hr; 205 gpm fresh at m 0.15', () => {
    expect(r).toBe(1);
    expect(q).toBeCloseTo(27.3, 9);
    expect(s).toBeCloseTo(0.15, 12);
    expect(50 * q * s).toBeCloseTo(204.75, 9);
  });

  it('a truck from 8 mi makes 0.88 loads/hr = 58.5 gpm', () => {
    expect(trucks.loadsPerHour).toBeCloseTo(0.877, 3);
    expect(trucks.gpm).toBeCloseTo(58.5, 1);
  });

  it('well only → 36.6; well + one truck → 50.0 (water allows 50.9); no well, three trucks → 42.9, four → 50.0', () => {
    expect(rate(0, [150], 0)).toBeCloseTo(36.6, 1);
    const b = waterBalance(
      {
        s3AvailableGpm: 0,
        wellYieldsGpm: [150],
        streamFlowFactor: 1,
        waterAvailMult: 1,
        maxWaterGpm: null,
        waterTrucksPerDay: 1,
        nearestFillMi: 8,
        benchLiftFt: 0,
        pumps: [PUMP6],
        freshShare: s,
      },
      P,
    ).value;
    expect(waterLimitedRate(b.circGpm, q)).toBeCloseTo(50.9, 1);
    expect(rate(0, [150], 1)).toBe(50);
    // DESIGN's 42.9 rounds from 3 × 58.5 gpm; unrounded, 3 × 58.48 gpm gives 42.84.
    expect(rate(0, [], 3)).toBeCloseTo(42.84, 2);
    expect(Math.abs(rate(0, [], 3) - 42.9)).toBeLessThan(0.07);
    expect(rate(0, [], 4)).toBe(50);
    // §3's median arid well (120 gpm) alone: 29.3 bcy/hr.
    expect(rate(0, [120], 0)).toBeCloseTo(29.3, 1);
  });

  it('a 180-ft well costs $25.8k; the second yields 0.7 × the first; no third', () => {
    expect(wellCostUsd(180, 1, P)).toBe(25800);
    expect(wellDrilling(180, 1, P).value).toEqual({ usd: 25800, weeks: 2 });
    expect(drilledWellYieldGpm(0, 150, P)).toBe(150);
    expect(drilledWellYieldGpm(1, 150, P)).toBeCloseTo(105, 12);
    expect(drilledWellYieldGpm(MAX_WELLS_PER_CLAIM, 150, P)).toBeNull();
    expect(wellPumpGal(60, 1, P)).toBeCloseTo(90, 12);
    expect(wellPumpGal(60, 0, P)).toBe(0);
  });
});

describe('sources, pumps and the availability hook (7.6.6, 7.23)', () => {
  it('uses §3 waterAvailableGpm as returned and applies the hook once, to drilled wells only', () => {
    // A spring claim: §3 has already halved its 200 gpm under a 0.5 hook.
    const springAsReturned = 100;
    const wells = wellsSupplyGpm([150], 1, 0.5);
    expect(wells).toBeCloseTo(75, 12);
    expect(sourceGpm(springAsReturned, wells, null, 0)).toBeCloseTo(175, 12);
    // A creek claim's supply is unchanged by the hook (§3 does not apply it to creeks; §7 never touches it).
    expect(sourceGpm(600, wellsSupplyGpm([], 1, 0.5), null, 0)).toBe(600);
  });

  it('a well yields (0.9 + 0.1 × min(sff, 1.5)) of its rating', () => {
    expect(wellsSupplyGpm([100], 0, 1)).toBeCloseTo(90, 12);
    expect(wellsSupplyGpm([100], 3, 1)).toBeCloseTo(105, 12);
  });

  it('a §6 cap limits the draw, not the trucks', () => {
    expect(sourceGpm(600, 0, 400, 50)).toBe(450);
  });

  it('a 120-ft bench lift needs 3 pump stages, which divide the pump flow', () => {
    expect(pumpStages(120, P)).toBe(3);
    expect(pumpStages(0, P)).toBe(1);
    expect(pumpFlowGpm([PUMP6], 3)).toBeCloseTo(500, 12);
  });

  it('discharge mode recycles the plan share up to ops.recycleMax; a frozen pond recycles nothing', () => {
    expect(recirculationShare('discharge', 0.6, true, P)).toBe(0.6);
    expect(recirculationShare('discharge', 0.95, true, P)).toBe(0.9);
    expect(recirculationShare('closedLoop', 0, false, P)).toBe(0);
    expect(freshShare(0, 0.12)).toBe(1);
  });

  it('lean water: up to W_water / 0.5, with ω = Q_circ / (rate × q)', () => {
    expect(leanRateLimit(30, P)).toBe(60);
    expect(waterRatio(800, 40, 25)).toBeCloseTo(0.8, 12);
    expect(waterRatio(2000, 40, 25)).toBe(1);
    expect(waterLimitedRate(100, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('adding a pump never lowers the water-limited rate (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            gpm: fc.double({ min: 0, max: 2000, noNaN: true }),
            u: fc.double({ min: 0, max: 1, noNaN: true }),
          }),
          {
            maxLength: 4,
          },
        ),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (pumps, src, s) => {
          const before = circulatingGpm(pumpFlowGpm(pumps, 1), src, s);
          const after = circulatingGpm(pumpFlowGpm([...pumps, PUMP6], 1), src, s);
          expect(after).toBeGreaterThanOrEqual(before);
        },
      ),
    );
  });

  it('explains the balance without changing it', () => {
    const input: WaterBalanceInput = {
      s3AvailableGpm: 600,
      wellYieldsGpm: [],
      streamFlowFactor: 1,
      waterAvailMult: 1,
      maxWaterGpm: null,
      waterTrucksPerDay: 0,
      nearestFillMi: 5,
      benchLiftFt: 0,
      pumps: [PUMP6],
      freshShare: 0.12,
    };
    const on = waterBalance(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(waterBalance(input, P).value);
    expect(on.calc?.value).toBe(on.value.circGpm);
  });
});

describe('plant lines share water (7.2.1, D-7.49)', () => {
  const q = 21; // tr75 on clay-free gravel in closed loop: 15 × 1.0 × 1.0 × 1.4
  const s = 0.12;
  const demand = 70 * q;

  it('two lines, one 6-inch pump → 35.71 each (71.43); two pumps → 70 each', () => {
    const circ1 = circulatingGpm(pumpFlowGpm([PUMP6], 1), 600, s);
    const one = shareWater([demand, demand], circ1).map((g) => g / q);
    expect(one[0]).toBeCloseTo(35.71, 2);
    expect(one[0]! + one[1]!).toBeCloseTo(71.43, 2);
    const circ2 = circulatingGpm(pumpFlowGpm([PUMP6, PUMP6], 1), 600, s);
    expect(shareWater([demand, demand], circ2).map((g) => g / q)).toEqual([70, 70]);
  });

  it('two pumps on a 300-gpm creek at m 0.12 → 59.52 each (119.05)', () => {
    const circ = circulatingGpm(pumpFlowGpm([PUMP6, PUMP6], 1), 300, s);
    const w = shareWater([demand, demand], circ).map((g) => g / q);
    expect(w[0]).toBeCloseTo(59.52, 2);
    expect(w[0]! + w[1]!).toBeCloseTo(119.05, 2);
  });

  it('a line with an empty pad takes no share and the other gets its full demand', () => {
    const circ = circulatingGpm(pumpFlowGpm([PUMP6], 1), 600, s);
    expect(shareWater([demand, 0], circ)).toEqual([1470, 0]);
  });

  it('allocations never exceed demand or the circulating flow (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 3000, noNaN: true }), { maxLength: 3 }),
        fc.double({ min: 0, max: 5000, noNaN: true }),
        (d, c) => {
          const a = shareWater(d, c);
          let sum = 0;
          a.forEach((x, i) => {
            expect(x).toBeLessThanOrEqual(d[i]! + 1e-9);
            sum += x;
          });
          expect(sum).toBeLessThanOrEqual(c + 1e-6);
        },
      ),
    );
  });
});

describe('power (7.6.7)', () => {
  it('sheds concentrators largest first until demand fits', () => {
    const a = allocatePower({
      supplyKw: 60,
      pumps: [],
      lines: [
        {
          lineId: 'L1',
          coreKw: 20,
          concentrators: [
            { id: 'mch_000010', kw: 15 },
            { id: 'mch_000011', kw: 30 },
            { id: 'mch_000012', kw: 10 },
          ],
        },
      ],
    });
    expect(a.lineRuns).toEqual([true]);
    expect(a.shedIds).toEqual(['mch_000011']);
    expect(a.servedKw).toBe(45);
  });

  it('80 kW against two 45 kW der150 cores runs L1 and stops L2', () => {
    const a = allocatePower({
      supplyKw: 80,
      pumps: [],
      lines: [
        { lineId: 'L1', coreKw: 45, concentrators: [] },
        { lineId: 'L2', coreKw: 45, concentrators: [] },
      ],
    });
    expect(a.lineRuns).toEqual([true, false]);
    expect(a.demandKw).toBe(90);
  });

  it('electric pumps are met first; a self-powered plant needs no generator', () => {
    const short = allocatePower({
      supplyKw: 10,
      pumps: [{ id: 'mch_000020', kw: 15 }],
      lines: [{ lineId: 'L1', coreKw: 0, concentrators: [] }],
    });
    expect(short.pumpsRun).toBe(false);
    expect(short.lineRuns).toEqual([false]);
    const diesel = allocatePower({ supplyKw: 0, pumps: [], lines: [{ lineId: 'L1', coreKw: 0, concentrators: [] }] });
    expect(diesel.lineRuns).toEqual([true]);
  });

  it('equal concentrators shed the higher id first', () => {
    const a = allocatePower({
      supplyKw: 30,
      pumps: [],
      lines: [
        {
          lineId: 'L1',
          coreKw: 0,
          concentrators: [
            { id: 'mch_000002', kw: 20 },
            { id: 'mch_000001', kw: 20 },
          ],
        },
      ],
    });
    expect(a.shedIds).toEqual(['mch_000002']);
  });

  it('generator load factor = clamp(demand / (0.75 kW), 0.35, 1.33)', () => {
    expect(generatorLoadFactor(75, 100)).toBe(1);
    expect(generatorLoadFactor(5, 100)).toBe(0.35);
    expect(generatorLoadFactor(200, 100)).toBe(1.33);
  });
});
