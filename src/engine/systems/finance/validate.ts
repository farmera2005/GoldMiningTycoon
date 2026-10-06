// §11 finance slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record, then calls this: both books are present, and in both
// ledgers every transaction balances and sits in its own book, `seq` ascends, no cash account is negative, the book
// sums to zero and the cached balances equal a recomputation from the journal and monthly summaries.
import { ledgerProblem } from './ledger';
import type { FinanceSlice } from './types';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

export function financeSliceProblem(slice: Readonly<Rec>): string | null {
  const books = slice['books'];
  if (!isRec(books) || !isRec(slice['distress'])) return 'finance';
  for (const name of ['company', 'owner']) {
    const book = books[name];
    if (!isRec(book) || !Array.isArray(book['txns']) || !isRec(book['balances']) || !Array.isArray(book['monthly'])) {
      return `finance.books.${name}`;
    }
  }
  try {
    const problem = ledgerProblem(slice as unknown as FinanceSlice);
    return problem === null ? null : `ledger: ${problem}`;
  } catch (e) {
    return `ledger unreadable: ${e instanceof Error ? e.message : String(e)}`;
  }
}
