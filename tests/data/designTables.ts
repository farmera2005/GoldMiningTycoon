// Reads DESIGN.md's §1 1.11 difficulty table (the canonical list of difficulty-scaled keys, D-1.44) so the data tests
// can check src/data/difficulty.ts against the document itself, not against a copy that could drift from it.
import { readFileSync } from 'node:fs';

export type DifficultyCells = { readonly easy: string; readonly standard: string; readonly hard: string };

/** One key of a 1.11 row with its three cells (a multi-key row's cells split per key, see `splitPerKey`). */
export interface DifficultyRow {
  readonly key: string;
  readonly knob: string;
  readonly cells: DifficultyCells;
  /** The owning section named in the key cell ("(§5)" → "5"), or null. */
  readonly owner: string | null;
}

const DESIGN_URL = new URL('../../DESIGN.md', import.meta.url);

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * The backticked keys of a key cell. A later key written without its namespace (`hardrock.capex.overrunMed` /
 * `scheduleMed`) shares the previous key's prefix.
 */
export function keysOfCell(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const k = m[1] as string;
    if (k.includes('.')) out.push(k);
    else if (out.length > 0) {
      const prev = out[out.length - 1] as string;
      out.push(prev.slice(0, prev.lastIndexOf('.') + 1) + k);
    }
  }
  return out;
}

/**
 * A row naming k keys gives k values per cell separated by " / " ("0.6 / 0.7" for frequency / severity); a cell that
 * does not split into k parts applies to every key ("× 1.00" for both hard-rock medians).
 */
function splitPerKey(cell: string, k: number): string[] {
  const parts = cell.split(' / ').map((p) => p.trim());
  return k > 1 && parts.length === k ? parts : Array.from({ length: k }, () => cell);
}

/** Every key of DESIGN §1 1.11's table, in document order. */
export function difficultyRowsFromDesign(text: string = readFileSync(DESIGN_URL, 'utf8')): DifficultyRow[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('### 1.11 '));
  if (start < 0) throw new Error('DESIGN.md has no "### 1.11" heading');
  const rows: DifficultyRow[] = [];
  for (let i = start + 1; i < lines.length && !(lines[i] as string).startsWith('### '); i++) {
    const line = lines[i] as string;
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const [knob, keyCell, easy, standard, hard] = tableCells(line);
    if (knob === undefined || knob === 'Knob' || easy === undefined || standard === undefined || hard === undefined)
      continue;
    const keys = keysOfCell(keyCell ?? '');
    const owner = /\(§(\d+)/.exec(keyCell ?? '')?.[1] ?? null;
    const e = splitPerKey(easy, keys.length);
    const s = splitPerKey(standard, keys.length);
    const h = splitPerKey(hard, keys.length);
    keys.forEach((key, j) => {
      rows.push({ key, knob, owner, cells: { easy: e[j] as string, standard: s[j] as string, hard: h[j] as string } });
    });
  }
  return rows;
}

// ------------------------------------------------------------------------------- tuning tables (Diff-cell scan)

/** Every engine and app-config tuning namespace (a key's first segment). */
const NAMESPACES = new Set([
  'game',
  'geology',
  'ops',
  'fleet',
  'staff',
  'land',
  'permits',
  'market',
  'finance',
  'events',
  'ai',
  'hardrock',
  'ui',
  'sim',
  'save',
]);

/** Sections whose tuning table writes keys without their namespace (§2.10: "the one namespace its table states"). */
const TABLE_NAMESPACE: Readonly<Record<string, string>> = { '6': 'permits', '8': 'staff', '14': 'hardrock' };

/** One row of a section's "Tuning constants" table. */
export interface TuningTableRow {
  /** "1.20", "7.21", … */
  readonly section: string;
  /** 1-based line in DESIGN.md. */
  readonly line: number;
  /** The row's keys, each a full dotted key (namespace added where the table omits it). */
  readonly keys: readonly string[];
  /** The Diff cell as written. */
  readonly diff: string;
  /** A pointer row (no key of its own, or a Default of "—"): it names keys owned elsewhere. */
  readonly pointer: boolean;
}

/** Table cells, honouring `\|` escapes inside code spans. */
function escapedCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/**
 * The keys of a tuning-table key cell. A key written without its namespace in a §6, §8 or §14 table gets it; a later
 * dotless token is a sibling of the previous key (`capex.overrunMed` / `scheduleMed` → `hardrock.capex.scheduleMed`);
 * `a.{b,c}` expands to `a.b`, `a.c`. Text outside backticks (`(land / permit / bond)`) is ignored.
 */
export function tuningKeysOfCell(cell: string, sectionMajor: string): string[] {
  const ns = TABLE_NAMESPACE[sectionMajor];
  const out: string[] = [];
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const token = m[1] as string;
    const brace = /^(.*)\{([^}]+)\}$/.exec(token);
    const tokens = brace ? (brace[2] as string).split(',').map((t) => `${brace[1] as string}${t.trim()}`) : [token];
    for (const t of tokens) {
      const first = t.split('.')[0] as string;
      if (t.includes('.') && NAMESPACES.has(first)) out.push(t);
      else if (out.length > 0 && !t.includes('.')) {
        const prev = out[out.length - 1] as string;
        out.push(prev.slice(0, prev.lastIndexOf('.') + 1) + t);
      } else if (ns !== undefined) out.push(`${ns}.${t}`);
    }
  }
  return out;
}

/** Every row of every "### N.M Tuning constants" table whose header has a Diff column, in document order. */
export function tuningTableRowsFromDesign(text: string = readFileSync(DESIGN_URL, 'utf8')): TuningTableRow[] {
  const lines = text.split('\n');
  const rows: TuningTableRow[] = [];
  let section: string | null = null;
  let diffCol = -1;
  let defaultCol = -1;
  lines.forEach((line, i) => {
    const heading = /^### (\d+\.\d+) (.*)$/.exec(line);
    if (heading || line.startsWith('## ')) {
      section = heading && /Tuning constants/.test(heading[2] as string) ? (heading[1] as string) : null;
      diffCol = -1;
      return;
    }
    if (section === null || !line.startsWith('|')) {
      if (!line.startsWith('|')) diffCol = -1;
      return;
    }
    const cells = escapedCells(line);
    if (cells[0] === 'Key') {
      diffCol = cells.findIndex((c) => /^Diff/.test(c));
      defaultCol = cells.indexOf('Default');
      return;
    }
    if (diffCol < 0 || /^-/.test(cells[0] ?? '')) return;
    const major = section.split('.')[0] as string;
    const keys = tuningKeysOfCell(cells[0] ?? '', major);
    const dflt = defaultCol >= 0 ? (cells[defaultCol] ?? '') : '';
    rows.push({ section, line: i + 1, keys, diff: cells[diffCol] ?? '', pointer: keys.length === 0 || dflt === '—' });
  });
  return rows;
}

/** A 1.11 cell as a number: "0.85", "+30", "−30" (U+2212), "× 1.15", ".55". */
export function cellNumber(cell: string): number {
  const text = cell.replace(/^×\s*/, '').replace('−', '-').replace(/^\+/, '');
  const n = Number(text.startsWith('.') ? `0${text}` : text.startsWith('-.') ? `-0${text.slice(1)}` : text);
  if (!Number.isFinite(n) || text === '') throw new Error(`1.11 cell '${cell}' is not a number`);
  return n;
}

/** A 1.11 mix cell (".55/.30/.12/.03") as its numbers, in order. */
export function cellNumbers(cell: string): number[] {
  return cell.split('/').map((p) => cellNumber(p.trim()));
}

/** One row of DESIGN §4.2.B (measurement parameters), with the numbers its cells state; null where a cell gives none. */
export interface MethodMeasurementRow {
  readonly id: string;
  readonly positionMode: string;
  /** A number, 'reach' (the machine's reach) or null ('—'). */
  readonly maxDepthFt: number | 'reach' | null;
  readonly frozenOk: boolean | null;
  readonly bedrockPenFt: number | null;
  /** coarse / medium / fine / ultrafine, or null when the cell gives no four-number row. */
  readonly capture: readonly [number, number, number, number] | null;
  /** volumeCv / weighCv / geomCv / thickCv; an entry is null where the cell prints '—'. */
  readonly cvs: readonly (number | null)[] | null;
  readonly falseBedrockP: number | null;
}

function leadingNumber(cell: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\b/.exec(cell.trim());
  return m === null ? null : Number(m[1]);
}

/** DESIGN §4.2.B's rows (the `SampleMethodParams` values §3's drawSample consumes), in document order. */
export function methodMeasurementRowsFromDesign(
  text: string = readFileSync(DESIGN_URL, 'utf8'),
): MethodMeasurementRow[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('**4.2.B Measurement parameters**'));
  if (start < 0) throw new Error('DESIGN.md has no "4.2.B Measurement parameters" table');
  const rows: MethodMeasurementRow[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (rows.length > 0 && !line.startsWith('|')) break;
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const c = tableCells(line);
    const id = /^`([^`]+)`/.exec(c[0] ?? '')?.[1];
    if (id === undefined || id === 'id') continue; // the header row names its first column `id`
    const capCell = (c[5] ?? '').replace(/^contractor\s+/, '');
    const cap = /^(\d*\.?\d+) \/ (\d*\.?\d+) \/ (\d*\.?\d+) \/ (\d*\.?\d+)/.exec(capCell);
    const cvParts = (c[6] ?? '').split(' / ').map((p) => p.trim());
    const cvs =
      cvParts.length === 4 && cvParts.every((p) => p === '—' || /^\d*\.?\d+$/.test(p))
        ? cvParts.map((p) => (p === '—' ? null : Number(p)))
        : null;
    const depth = (c[2] ?? '').trim();
    const frozen = (c[3] ?? '').trim();
    rows.push({
      id,
      positionMode: (c[1] ?? '').trim().split(/[\s(]/)[0] as string,
      maxDepthFt: depth === 'reach' ? 'reach' : leadingNumber(depth),
      frozenOk: frozen === 'yes' ? true : frozen === 'no' ? false : null,
      bedrockPenFt: /^\d*\.?\d+$/.test((c[4] ?? '').trim()) ? Number((c[4] ?? '').trim()) : null,
      capture: cap === null ? null : [Number(cap[1]), Number(cap[2]), Number(cap[3]), Number(cap[4])],
      cvs,
      falseBedrockP: leadingNumber(c[10] ?? ''),
    });
  }
  return rows;
}
