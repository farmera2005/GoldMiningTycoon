// The scrambler registry (D-2.58; S13-12, P1 contract §11 item 4): one scrambler per section with hidden fields,
// composed here; retained reports are scrambled too. The twin's behaviour on the world truth is in catalog.test.ts.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, newGame, type CalcNode, type WeekReport } from '../../src/engine';
import { emptyWeekRecords } from '../../src/engine/turn/week';
import { SCRAMBLERS, scrambleHidden, scrambleReportHidden, withoutHidden, withoutReportHidden } from './scramble';

const STATE = newGame(defaultNewGameSetup({ companyName: 'Scramble Registry' }), 'scramble-registry');

describe('the scrambler registry', () => {
  it('registers every scrambler file once, named for its section', () => {
    const files = readdirSync(new URL('./scramblers/', import.meta.url))
      .filter((f) => /^s\d\d\.ts$/.test(f))
      .map((f) => f.slice(0, 3))
      .sort();
    expect(SCRAMBLERS.map((d) => d.id)).toEqual(files);
    for (const d of SCRAMBLERS) {
      expect(d.id, d.id).toBe(`s${String(d.section).padStart(2, '0')}`);
      expect(d.covers.length, d.id).toBeGreaterThan(0);
    }
  });

  it('has a scrambler for every P1 owner of hidden fields (§1, §3, §4, §5, §7, §8, §10; §9 none, S09-20)', () => {
    expect(SCRAMBLERS.map((d) => d.section)).toEqual([1, 3, 4, 5, 7, 8, 10]);
  });

  it('each scrambler leaves everything its strip does not cover unchanged', () => {
    for (const d of SCRAMBLERS) {
      const twin = d.scramble(JSON.parse(JSON.stringify(STATE)) as typeof STATE, `seed-${d.id}`);
      const a = JSON.parse(JSON.stringify(STATE)) as Record<string, unknown>;
      const b = JSON.parse(JSON.stringify(twin)) as Record<string, unknown>;
      d.strip(a);
      d.strip(b);
      expect(b, d.id).toEqual(a);
    }
    expect(withoutHidden(scrambleHidden(STATE, 'x'))).toEqual(withoutHidden(STATE));
  });
});

describe('scrambleReportHidden (S13-12)', () => {
  const leaf = (label: string, value: number, hidden = false): CalcNode =>
    hidden ? { label, value, unit: 'rawOz', hidden: true } : { label, value, unit: 'rawOz' };
  const report: WeekReport = {
    turn: 5,
    alerts: [],
    stopCandidates: [],
    ops: {},
    records: emptyWeekRecords(),
    calc: {
      'ops/contained/clm_000001': {
        label: 'Contained gold',
        value: 12,
        unit: 'rawOz',
        hidden: true,
        knownAlt: leaf('At your P50 grade', 10),
        children: [leaf('Pay washed', 1_000), leaf('True grade', 0.012, true)],
      },
      'finance/cashOnHand/company': leaf('Cash', 400_000),
    },
  };

  it('moves every hidden value (and its hidden subtree) and nothing visible', () => {
    const twin = scrambleReportHidden(report, 'r');
    const contained = twin.calc?.['ops/contained/clm_000001'] as CalcNode;
    expect(contained.value).not.toBe(12);
    expect(contained.children?.map((c) => c.value)).not.toEqual([1_000, 0.012]);
    expect(contained.knownAlt).toEqual(leaf('At your P50 grade', 10));
    expect(twin.calc?.['finance/cashOnHand/company']).toEqual(leaf('Cash', 400_000));
    expect(withoutReportHidden(twin)).toEqual(withoutReportHidden(report));
    expect(scrambleReportHidden(report, 'r')).toEqual(twin);
    expect(scrambleReportHidden(report, 's')).not.toEqual(twin);
  });

  it('renders a hidden node as its knownAlt, or drops it', () => {
    const visible = withoutReportHidden(report);
    expect(visible.calc?.['ops/contained/clm_000001']).toEqual(leaf('At your P50 grade', 10));
    const noAlt = withoutReportHidden({ ...report, calc: { k: leaf('Truth', 1, true) } });
    expect(noAlt.calc).toEqual({});
  });
});
