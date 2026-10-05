// dmath accuracy against the host Math.* (tests may use Math.*; the engine may not). V8's Math functions are themselves
// fdlibm ports, so most results agree bit for bit; the bounds below are the DESIGN §2.14 / P0 brief targets.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as d from './dmath';
import { rng } from './rng';

const view = new DataView(new ArrayBuffer(8));
function ordered(x: number): bigint {
  view.setFloat64(0, x);
  const b = view.getBigInt64(0);
  return b < 0n ? -(b & 0x7fffffffffffffffn) : b;
}
/** Distance in units in the last place (0 for equal values, including NaN/NaN and +0/−0 treated as equal). */
function ulps(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) && Number.isNaN(b) ? 0 : Infinity;
  if (a === b) return 0;
  const diff = ordered(a) - ordered(b);
  return Number(diff < 0n ? -diff : diff);
}

function maxUlps(f: (x: number) => number, g: (x: number) => number, inputs: number[]): { max: number; at: number } {
  let max = 0;
  let at = NaN;
  for (const x of inputs) {
    const u = ulps(f(x), g(x));
    if (u > max) {
      max = u;
      at = x;
    }
  }
  return { max, at };
}

const r = rng('dmath-tests', 'world', 'inputs');
const uniform = (lo: number, hi: number, n = 50_000) => Array.from({ length: n }, () => lo + (hi - lo) * r.next());
const logUniform = (lo: number, hi: number, n = 50_000) =>
  Array.from({ length: n }, () => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * r.next()));
const signed = (xs: number[]) => xs.map((x, i) => (i % 2 === 0 ? x : -x));

describe('exp, expm1, log, log1p: ≤ 2 ulp vs Math', () => {
  const cases: [string, (x: number) => number, (x: number) => number, number[]][] = [
    ['exp', d.exp, Math.exp, [...uniform(-745, 709.7), ...uniform(-2, 2), ...signed(logUniform(1e-300, 1))]],
    ['expm1', d.expm1, Math.expm1, [...uniform(-60, 709), ...signed(logUniform(1e-300, 1)), ...uniform(-1, 1)]],
    ['log', d.log, Math.log, [...logUniform(1e-320, 1e308), ...uniform(0.5, 2), ...uniform(0.99, 1.01)]],
    [
      'log1p',
      d.log1p,
      Math.log1p,
      [...uniform(-0.999999, 2), ...signed(logUniform(1e-300, 0.3)), ...logUniform(1, 1e300)],
    ],
  ];
  for (const [name, f, g, inputs] of cases) {
    it(name, () => {
      const { max, at } = maxUlps(f, g, inputs);
      expect(max, `${name} worst at ${at}`).toBeLessThanOrEqual(2);
    });
  }

  it('handles special values like Math', () => {
    const specials = [
      NaN,
      Infinity,
      -Infinity,
      0,
      -0,
      1,
      -1,
      709.782712893384,
      709.79,
      -745.13,
      -745.14,
      -746,
      5e-324,
      1e-310,
      -1e-310,
    ];
    for (const x of specials) {
      expect(ulps(d.exp(x), Math.exp(x)), `exp(${x})`).toBe(0);
      expect(ulps(d.expm1(x), Math.expm1(x)), `expm1(${x})`).toBe(0);
      expect(ulps(d.log(x), Math.log(x)), `log(${x})`).toBe(0);
      expect(ulps(d.log1p(x), Math.log1p(x)), `log1p(${x})`).toBe(0);
    }
    expect(Object.is(d.expm1(-0), -0)).toBe(true);
    expect(Object.is(d.log1p(-0), -0)).toBe(true);
    expect(d.log(1)).toBe(0);
    expect(d.exp(0)).toBe(1);
  });
});

describe('sin, cos, tan, atan, atan2: ≤ 2 ulp vs Math', () => {
  const trigInputs = [
    ...uniform(-1e5, 1e5),
    ...uniform(-10, 10),
    ...signed(logUniform(1e-300, 1)),
    ...uniform(-d.TRIG_MAX_ABS, d.TRIG_MAX_ABS, 20_000),
  ];
  for (const [name, f, g] of [
    ['sin', d.sin, Math.sin],
    ['cos', d.cos, Math.cos],
    ['tan', d.tan, Math.tan],
  ] as const) {
    it(name, () => {
      const { max, at } = maxUlps(f, g, trigInputs);
      expect(max, `${name} worst at ${at}`).toBeLessThanOrEqual(2);
    });
  }

  it('reduces arguments near multiples of π/2 accurately', () => {
    const near: number[] = [];
    for (let k = 1; k < 2000; k++) {
      const base = (k * Math.PI) / 2;
      for (const delta of [-2, -1, 0, 1, 2]) {
        view.setFloat64(0, base);
        view.setBigInt64(0, view.getBigInt64(0) + BigInt(delta));
        near.push(view.getFloat64(0), -view.getFloat64(0));
      }
    }
    for (const [f, g] of [
      [d.sin, Math.sin],
      [d.cos, Math.cos],
    ] as const) {
      expect(maxUlps(f, g, near).max).toBeLessThanOrEqual(2);
    }
  });

  it('throws RangeError outside |x| ≤ 2^20·π/2 and returns NaN for NaN/±∞', () => {
    expect(d.TRIG_MAX_ABS).toBeGreaterThan(2 ** 20 * (Math.PI / 2));
    expect(d.TRIG_MAX_ABS).toBeLessThan(2 ** 20 * (Math.PI / 2) + 1);
    expect(() => d.sin(d.TRIG_MAX_ABS)).not.toThrow();
    for (const f of [d.sin, d.cos, d.tan]) {
      expect(() => f(d.TRIG_MAX_ABS * 1.000001)).toThrow(RangeError);
      expect(() => f(-2e6)).toThrow(RangeError);
      expect(f(NaN)).toBeNaN();
      expect(f(Infinity)).toBeNaN();
      expect(f(-Infinity)).toBeNaN();
    }
    expect(Object.is(d.sin(-0), -0)).toBe(true);
    expect(d.cos(-0)).toBe(1);
  });

  it('atan over its whole domain', () => {
    const inputs = [...uniform(-20, 20), ...signed(logUniform(1e-300, 1e300)), Infinity, -Infinity, 0, -0];
    expect(maxUlps(d.atan, Math.atan, inputs).max).toBeLessThanOrEqual(2);
    expect(d.atan(NaN)).toBeNaN();
  });

  it('atan2 in every quadrant and on every signed-zero / infinity case', () => {
    const vals = [
      0,
      -0,
      1,
      -1,
      0.5,
      -3.7,
      1e-320,
      -1e-320,
      1e300,
      -1e300,
      Infinity,
      -Infinity,
      NaN,
      2 ** 70,
      -(2 ** -70),
    ];
    for (const y of vals) {
      for (const x of vals) {
        expect(ulps(d.atan2(y, x), Math.atan2(y, x)), `atan2(${y}, ${x})`).toBeLessThanOrEqual(1);
        if (Number.isNaN(Math.atan2(y, x))) expect(d.atan2(y, x)).toBeNaN();
        else expect(Object.is(Math.sign(d.atan2(y, x)), Math.sign(Math.atan2(y, x)))).toBe(true);
      }
    }
    const ys = uniform(-50, 50, 20_000);
    const xs = uniform(-50, 50, 20_000);
    let worst = 0;
    for (let i = 0; i < ys.length; i++)
      worst = Math.max(worst, ulps(d.atan2(ys[i]!, xs[i]!), Math.atan2(ys[i]!, xs[i]!)));
    expect(worst).toBeLessThanOrEqual(2);
  });
});

describe('pow: ≤ 1e-14 relative vs Math.pow, and ECMAScript special cases', () => {
  const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

  it('general arguments', () => {
    let worst = 0;
    const g = rng('dmath-tests', 'world', 'pow');
    for (let i = 0; i < 100_000; i++) {
      const x = Math.exp((g.next() - 0.5) * 40);
      const y = (g.next() - 0.5) * 60;
      const want = Math.pow(x, y);
      if (want === 0 || !Number.isFinite(want) || want < 1e-300) continue;
      worst = Math.max(worst, rel(d.pow(x, y), want));
    }
    expect(worst).toBeLessThanOrEqual(1e-14);
  });

  it('bases near 1 with huge exponents and results near the overflow and underflow edges', () => {
    const cases: [number, number][] = [
      [1 + 1e-10, 1e12],
      [1 - 1e-12, 3e14],
      [1.0000001, -7e9],
      [2, 1023.999],
      [2, -1021.5],
      [10, 308.2],
      [10, -307.5],
      [0.5, 1000.25],
      [1.0001, 7e6],
      [123.456, 147.1],
      [7.5, 0.5],
      [3, 1 / 3],
    ];
    for (const [x, y] of cases) expect(rel(d.pow(x, y), Math.pow(x, y)), `pow(${x}, ${y})`).toBeLessThanOrEqual(1e-14);
  });

  it('integer exponents and negative bases', () => {
    for (const x of [-2.5, -0.3, -7, 3.1, 0.9]) {
      for (const y of [-7, -3, -2, -1, 1, 2, 3, 5, 10, 31]) {
        expect(rel(d.pow(x, y), x ** y), `pow(${x}, ${y})`).toBeLessThanOrEqual(1e-14);
      }
    }
    expect(d.pow(-8, 1 / 3)).toBeNaN();
  });

  it('matches ** on every special value combination', () => {
    const vals = [
      NaN,
      0,
      -0,
      1,
      -1,
      0.5,
      -0.5,
      2,
      -2,
      3,
      -3,
      Infinity,
      -Infinity,
      2 ** 53,
      -(2 ** 53) - 2,
      1e-310,
      0.75,
    ];
    for (const x of vals) {
      for (const y of vals) {
        const got = d.pow(x, y);
        const want = x ** y;
        if (Number.isNaN(want)) expect(got, `pow(${x}, ${y})`).toBeNaN();
        else if (want === 0 || !Number.isFinite(want))
          expect(Object.is(got, want), `pow(${x}, ${y}) = ${got}`).toBe(true);
        else expect(rel(got, want), `pow(${x}, ${y})`).toBeLessThanOrEqual(1e-14);
      }
    }
  });
});

describe('sqrt', () => {
  it('is the exactly rounded host sqrt', () => {
    expect(d.sqrt(2)).toBe(Math.SQRT2);
    expect(d.sqrt(-1)).toBeNaN();
  });
});

describe('fdlibm constants', () => {
  it('every decimal literal annotated with a hex pattern has exactly that bit pattern', () => {
    const source = readFileSync(fileURLToPath(new URL('./dmath.ts', import.meta.url)), 'utf8');
    const re = /(-?\d[\d.]*(?:e[+-]?\d+)?)\s*[,;]\s*\/\/[^\n]*?0x([0-9A-Fa-f]{8}) ([0-9A-Fa-f]{8})/g;
    let checked = 0;
    for (const m of source.matchAll(re)) {
      const value = Number(m[1]);
      view.setFloat64(0, value);
      const hex = `${view.getUint32(0).toString(16).padStart(8, '0')}${view.getUint32(4).toString(16).padStart(8, '0')}`;
      expect(hex, `literal ${m[1]}`).toBe(`${m[2]}${m[3]}`.toLowerCase());
      checked++;
    }
    expect(checked).toBeGreaterThan(150);
  });
});
