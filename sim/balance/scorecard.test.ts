import { describe, expect, it } from 'vitest';
import { aggregateCell } from '../metrics/aggregate';
import { operating, syntheticResult } from '../metrics/testing';
import type { CellSummary } from '../report';
import type { SimStart } from '../setup';
import { buildMatrix, type MatrixCell } from './matrix';
import {
  acrossVariants,
  bandStatus,
  compareWithBaseline,
  formatScorecard,
  gatingFailures,
  scoreTargets,
  targetStatuses,
  worstStatus,
  type TargetResult,
} from './scorecard';
import { TARGETS } from './targets';

const band = (lo: number | null, hi: number | null) => ({ lo, hi, text: 'test' });

describe('§3.0 pass rules', () => {
  it('PASS inside the band, edges inclusive', () => {
    expect(bandStatus(band(0.6, 0.7), 0.65, [0.6, 0.7])).toBe('PASS');
    expect(bandStatus(band(0.6, 0.7), 0.6, null)).toBe('PASS');
    expect(bandStatus(band(0.6, 0.7), 0.7, null)).toBe('PASS');
  });

  it('AT-RISK outside the band when the crossed edge lies inside the 95% interval', () => {
    expect(bandStatus(band(0.6, 0.7), 0.58, [0.54, 0.62])).toBe('AT-RISK');
    expect(bandStatus(band(0.6, 0.7), 0.72, [0.68, 0.76])).toBe('AT-RISK');
    expect(bandStatus(band(0.75, null), 0.74, [0.7, 0.75])).toBe('AT-RISK');
  });

  it('FAIL when the band edge lies outside the interval, or there is no interval', () => {
    expect(bandStatus(band(0.6, 0.7), 0.5, [0.46, 0.54])).toBe('FAIL');
    expect(bandStatus(band(0.6, 0.7), 0.8, [0.76, 0.84])).toBe('FAIL');
    expect(bandStatus(band(null, 0.4), 0.45, [0.41, 0.49])).toBe('FAIL');
    expect(bandStatus(band(0.6, 0.7), 0.5, null)).toBe('FAIL');
  });

  it('treats an open edge as failing at the edge ("> 0")', () => {
    const open = { lo: 0, hi: null, loOpen: true, text: '> 0' };
    expect(bandStatus(open, 0, [-1, 1])).toBe('AT-RISK');
    expect(bandStatus(open, 0.01, null)).toBe('PASS');
    expect(bandStatus(open, -2, [-3, -1])).toBe('FAIL');
  });

  it('a multi-clause target takes its worst clause; variants passing in only one are AT-RISK', () => {
    expect(worstStatus(['PASS', 'AT-RISK', 'PASS'])).toBe('AT-RISK');
    expect(worstStatus(['PASS', 'FAIL', 'AT-RISK'])).toBe('FAIL');
    expect(worstStatus(['PASS', 'N/A'])).toBe('N/A');
    expect(worstStatus(['PASS', 'INFO'])).toBe('PASS');
    expect(worstStatus(['INFO', 'INFO'])).toBe('INFO');
    expect(worstStatus([])).toBe('N/A');
    expect(acrossVariants(['PASS', 'FAIL'])).toBe('AT-RISK');
    expect(acrossVariants(['PASS', 'PASS'])).toBe('PASS');
    expect(acrossVariants(['FAIL', 'AT-RISK'])).toBe('FAIL');
  });
});

function cell(bot: string, start: SimStart, s2Going: number, games = 100, rules = 1): CellSummary {
  const results = Array.from({ length: games }, (_, i) =>
    i < s2Going ? syntheticResult({ index: i }, 5, operating) : syntheticResult({ index: i }, 5),
  );
  return {
    bot,
    start,
    difficulty: 'standard',
    background: 'none',
    entity: 'llc',
    rules: rules as CellSummary['rules'],
    n: games,
    years: 5,
    seedBase: 0,
    tuningHash: 'x',
    metrics: aggregateCell(results, 5, { cellKey: `${bot}|${start}`, resamples: 50 }),
  };
}

describe('scoring', () => {
  it('scores every clause N/A in P0 ("no targets gate P0")', () => {
    const r = scoreTargets({ phase: 0, cells: [], timing: null });
    expect(r).toHaveLength(TARGETS.length);
    expect(r.every((x) => x.status === 'N/A' && x.applicability === null && x.note === 'no targets gate P0')).toBe(
      true,
    );
    expect(formatScorecard(0, r, compareWithBaseline(r, null)).join('\n')).toContain('no targets gate P0');
  });

  it('pools O-01 over the four starts with equal weight (Backed terms averaged)', () => {
    // S2 going concerns: Bootstrapper 60, Backed equity 70, Backed royalty 50, Inheritor 66 → (60 + 66)/3 + (70 + 50)/6 = 62.
    const cells = [
      cell('cautious', 'bootstrapper', 60),
      cell('cautious', 'backedEquity', 70),
      cell('cautious', 'backedRoyalty', 50),
      cell('cautious', 'inheritor', 66),
    ];
    const r = scoreTargets({ phase: 1, cells, timing: null });
    const s2 = r.find((x) => x.id === 'O-01.S2') as TargetResult;
    expect(s2.value).toBeCloseTo(0.62, 6);
    expect(s2.status).toBe('PASS');
    const b2 = r.find((x) => x.id === 'O-01.B2') as TargetResult;
    expect(b2.value).toBe(1);
    expect(b2.status).toBe('PASS');
    const a = r.find((x) => x.id === 'O-06a.backedRoyalty') as TargetResult;
    expect(a.value).toBe(0.5);
    expect(a.status).toBe('PASS'); // P1 band 45–85%
    expect(r.find((x) => x.id === 'O-13.weekMeanMs')?.note).toBe('timing: see timing.json');
    expect(r.find((x) => x.id === 'T-06.bcy')?.note).toBe('extractor not implemented yet');
  });

  it('marks a missing cell N/A and scores timing only when given', () => {
    const r = scoreTargets({
      phase: 1,
      cells: [cell('cautious', 'bootstrapper', 60)],
      timing: { weeks: 10, meanMs: 4, p95Ms: 2 },
    });
    expect(r.find((x) => x.id === 'O-01.S2')).toMatchObject({ status: 'N/A', note: 'cells not in this run' });
    expect(r.find((x) => x.id === 'O-13.weekMeanMs')).toMatchObject({ status: 'FAIL', value: 4 });
    expect(r.find((x) => x.id === 'O-13.weekP95Ms')).toMatchObject({ status: 'PASS' });
    expect(targetStatuses(r)['O-13']).toBe('FAIL');
  });

  it('scores G-03 from passive B5 and a not-yet-applicable target as N/A', () => {
    const r = scoreTargets({ phase: 1, cells: [cell('passive', 'bootstrapper', 0)], timing: null });
    expect(r.find((x) => x.id === 'G-03')).toMatchObject({ status: 'PASS', value: 1 });
    expect(r.find((x) => x.id === 'O-09.s2Loss')).toMatchObject({ status: 'N/A', applicability: '—' });
  });
});

describe('O-02 over the core block only (BALANCE §3.1, §6.4)', () => {
  /** A cell whose FSP is k / n: k games with year-1 net income > 0. */
  function fspCell(c: MatrixCell, k: number, n = 200): CellSummary {
    const results = Array.from({ length: n }, (_, i) =>
      syntheticResult({ index: i }, 2, (y) => (y === 1 ? { netIncomeCents: i < k ? 1 : -1 } : {})),
    );
    return {
      ...c,
      rules: 1,
      n,
      years: 2,
      seedBase: 0,
      tuningHash: 'x',
      metrics: aggregateCell(results, 2, {
        cellKey: `${c.bot}|${c.start}|${c.difficulty}|${c.background}`,
        resamples: 20,
      }),
    };
  }
  const blocks = buildMatrix(1, 1, { quick: false, games: 200 });
  const cellsOf = (id: string) => blocks.find((b) => b.id === id)?.cells ?? [];
  const score = (cells: CellSummary[]) => scoreTargets({ phase: 1, cells, timing: null });
  const result = (r: TargetResult[], id: string) => r.find((x) => x.id === id) as TargetResult;

  it('the core block is the 13 standard / background none / LLC cells', () => {
    expect(cellsOf('core')).toHaveLength(13);
    expect(cellsOf('difficulty').some((c) => c.bot === 'cautious' && c.difficulty === 'easy')).toBe(true);
    expect(cellsOf('backgrounds').every((c) => c.bot === 'cautious' && c.background !== 'none')).toBe(true);
  });

  it('every-bot ≤ 45% reads the core cells: an easy or Operator cell at 60% cannot fail it', () => {
    const core = cellsOf('core').map((c) => fspCell(c, 60)); // 30%
    for (const other of [...cellsOf('difficulty'), ...cellsOf('backgrounds')]) {
      const r = score([...core, fspCell(other, 120)]); // 60%
      expect(result(r, 'O-02.everyBot'), `${other.difficulty}/${other.background}`).toMatchObject({
        value: 0.3,
        status: 'PASS',
      });
    }
    expect(result(score(core), 'O-02.everyBot').value).toBe(0.3);
  });

  it('at-least-one-bot ≥ 10% reads the core cells: a difficulty or background cell cannot rescue it', () => {
    const core = cellsOf('core').map((c) => fspCell(c, 8)); // 4%
    expect(result(score(core), 'O-02.someBot')).toMatchObject({ value: 0.04, status: 'FAIL' });
    const easy = cellsOf('difficulty').find((c) => c.bot === 'cautious' && c.difficulty === 'easy') as MatrixCell;
    const operator = cellsOf('backgrounds').find((c) => c.background === 'operator') as MatrixCell;
    for (const other of [easy, operator]) {
      expect(result(score([...core, fspCell(other, 40)]), 'O-02.someBot')).toMatchObject({
        value: 0.04,
        status: 'FAIL',
      });
    }
  });

  it('a cell of another rules phase is not the run’s', () => {
    const core = cellsOf('core').map((c) => fspCell(c, 60));
    const p2 = { ...fspCell(cellsOf('core')[0] as MatrixCell, 160), rules: 2 as const };
    expect(result(score([...core, p2]), 'O-02.everyBot').value).toBe(0.3);
  });
});

describe('baseline comparison (§6.7)', () => {
  const res = (
    id: string,
    status: TargetResult['status'],
    value: number | null,
    ci: [number, number] | null,
    g: 'G' | 'R' = 'G',
  ): TargetResult => ({
    id,
    target: id.slice(0, 4),
    applicability: g,
    band: null,
    value,
    ci,
    status,
    note: null,
  });

  it('flags a worsened gating status and a new FAIL, and measures moves in standard errors', () => {
    const before = [
      res('O-01.S2', 'PASS', 0.65, [0.61, 0.69]),
      res('O-02.cautious', 'FAIL', 0.5, [0.46, 0.54]),
      res('O-04.noDominance', 'PASS', null, null, 'R'),
    ];
    const after = [
      res('O-01.S2', 'AT-RISK', 0.59, [0.55, 0.63]),
      res('O-02.cautious', 'FAIL', 0.5, [0.46, 0.54]),
      res('O-04.noDominance', 'FAIL', null, null, 'R'),
    ];
    const d = compareWithBaseline(after, before);
    expect(d[0]).toMatchObject({ before: 'PASS', after: 'AT-RISK', worsened: true, newFail: false });
    expect(d[0]?.movedSe).toBeGreaterThan(2);
    expect(d[1]).toMatchObject({ worsened: false, newFail: false });
    expect(d[2]).toMatchObject({ worsened: false, newFail: true });
    // Only gating clauses fail the run.
    expect(gatingFailures(after, d)).toEqual(['O-01.S2']);
  });

  it('without a baseline every gating FAIL is new', () => {
    const after = [res('O-01.S2', 'FAIL', 0.4, [0.36, 0.44]), res('O-03.S2', 'PASS', 0.2, [0.1, 0.3])];
    expect(gatingFailures(after, compareWithBaseline(after, null))).toEqual(['O-01.S2']);
  });
});
