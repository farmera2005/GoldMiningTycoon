// DESIGN §7 7.6.1 strip capacity and the 7.8 worked example "the D8 is the only thing keeping up with stripping".
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { pushFactorOf } from './ground';
import {
  allocateStripWork,
  clearingDozerHours,
  pushDistanceFt,
  pushFactor,
  stripNeedBcy,
  stripRate,
  type StripGround,
  type StripMachineInput,
  type StripRate,
} from './strip';
import { DESIGN_PARAMS as P } from './testing/designTuning';

const U = 0.8993; // the 7.8 week's usable share
const HOURS = 66;
const PUSH = pushDistanceFt(1, true, P); // one column wide, overburden to a dump
const GROUND: StripGround = { pushFactor: pushFactorOf(PUSH, P), cementation: 0, permafrost: 0.6 };
const D8: StripMachineInput = { id: 'mch_000001', kind: 'dozerRipper', refRate: 250, u: U };
const D6: StripMachineInput = { id: 'mch_000002', kind: 'dozerNoRipper', refRate: 130, u: U };
// Two skimmed muck surfaces thaw √(2.0 × 0.7) = 1.183 ft each this week: 3,817 bcy.
const THAWED_POOL = 2 * Math.sqrt(1.4) * 1613;
const NEED = stripNeedBcy(14.5, 7.0, 3114, P);

/** A week as one allocation (capacities × 66 h). */
function weekly(machines: StripMachineInput[]): number {
  const rates = machines.map((m) => {
    const r = stripRate(m, GROUND, P);
    return { ...r, thawedCap: r.thawedCap * HOURS, mixCap: r.mixCap * HOURS };
  });
  const a = allocateStripWork(rates, THAWED_POOL, Number.POSITIVE_INFINITY, GROUND.permafrost);
  return a.thawedBcy + a.mixBcy;
}

/** A week hour by hour, the thawed pool released evenly over the scheduled hours. */
function hourly(machines: StripMachineInput[]): number {
  const rates = machines.map((m) => stripRate(m, GROUND, P));
  let pool = THAWED_POOL;
  let total = 0;
  for (let h = 0; h < HOURS; h++) {
    const share = pool / (HOURS - h);
    const a = allocateStripWork(rates, share, Number.POSITIVE_INFINITY, GROUND.permafrost);
    pool -= a.thawedBcy;
    total += a.thawedBcy + a.mixBcy;
  }
  return total;
}

describe('push factor and strip rates (7.6.1)', () => {
  it('one column to a dump: 200 ft push, factor 0.772', () => {
    expect(PUSH).toBe(200);
    expect(pushFactor(PUSH, P).value).toBeCloseTo(0.772, 3);
    expect(pushDistanceFt(3, false, P)).toBe(350);
  });

  it('D8 with ripper: 193.0 bcy/hr thawed, 80.4 on the 0.6-frozen mix; D6 without: 100.3 and 12.7', () => {
    const d8 = stripRate({ ...D8, u: 1 }, GROUND, P);
    const d6 = stripRate({ ...D6, u: 1 }, GROUND, P);
    expect(d8.thawedCap).toBeCloseTo(193.0, 1);
    expect(d8.mixCap).toBeCloseTo(80.4, 1);
    expect(d6.thawedCap).toBeCloseTo(100.3, 1);
    expect(d6.mixCap).toBeCloseTo(12.7, 1);
  });

  it('an excavator casts at 0.75; cementation slows every strip machine (s07 #19)', () => {
    const ex = stripRate({ id: 'mch_000003', kind: 'excavator', refRate: 150, u: 1 }, { ...GROUND, permafrost: 0 }, P);
    expect(ex.thawedCap).toBeCloseTo(112.5, 9);
    const cem = stripRate({ ...D8, u: 1 }, { ...GROUND, cementation: 0.3 }, P);
    expect(cem.thawedCap).toBeCloseTo(193.0 / 1.15, 0);
  });
});

describe('the D8 example (7.8)', () => {
  it('strip need = (14.5 / 7.28) × 3,114 = 6,202 bcy/week', () => {
    expect(NEED).toBeCloseTo(6202, 0);
  });

  it('standalone: D8 6,999 bcy (113%), D6 4,088 bcy (66%)', () => {
    expect(weekly([D8])).toBeCloseTo(6999, -1);
    expect(weekly([D6])).toBeCloseTo(4088, -1);
    expect(Math.round((weekly([D8]) / NEED) * 100)).toBe(113);
    expect(Math.round((weekly([D6]) / NEED) * 100)).toBe(66);
  });

  it('both, thawed pool to the D6 first: 8,860 bcy (143%), by week or hour by hour', () => {
    expect(weekly([D8, D6])).toBeCloseTo(8860, -1);
    expect(hourly([D8, D6])).toBeCloseTo(8860, -1);
    expect(hourly([D8])).toBeCloseTo(6999, -1);
    expect(Math.round((weekly([D8, D6]) / NEED) * 100)).toBe(143);
  });

  it('the thawed pool goes to the D6 and the D8 works the frozen mix', () => {
    const rates = [D8, D6].map((m) => stripRate(m, GROUND, P));
    const a = allocateStripWork(rates, 50, Number.POSITIVE_INFINITY, 0.6);
    expect(a.byMachine[1]!.thawedBcy).toBe(50);
    expect(a.byMachine[0]!.thawedBcy).toBe(0);
    expect(a.byMachine[0]!.timeUsed).toBeCloseTo(1, 12);
    expect(a.frozenBcy).toBeCloseTo(a.mixBcy * 0.6, 12);
  });
});

describe('allocation properties', () => {
  const arbRate = fc.record({
    kind: fc.constantFrom('dozerRipper' as const, 'dozerNoRipper' as const, 'excavator' as const),
    thawedCap: fc.double({ min: 0, max: 300, noNaN: true }),
    mixMult: fc.double({ min: 0.05, max: 1, noNaN: true }),
  });

  it('never exceeds availability or a machine hour, and conserves work', () => {
    fc.assert(
      fc.property(
        fc.array(arbRate, { maxLength: 5 }),
        fc.double({ min: 0, max: 800, noNaN: true }),
        fc.double({ min: 0, max: 800, noNaN: true }),
        (rs, thawed, mix) => {
          const rates: StripRate[] = rs.map((r, i) => ({
            id: `mch_${i}`,
            kind: r.kind,
            thawedCap: r.thawedCap,
            mixCap: r.thawedCap * r.mixMult,
            frozenMult: r.mixMult,
          }));
          const a = allocateStripWork(rates, thawed, mix, 0.5);
          expect(a.thawedBcy).toBeLessThanOrEqual(thawed + 1e-9);
          expect(a.mixBcy).toBeLessThanOrEqual(mix + 1e-9);
          for (const w of a.byMachine) {
            expect(w.timeUsed).toBeLessThanOrEqual(1);
            expect(w.thawedBcy).toBeGreaterThanOrEqual(0);
          }
          // Adding a machine never strips less.
          const more = allocateStripWork(
            [...rates, { id: 'mch_x', kind: 'dozerRipper', thawedCap: 50, mixCap: 15, frozenMult: 0.3 }],
            thawed,
            mix,
            0.5,
          );
          expect(more.thawedBcy + more.mixBcy).toBeGreaterThanOrEqual(a.thawedBcy + a.mixBcy - 1e-9);
        },
      ),
    );
  });

  it('clearing takes ops.clearDozerHrPerAcre dozer hours per acre', () => {
    expect(clearingDozerHours(2, P)).toBe(12);
  });

  it('push factor explanations cite their keys', () => {
    const c = pushFactor(200, P, EXPLAIN_ON).calc;
    expect(c?.children?.map((n) => n.source?.kind === 'tuning' && n.source.key)).toContain('ops.dozerPushExp');
  });
});
