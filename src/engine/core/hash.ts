// Canonical JSON and the 64-bit FNV-1a state hash (DESIGN §2.3 item 5): golden replays, save round trips and
// `meta.tuningHash` all compare these strings, so the encoding must be identical in Node and every browser.
import { sortedKeysByCodeUnit } from './iter';

/** A 64-bit value as two unsigned 32-bit halves. */
export interface U64 {
  readonly hi: number;
  readonly lo: number;
}

// Reusable UTF-8 buffer (module scratch: hashing is synchronous, one call at a time).
let utf8Buf = new Uint8Array(1024);

/**
 * UTF-8 bytes of `text` into the scratch buffer; returns the byte count. A lone UTF-16 surrogate is encoded as U+FFFD
 * (EF BF BD), as the WHATWG TextEncoder does, so every JS string has exactly one encoding.
 */
function encodeUtf8(text: string): number {
  const n = text.length;
  if (utf8Buf.length < n * 3) utf8Buf = new Uint8Array(Math.max(n * 3, utf8Buf.length * 2));
  const buf = utf8Buf;
  let j = 0;
  for (let i = 0; i < n; i++) {
    let c = text.charCodeAt(i);
    if (c < 0x80) {
      buf[j++] = c;
      continue;
    }
    if (c < 0x800) {
      buf[j++] = 0xc0 | (c >> 6);
      buf[j++] = 0x80 | (c & 0x3f);
      continue;
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      const next = i + 1 < n ? text.charCodeAt(i + 1) : 0;
      if (c <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
        buf[j++] = 0xf0 | (cp >> 18);
        buf[j++] = 0x80 | ((cp >> 12) & 0x3f);
        buf[j++] = 0x80 | ((cp >> 6) & 0x3f);
        buf[j++] = 0x80 | (cp & 0x3f);
        continue;
      }
      c = 0xfffd;
    }
    buf[j++] = 0xe0 | (c >> 12);
    buf[j++] = 0x80 | ((c >> 6) & 0x3f);
    buf[j++] = 0x80 | (c & 0x3f);
  }
  return j;
}

/**
 * 64-bit FNV-1a over the UTF-8 bytes of `text` (offset basis 0xcbf29ce484222325, prime 0x100000001b3 = 2^40 + 0x1b3).
 *
 * The hash is kept as four 16-bit limbs h0 (low) … h3, so multiplying by the prime modulo 2^64 is exact small-integer
 * arithmetic: h·435 contributes to every limb and h·2^40 shifts h0, h1 into limbs 2 and 3 (×2^8).
 */
export function fnv1a64(text: string): U64 {
  const len = encodeUtf8(text);
  const buf = utf8Buf;
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (let i = 0; i < len; i++) {
    h0 ^= buf[i] as number;
    const t0 = h0 * 435;
    const t1 = h1 * 435 + (t0 >>> 16);
    const t2 = h2 * 435 + (h0 << 8) + (t1 >>> 16);
    h3 = (h3 * 435 + (h1 << 8) + (t2 >>> 16)) & 0xffff;
    h0 = t0 & 0xffff;
    h1 = t1 & 0xffff;
    h2 = t2 & 0xffff;
  }
  return { hi: ((h3 << 16) | h2) >>> 0, lo: ((h1 << 16) | h0) >>> 0 };
}

/** 16 lowercase hex digits of a 64-bit value. */
export function u64Hex(v: U64): string {
  return v.hi.toString(16).padStart(8, '0') + v.lo.toString(16).padStart(8, '0');
}

/** 64-bit FNV-1a of the UTF-8 bytes of `text`, as 16 lowercase hex digits. */
export function fnv1a64Hex(text: string): string {
  return u64Hex(fnv1a64(text));
}

/** Thrown when a value cannot be canonically serialized (it would not survive a save round trip unchanged). */
export class CanonicalJsonError extends Error {
  constructor(path: readonly string[], problem: string) {
    super(`canonicalJson: ${problem} at ${formatPath(path)}`);
    this.name = 'CanonicalJsonError';
  }
}

function formatPath(path: readonly string[]): string {
  return '$' + path.map((p) => (/^[A-Za-z_$][\w$]*$/.test(p) ? `.${p}` : `[${JSON.stringify(p)}]`)).join('');
}

/**
 * Canonical JSON: object keys sorted by UTF-16 code units, numbers in ECMAScript's shortest round-trip form
 * (−0 prints as 0), strings escaped as JSON.stringify does, no whitespace.
 *
 * Only JSON-safe plain data is accepted, matching the GameState rules (CLAUDE.md "State is plain serializable data"):
 * NaN, ±Infinity, undefined (as a value or array element), sparse arrays, functions, symbols, bigints, cycles,
 * symbol-keyed properties and non-plain objects (Map, Set, Date, class instances) throw a CanonicalJsonError naming
 * the path, because each would either be lost or change shape in a save round trip.
 */
export function canonicalJson(value: unknown): string {
  const path: string[] = [];
  const ancestors: object[] = [];
  // Built by concatenation (V8 ropes), which beats collecting parts and joining for multi-MB states.
  let out = '';

  const write = (v: unknown): void => {
    if (v === null) {
      out += 'null';
      return;
    }
    switch (typeof v) {
      case 'boolean':
        out += v ? 'true' : 'false';
        return;
      case 'number':
        if (!Number.isFinite(v)) throw new CanonicalJsonError(path, `non-finite number ${String(v)}`);
        out += String(v); // Number::toString: shortest round-trip digits; String(−0) is "0"
        return;
      case 'string':
        out += JSON.stringify(v);
        return;
      case 'undefined':
        throw new CanonicalJsonError(path, 'undefined value (omit the property instead)');
      case 'function':
      case 'symbol':
      case 'bigint':
        throw new CanonicalJsonError(path, `unsupported ${typeof v}`);
      case 'object':
        writeObject(v);
        return;
    }
  };

  const writeObject = (obj: object): void => {
    if (ancestors.includes(obj)) throw new CanonicalJsonError(path, 'cycle');
    ancestors.push(obj);
    if (Array.isArray(obj)) {
      out += '[';
      for (let i = 0; i < obj.length; i++) {
        if (i > 0) out += ',';
        path.push(String(i));
        if (!(i in obj)) throw new CanonicalJsonError(path, 'sparse array hole');
        write(obj[i]);
        path.pop();
      }
      out += ']';
    } else {
      const proto: unknown = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) {
        const name = (obj as { constructor?: { name?: unknown } }).constructor?.name;
        throw new CanonicalJsonError(path, `non-plain object (${typeof name === 'string' ? name : 'unknown'})`);
      }
      if (Object.getOwnPropertySymbols(obj).length > 0) throw new CanonicalJsonError(path, 'symbol-keyed property');
      const rec = obj as Record<string, unknown>;
      out += '{';
      let first = true;
      for (const key of sortedKeysByCodeUnit(rec)) {
        if (!first) out += ',';
        first = false;
        out += JSON.stringify(key) + ':';
        path.push(key);
        write(rec[key]);
        path.pop();
      }
      out += '}';
    }
    ancestors.pop();
  };

  write(value);
  return out;
}

/** The state hash: FNV-1a 64 over the canonical JSON (DESIGN §2.3 item 5). */
export function hashValue(value: unknown): string {
  return fnv1a64Hex(canonicalJson(value));
}
