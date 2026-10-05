import { afterEach, describe, expect, it } from 'vitest';
import { clearAllMemos, createMemo, createWeakMemo, isMemoEnabled, memoNames, setMemoEnabled } from './memo';

afterEach(() => setMemoEnabled(true));

describe('createMemo (bounded LRU)', () => {
  it('caches, returns the same object for the same key, and counts hits and misses', () => {
    const m = createMemo<string, { v: number }>('test.same', 10);
    let computed = 0;
    const a = m.getOrCompute('k', () => ({ v: ++computed }));
    const b = m.getOrCompute('k', () => ({ v: ++computed }));
    expect(a).toBe(b);
    expect(computed).toBe(1);
    expect(m.stats.hits).toBe(1);
    expect(m.stats.misses).toBe(1);
  });

  it('evicts the least recently used entry beyond maxEntries', () => {
    const m = createMemo<string, number>('test.lru', 2);
    m.set('a', 1);
    m.set('b', 2);
    expect(m.get('a')).toBe(1); // a is now most recent
    m.set('c', 3); // evicts b
    expect(m.get('b')).toBeUndefined();
    expect(m.get('a')).toBe(1);
    expect(m.get('c')).toBe(3);
    expect(m.size).toBe(2);
    expect(m.stats.evictions).toBe(1);
    expect(() => createMemo('test.bad', 0)).toThrow(RangeError);
  });

  it('computes every time while disabled, and clears on toggle', () => {
    const m = createMemo<string, number>('test.toggle', 5);
    m.set('x', 1);
    setMemoEnabled(false);
    expect(isMemoEnabled()).toBe(false);
    expect(m.size).toBe(0);
    let n = 0;
    expect(m.getOrCompute('x', () => ++n)).toBe(1);
    expect(m.getOrCompute('x', () => ++n)).toBe(2);
    m.set('y', 9);
    expect(m.get('y')).toBeUndefined();
    setMemoEnabled(true);
    expect(m.getOrCompute('x', () => ++n)).toBe(3);
    expect(m.getOrCompute('x', () => ++n)).toBe(3);
  });

  it('clearAllMemos empties every registered cache, including weak ones', () => {
    const m = createMemo<string, number>('test.clearA', 5);
    const w = createWeakMemo<object, number>('test.clearW');
    const key = {};
    m.set('a', 1);
    w.set(key, 2);
    expect(w.get(key)).toBe(2);
    clearAllMemos();
    expect(m.get('a')).toBeUndefined();
    expect(w.get(key)).toBeUndefined();
    expect(memoNames()).toEqual(expect.arrayContaining(['test.clearA', 'test.clearW']));
  });

  it('a cold cache never changes a result (memo transparency in miniature)', () => {
    const m = createMemo<string, number>('test.transparent', 3);
    const f = (n: number) => m.getOrCompute(`sq:${n}`, () => n * n);
    const run = () => [1, 2, 3, 4, 1, 2, 5, 3].map(f);
    const warm = run();
    clearAllMemos();
    const cold = run();
    setMemoEnabled(false);
    const off = run();
    expect(cold).toEqual(warm);
    expect(off).toEqual(warm);
  });
});

describe('createWeakMemo', () => {
  it('keys on object identity', () => {
    const w = createWeakMemo<object, string>('test.weak');
    const a = {};
    const b = {};
    expect(w.getOrCompute(a, () => 'A')).toBe('A');
    expect(w.getOrCompute(a, () => 'other')).toBe('A');
    expect(w.getOrCompute(b, () => 'B')).toBe('B');
    setMemoEnabled(false);
    expect(w.get(a)).toBeUndefined();
  });
});
