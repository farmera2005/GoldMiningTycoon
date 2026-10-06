// Reads DESIGN.md's §1 1.11 difficulty table (the canonical list of difficulty-scaled keys, D-1.44) so the data tests
// can check src/data/difficulty.ts against the document itself, not against a copy that could drift from it.
import { readFileSync } from 'node:fs';

export type DifficultyCells = { readonly easy: string; readonly standard: string; readonly hard: string };

/** One key of a 1.11 row with its three cells (a multi-key row's cells split per key, see `splitPerKey`). */
export interface DifficultyRow {
  readonly key: string;
  readonly knob: string;
  readonly cells: DifficultyCells;
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
    const e = splitPerKey(easy, keys.length);
    const s = splitPerKey(standard, keys.length);
    const h = splitPerKey(hard, keys.length);
    keys.forEach((key, j) => {
      rows.push({ key, knob, cells: { easy: e[j] as string, standard: s[j] as string, hard: h[j] as string } });
    });
  }
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
