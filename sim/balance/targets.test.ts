// The targets registry against BALANCE.md itself: every ID of §7's table is present, every registered clause belongs to
// a §7 row, and each clause's per-phase status (G, R, —) is the table's. Interim bands for O-01 are checked too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHASES, TARGETS, ruleFor, type Applicability, type TargetClause } from './targets';

const balance = readFileSync(new URL('../../BALANCE.md', import.meta.url), 'utf8');

interface Row {
  /** One entry per slash-separated group of the ID cell: the clause prefixes it names. */
  groups: string[][];
  /** cells[phase − 1] = the raw P1…P6 cell. */
  cells: string[];
}

function clauseId(base: string, sub: string): string {
  return /^[a-z]$/.test(sub) ? `${base}${sub}` : `${base}.${sub}`;
}

/**
 * One slash-separated group of a §7 ID cell → clause prefixes. "T-01, T-10 (a, c)" → T-01, T-10a, T-10c; a group
 * without an ID ("(c)", "(a) and market") continues the previous group's ID: T-08c; T-09a, T-09.market.
 */
function expandGroup(text: string, carried: string | null): { ids: string[]; base: string | null } {
  const ids: string[] = [];
  let base = carried;
  let pending: string | null = null;
  for (const m of text.matchAll(/([TOG]-\d{2})|\(([^)]*)\)|and market/g)) {
    if (m[1] !== undefined) {
      if (pending !== null) ids.push(pending);
      base = m[1];
      pending = m[1];
    } else if (m[2] !== undefined && base !== null) {
      for (const sub of m[2].split(',').map((x) => x.trim())) ids.push(clauseId(base, sub));
      pending = null;
    } else if (base !== null) {
      ids.push(`${base}.market`);
    }
  }
  if (pending !== null) ids.push(pending);
  return { ids, base };
}

function section7Rows(): Row[] {
  const start = balance.indexOf('## 7. Phase applicability and interim bands');
  const end = balance.indexOf('\n---', start);
  const lines = balance
    .slice(start, end)
    .split('\n')
    .filter((l) => /^\| [TOG]-\d{2}/.test(l));
  return lines.map((line) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const groups: string[][] = [];
    let base: string | null = null;
    for (const g of (cells[0] as string).split(' / ')) {
      const r = expandGroup(g, base);
      base = r.base;
      groups.push(r.ids);
    }
    return { groups, cells: cells.slice(1) };
  });
}

function statusOf(cellPart: string): Applicability {
  const c = cellPart.trim();
  if (c.startsWith('G')) return 'G';
  if (c.startsWith('R')) return 'R';
  if (c.startsWith('—')) return '—';
  throw new Error(`unreadable §7 status '${cellPart}'`);
}

function matches(prefix: string, c: TargetClause): boolean {
  if (c.id === prefix) return true;
  if (!c.id.startsWith(prefix)) return false;
  const rest = c.id.slice(prefix.length);
  return /^[a-z.]/.test(rest);
}

const rows = section7Rows();

describe('targets registry vs BALANCE §7', () => {
  it('reads every §7 row', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(rows.flatMap((r) => r.groups.flat())).toEqual(
      expect.arrayContaining([
        'T-01',
        'T-08a',
        'T-08b',
        'T-08c',
        'T-08d',
        'T-09a',
        'T-09b',
        'T-09c',
        'T-09.market',
        'T-10a',
        'T-10b',
        'T-10c',
        'O-01.S2',
        'O-01.B2',
        'O-06a',
        'O-06d',
        'G-09',
      ]),
    );
  });

  it('registers at least one clause for every ID §7 names, with §7’s status in every phase', () => {
    for (const row of rows) {
      row.groups.forEach((ids, g) => {
        for (const id of ids) {
          const clauses = TARGETS.filter((c) => matches(id, c));
          expect(clauses.length, `no clause for ${id}`).toBeGreaterThan(0);
          for (const p of PHASES) {
            const cell = row.cells[p - 1] as string;
            const parts = cell.split(' / ');
            const part = parts.length === row.groups.length ? (parts[g] as string) : cell;
            for (const c of clauses) expect(ruleFor(c, p)?.status, `${c.id} in P${p}`).toBe(statusOf(part));
          }
        }
      });
    }
  });

  it('has no clause outside §7’s table', () => {
    const named = rows.flatMap((r) => r.groups.flat());
    for (const c of TARGETS)
      expect(
        named.some((id) => matches(id, c)),
        c.id,
      ).toBe(true);
  });

  it('uses unique clause ids', () => {
    const ids = TARGETS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries O-01’s interim S2 bands and B2 floors by phase (§7)', () => {
    const row = rows.find((r) => r.groups[0]?.includes('O-01.S2')) as Row;
    const s2 = TARGETS.find((c) => c.id === 'O-01.S2') as TargetClause;
    const b2 = TARGETS.find((c) => c.id === 'O-01.B2') as TargetClause;
    for (const p of PHASES) {
      const [sText, bText] = (row.cells[p - 1] as string).split(' / ') as [string, string];
      const range = /(\d+)–(\d+)%/.exec(sText);
      const floor = /≥ (\d+)%/.exec(bText);
      expect(ruleFor(s2, p)?.band?.lo).toBeCloseTo(Number(range?.[1]) / 100, 9);
      expect(ruleFor(s2, p)?.band?.hi).toBeCloseTo(Number(range?.[2]) / 100, 9);
      expect(ruleFor(b2, p)?.band?.lo).toBeCloseTo(Number(floor?.[1]) / 100, 9);
    }
  });

  it('carries O-06 (a)’s and O-02’s interim bands where §7 states them', () => {
    const a = TARGETS.find((c) => c.id === 'O-06a.inheritor') as TargetClause;
    expect(ruleFor(a, 1)?.band).toMatchObject({ lo: 0.45, hi: 0.85 });
    expect(ruleFor(a, 3)?.band).toMatchObject({ lo: 0.5, hi: 0.8 });
    const o2 = TARGETS.find((c) => c.id === 'O-02.cautious') as TargetClause;
    expect(ruleFor(o2, 1)?.band).toMatchObject({ lo: 0.2, hi: 0.45 });
    expect(ruleFor(o2, 3)?.band).toMatchObject({ lo: 0.12, hi: 0.35 });
  });

  it('gives P0 no rule', () => {
    for (const c of TARGETS) expect(ruleFor(c, 0)).toBeNull();
  });
});
