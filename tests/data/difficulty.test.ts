// The difficulty table against DESIGN §1 1.11 (D-1.44, §1 1.22 "Difficulty", §2.10 cross-references): every
// src/data/difficulty.ts key is a 1.11 row and a resolvable tuning key; every 1.11 row whose key exists in this
// build's tuning is in difficulty.ts with exactly 1.11's values; the other rows wait for their owners' keys. Standard
// leaves the base tuning (and so the goldens and the standard tuningHash) unchanged; easy and hard differ where 1.11
// says they do, and §1 1.22's start figures follow through newGame.
import { describe, expect, it } from 'vitest';
import { difficultyTable, type Difficulty } from '../../src/data/difficulty';
import { baseTuning, type TuningValue } from '../../src/data/tuning';
import {
  defaultNewGameSetup,
  newGame,
  resolveTuning,
  select,
  tuningHashOf,
  type GameState,
  type NewGameSetup,
} from '../../src/engine';
import {
  cellNumber,
  cellNumbers,
  difficultyRowsFromDesign,
  tuningKeysOfCell,
  tuningTableRowsFromDesign,
  type DifficultyRow,
  type TuningTableRow,
} from './designTables';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'standard', 'hard'];
const ROWS: readonly DifficultyRow[] = difficultyRowsFromDesign();
const ROW_BY_KEY: Readonly<Record<string, DifficultyRow>> = Object.fromEntries(ROWS.map((r) => [r.key, r]));
const has = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);
const TABLE: Readonly<Record<string, unknown>> = difficultyTable;
const BASE: Readonly<Record<string, TuningValue>> = baseTuning;

/**
 * How a 1.11 cell becomes the key's resolved value. A key whose owner ships it must be listed here when it joins
 * the build, or the "exactly 1.11's values" test fails and names it.
 */
type Interpretation =
  | { readonly kind: 'number' }
  | { readonly kind: 'mix'; readonly fields: readonly string[] }
  | { readonly kind: 'probabilityTableTimes' };

const INTERPRETATION: Readonly<Record<string, Interpretation>> = {
  // ".55/.30/.12/.03" in the knob's order: accurate / optimistic / cherry-picked / fraudulent.
  'geology.seller.honestyMix': { kind: 'mix', fields: ['accurate', 'optimistic', 'cherryPicked', 'fraudulent'] },
  // "× 1.15": every detection probability of the base table times the multiplier, capped at 1.
  'geology.seller.tellDetect': { kind: 'probabilityTableTimes' },
  // §4 4.20: the three difficulty-scaled §4 multipliers (base 1.0).
  'geology.recordsFindMult': { kind: 'number' },
  'geology.pitStopMult': { kind: 'number' },
  'geology.contractorLeadMult': { kind: 'number' },
  'game.startCompanyCashMult': { kind: 'number' },
  'game.startPersonalCashMult': { kind: 'number' },
  // P1 Wave 0 (contracts-data; P1 contract §9.2): every cell a plain number, so each is { set }.
  'land.askMarkup': { kind: 'number' },
  'staff.resumeBiasMult': { kind: 'number' },
  'finance.p1InsolvencyGraceWeeks': { kind: 'number' },
  'finance.distress.watchWeeks': { kind: 'number' },
  'land.leaseCureWeeks': { kind: 'number' },
  'events.frequencyMult': { kind: 'number' },
  'events.severityMult': { kind: 'number' },
  'events.budgetPerHalf': { kind: 'number' },
  'events.catastropheEarliestTurn': { kind: 'number' },
  'events.distressMercyMult': { kind: 'number' },
  'game.season.sigmaMult': { kind: 'number' },
  'game.season.freezeUpMeanShift': { kind: 'number' },
  'staff.poolSizeMult': { kind: 'number' },
  'staff.wageAskMult': { kind: 'number' },
  'staff.quitHazardMult': { kind: 'number' },
  'game.inheritorDebtMult': { kind: 'number' },
  'game.scoreMult': { kind: 'number' },
  // §9's two rows, ready for when fleet-catalog's keys land (P1 contract §9.2 defers them to P3; the rows join
  // data/difficulty.ts with the keys, so this test fails and names them if a key arrives without its row).
  'fleet.privateLemonShare': { kind: 'number' },
  'fleet.failureHazardMult': { kind: 'number' },
};

function expectedValue(key: string, cell: string): TuningValue {
  const how = INTERPRETATION[key];
  if (how === undefined) throw new Error(`${key}: add its 1.11 interpretation to this test`);
  switch (how.kind) {
    case 'number':
      return cellNumber(cell);
    case 'mix': {
      const values = cellNumbers(cell);
      expect(values, `${key} ${cell}`).toHaveLength(how.fields.length);
      return Object.fromEntries(how.fields.map((f, i) => [f, values[i] as number]));
    }
    case 'probabilityTableTimes': {
      const mult = cellNumber(cell);
      const table = BASE[key] as Readonly<Record<string, Readonly<Record<string, number>>>>;
      return Object.fromEntries(
        Object.entries(table).map(([row, cols]) => [
          row,
          Object.fromEntries(Object.entries(cols).map(([col, p]) => [col, Math.min(1, p * mult)])),
        ]),
      );
    }
  }
}

const setupFor = (difficulty: Difficulty): NewGameSetup =>
  defaultNewGameSetup({ companyName: 'Difficulty Test', difficulty });
const resolved = (d: Difficulty): Readonly<Record<string, TuningValue>> => resolveTuning(setupFor(d));

describe('DESIGN §1 1.11 as read from DESIGN.md', () => {
  it('lists the table’s keys, including every one this build interprets', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(40);
    for (const k of Object.keys(INTERPRETATION)) expect(ROW_BY_KEY[k], k).toBeDefined();
    expect(ROW_BY_KEY['game.startCompanyCashMult']?.cells).toEqual({ easy: '1.25', standard: '1.0', hard: '0.85' });
    expect(ROW_BY_KEY['events.severityMult']?.cells).toEqual({ easy: '0.7', standard: '1.0', hard: '1.3' });
    expect(ROW_BY_KEY['hardrock.capex.scheduleMed']?.cells.hard).toBe('× 1.05');
  });

  it('parses the cell notations it uses', () => {
    expect(cellNumber('× 1.15')).toBe(1.15);
    expect(cellNumber('−30')).toBe(-30);
    expect(cellNumber('+0.5')).toBe(0.5);
    expect(cellNumbers('.55/.30/.12/.03')).toEqual([0.55, 0.3, 0.12, 0.03]);
    expect(() => cellNumber('on')).toThrow();
  });
});

describe('src/data/difficulty.ts ↔ §1 1.11 (D-1.44)', () => {
  it('every difficulty key is a 1.11 row and a resolvable tuning key, with an entry for all three difficulties', () => {
    for (const key of Object.keys(TABLE)) {
      expect(ROW_BY_KEY[key], `${key} is not a §1 1.11 row`).toBeDefined();
      expect(has(BASE, key), `${key} is not a tuning key of this build`).toBe(true);
      const row = TABLE[key] as Record<string, unknown>;
      expect(Object.keys(row).sort()).toEqual([...DIFFICULTIES].sort());
      for (const d of DIFFICULTIES) {
        const entry = row[d] as Record<string, unknown>;
        expect(Object.keys(entry).length, `${key}.${d}`).toBe(1);
        if (has(entry, 'mul')) expect(typeof BASE[key], `${key}: { mul } needs a numeric base`).toBe('number');
        else expect(has(entry, 'set'), `${key}.${d} is neither { mul } nor { set }`).toBe(true);
      }
    }
  });

  const present = ROWS.filter((r) => has(BASE, r.key)).map((r) => r.key);
  const deferred = ROWS.filter((r) => !has(BASE, r.key)).map((r) => r.key);

  it(`every 1.11 row is in difficulty.ts once its key exists in this build (${present.length} now; ${deferred.length} deferred)`, () => {
    for (const key of present) expect(has(TABLE, key), `${key} exists in tuning but has no difficulty row`).toBe(true);
    for (const key of deferred) expect(has(TABLE, key), key).toBe(false);
    console.info(
      `§1 1.11: ${present.length} rows in difficulty.ts (${present.join(', ')}); ${deferred.length} deferred until ` +
        `their owners add the key: ${deferred.join(', ')}`,
    );
    expect([...present].sort()).toEqual(Object.keys(TABLE).sort());
  });

  it('resolves every row to exactly 1.11’s value at every difficulty, applying each entry once', () => {
    const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, resolved(d)]));
    for (const key of Object.keys(TABLE)) {
      const row = ROW_BY_KEY[key] as DifficultyRow;
      for (const d of DIFFICULTIES) {
        expect(byDifficulty[d]?.[key], `${key} on ${d} (1.11: ${row.cells[d]})`).toEqual(
          expectedValue(key, row.cells[d]),
        );
      }
    }
  });

  it('standard leaves the base tuning unchanged, so the standard tuningHash is the base tables’ hash', () => {
    const standard = resolved('standard');
    expect(standard).toEqual(BASE);
    expect(tuningHashOf(resolveTuning(setupFor('standard')))).toBe(tuningHashOf(BASE as typeof standard as never));
    for (const key of Object.keys(TABLE)) {
      expect(expectedValue(key, (ROW_BY_KEY[key] as DifficultyRow).cells.standard), key).toEqual(BASE[key]);
    }
  });

  it('easy and hard differ from standard exactly where 1.11 says they do', () => {
    const easy = resolved('easy');
    const hard = resolved('hard');
    let differing = 0;
    for (const key of Object.keys(TABLE)) {
      const { cells } = ROW_BY_KEY[key] as DifficultyRow;
      for (const [d, t] of [
        ['easy', easy],
        ['hard', hard],
      ] as const) {
        const differs = cells[d] !== cells.standard;
        if (differs) differing++;
        if (differs) expect(t[key], `${key} on ${d}`).not.toEqual(BASE[key]);
        else expect(t[key], `${key} on ${d}`).toEqual(BASE[key]);
      }
    }
    // P0: honesty mix 2, tell detection 2, records find 1 (hard only), pit stops 2, contractor lead 2, start cash
    // 2 + 2 = 13. P1 Wave 0's 17 rows each differ on easy and on hard: 13 + 34 = 47.
    expect(differing).toBe(47);
    const hashes = DIFFICULTIES.map((d) => tuningHashOf(resolveTuning(setupFor(d))));
    expect(new Set(hashes).size).toBe(3);
  });

  it('leaves ops.freezeDamageProb unscaled (§1 1.11 note, D-7.41)', () => {
    expect(ROW_BY_KEY['ops.freezeDamageProb']).toBeUndefined();
    expect(has(TABLE, 'ops.freezeDamageProb')).toBe(false);
  });
});

describe('converse Diff-cell scan of every tuning table (§1 1.22, D-1.67, §2.10)', () => {
  const TABLE_ROWS: readonly TuningTableRow[] = tuningTableRowsFromDesign();
  const KEYS_111 = new Set(ROWS.map((r) => r.key));
  const where = (r: TuningTableRow): string => `§${r.section} line ${r.line} (${r.keys.join(', ') || 'no key'})`;
  const keyRows = TABLE_ROWS.filter((r) => !r.pointer);

  it('reads every section’s tuning table', () => {
    const sections = new Set(TABLE_ROWS.map((r) => r.section));
    for (const s of ['1.20', '2.16', '3.16', '4.20', '5.19', '6.19', '7.21', '8.18', '9.15', '10.19', '11.25', '12.22'])
      expect(sections.has(s), s).toBe(true);
    for (const s of ['13.25', '14.19']) expect(sections.has(s), s).toBe(true);
    expect(keyRows.length).toBeGreaterThan(500);
  });

  it('parses the key-cell notations the tables use', () => {
    expect(tuningKeysOfCell('`capex.overrunMed` / `scheduleMed`', '14')).toEqual([
      'hardrock.capex.overrunMed',
      'hardrock.capex.scheduleMed',
    ]);
    expect(tuningKeysOfCell('`poolSizeMult` / `wageAskMult` / `quitHazardMult`', '8')).toEqual([
      'staff.poolSizeMult',
      'staff.wageAskMult',
      'staff.quitHazardMult',
    ]);
    expect(tuningKeysOfCell('`autoPayDefault` (land / permit / bond)', '6')).toEqual(['permits.autoPayDefault']);
    expect(tuningKeysOfCell('`market.localBuyer.{repHighMin,repLowMax}`', '10')).toEqual([
      'market.localBuyer.repHighMin',
      'market.localBuyer.repLowMax',
    ]);
  });

  it('every Diff cell reads exactly yes or no, pointer rows (no key of their own) aside', () => {
    const bad = keyRows.filter((r) => r.diff !== 'yes' && r.diff !== 'no').map(where);
    expect(bad).toEqual([]);
  });

  it('a yes row names only 1.11 keys, and a no row names none', () => {
    const yesWithOthers = keyRows.filter((r) => r.diff === 'yes' && r.keys.some((k) => !KEYS_111.has(k)));
    expect(yesWithOthers.map(where)).toEqual([]);
    const noWith111 = keyRows.filter((r) => r.diff === 'no' && r.keys.some((k) => KEYS_111.has(k)));
    expect(noWith111.map(where)).toEqual([]);
  });

  it('every 1.11 key has a yes row in its owner’s table (ops.freezeDamageProb reads no)', () => {
    const yesKeys = new Map<string, string>();
    for (const r of keyRows) if (r.diff === 'yes') for (const k of r.keys) yesKeys.set(k, r.section);
    const missing = ROWS.filter((r) => !yesKeys.has(r.key)).map((r) => r.key);
    expect(missing).toEqual([]);
    const wrongOwner = ROWS.filter((r) => r.owner !== null && yesKeys.get(r.key)?.split('.')[0] !== r.owner).map(
      (r) => `${r.key}: 1.11 owner §${r.owner}, yes row in §${yesKeys.get(r.key) ?? '—'}`,
    );
    expect(wrongOwner).toEqual([]);
    const freeze = keyRows.find((r) => r.keys.includes('ops.freezeDamageProb'));
    expect(freeze?.diff).toBe('no');
  });
});

describe('difficulty through newGame (§1 1.22, D-1.43, D-1.64, D-3.18)', () => {
  const games: Partial<Record<Difficulty, GameState>> = {};
  const game = (d: Difficulty): GameState => (games[d] ??= newGame(setupFor(d), 'difficulty-seed'));
  const ownerCash = (s: GameState): number => s.finance.books.owner.balances['own.cash'] ?? 0;

  it('books 1.11’s start cash: easy $500k + $132k, standard $400k + $120k, hard $340k + $108k', () => {
    const expected: Record<Difficulty, [number, number]> = {
      easy: [50_000_000, 13_200_000],
      standard: [40_000_000, 12_000_000],
      hard: [34_000_000, 10_800_000],
    };
    for (const d of DIFFICULTIES) {
      const s = game(d);
      expect(select.cashOnHand(s), d).toBe(expected[d][0]);
      expect(ownerCash(s), d).toBe(expected[d][1]);
      expect(select.netWorth(s, 'scoring'), d).toBe(expected[d][0] + expected[d][1]);
    }
  });

  it('keeps the ground truth identical across difficulties and shifts only seller honesty', () => {
    const truth = (s: GameState) => s.world.claimIds.map((id) => s.world.claims[id]?.hidden.truthHash).join(',');
    expect(truth(game('easy'))).toBe(truth(game('standard')));
    expect(truth(game('hard'))).toBe(truth(game('standard')));
    const share = (s: GameState, honesty: string): number => {
      const holders = Object.values(s.world.holders);
      return holders.filter((h) => h.honesty === honesty).length / holders.length;
    };
    // 1.11: accurate .55 / .35 / .20 and fraudulent .03 / .08 / .15 before situation tilts.
    expect(share(game('easy'), 'accurate')).toBeGreaterThan(share(game('hard'), 'accurate'));
    expect(share(game('easy'), 'fraudulent')).toBeLessThan(share(game('hard'), 'fraudulent'));
  });
});
