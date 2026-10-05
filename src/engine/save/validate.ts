// Structural validation of a loaded state (DESIGN §2.9: load → migrate forward → validate). It checks the §2.5 frame
// and the invariants the engine relies on (tuning hash, clock, id counters, ledger balance, sorted id arrays); each
// owning section's slice internals are its own business and arrive with their checks. Returns the first problem as
// text (reported as SAVE_CORRUPT), or null.
import { hashValue } from '../core/hash';
import { isIdPrefix } from '../core/ids';
import { idsMatchRecord, isSortedIds, sortedKeysByCodeUnit } from '../core/iter';
import { turnToYearWeek } from '../core/calendar';
import { isRulesPhase } from '../state/rules';
import { SLICE_KEYS } from '../state/types';
import { ledgerProblem } from '../systems/finance/ledger';
import type { FinanceSlice } from '../systems/finance/types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function metaProblem(meta: unknown): string | null {
  if (!isRec(meta)) return 'meta is missing';
  if (typeof meta['seed'] !== 'string' || meta['seed'] === '') return 'meta.seed';
  if (!isRec(meta['setup']) || typeof meta['setup']['companyName'] !== 'string') return 'meta.setup';
  if (!isRec(meta['tuning'])) return 'meta.tuning';
  if (typeof meta['tuningHash'] !== 'string' || meta['tuningHash'] !== hashValue(meta['tuning'])) {
    return 'meta.tuningHash does not match meta.tuning';
  }
  if (typeof meta['rulesVersion'] !== 'string') return 'meta.rulesVersion';
  if (!isRulesPhase(meta['rulesPhase'])) return 'meta.rulesPhase';
  return null;
}

function clockProblem(clock: unknown): string | null {
  if (!isRec(clock)) return 'clock is missing';
  const { turn, year, week, actionSeq, phase } = clock;
  if (!isInt(turn) || turn < 0) return 'clock.turn';
  const derived = turnToYearWeek(turn);
  if (year !== derived.year || week !== derived.week) return 'clock.year/week do not match clock.turn';
  if (!isInt(actionSeq) || actionSeq < 0) return 'clock.actionSeq';
  if (!isRec(phase)) return 'clock.phase';
  return null;
}

function idsProblem(ids: unknown): string | null {
  if (!isRec(ids)) return 'ids is missing';
  for (const prefix of sortedKeysByCodeUnit(ids)) {
    if (!isIdPrefix(prefix)) return `ids.${prefix} is not a registered prefix`;
    const n = ids[prefix];
    if (!isInt(n) || n < 0) return `ids.${prefix}`;
  }
  return null;
}

function financeProblem(finance: Rec): string | null {
  const books = finance['books'];
  if (!isRec(books) || !isRec(finance['distress'])) return 'finance';
  for (const name of ['company', 'owner']) {
    const book = books[name];
    if (!isRec(book) || !Array.isArray(book['txns']) || !isRec(book['balances']) || !Array.isArray(book['monthly'])) {
      return `finance.books.${name}`;
    }
  }
  try {
    const problem = ledgerProblem(finance as unknown as FinanceSlice);
    return problem === null ? null : `ledger: ${problem}`;
  } catch (e) {
    return `ledger unreadable: ${e instanceof Error ? e.message : String(e)}`;
  }
}

function inboxProblem(inbox: Rec): string | null {
  const pairs: [string, string][] = [
    ['messages', 'messageIds'],
    ['decisions', 'decisionIds'],
    ['closedDecisions', 'closedDecisionIds'],
  ];
  for (const [recKey, idsKey] of pairs) {
    const rec = inbox[recKey];
    const ids = inbox[idsKey];
    if (!isRec(rec) || !Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return `inbox.${recKey}`;
    if (!isSortedIds(ids as string[]) || !idsMatchRecord(ids as string[], rec)) return `inbox.${idsKey} ≠ its Record`;
  }
  return null;
}

function historyProblem(history: Rec): string | null {
  const weekly = history['weekly'];
  if (!Array.isArray(weekly) || !Array.isArray(history['annual'])) return 'history';
  let last = Number.NEGATIVE_INFINITY;
  for (const snap of weekly as unknown[]) {
    if (!isRec(snap) || !isInt(snap['turn']) || !isRec(snap['market'])) return 'history.weekly entry';
    if (snap['turn'] <= last) return 'history.weekly is not ascending';
    last = snap['turn'];
  }
  return null;
}

/** The first structural problem of a state that should be at `schemaVersion`, or null. */
export function stateProblem(state: unknown, schemaVersion: number): string | null {
  if (!isRec(state)) return 'state is not an object';
  if (state['schemaVersion'] !== schemaVersion) return `state.schemaVersion is not ${schemaVersion}`;
  const problem = metaProblem(state['meta']) ?? clockProblem(state['clock']) ?? idsProblem(state['ids']);
  if (problem !== null) return problem;
  for (const key of SLICE_KEYS) if (!isRec(state[key])) return `${key} slice is missing`;
  if (state['hardRock'] !== undefined && !isRec(state['hardRock'])) return 'hardRock slice';
  const company = state['company'] as Rec;
  if (!['active', 'won', 'lost', 'retired'].includes(company['runStatus'] as string)) return 'company.runStatus';
  const ledger = financeProblem(state['finance'] as Rec);
  if (ledger !== null) return ledger;
  return inboxProblem(state['inbox'] as Rec) ?? historyProblem(state['history'] as Rec);
}
