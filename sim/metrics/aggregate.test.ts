import { describe, expect, it } from 'vitest';
import { aggregateCell } from './aggregate';
import { operating, syntheticResult } from './testing';

describe('aggregateCell (BALANCE §5, §6.6)', () => {
  const going = Array.from({ length: 6 }, (_, i) => syntheticResult({ index: i }, 2, operating));
  const liquidated = Array.from({ length: 2 }, (_, i) =>
    syntheticResult(
      {
        index: 6 + i,
        runStatus: 'lost',
        endReason: 'liquidated',
        lossCause: 'liquidated',
        liquidationCause: 'p1Counter',
        lostTurn: 70,
      },
      2,
      (n) => (n === 1 ? operating() : { carried: true, cashCents: 0, ownerNwCents: 12_000_000 }),
    ),
  );
  const retreated = Array.from({ length: 2 }, (_, i) =>
    syntheticResult({ index: 8 + i }, 2, (n) =>
      n === 1 ? operating() : { washedBcy: 0, claimsHeld: 0, fleetWashBcyHr: 0, cashCents: 1_000_000 },
    ),
  );
  const games = [...going, ...liquidated, ...retreated];
  const m = aggregateCell(games, 2, { cellKey: 'test', resamples: 200 });

  it('prints S_N, B_N, RS_N and the retreated share side by side, by year', () => {
    const y2 = m.byYear[1];
    expect(y2?.S).toMatchObject({ k: 6, n: 10, value: 0.6 });
    expect(y2?.B).toMatchObject({ k: 8, n: 10, value: 0.8 });
    expect(y2?.RS).toMatchObject({ k: 0, n: 10 });
    expect(y2?.retreated).toMatchObject({ k: 2, n: 10, value: 0.2 });
    expect(m.byYear[0]?.S.value).toBe(1);
  });

  it('splits BK_N into liquidations by cause and reorganization filings by status', () => {
    const y2 = m.byYear[1];
    expect(y2?.BK).toMatchObject({ k: 2, value: 0.2 });
    expect(y2?.liquidations.p1Counter).toMatchObject({ k: 2, value: 0.2 });
    expect(y2?.liquidations.filed).toMatchObject({ k: 0 });
    expect(y2?.liquidationsTotal.k).toBe(2);
    expect(y2?.reorgFilings.open.k).toBe(0);
    expect(m.lossCauses).toEqual({ liquidated: 2, ousted: 0, scenario: 0 });
  });

  it('reports owner NW and the NW ratio quantiles with intervals', () => {
    const y2 = m.byYear[1];
    // Sorted: two lost runs at $120k, then eight at $520k. Type-7 p10: h = 9 × 0.1 = 0.9 → x0 + 0.9 (x1 − x0) = $120k;
    // p25: h = 2.25 → x2 + 0.25 (x3 − x2) = $520k.
    expect(y2?.ownerNwUsd.p10.value).toBe(120_000);
    expect(y2?.ownerNwUsd.p50.value).toBe(520_000);
    expect(y2?.nwRatio.p50.value).toBe(1);
    expect(y2?.ownerNwUsd.p50.ci).not.toBeNull();
    expect(y2?.ownerAhead).toMatchObject({ k: 8, n: 10 });
  });

  it('counts stops only over years the run played in full and reports n/a figures as null', () => {
    expect(m.byYear[1]?.stops.mean).toBe(0);
    expect(m.byYear[0]?.cashCostUsdPerOzP50.value).toBeNull();
    expect(m.claimsProfitableShare.value).toBeNull();
    expect(m.districtSplit).toBeNull();
    expect(m.fsp).toMatchObject({ k: 0, n: 10 });
    expect(m.options).toEqual({ maxPlantLines: 0, smallCrewClaimWeeks: 0, poolMechanicWeeks: 0 });
    expect(m.rejectedActions).toBe(0);
    expect(m.abortedGames).toBe(0);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(aggregateCell(games, 2, { cellKey: 'test', resamples: 200 }))).toBe(JSON.stringify(m));
  });
});
