import { describe, expect, it } from 'vitest';
import {
  EXPLAIN_OFF,
  EXPLAIN_ON,
  calcResult,
  drawNode,
  entityLeaf,
  lazyCalc,
  leaf,
  markHidden,
  node,
  tuningLeaf,
  type Calc,
  type ExplainCtx,
} from './calc';
import { hashValue } from './hash';

// A toy formula in the §2.8 style: value always computed, explanation only when asked.
function recoveryRate(ctx: ExplainCtx, base: number, feedPenalty: number): Calc {
  const value = base * feedPenalty;
  return calcResult(
    value,
    node(ctx, 'Recovery rate', 'product', 'pct', value, [
      tuningLeaf(ctx, 'ops.recovery.base', base, 'pct', 'Base recovery'),
      leaf(ctx, 'Feed penalty', feedPenalty, 'mult', { note: 'Plant fed at 118% of rated capacity' }),
    ]),
  );
}

describe('CalcNode builders (DESIGN §2.8)', () => {
  it('build nothing when explanations are off, and the value is identical either way', () => {
    const off = recoveryRate(EXPLAIN_OFF, 0.9, 0.95);
    const on = recoveryRate(EXPLAIN_ON, 0.9, 0.95);
    expect(off).toEqual({ value: 0.9 * 0.95 });
    expect('calc' in off).toBe(false);
    expect(on.value).toBe(off.value);
    expect(on.calc).toEqual({
      label: 'Recovery rate',
      value: 0.9 * 0.95,
      unit: 'pct',
      op: 'product',
      children: [
        { label: 'Base recovery', value: 0.9, unit: 'pct', source: { kind: 'tuning', key: 'ops.recovery.base' } },
        { label: 'Feed penalty', value: 0.95, unit: 'mult', note: 'Plant fed at 118% of rated capacity' },
      ],
    });
    expect(lazyCalc(EXPLAIN_OFF, () => ({ label: 'x', value: 1, unit: 'none' }))).toBeUndefined();
    expect(lazyCalc(EXPLAIN_ON, () => ({ label: 'x', value: 1, unit: 'none' }))).toEqual({
      label: 'x',
      value: 1,
      unit: 'none',
    });
  });

  it('drops undefined children and omits empty child lists', () => {
    expect(node(EXPLAIN_ON, 'Sum', 'sum', 'usd', 3, [undefined, leaf(EXPLAIN_OFF, 'x', 1, 'usd')])).toEqual({
      label: 'Sum',
      value: 3,
      unit: 'usd',
      op: 'sum',
    });
  });

  it('cites entities and RNG streams, and marks public-parameter draws', () => {
    expect(
      entityLeaf(EXPLAIN_ON, { kind: 'claim', id: 'clm_000042' }, 'Claim grade', 0.012, 'ozPerBcy')?.source,
    ).toEqual({
      kind: 'entity',
      ref: { kind: 'claim', id: 'clm_000042' },
    });
    const key = [28, 'mch_000003'];
    const draw = drawNode(EXPLAIN_ON, 'Failure roll', 0.31, 'prob', 'fleet-fail', key, [], true);
    expect(draw).toEqual({
      label: 'Failure roll',
      value: 0.31,
      unit: 'prob',
      op: 'draw',
      source: { kind: 'rng', stream: 'fleet-fail', key: [28, 'mch_000003'] },
      publicParams: true,
    });
    key.push('mutated');
    expect(draw?.source).toEqual({ kind: 'rng', stream: 'fleet-fail', key: [28, 'mch_000003'] });
    expect(drawNode(EXPLAIN_ON, 'Hidden roll', 1, 'prob', 'ops-grade', [1])?.publicParams).toBeUndefined();
  });

  it('tags hidden nodes with their player-knowledge alternative', () => {
    const known = leaf(EXPLAIN_ON, 'Contained gold (your P50)', 410, 'oz');
    const truth = markHidden(leaf(EXPLAIN_ON, 'Contained gold', 523, 'oz'), known);
    expect(truth).toEqual({ label: 'Contained gold', value: 523, unit: 'oz', hidden: true, knownAlt: known });
    expect(markHidden(undefined)).toBeUndefined();
  });

  it('never affects a state hash (explanations live outside state)', () => {
    const stateLike = { turn: 3, rate: recoveryRate(EXPLAIN_OFF, 0.8, 1).value };
    const withExplain = { turn: 3, rate: recoveryRate(EXPLAIN_ON, 0.8, 1).value };
    expect(hashValue(withExplain)).toBe(hashValue(stateLike));
  });
});
