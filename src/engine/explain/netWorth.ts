// explain.netWorth (DESIGN §1 1.13, §11 11.20): the scoring net worth as company NW (assets at player-visible marks
// minus liabilities) plus the owner's personal items. P0 form: every mark is a ledger balance; §9 machine resale, §10
// lots and metal accounts and §1's equity waterfall join the tree when those systems hold state.
import type { CalcNode } from '../core/calc';
import { sortedKeys } from '../core/iter';
import { centsToUsd, type Cents } from '../core/money';
import type { GameState } from '../state/types';
import { accountDef, accountFamilyOf, type AccountCode } from '../systems/finance/accounts';
import { accountBalance } from '../systems/finance/ledger';
import { companyNetWorthCents, ownerNetWorthCents } from '../systems/finance/netWorth';
import type { LedgerBook } from '../systems/finance/types';

const usd = (c: number): number => centsToUsd(c as Cents);

function ledgerLeaf(label: string, cents: number, account: AccountCode): CalcNode {
  return { label, value: usd(cents), unit: 'usd', note: `ledger ${account}` };
}

function companyAssetNodes(state: GameState): CalcNode[] {
  const book = state.finance.books.company;
  const out: CalcNode[] = [];
  for (const account of sortedKeys(book.balances)) {
    const bal = accountBalance(book, account);
    if (bal === 0) continue;
    const def = accountDef(account);
    if (def === null || (def.cls !== 'asset' && def.cls !== 'contraAsset')) continue;
    const scoredAtBook =
      account.startsWith('cash.') ||
      accountFamilyOf(account) === 'cash.restricted' ||
      ['deposits.bonds', 'prepaid', 'ar.refinery', 'ar.insurance', 'ar.other', 'inv.fuel'].includes(account) ||
      account.startsWith('mineral.');
    if (scoredAtBook) out.push(ledgerLeaf(def.line, bal, account));
    if (account === 'inv.parts') {
      const factor = state.meta.tuning['game.nw.partsResaleFactor'];
      const f = typeof factor === 'number' ? factor : 0;
      out.push({
        label: 'Parts at resale',
        value: usd(bal) * f,
        unit: 'usd',
        op: 'product',
        children: [
          ledgerLeaf(def.line, bal, account),
          {
            label: 'Parts resale factor',
            value: f,
            unit: 'mult',
            source: { kind: 'tuning', key: 'game.nw.partsResaleFactor' },
          },
        ],
      });
    }
  }
  return out;
}

function liabilityNodes(book: LedgerBook): CalcNode[] {
  const out: CalcNode[] = [];
  for (const account of sortedKeys(book.balances)) {
    const bal = accountBalance(book, account);
    if (bal === 0 || accountDef(account)?.cls !== 'liability') continue;
    out.push(ledgerLeaf(accountDef(account)?.line ?? account, bal, account)); // credit balances are negative
  }
  return out;
}

/** Company NW (§1 1.13, P0 form). */
export function explainCompanyNetWorth(state: GameState): CalcNode {
  const children = [...companyAssetNodes(state), ...liabilityNodes(state.finance.books.company)];
  const node: CalcNode = {
    label: 'Company net worth',
    value: usd(companyNetWorthCents(state.finance, state.meta.tuning)),
    unit: 'usd',
    op: 'sum',
    note: 'Player-visible marks only (§1 1.13); claims at cost',
  };
  if (children.length > 0) node.children = children;
  return node;
}

/** netWorth(state, 'scoring') → company NW + the owner's personal items. */
export function explainNetWorth(state: GameState): CalcNode {
  const owner = state.finance.books.owner;
  const personal: CalcNode[] = [];
  for (const account of ['own.cash', 'own.loanToCompany', 'own.personalDebt', 'own.guaranteeDue', 'own.taxDue']) {
    const bal = accountBalance(owner, account);
    if (bal !== 0) personal.push(ledgerLeaf(accountDef(account)?.line ?? account, bal, account));
  }
  return {
    label: 'Owner net worth (scoring)',
    value: usd(ownerNetWorthCents(state.finance, state.meta.tuning)),
    unit: 'usd',
    op: 'sum',
    children: [explainCompanyNetWorth(state), ...personal],
    note: 'No equity holders yet, so the owner share is the whole company (§1 1.8.1)',
  };
}
