// Truth packing (DESIGN §3.1, D-3.1, D-3.32). Each claim's block truth is quantized at generation and stored as a
// base64 string with its 64-bit FNV-1a hash; the engine decodes it lazily through a pure memo cache keyed by
// (claimId, truthHash). The key excludes the seed on purpose: the simulator replays one seed under many tuning
// overrides in one process, and the Inheritor step re-packs a claim inside newGame.
//
// Byte layout (little-endian; version 1):
//   header   u16 version | u16 nBlocks | u16 coarseMeanMg×10 | u16 nPockets | u16 nTailings
//   block    u16 overburdenFt×100, payThicknessFt×100, bedrockCleanupFt×100     lengths, 0.01 ft
//            u16 grade, virginGrade                                             log grade (below)
//            u16 sizeMix×4 (sum exactly 65535)                                  coarse, medium, fine, ultrafine
//            u16 permafrost, clay, boulders, cementation, minedOut, paystreakFraction, bedrockGoldShare   ×65535
//            u16 fineness ((x − 0.5)/0.5 × 65535) | u16 verticalDecayFt×1000 | u8 bedrockType     = 37 bytes
//   pocket   u16 blockIdx | u16 bcy | u16 grade                                 (sparse, ascending blockIdx)
//   tailings u16 blockIdx | u16 bcy | u16 grade | u16 sizeMix×4                 (sparse, ascending blockIdx)
// Log grade: q = round(8000 × log10(max(g, 1e-7) / 1e-7)), 0.03% relative steps over 1e-7..15 oz/bcy; 0 decodes as 1e-7.
// decode(pack(T)) is canonical: generation, classification and sampling all use the decoded values (D-3.1).
import { exp, log } from '../../core/dmath';
import { fnv1a64Hex } from '../../core/hash';
import type { ClaimId } from '../../core/ids';
import { createMemo } from '../../core/memo';
import type { BedrockType, BlockTruth, ClaimTruth, SizeRecord } from './types';
import { BEDROCK_TYPES } from './enums';

export const PACK_VERSION = 1;
const HEADER_BYTES = 10;
export const BLOCK_BYTES = 37;
const POCKET_BYTES = 6;
const TAILINGS_BYTES = 14;
const U16_MAX = 65535;
const GRADE_FLOOR = 1e-7;
const LN10 = 2.302585092994046;
/** One log-grade step in natural-log units: ln(10) / 8000. */
const GRADE_STEP_LN = LN10 / 8000;

// ---------------------------------------------------------------------------------------------------------------------
// Quantizers (each decode∘encode is idempotent: encode(decode(q)) = q)
// ---------------------------------------------------------------------------------------------------------------------

function u16(x: number): number {
  const r = Math.round(x);
  return r < 0 ? 0 : r > U16_MAX ? U16_MAX : r;
}

export const quant = {
  length: (ft: number): number => u16(ft * 100),
  lengthOf: (q: number): number => q / 100,
  grade: (g: number): number => u16(log(Math.max(g, GRADE_FLOOR) / GRADE_FLOOR) / GRADE_STEP_LN),
  gradeOf: (q: number): number => GRADE_FLOOR * exp(q * GRADE_STEP_LN),
  frac: (x: number): number => u16((x < 0 ? 0 : x > 1 ? 1 : x) * U16_MAX),
  fracOf: (q: number): number => q / U16_MAX,
  fineness: (x: number): number => u16(((x - 0.5) / 0.5) * U16_MAX),
  finenessOf: (q: number): number => 0.5 + (q / U16_MAX) * 0.5,
  decay: (ft: number): number => u16(ft * 1000),
  decayOf: (q: number): number => q / 1000,
  coarseMg: (mg: number): number => u16(mg * 10),
  coarseMgOf: (q: number): number => q / 10,
  bcy: (bcy: number): number => u16(bcy),
  bcyOf: (q: number): number => q,
};

/**
 * Size mix → four u16 shares summing exactly to 65535 (largest remainder; ties to the lower class index), so the
 * decoded mix sums to 1 and re-encoding a decoded mix returns the same integers.
 */
export function quantizeMix(mix: readonly [number, number, number, number]): [number, number, number, number] {
  const total = mix[0] + mix[1] + mix[2] + mix[3];
  const scaled = mix.map((x) => (total > 0 ? (Math.max(0, x) / total) * U16_MAX : U16_MAX / 4));
  const q = scaled.map((x) => Math.floor(x));
  let left = U16_MAX - (q[0] as number) - (q[1] as number) - (q[2] as number) - (q[3] as number);
  const order = [0, 1, 2, 3].sort((a, b) => {
    const ra = (scaled[a] as number) - (q[a] as number);
    const rb = (scaled[b] as number) - (q[b] as number);
    return rb !== ra ? rb - ra : a - b;
  });
  for (let k = 0; left > 0; k = (k + 1) % 4, left--) {
    const i = order[k] as number;
    q[i] = (q[i] as number) + 1;
  }
  return [q[0] as number, q[1] as number, q[2] as number, q[3] as number];
}

function mixOf(q: readonly number[]): SizeRecord {
  const s = (q[0] as number) + (q[1] as number) + (q[2] as number) + (q[3] as number);
  const d = s > 0 ? s : 1;
  return {
    coarse: (q[0] as number) / d,
    medium: (q[1] as number) / d,
    fine: (q[2] as number) / d,
    ultrafine: (q[3] as number) / d,
  };
}

function mixTuple(m: SizeRecord): [number, number, number, number] {
  return [m.coarse, m.medium, m.fine, m.ultrafine];
}

function bedrockIndex(b: BedrockType): number {
  const i = BEDROCK_TYPES.indexOf(b);
  if (i < 0) throw new RangeError(`pack: unknown bedrock type ${b}`);
  return i;
}

// ---------------------------------------------------------------------------------------------------------------------
// Base64 (RFC 4648 with padding), implemented here so the engine needs no host API.
// ---------------------------------------------------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: number[] = (() => {
  const t = new Array<number>(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out += B64.charAt(n >> 18) + B64.charAt((n >> 12) & 63) + B64.charAt((n >> 6) & 63) + B64.charAt(n & 63);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] as number) << 16;
    out += B64.charAt(n >> 18) + B64.charAt((n >> 12) & 63) + '==';
  } else if (rest === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += B64.charAt(n >> 18) + B64.charAt((n >> 12) & 63) + B64.charAt((n >> 6) & 63) + '=';
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  if (s.length % 4 !== 0) throw new RangeError('base64: length must be a multiple of 4');
  let pad = 0;
  if (s.endsWith('==')) pad = 2;
  else if (s.endsWith('=')) pad = 1;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map((k) => {
      const ch = s.charCodeAt(i + k);
      if (ch === 61) return 0; // '='
      const v = ch < 128 ? (B64_INDEX[ch] as number) : -1;
      if (v < 0) throw new RangeError('base64: invalid character');
      return v;
    });
    const n = ((c[0] as number) << 18) | ((c[1] as number) << 12) | ((c[2] as number) << 6) | (c[3] as number);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Pack / unpack
// ---------------------------------------------------------------------------------------------------------------------

class ByteWriter {
  readonly bytes: Uint8Array;
  private o = 0;
  constructor(n: number) {
    this.bytes = new Uint8Array(n);
  }
  u16(v: number): void {
    this.bytes[this.o++] = v & 255;
    this.bytes[this.o++] = (v >> 8) & 255;
  }
  u8(v: number): void {
    this.bytes[this.o++] = v & 255;
  }
}

class ByteReader {
  private o = 0;
  constructor(private readonly bytes: Uint8Array) {}
  u16(): number {
    const lo = this.bytes[this.o++];
    const hi = this.bytes[this.o++];
    if (lo === undefined || hi === undefined) throw new RangeError('truthPack: truncated');
    return lo | (hi << 8);
  }
  u8(): number {
    const v = this.bytes[this.o++];
    if (v === undefined) throw new RangeError('truthPack: truncated');
    return v;
  }
  get done(): boolean {
    return this.o === this.bytes.length;
  }
}

/** Packs a claim's block truth (blocks in blockIdx order) and its claim-level coarse particle mass. */
export function packTruth(blocks: readonly BlockTruth[], coarseMeanMg: number): string {
  if (blocks.length > U16_MAX) throw new RangeError('packTruth: too many blocks');
  let nPockets = 0;
  let nTailings = 0;
  for (const b of blocks) {
    if (b.pocket !== undefined) nPockets++;
    if (b.oldTailings !== undefined) nTailings++;
  }
  const w = new ByteWriter(
    HEADER_BYTES + BLOCK_BYTES * blocks.length + POCKET_BYTES * nPockets + TAILINGS_BYTES * nTailings,
  );
  w.u16(PACK_VERSION);
  w.u16(blocks.length);
  w.u16(quant.coarseMg(coarseMeanMg));
  w.u16(nPockets);
  w.u16(nTailings);
  for (const b of blocks) {
    w.u16(quant.length(b.overburdenFt));
    w.u16(quant.length(b.payThicknessFt));
    w.u16(quant.length(b.bedrockCleanupFt));
    w.u16(quant.grade(b.gradeOzPerBcy));
    w.u16(quant.grade(b.virginGradeOzPerBcy));
    for (const q of quantizeMix(mixTuple(b.sizeMix))) w.u16(q);
    w.u16(quant.frac(b.permafrost));
    w.u16(quant.frac(b.clay));
    w.u16(quant.frac(b.boulders));
    w.u16(quant.frac(b.cementation));
    w.u16(quant.frac(b.minedOutFraction));
    w.u16(quant.frac(b.paystreakFraction));
    w.u16(quant.frac(b.bedrockGoldShare));
    w.u16(quant.fineness(b.fineness));
    w.u16(quant.decay(b.verticalDecayFt));
    w.u8(bedrockIndex(b.bedrockType));
  }
  blocks.forEach((b, i) => {
    if (b.pocket === undefined) return;
    w.u16(i);
    w.u16(quant.bcy(b.pocket.bcy));
    w.u16(quant.grade(b.pocket.gradeOzPerBcy));
  });
  blocks.forEach((b, i) => {
    if (b.oldTailings === undefined) return;
    w.u16(i);
    w.u16(quant.bcy(b.oldTailings.bcy));
    w.u16(quant.grade(b.oldTailings.gradeOzPerBcy));
    for (const q of quantizeMix(mixTuple(b.oldTailings.sizeMix))) w.u16(q);
  });
  return bytesToBase64(w.bytes);
}

type MutableBlock = { -readonly [K in keyof BlockTruth]: BlockTruth[K] };

/** Decodes a pack into its canonical truth (no caching; see claimTruthOf for the memoized path). */
export function unpackTruth(pack: string): { coarseMeanMg: number; blocks: BlockTruth[] } {
  const r = new ByteReader(base64ToBytes(pack));
  const version = r.u16();
  if (version !== PACK_VERSION) throw new RangeError(`truthPack: unsupported version ${version}`);
  const n = r.u16();
  const coarseMeanMg = quant.coarseMgOf(r.u16());
  const nPockets = r.u16();
  const nTailings = r.u16();
  const blocks: MutableBlock[] = [];
  for (let i = 0; i < n; i++) {
    const overburdenFt = quant.lengthOf(r.u16());
    const payThicknessFt = quant.lengthOf(r.u16());
    const bedrockCleanupFt = quant.lengthOf(r.u16());
    const gradeOzPerBcy = quant.gradeOf(r.u16());
    const virginGradeOzPerBcy = quant.gradeOf(r.u16());
    const sizeMix = mixOf([r.u16(), r.u16(), r.u16(), r.u16()]);
    const permafrost = quant.fracOf(r.u16());
    const clay = quant.fracOf(r.u16());
    const boulders = quant.fracOf(r.u16());
    const cementation = quant.fracOf(r.u16());
    const minedOutFraction = quant.fracOf(r.u16());
    const paystreakFraction = quant.fracOf(r.u16());
    const bedrockGoldShare = quant.fracOf(r.u16());
    const fineness = quant.finenessOf(r.u16());
    const verticalDecayFt = quant.decayOf(r.u16());
    const bedrockType = BEDROCK_TYPES[r.u8()];
    if (bedrockType === undefined) throw new RangeError('truthPack: bad bedrock type');
    blocks.push({
      overburdenFt,
      payThicknessFt,
      bedrockCleanupFt,
      gradeOzPerBcy,
      virginGradeOzPerBcy,
      sizeMix,
      coarseMeanMg,
      fineness,
      permafrost,
      clay,
      boulders,
      cementation,
      bedrockType,
      bedrockGoldShare,
      verticalDecayFt,
      paystreakFraction,
      minedOutFraction,
    });
  }
  for (let k = 0; k < nPockets; k++) {
    const b = blocks[r.u16()];
    if (b === undefined) throw new RangeError('truthPack: pocket on a missing block');
    b.pocket = { bcy: quant.bcyOf(r.u16()), gradeOzPerBcy: quant.gradeOf(r.u16()) };
  }
  for (let k = 0; k < nTailings; k++) {
    const b = blocks[r.u16()];
    if (b === undefined) throw new RangeError('truthPack: tailings on a missing block');
    const bcy = quant.bcyOf(r.u16());
    const gradeOzPerBcy = quant.gradeOf(r.u16());
    b.oldTailings = { bcy, gradeOzPerBcy, sizeMix: mixOf([r.u16(), r.u16(), r.u16(), r.u16()]) };
  }
  if (!r.done) throw new RangeError('truthPack: trailing bytes');
  return { coarseMeanMg, blocks };
}

export function truthHashOf(pack: string): string {
  return fnv1a64Hex(pack);
}

// The decode cache: keyed by content hash, never saved or hashed; a cold cache returns identical values (§2.3 item 6).
const truthMemo = createMemo<string, ClaimTruth>('world.claimTruth', 512);

function freezeTruth(
  claimId: ClaimId,
  truthHash: string,
  decoded: { coarseMeanMg: number; blocks: BlockTruth[] },
): ClaimTruth {
  for (const b of decoded.blocks) {
    Object.freeze(b.sizeMix);
    if (b.pocket !== undefined) Object.freeze(b.pocket);
    if (b.oldTailings !== undefined) {
      Object.freeze(b.oldTailings.sizeMix);
      Object.freeze(b.oldTailings);
    }
    Object.freeze(b);
  }
  return Object.freeze({
    claimId,
    truthHash,
    coarseMeanMg: decoded.coarseMeanMg,
    blocks: Object.freeze(decoded.blocks),
  });
}

/** Decoded, frozen truth of a claim, memoized by (claimId, truthHash) (D-3.32). Engine-internal: never for UI or bots. */
export function decodeClaimTruth(claimId: ClaimId, truthPack: string, truthHash: string): ClaimTruth {
  return truthMemo.getOrCompute(`${claimId}|${truthHash}`, () =>
    freezeTruth(claimId, truthHash, unpackTruth(truthPack)),
  );
}
