// The minimal ledger view (DESIGN §13.13 ledger chips and `ledger` refs; 13.11's full Ledger tab arrives in P1): the
// matching postings with exact cents, because the ledger is the record of account (13.2, D-13.13).
import { select, type GameState } from '../../engine';
import { usdFromCents, yearWeek } from '../format';
import type { LedgerQuery } from './ledger';

export function LedgerView({ state, title, query }: { state: GameState; title: string; query: LedgerQuery }) {
  const week = (turn: number): string => {
    const v = select.dateView(state, turn);
    return yearWeek(v.year, v.week);
  };
  const cents = (c: number): string => (c === 0 ? '' : usdFromCents(c, { style: 'ledger' }));
  const empty = query.rows.length === 0 && query.summaries.length === 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-12" data-ledger-view="">
        <caption className="mb-1 text-left text-13 font-semibold text-ink-1">{title}</caption>
        <thead>
          <tr className="border-b border-hairline text-left text-ink-2">
            <th scope="col" className="px-1 py-1 font-semibold">
              Txn
            </th>
            <th scope="col" className="px-1 py-1 font-semibold">
              Week
            </th>
            <th scope="col" className="px-1 py-1 font-semibold">
              Memo
            </th>
            <th scope="col" className="px-1 py-1 font-semibold">
              Account
            </th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">
              Debit (USD)
            </th>
            <th scope="col" className="px-1 py-1 text-right font-semibold">
              Credit (USD)
            </th>
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={6} className="px-1 py-2 text-ink-2">
                No postings match.
              </td>
            </tr>
          ) : null}
          {query.summaries.map((r, i) => (
            <tr key={`s${i}`} className="border-b border-hairline" style={{ height: 'var(--row-h)' }}>
              <td className="px-1 text-ink-3">—</td>
              <td className="px-1 text-ink-3">—</td>
              <td className="px-1">{r.label}</td>
              <td className="px-1" data-code="">
                {r.account}
              </td>
              <td className="px-1 text-right">{cents(r.debitCents)}</td>
              <td className="px-1 text-right">{cents(r.creditCents)}</td>
            </tr>
          ))}
          {query.rows.map((r, i) => (
            <tr key={`${r.txnId}-${i}`} className="border-b border-hairline" style={{ height: 'var(--row-h)' }}>
              <td className="px-1" data-code="">
                {r.txnId}
              </td>
              <td className="px-1">{week(r.turn)}</td>
              <td className="px-1">{r.memo}</td>
              <td className="px-1" data-code="">
                {r.account}
              </td>
              <td className="px-1 text-right">{cents(r.debitCents)}</td>
              <td className="px-1 text-right">{cents(r.creditCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <th scope="row" colSpan={4} className="px-1 py-1 text-left">
              Net (debits less credits)
            </th>
            <td colSpan={2} className="px-1 py-1 text-right">
              {usdFromCents(query.netCents, { style: 'ledger' })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
