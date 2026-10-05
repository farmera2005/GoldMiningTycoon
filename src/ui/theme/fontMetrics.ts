// Font metrics for the metric-matched fallback faces (DESIGN §13.20, D-13.59): a late web-font load must not change
// a row height or a column width, so `Besley Fallback` and `Inter Fallback` are local system fonts scaled with
// `size-adjust` and the `*-override` descriptors. This module reads the few OpenType tables needed (head, hhea, cmap,
// hmtx) from a WOFF 1.0 or bare SFNT file and computes those descriptors the way the common tooling does.
import { unzlibSync } from 'fflate';

export interface FontMetrics {
  readonly unitsPerEm: number;
  /** hhea ascender, descender (negative) and line gap, in font units. */
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  /** Advance width averaged over English prose (see PROSE_WEIGHTS), in font units. */
  readonly xWidthAvg: number;
}

export interface FallbackOverrides {
  /** Percentages, as written in the CSS descriptors. */
  readonly sizeAdjustPct: number;
  readonly ascentOverridePct: number;
  readonly descentOverridePct: number;
  readonly lineGapOverridePct: number;
}

/**
 * Letter frequencies of English text (percent; the widely used Lewand table) plus the space, at one per 4.7 letters
 * (average English word length). Width matching on prose keeps wrapped labels and headers where they were.
 */
export const PROSE_WEIGHTS: Readonly<Record<string, number>> = {
  a: 8.167,
  b: 1.492,
  c: 2.782,
  d: 4.253,
  e: 12.702,
  f: 2.228,
  g: 2.015,
  h: 6.094,
  i: 6.966,
  j: 0.153,
  k: 0.772,
  l: 4.025,
  m: 2.406,
  n: 6.749,
  o: 7.507,
  p: 1.929,
  q: 0.095,
  r: 5.987,
  s: 6.327,
  t: 9.056,
  u: 2.758,
  v: 0.978,
  w: 2.36,
  x: 0.15,
  y: 1.974,
  z: 0.074,
  ' ': 21.277,
};

/**
 * Metrics of the local fallback fonts. Arial and Times New Roman are not redistributable, so these were read from
 * Liberation Sans and Liberation Serif, which are metric-compatible with them by design (same advance widths and
 * vertical metrics); `readFontMetrics` on those files reproduces the numbers.
 */
export const LOCAL_FALLBACK_METRICS = {
  arialRegular: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 906.033 },
  arialBold: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 979.887 },
  timesBold: { unitsPerEm: 2048, ascent: 1825, descent: -443, lineGap: 87, xWidthAvg: 873.689 },
} as const satisfies Record<string, FontMetrics>;

type TableMap = Readonly<Record<string, DataView>>;

const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'
const SFNT_VERSIONS = [0x00010000, 0x4f54544f /* 'OTTO' */, 0x74727565 /* 'true' */];

function tagAt(view: DataView, offset: number): string {
  let tag = '';
  for (let i = 0; i < 4; i++) tag += String.fromCharCode(view.getUint8(offset + i));
  return tag;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function readWoffTables(bytes: Uint8Array, view: DataView): TableMap {
  const numTables = view.getUint16(12);
  const tables: Record<string, DataView> = {};
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + i * 20;
    const tag = tagAt(view, entry);
    const offset = view.getUint32(entry + 4);
    const compLength = view.getUint32(entry + 8);
    const origLength = view.getUint32(entry + 12);
    const raw = bytes.subarray(offset, offset + compLength);
    // WOFF stores a table zlib-compressed only when that made it smaller.
    const data = compLength < origLength ? unzlibSync(raw) : raw;
    tables[tag] = viewOf(data);
  }
  return tables;
}

function readSfntTables(bytes: Uint8Array, view: DataView): TableMap {
  const numTables = view.getUint16(4);
  const tables: Record<string, DataView> = {};
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    tables[tagAt(view, record)] = viewOf(bytes.subarray(offset, offset + length));
  }
  return tables;
}

export function readFontTables(bytes: Uint8Array): TableMap {
  const view = viewOf(bytes);
  const signature = view.getUint32(0);
  if (signature === WOFF_SIGNATURE) return readWoffTables(bytes, view);
  if (SFNT_VERSIONS.includes(signature)) return readSfntTables(bytes, view);
  throw new Error('Unsupported font container (expected WOFF 1.0 or SFNT)');
}

function table(tables: TableMap, tag: string): DataView {
  const t = tables[tag];
  if (!t) throw new Error(`Font has no ${tag} table`);
  return t;
}

/** Glyph lookup from a cmap format 4 (BMP) subtable. */
function format4Lookup(cmap: DataView, base: number): (codePoint: number) => number {
  const segCount = cmap.getUint16(base + 6) / 2;
  const endCodes = base + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;
  return (cp) => {
    for (let i = 0; i < segCount; i++) {
      if (cmap.getUint16(endCodes + i * 2) < cp) continue;
      const start = cmap.getUint16(startCodes + i * 2);
      if (start > cp) return 0;
      const delta = cmap.getInt16(idDeltas + i * 2);
      const rangeOffsetPos = idRangeOffsets + i * 2;
      const rangeOffset = cmap.getUint16(rangeOffsetPos);
      if (rangeOffset === 0) return (cp + delta) & 0xffff;
      const glyph = cmap.getUint16(rangeOffsetPos + rangeOffset + (cp - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/** Glyph lookup from a cmap format 12 (full Unicode) subtable. */
function format12Lookup(cmap: DataView, base: number): (codePoint: number) => number {
  const numGroups = cmap.getUint32(base + 12);
  return (cp) => {
    for (let i = 0; i < numGroups; i++) {
      const group = base + 16 + i * 12;
      const start = cmap.getUint32(group);
      const end = cmap.getUint32(group + 4);
      if (cp >= start && cp <= end) return cmap.getUint32(group + 8) + (cp - start);
    }
    return 0;
  };
}

function glyphLookup(cmap: DataView): (codePoint: number) => number {
  const numTables = cmap.getUint16(2);
  let format4: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const record = 4 + i * 8;
    const platform = cmap.getUint16(record);
    const encoding = cmap.getUint16(record + 2);
    const offset = cmap.getUint32(record + 4);
    const format = cmap.getUint16(offset);
    if (format === 12 && (platform === 3 || platform === 0)) return format12Lookup(cmap, offset);
    if (format === 4 && ((platform === 3 && encoding === 1) || platform === 0)) format4 ??= offset;
  }
  if (format4 === null) throw new Error('Font has no Unicode cmap subtable');
  return format4Lookup(cmap, format4);
}

export function readFontMetrics(bytes: Uint8Array): FontMetrics {
  const tables = readFontTables(bytes);
  const head = table(tables, 'head');
  const hhea = table(tables, 'hhea');
  const hmtx = table(tables, 'hmtx');
  const numberOfHMetrics = hhea.getUint16(34);
  const advance = (glyph: number): number => hmtx.getUint16(4 * Math.min(glyph, numberOfHMetrics - 1));
  const lookup = glyphLookup(table(tables, 'cmap'));

  let weighted = 0;
  let totalWeight = 0;
  for (const [ch, weight] of Object.entries(PROSE_WEIGHTS)) {
    const glyph = lookup(ch.charCodeAt(0));
    if (glyph === 0) throw new Error(`Font has no glyph for ${JSON.stringify(ch)}`);
    weighted += advance(glyph) * weight;
    totalWeight += weight;
  }
  return {
    unitsPerEm: head.getUint16(18),
    ascent: hhea.getInt16(4),
    descent: hhea.getInt16(6),
    lineGap: hhea.getInt16(8),
    xWidthAvg: weighted / totalWeight,
  };
}

/**
 * Descriptors for a local fallback face that occupies the same width and line box as the web font: the fallback is
 * scaled so its average prose width matches, and the vertical overrides are expressed against that scaled em.
 */
export function fallbackOverrides(target: FontMetrics, fallback: FontMetrics): FallbackOverrides {
  const sizeAdjust = target.xWidthAvg / target.unitsPerEm / (fallback.xWidthAvg / fallback.unitsPerEm);
  const adjustedEm = target.unitsPerEm * sizeAdjust;
  return {
    sizeAdjustPct: sizeAdjust * 100,
    ascentOverridePct: (target.ascent / adjustedEm) * 100,
    descentOverridePct: (Math.abs(target.descent) / adjustedEm) * 100,
    lineGapOverridePct: (target.lineGap / adjustedEm) * 100,
  };
}
