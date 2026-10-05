import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CanonicalJsonError, canonicalJson, fnv1a64, fnv1a64Hex, hashValue } from './hash';

// Reference FNV-1a 64 over TextEncoder bytes with BigInt arithmetic.
function fnvRef(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(text)) {
    h ^= BigInt(b);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

describe('fnv1a64', () => {
  it('matches the published FNV-1a 64 test vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325');
    expect(fnv1a64Hex('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64Hex('foobar')).toBe('85944171f73967e8');
  });

  it('hashes the UTF-8 bytes (multi-byte and astral characters) like a BigInt reference', () => {
    for (const s of ['é', '€', '日本語', '𝄞 clef', 'mixed ascii é € 𝄞', '\u001f', '\u0000x']) {
      expect(fnv1a64Hex(s)).toBe(fnvRef(s));
    }
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (s) => fnv1a64Hex(s) === fnvRef(s)),
      { numRuns: 500 },
    );
  });

  it('encodes a lone surrogate as U+FFFD, as TextEncoder does', () => {
    expect(fnv1a64Hex('a\ud800b')).toBe(fnvRef('a�b'));
    expect(fnv1a64Hex('\udc00')).toBe(fnvRef('�'));
  });

  it('returns unsigned 32-bit halves', () => {
    const h = fnv1a64('foobar');
    expect(h.hi).toBe(0x85944171);
    expect(h.lo).toBe(0xf73967e8);
  });
});

describe('canonicalJson', () => {
  it('sorts keys by UTF-16 code units at every depth and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: [3, { d: true, c: null }], A: 'x' })).toBe(
      '{"A":"x","a":[3,{"c":null,"d":true}],"b":1}',
    );
    // code-unit order, not locale or id order: 'clm_10' < 'clm_9', 'Z' < 'a'
    expect(canonicalJson({ clm_9: 1, clm_10: 2, a: 3, Z: 4 })).toBe('{"Z":4,"a":3,"clm_10":2,"clm_9":1}');
  });

  it('prints numbers in shortest round-trip form and −0 as 0', () => {
    expect(canonicalJson([0.1, 1e21, 1e-7, -0, 123456789012345680000, 5e-324, 0.30000000000000004])).toBe(
      '[0.1,1e+21,1e-7,0,123456789012345680000,5e-324,0.30000000000000004]',
    );
  });

  it('escapes strings as JSON does', () => {
    expect(canonicalJson('a"b\\c\n\u0001 ')).toBe(JSON.stringify('a"b\\c\n\u0001 '));
  });

  it('is independent of key insertion order', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.jsonValue()), (obj) => {
        // fromEntries defines own properties, so a generated "__proto__" key stays a key instead of setting the prototype
        const reversed = Object.fromEntries(Object.entries(obj).reverse());
        return canonicalJson(obj) === canonicalJson(reversed);
      }),
      { numRuns: 300 },
    );
  });

  it('round-trips through JSON.parse to an equal value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const normalized = JSON.parse(JSON.stringify(v)) as unknown; // −0 → 0
        expect(JSON.parse(canonicalJson(v))).toEqual(normalized);
      }),
      { numRuns: 300 },
    );
  });

  it('rejects values that would not survive a save round trip, naming the path', () => {
    const bad: [unknown, RegExp][] = [
      [{ a: NaN }, /non-finite number NaN at \$\.a/],
      [{ a: [1, Infinity] }, /non-finite.*\$\.a\[?"?1/],
      [{ a: undefined }, /undefined value .*at \$\.a/],
      [[1, undefined], /undefined/],
      [{ f: () => 1 }, /unsupported function/],
      [{ s: Symbol('x') }, /unsupported symbol/],
      [{ n: 10n }, /unsupported bigint/],
      [{ m: new Map() }, /non-plain object \(Map\)/],
      [{ d: new Date(0) }, /non-plain object \(Date\)/],
      [{ k: new (class Foo {})() }, /non-plain object \(Foo\)/],
      [{ 'odd key': { [Symbol('s')]: 1 } }, /symbol-keyed property at \$\["odd key"\]/],
    ];
    for (const [value, message] of bad) {
      expect(() => canonicalJson(value)).toThrow(CanonicalJsonError);
      expect(() => canonicalJson(value)).toThrow(message);
    }
    // eslint-disable-next-line no-sparse-arrays
    expect(() => canonicalJson([1, , 3])).toThrow(/sparse array hole/);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow(/cycle/);
  });

  it('accepts null-prototype objects and shared (non-cyclic) references', () => {
    const o = Object.create(null) as Record<string, unknown>;
    o.b = 2;
    o.a = 1;
    expect(canonicalJson(o)).toBe('{"a":1,"b":2}');
    expect(canonicalJson(JSON.parse('{"b":2,"__proto__":1}'))).toBe('{"__proto__":1,"b":2}'); // an own "__proto__" key
    const shared = { x: 1 };
    expect(canonicalJson({ p: shared, q: shared })).toBe('{"p":{"x":1},"q":{"x":1}}');
  });
});

describe('hashValue', () => {
  it('is FNV-1a 64 over the canonical JSON (pinned)', () => {
    const v = { turn: 28, ids: { clm: 3, emp: 1 }, cash: [-450, 0, 12.5] };
    expect(hashValue(v)).toBe(fnv1a64Hex('{"cash":[-450,0,12.5],"ids":{"clm":3,"emp":1},"turn":28}'));
    expect(hashValue(v)).toBe('b6e6d7428883f591');
  });
});
