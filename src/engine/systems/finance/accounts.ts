// Chart of accounts (DESIGN §11 11.1–11.2). Account codes are part of the save format and the explain links, so the
// chart is one fixed table: an exact code, or a family whose members are `<family>.<suffix>` (sub-ledgers per loan,
// lease, agreement or restricted-cash purpose). Statements map by account and cost center (11.19, P1+).

export type Book = 'company' | 'owner';
export type AccountCode = string;

/** Balance-sheet or income-statement class. Contra assets carry credit balances against an asset line. */
export type AccountClass = 'asset' | 'contraAsset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * §11 11.2 cash-flow class: O operating, W operating working capital, I investing, F financing, N non-cash (reversed in
 * the indirect method), C cash. `null` where the class is set per entry (exp.casualtyLoss, exp.theftLoss: N or O).
 */
export type CfClass = 'O' | 'W' | 'I' | 'F' | 'N' | 'C';

export interface AccountDef {
  readonly book: Book;
  readonly cls: AccountClass;
  readonly cf: CfClass | null;
  /** Statement line the account rolls up to. */
  readonly line: string;
  /** Cash for the no-overdraft invariant (§11 11.1: posting that would drive it negative throws CASH_NEGATIVE). */
  readonly cash?: true;
}

const A = (cf: CfClass | null, line: string, cash?: true): AccountDef =>
  cash ? { book: 'company', cls: 'asset', cf, line, cash } : { book: 'company', cls: 'asset', cf, line };
const L = (cf: CfClass | null, line: string): AccountDef => ({ book: 'company', cls: 'liability', cf, line });
const E = (cf: CfClass | null, line: string): AccountDef => ({ book: 'company', cls: 'equity', cf, line });
const I = (cf: CfClass | null, line: string): AccountDef => ({ book: 'company', cls: 'income', cf, line });
const X = (cf: CfClass | null, line: string): AccountDef => ({ book: 'company', cls: 'expense', cf, line });
const own = (cls: AccountClass, line: string, cash?: true): AccountDef =>
  cash ? { book: 'owner', cls, cf: null, line, cash } : { book: 'owner', cls, cf: null, line };

/** Exact account codes (§11 11.2, company book; then the owner book). */
export const ACCOUNTS = {
  'cash.operating': A('C', 'Cash', true),
  'cash.reserve': A('C', 'Cash', true),
  'ar.refinery': A('W', 'Refinery receivables'),
  'ar.insurance': A('W', 'Insurance claims receivable'),
  'ar.other': A('W', 'Other receivables'),
  'inv.gold': A('W', 'Gold inventory'),
  'inv.parts': A('W', 'Parts inventory'),
  'inv.fuel': A('W', 'Fuel stockpile'),
  prepaid: A('W', 'Prepaid and deposits'),
  'ppe.equipment': A('I', 'Equipment'),
  'ppe.accumDep': { book: 'company', cls: 'contraAsset', cf: 'N', line: 'Accumulated depreciation' },
  'mineral.properties': A('I', 'Mineral properties'),
  'mineral.accumDepletion': { book: 'company', cls: 'contraAsset', cf: 'N', line: 'Accumulated depletion' },
  'deposits.bonds': A('I', 'Bond deposits'),
  'ap.vendors': L('W', 'Accounts payable'),
  'ap.payroll': L('W', 'Net wages payable'),
  'accrued.wages': L('W', 'Accrued wages'),
  'accrued.payrollTax.trust': L('W', 'Payroll taxes: trust funds'),
  'accrued.payrollTax.employer': L('W', 'Payroll taxes: employer'),
  'accrued.incomeTax': L('W', 'Income tax payable'),
  'accrued.taxesOther': L('W', 'Production, license and property taxes'),
  'accrued.royalties': L('W', 'Royalties payable'),
  'accrued.interest': L('W', 'Accrued interest'),
  'accrued.other': L('W', 'Other accrued liabilities'),
  'cc.cards': L('F', 'Credit cards'),
  'liab.reclamation': L('N', 'Reclamation liability'),
  'liab.suretyIndemnity': L('W', 'Surety indemnity'),
  'liab.agencyJudgment': L('W', 'Agency judgment'),
  'liab.forwardDelivery': L('W', 'Forward close-outs owed'),
  'liab.deliveryArrears': L('W', 'Delivery arrears'),
  'liab.refineryAdvance': L('W', 'Refinery advances'),
  'eq.ownerCapital': E('F', "Owner's capital"),
  'eq.investor': E('F', 'Investor equity'),
  'eq.retained': E(null, 'Retained earnings'),
  'eq.draws': E('F', 'Distributions'),
  'rev.gold': I('O', 'Gold revenue'),
  'inc.hedgeGainLoss': I('O', 'Hedging gain (loss)'),
  'gain.assetSale': I('N', 'Gain (loss) on disposal'),
  'gain.insurance': I('N', 'Insurance recovery'),
  'gain.debtDischarge': I('N', 'Debt discharged in reorganization'),
  'inc.interest': I('O', 'Interest income'),
  'inc.other': I('O', 'Other income'),
  'exp.fuel': X('O', 'Fuel'),
  'exp.wages': X('O', 'Wages'),
  'exp.payrollTax': X('O', 'Payroll taxes'),
  'exp.workersComp': X('O', "Workers' compensation"),
  'exp.camp': X('O', 'Camp'),
  'exp.parts': X('O', 'Parts'),
  'exp.repairsContract': X('O', 'Contract repairs'),
  'exp.consumables': X('O', 'Consumables'),
  'exp.royaltyCash': X('O', 'Cash royalties'),
  'exp.rental': X('O', 'Equipment rental'),
  'exp.opLease': X('O', 'Operating leases'),
  'exp.insurance': X('O', 'Insurance'),
  'exp.permitsFees': X('O', 'Permits and fees'),
  'exp.claimFees': X('O', 'Claim fees'),
  'exp.prospecting': X('O', 'Prospecting'),
  'exp.mobilization': X('O', 'Mobilization'),
  'exp.refiningAssay': X('O', 'Refining and assay'),
  'exp.ga': X('O', 'General and administrative'),
  'exp.goldHandling': X('O', 'Gold handling'),
  'exp.taxesOther': X('O', 'Production, license and property taxes'),
  'exp.staffing': X('O', 'Staffing'),
  'exp.depreciation': X('N', 'Depreciation'),
  'exp.depletion': X('N', 'Depletion'),
  'exp.reclamationProvision': X('N', 'Reclamation provision'),
  'exp.reclamationAccretion': X('N', 'Reclamation accretion'),
  'exp.inventoryChange': X('O', 'Inventory change'),
  'exp.inventoryWritedown': X('N', 'Inventory write-down'),
  'exp.casualtyLoss': X(null, 'Casualty loss'),
  'exp.theftLoss': X(null, 'Theft loss'),
  'exp.interest': X('O', 'Interest'),
  'exp.financeFees': X('O', 'Finance fees'),
  'exp.fines': X('O', 'Fines and penalties'),
  'exp.reorganization': X('O', 'Reorganization items'),
  'exp.incomeTax': X('O', 'Income tax'),
  // Owner book (§11 11.2 "Owner book").
  'own.cash': own('asset', 'Personal cash', true),
  'own.loanToCompany': own('asset', 'Loan to company'),
  'own.personalDebt': own('liability', 'Personal debt'),
  'own.guaranteeDue': own('liability', 'Guarantee demands due'),
  'own.taxDue': own('liability', 'Personal tax due'),
  'own.equity': own('equity', "Owner's personal equity"),
  'own.inc.draws': own('income', 'Draws received'),
  'own.inc.salaryNet': own('income', 'Net salary'),
  'own.inc.dividends': own('income', 'Dividends'),
  'own.inc.interest': own('income', 'Interest'),
  'own.exp.living': own('expense', 'Living costs'),
  'own.exp.tax': own('expense', 'Personal tax'),
  'own.exp.interest': own('expense', 'Interest'),
  'own.exp.guaranteePaid': own('expense', 'Guarantees paid'),
  'own.exp.medical': own('expense', 'Medical'),
} as const satisfies Record<string, AccountDef>;

/**
 * Sub-ledger families: a member is `<family>.<suffix>` with a non-empty suffix (§11 11.1 "Sub-ledger accounts").
 * Restricted cash has a fixed purpose list; loans, leases and agreements are suffixed by their ids (`debt.ownerLoan`
 * is the subordinated owner loan).
 */
export const ACCOUNT_FAMILIES = {
  'cash.restricted': A('I', 'Restricted cash', true),
  debt: L('F', 'Debt'),
  lease: L('F', 'Finance-lease liabilities'),
  'deferred.revenue': L('F', 'Deferred revenue'),
} as const satisfies Record<string, AccountDef>;

export const RESTRICTED_CASH_PURPOSES = ['bond', 'suretyCollateral', 'lenderCollateral', 'margin', 'escrow'] as const;

export type ExactAccountCode = keyof typeof ACCOUNTS;
export type AccountFamily = keyof typeof ACCOUNT_FAMILIES;

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
const SUFFIX = /^[A-Za-z0-9_]+$/;

/** The family of a sub-ledger code (`debt.loan_000004` → `debt`), or null. */
export function accountFamilyOf(code: AccountCode): AccountFamily | null {
  for (const family of ['cash.restricted', 'deferred.revenue', 'debt', 'lease'] as const) {
    if (code.startsWith(`${family}.`)) {
      const suffix = code.slice(family.length + 1);
      if (!SUFFIX.test(suffix)) return null;
      if (family === 'cash.restricted' && !(RESTRICTED_CASH_PURPOSES as readonly string[]).includes(suffix))
        return null;
      return family;
    }
  }
  return null;
}

/** The account's definition, or null for a code outside the chart. */
export function accountDef(code: AccountCode): AccountDef | null {
  if (hasOwn(ACCOUNTS, code)) return ACCOUNTS[code as ExactAccountCode];
  const family = accountFamilyOf(code);
  return family === null ? null : ACCOUNT_FAMILIES[family];
}

/** Natural-balance sign: +1 for debit-normal classes (assets, expenses), −1 for credit-normal ones. */
export function normalSign(cls: AccountClass): 1 | -1 {
  return cls === 'asset' || cls === 'expense' ? 1 : -1;
}
