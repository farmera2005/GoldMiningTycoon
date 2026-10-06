// §11 finance slice of GameState (DESIGN §11.1, §11.3, §11.4, §11.5, §11.7, §11.10, §11.12, §11.14, §11.16, §11.17,
// §11.18, §11.23 `FinanceSlice`; S11-6, S11-19, S13-2, S10-2; P1 contract §4.11). Every 11.23 field ships from P1 with
// an inert value (§2 D-2.60): no reorganization case, empty credit derogatory marks, the P4+ collections empty. §11
// holds no hidden field.
import type { CalcNode } from '../../core/calc';
import type {
  ArrearId,
  BillId,
  CardId,
  ClaimId,
  CovenantId,
  EmployeeId,
  EntityRef,
  FinanceOfferId,
  FinancingAgreementId,
  Id,
  InsuranceClaimId,
  LeaseId,
  LetterOfCreditId,
  LienId,
  LoanApplicationId,
  LoanId,
  LossId,
  LotId,
  MachineId,
  ObligationId,
  PolicyId,
  ProductionInterestId,
  ReorgCaseId,
  TenureId,
  TxnId,
  VendorAccountId,
} from '../../core/ids';
import type { Cents } from '../../core/money';
import type { Guarantee } from '../company/types';
import type { ClimateTemplateId, JurisdictionId } from '../world/enums';
import type { AccountCode, Book } from './accounts';

export type { AccountCode, Book } from './accounts';

export type CostCenter = 'site' | 'ga' | 'prospecting' | 'reclaim' | 'capital';

export interface PostingDims {
  claimId?: ClaimId;
  machineId?: MachineId;
  employeeId?: EmployeeId;
  lotId?: LotId;
  loanId?: LoanId;
  costCenter?: CostCenter;
}

/** One line of a posting: exactly one of debit or credit, a positive integer number of cents (§11 11.1). */
export interface PostingLine {
  account: AccountCode;
  debit?: Cents;
  credit?: Cents;
  dims?: PostingDims;
}

export interface PostingEntry {
  /** Default 'company'. */
  book?: Book;
  /** The turn the entry is dated. */
  date: number;
  lines: PostingLine[];
  memo: string;
  refs: EntityRef[];
  /** '§7/fuel', '§11/payroll', … */
  source: string;
  counterparty?: string;
}

/** A posted transaction. `seq` is the txn counter value (the numeric part of `id`), unique across both books. */
export interface Txn extends PostingEntry {
  id: TxnId;
  seq: number;
}

/** §11 11.1 balance-preserving month summary of compacted detail (compaction ships in P1 with 52 weeks of detail). */
export interface MonthlySummary {
  year: number;
  month: number;
  rows: {
    account: AccountCode;
    costCenter?: CostCenter;
    claimId?: ClaimId;
    cf: 'O' | 'I' | 'F' | 'X';
    debitCents: Cents;
    creditCents: Cents;
  }[];
}

/** One book. `balances` are signed debit-positive cents (Σ debits − Σ credits) per account. */
export interface LedgerBook {
  txns: Txn[];
  balances: Record<AccountCode, Cents>;
  monthly: MonthlySummary[];
}

/** §11 `queryLedger` filter (S11-19; §13's `ledger` ExplainRef carries one). Every field set must match. */
export interface LedgerFilter {
  book?: Book;
  /** Exact account codes, or family prefixes ending in '.' (e.g. 'cash.', 'debt.'). */
  accounts?: AccountCode[];
  fromTurn?: number;
  toTurn?: number;
  claimId?: ClaimId;
  costCenter?: CostCenter;
  minCents?: Cents;
  maxCents?: Cents;
  text?: string;
  ref?: EntityRef;
  txnIds?: TxnId[];
}

export interface LedgerPage {
  rows: Txn[];
  summaries: MonthlySummary['rows'];
  total: number;
  netCents: Cents;
}

// ---------------------------------------------------------------------------------------------------------------------
// Payments, bills, payroll (§11.3, §11.4)
// ---------------------------------------------------------------------------------------------------------------------

/** §11.4 payment categories, in no particular order (the priority order is `paymentPriority`). */
export type PayCategory =
  | 'autoDebit'
  | 'payroll.net'
  | 'payroll.taxDeposit'
  | 'margin'
  | 'regulatory.critical'
  | 'debt.secured'
  | 'insurance'
  | 'vendor.critical'
  | 'royalty.cash'
  | 'tax'
  | 'debt.unsecured'
  | 'vendor.other'
  | 'owner';

/** §11.4's default priority order (highest first). */
export const DEFAULT_PAY_PRIORITY: readonly PayCategory[] = [
  'autoDebit',
  'payroll.net',
  'payroll.taxDeposit',
  'margin',
  'regulatory.critical',
  'debt.secured',
  'insurance',
  'vendor.critical',
  'royalty.cash',
  'tax',
  'debt.unsecured',
  'vendor.other',
  'owner',
];

export interface PayeeRef {
  kind: 'vendor' | 'employee' | 'lender' | 'lessor' | 'investor' | 'owner' | 'agency' | 'buyer' | 'insurer';
  id?: string;
  name: string;
}

export interface Bill {
  id: BillId;
  payee: PayeeRef;
  category: PayCategory;
  amountCents: Cents;
  paidCents: Cents;
  issuedTurn: number;
  dueTurn: number;
  allowPartial: boolean;
  method: 'cash' | 'card';
  vendorAccountId?: VendorAccountId;
  loanId?: LoanId;
  leaseId?: LeaseId;
  obligationId?: ObligationId;
  policyId?: PolicyId;
  source: string;
  /** The batch accrual (D-11.82); null for loan payments. */
  accrualTxnId: TxnId | null;
  closedTurn: number | null;
  status: 'open' | 'paid' | 'partial' | 'late' | 'cancelled' | 'stayed';
  weeksLate: number;
  feesCents: Cents;
}

export type PayResult = {
  status: 'paid' | 'partial' | 'failed';
  paidCents: Cents;
  shortfallCents: Cents;
  txnIds: TxnId[];
};

export interface PaymentRequest {
  payee: PayeeRef;
  category: PayCategory;
  amountCents: Cents;
  allowPartial: boolean;
  origin: 'player' | 'pipeline';
  /** The non-cash side. */
  lines: PostingLine[];
  refs: EntityRef[];
  memo: string;
}

export interface ReceiptRequest {
  payer: PayeeRef;
  amountCents: Cents;
  /** The credit side. */
  lines: PostingLine[];
  refs: EntityRef[];
  memo: string;
  /** Local-buyer sale, refinery settlement, metal-account sale, forced sale of pledged metal. */
  goldSale: boolean;
}

export interface NewBill {
  payee: PayeeRef;
  category: PayCategory;
  amountCents: Cents;
  dueTurn: number;
  allowPartial: boolean;
  /** The non-AP side; null for loan payments, which split fees → interest → principal at settlement. */
  accrual: PostingLine[] | null;
  payableAccount: AccountCode;
  loanId?: LoanId;
  obligationId?: ObligationId;
  refs: EntityRef[];
  memo: string;
  source: string;
}

export interface PaymentEvent {
  turn: number;
  kind: 'paid' | 'partial' | 'failed';
  category: PayCategory;
  billId: BillId;
  shortCents: Cents;
}

export interface Arrear {
  id: ArrearId;
  billId: BillId;
  category: PayCategory;
  amountCents: Cents;
  dueTurn: number;
  weeksLate: number;
  feesCents: Cents;
}

/** §11.18 tax jurisdictions are §3's ids (D-3.46). */
export type TaxJurisdictionId = JurisdictionId;

/** §11.3 one employee's payroll line (from §8 `payrollForWeek`). */
export interface PayrollLine {
  employeeId: EmployeeId;
  grossCents: Cents;
  hours: number;
  parts: { regular: Cents; overtime: Cents; salary: Cents; bonusPaid: Cents; goldSharePaid: Cents };
  /** Season bonus / %-of-gold earned this week, payable later (→ accrued.wages). */
  bonusAccrualCents: Cents;
  costCenter: CostCenter;
  claimId?: ClaimId;
  isOwner: boolean;
  wcClass: 'mining' | 'clerical';
  jurisdictionId: TaxJurisdictionId;
}

export interface PayrollRegisterLine {
  employeeId: EmployeeId;
  costCenter: CostCenter;
  claimId?: ClaimId;
  grossCents: Cents;
  hours: number;
  trustCents: Cents;
  netCents: Cents;
  employerTaxCents: Cents;
  wcCents: Cents;
  paidCents: Cents;
  shortCents: Cents;
}

/** A week's payroll run (14b/14e), for the step-15 distress evaluation and §8's outcomes. */
export interface PayrollRunSummary {
  turn: number;
  grossCents: Cents;
  netCents: Cents;
  trustCents: Cents;
  employerTaxCents: Cents;
  paidCents: Cents;
  shortCents: Cents;
  lines: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lenders, loans, leases, credit (§11.5–§11.14)
// ---------------------------------------------------------------------------------------------------------------------

/** Data-defined lenders (`data/finance/lenders.ts`). */
export type LenderId = string;

export type ProductId =
  | 'term'
  | 'equipment'
  | 'cashOutRefi'
  | 'sbaTerm'
  | 'revolver'
  | 'hardMoney'
  | 'goldLoan'
  | 'mca'
  | 'ownerLoan'
  | 'estateNote'
  | 'sellerCarry'
  | 'deficiency'
  | 'fixedP1'
  | 'dip'
  | 'reorgSecured'
  | 'reorgPriority'
  | 'reorgUnsecured';

/** §11.5 lender tier. */
export type Tier = 'A' | 'B' | 'C' | 'D';

export type PaymentScheduleKind =
  'level' | 'skip' | 'seasonal' | 'interestOnlyOffSeason' | 'interestOnly' | 'weeklyDebit' | 'revolving';

export type LoanStatus =
  | 'current'
  | 'late'
  | 'delinquent'
  | 'default'
  | 'forbearance'
  | 'accelerated'
  | 'repossessing'
  | 'deficiency'
  | 'closed'
  | 'stayed';

export type CollateralRef =
  | { kind: 'machine'; id: MachineId; pmsi: boolean }
  | { kind: 'patented'; claimId: ClaimId }
  | { kind: 'claim'; id: ClaimId }
  | { kind: 'tenure'; tenureId: TenureId }
  | { kind: 'metal'; fineOz: number }
  | { kind: 'blanket' };

export interface Loan {
  id: LoanId;
  lenderId: LenderId;
  product: ProductId;
  originalCents: Cents;
  balanceCents: Cents;
  accruedInterestCents: Cents;
  rate: { kind: 'fixed' | 'floating'; spread: number; annual: number; stepUpPts: number; defaultPts: number };
  schedule: {
    kind: PaymentScheduleKind;
    termMonths: number;
    payMonths: number[];
    ioMonths: number[];
    paymentCents: Cents;
    firstDueTurn: number;
    maturityTurn: number;
    balloon: boolean;
  };
  collateral: CollateralRef[];
  guarantee: Guarantee | null;
  covenantIds: CovenantId[];
  crossDefault: boolean;
  status: LoanStatus;
  pastDue: { sinceTurn: number | null; amountCents: Cents; feesCents: Cents };
  milestones: { noticeTurn?: number; cureDeadlineTurn?: number; accelTurn?: number; repoTurn?: number };
  /** Last 24. */
  history: { dueTurn: number; dueCents: Cents; paidCents: Cents; weeksLate: number }[];
  promo?: { forgoneRebateCents: Cents };
  callTurn?: number;
  onForeclose?: 'land.onForeclose';
  reorgCaseId?: ReorgCaseId;
}

export interface Lease {
  id: LeaseId;
  lenderId: LenderId;
  machineId: MachineId;
  kind: 'operating' | 'finance';
  costCents: Cents;
  paymentCents: Cents;
  termMonths: number;
  firstDueTurn: number;
  hourCapPerYear: number | null;
  hoursThisLeaseYear: number;
  status: LoanStatus;
  liabilityCents?: Cents;
  endOption?: 'return' | 'buyFmv' | 'renew';
}

export interface Lien {
  id: LienId;
  loanId: LoanId;
  collateral: CollateralRef;
  filedTurn: number;
  kind: 'pmsi' | 'specific' | 'blanket' | 'vendor';
  releasedTurn?: number;
}

export interface CardAccount {
  id: CardId;
  lenderId: LenderId;
  limitCents: Cents;
  balanceCents: Cents;
  statementCents: Cents;
  statementDueTurn: number | null;
  paidInFullLast: boolean;
  consecutiveMisses: number;
  apr: number;
  penaltyApr: boolean;
  routing: PayCategory[];
}

export interface VendorAccount {
  id: VendorAccountId;
  kind: 'fuel' | 'parts' | 'contractor' | 'camp' | 'professional';
  vendorName: string;
  districtId?: Id;
  brandId?: string;
  status: 'cod' | 'terms' | 'stopSupply' | 'collections';
  limitCents: Cents;
  balanceCents: Cents;
  pastDueCents: Cents;
  oldestPastDueTurn: number | null;
  netWeeks: number;
  earlyPay?: { discountPct: number; withinWeeks: number };
  pg: boolean;
  openedTurn: number;
  lienIds: LienId[];
}

export interface LoanApplication {
  id: LoanApplicationId;
  lenderId: LenderId;
  product: ProductId;
  amountCents: Cents;
  termMonths: number;
  schedule: PaymentScheduleKind;
  collateral: CollateralRef[];
  purpose: string;
  submittedTurn: number;
  decisionTurn: number;
}

export interface FinanceOffer {
  id: FinanceOfferId;
  source: 'lender' | 'royaltyCo' | 'equity' | 'rescue' | 'forbearance';
  counterpartyId: string;
  terms: Record<string, number | string>;
  expiresTurn: number;
  calc: CalcNode | null;
}

export interface FinancingAgreement {
  id: FinancingAgreementId;
  kind: 'royaltySale' | 'stream' | 'prepay';
  counterpartyId: LenderId;
  startTurn: number;
  upfrontCents: Cents;
  claimIds: ClaimId[] | 'company';
  productionInterestId?: ProductionInterestId;
  rate: number;
  paybackMultiple?: number;
  tailRate?: number;
  streamPricePerFineOzCents?: Cents;
  stepDownValueCents?: Cents;
  schedule?: { dueTurn: number; fineOz: number }[];
  deliveredFineOz: number;
  deliveredValueCents: Cents;
  deferredBalanceCents: Cents;
  arrearsFineOz: number;
  buyback?: { beforePaybackCents: Cents; tailMultipleOfTrailingYear: number };
  status: 'active' | 'tail' | 'complete' | 'default' | 'boughtOut';
}

export type CovenantCadence = 'monthly' | 'quarterly' | 'annual' | 'continuous';

export interface CovenantDef {
  kind:
    | 'dscr'
    | 'minLiquidity'
    | 'maxLeverage'
    | 'reporting'
    | 'bbc'
    | 'cleanUp'
    | 'hedging'
    | 'capexLimit'
    | 'distributions'
    | 'insurance'
    | 'negativePledge';
  threshold: number;
  cadence: CovenantCadence;
}

export interface CovenantState {
  id: CovenantId;
  loanId: LoanId;
  def: CovenantDef;
  lastValue: number | null;
  lastTestTurn: number | null;
  headroomPct: number | null;
  status: 'ok' | 'watch' | 'breach' | 'cure' | 'waived' | 'default';
  cureDeadlineTurn: number | null;
  breaches104w: number;
  stepUpActive: boolean;
  monitoringUntilTurn: number | null;
}

export interface Derog {
  kind: string;
  turn: number;
  base: number;
  mult: number;
  halfLifeWeeks: number;
  maxAgeWeeks: number;
  ref: Id;
}

export interface StandbyLoc {
  id: LetterOfCreditId;
  bondId: Id;
  faceCents: Cents;
  feeNextTurn: number;
  status: 'open' | 'drawn' | 'released';
}

// ---------------------------------------------------------------------------------------------------------------------
// Insurance and tax (§11.17, §11.18)
// ---------------------------------------------------------------------------------------------------------------------

export interface Policy {
  id: PolicyId;
  line: 'equipment' | 'breakdown' | 'gl' | 'wc' | 'auto' | 'goldStorage' | 'crime' | 'pollution' | 'umbrella';
  scheduled?: { machineId: MachineId; insuredValueCents: Cents }[];
  limitCents: Cents;
  deductible: { kind: 'flat' | 'pct'; value: number };
  annualPremiumCents: Cents;
  installments: 'annual' | 'monthly';
  renewalWeek: 49;
  status: 'active' | 'lapsed' | 'nonRenewed' | 'forcePlaced';
  claimsMult: number;
  marketMult: number;
}

export interface LossEvent {
  id: LossId;
  turn: number;
  source: '§8' | '§9' | '§10' | '§12';
  cause:
    | 'fire'
    | 'flood'
    | 'theft'
    | 'overturn'
    | 'collision'
    | 'contamination'
    | 'breakdown'
    | 'injury'
    | 'liability'
    | 'other';
  lossCents: Cents;
  machineId?: MachineId;
  lotIds?: LotId[];
  employeeId?: EmployeeId;
  claimId?: ClaimId;
  locationKey?: string;
  thirdParty?: boolean;
  pollution?: boolean;
  totalLoss?: boolean;
  wc?: { incurredCents: Cents; medicalOnly: boolean };
  breakdown?: { component: string; healthAtFailure: number; pmOverduePct: number };
}

export interface InsuranceClaim {
  id: InsuranceClaimId;
  lossId: LossId;
  policyId: PolicyId;
  approvedCents: Cents;
  deductibleCents: Cents;
  settleTurn: number;
  status: 'pending' | 'settled';
}

export interface TaxBasis {
  costCents: Cents;
  adjustedCents: Cents;
  placedTurn: number;
  method: 'bonus100' | 'macrs7' | 'macrs5' | 'inherited7';
}

export interface TaxInstallment {
  book: Book;
  dueTurn: number;
  requiredCents: Cents;
  paidCents: Cents;
  method: 'safeHarbor' | 'annualized';
}

// ---------------------------------------------------------------------------------------------------------------------
// Distress and reorganization (§11.16)
// ---------------------------------------------------------------------------------------------------------------------

/** §11 `distress.liquidation`: set by step 15 (or a filing); §1 step 16d ends the run on it. */
export interface LiquidationFlag {
  cause: 'filed' | 'involuntary' | 'converted' | 'p1Counter';
  turn: number;
  caseId: ReorgCaseId | null;
}

export interface DistressState {
  stage: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  enteredTurn: number;
  history: { turn: number; stage: number }[];
  /** Stage 7 only. */
  form: 'reorganization' | 'liquidation' | null;
  /** §13 ladder widget. */
  nextTrigger: { stage: number; text: string; week: number; amountCents: Cents } | null;
  missedPayrollRuns: number;
  weeksAtStage4Plus: number;
  guaranteeDemands: { loanId: LoanId; amountCents: Cents; dueTurn: number; paidCents: Cents }[];
  tfrp: { assessedCents: Cents; unpaidCents: Cents; assessedTurn: number | null; pausedSinceTurn: number | null };
  /** The P1 insolvency counter (S11-17). */
  p1: { openSinceTurn: number | null };
  petitionDecisionId: Id | null;
  liquidation: LiquidationFlag | null;
}

/** §5 5.14 a tenure's treatment in a reorganization plan. */
export type ClaimPlanTreatment =
  | { kind: 'keep' }
  | { kind: 'sell'; reserveCents: Cents }
  | { kind: 'surrender'; creditor: { kind: 'lender' | 'investor' | 'npc'; id: Id } };

export interface ReorgPlanTerms {
  termWeeks: number;
  schedule: 'level' | 'seasonal';
  reservePct: number;
  surrender: CollateralRef[];
  rejectLeaseIds: Id[];
  rejectTenureIds: TenureId[];
  ownerContributionCents: Cents;
  claimTreatments: Record<TenureId, ClaimPlanTreatment>;
}

export interface ReorgCase {
  id: ReorgCaseId;
  filedTurn: number;
  how: 'voluntary' | 'involuntaryConverted';
  ownerIsDebtor: boolean;
  status: 'filed' | 'confirmed' | 'completed' | 'converted';
  planDueTurn: number;
  plan: ReorgPlanTerms | null;
  planFiledTurn: number | null;
  hearingTurn: number | null;
  denials: number;
  amendDueTurn: number | null;
  claims: {
    secured: { loanId: LoanId; claimCents: Cents; collateralValueCents: Cents }[];
    priorityCents: Cents;
    unsecuredCents: Cents;
    adminCents: Cents;
    debtsAtFilingCents: Cents;
  };
  stayedBillIds: BillId[];
  stayedLoanIds: LoanId[];
  reliefLoanIds: LoanId[];
  adequateProtection: Record<LoanId, { monthlyCents: Cents; unpaidSinceTurn: number | null }>;
  confirmation: {
    turn: number;
    consensual: boolean;
    termWeeks: number;
    pdiCents: Cents;
    pdi0Cents: Cents;
    noteIds: LoanId[];
    scheduledUnsecuredCents: Cents;
    unsecuredClaimCents: Cents;
    effectiveDateCents: Cents;
    dischargedCents: Cents;
    trusteeOnAllPayments: boolean;
  } | null;
  missedPaymentTurns: number[];
  trueUps: { turn: number; cents: Cents }[];
  feesCents: Cents;
  closedTurn: number | null;
  closeReason:
    | 'completed'
    | 'planNotFiled'
    | 'notConfirmed'
    | 'missedPayments'
    | 'payrollCollapse'
    | 'postFilingTaxes'
    | 'involuntary'
    | 'debtorConverted'
    | null;
}

export interface ReorgSlice {
  active: ReorgCase | null;
  history: ReorgCase[];
}

// ---------------------------------------------------------------------------------------------------------------------
// The slice (§11.23)
// ---------------------------------------------------------------------------------------------------------------------

export interface FinanceSlice {
  books: Record<Book, LedgerBook>;
  sweep: { operatingTargetCents: Cents; autoDrawRevolver: boolean; autoPaydownRevolver: boolean };
  paymentPriority: PayCategory[];
  bills: Record<BillId, Bill>;
  billIds: BillId[];
  arrears: Record<ArrearId, Arrear>;
  arrearIds: ArrearId[];
  loans: Record<LoanId, Loan>;
  loanIds: LoanId[];
  leases: Record<LeaseId, Lease>;
  liens: Record<LienId, Lien>;
  cards: Record<CardId, CardAccount>;
  vendorAccounts: Record<VendorAccountId, VendorAccount>;
  applications: Record<LoanApplicationId, LoanApplication>;
  offers: Record<FinanceOfferId, FinanceOffer>;
  agreements: Record<FinancingAgreementId, FinancingAgreement>;
  covenants: Record<CovenantId, CovenantState>;
  credit: {
    owner: { score: number; anchor: number; derogs: Derog[]; inquiries: number[] };
    company: { fileExists: boolean; paydex: number | null; U: number; derogs: Derog[]; tradeLines: Id[] };
  };
  insurance: {
    policies: Record<PolicyId, Policy>;
    claims: Record<InsuranceClaimId, InsuranceClaim>;
    losses: Record<LossId, LossEvent & { status: 'open' | 'filed' | 'absorbed' | 'uninsured'; decideByTurn: number }>;
    emr: number;
  };
  tax: {
    elections: Record<number, 'bonus100' | 'macrs'>;
    estimateMethod: 'safeHarbor' | 'annualized';
    distributionPolicy: 'auto' | 'manual';
    nol: { company: Cents; owner: Cents };
    priorYear: { companyTax: Cents; ownerTax: Cents; ownerAgi: Cents };
    basis: { machines: Record<MachineId, TaxBasis>; claims: Record<ClaimId, TaxBasis> };
    akHolidayStartTurn: number | null;
    installments: TaxInstallment[];
  };
  /** Lot cost lives on §10 GoldLot.costBasisCents. */
  inventory: { pools: Record<string, Cents>; cleanedThisWeek: LotId[] };
  locs: Record<LetterOfCreditId, StandbyLoc>;
  /** Bill id → obligation id. */
  obligationsByBill: Record<BillId, ObligationId>;
  /** Last 13 runs (11.3). */
  payrollRegister: { turn: number; lines: PayrollRegisterLine[] }[];
  payrollYtd: Record<EmployeeId, Cents>;
  payrollQtdByJurisdiction: Record<string, Cents>;
  distress: DistressState;
  reorg: ReorgSlice;
  /** Season-year anchor (11.14, D-11.62). */
  primaryClimate: ClimateTemplateId;
}

export function emptyLedgerBook(): LedgerBook {
  return { txns: [], balances: {}, monthly: [] };
}

const ZERO = 0 as Cents;

export function emptyDistressState(): DistressState {
  return {
    stage: 0,
    enteredTurn: 0,
    history: [],
    form: null,
    nextTrigger: null,
    missedPayrollRuns: 0,
    weeksAtStage4Plus: 0,
    guaranteeDemands: [],
    tfrp: { assessedCents: ZERO, unpaidCents: ZERO, assessedTurn: null, pausedSinceTurn: null },
    p1: { openSinceTurn: null },
    petitionDecisionId: null,
    liquidation: null,
  };
}

/**
 * The slice at its inert values. `operatingTargetCents` and the owner's credit score are filled from tuning by the
 * start (N9) under P1 rules; the empty slice keeps them at 0.
 */
export function emptyFinanceSlice(): FinanceSlice {
  return {
    books: { company: emptyLedgerBook(), owner: emptyLedgerBook() },
    sweep: { operatingTargetCents: ZERO, autoDrawRevolver: false, autoPaydownRevolver: false },
    paymentPriority: [...DEFAULT_PAY_PRIORITY],
    bills: {},
    billIds: [],
    arrears: {},
    arrearIds: [],
    loans: {},
    loanIds: [],
    leases: {},
    liens: {},
    cards: {},
    vendorAccounts: {},
    applications: {},
    offers: {},
    agreements: {},
    covenants: {},
    credit: {
      owner: { score: 0, anchor: 0, derogs: [], inquiries: [] },
      company: { fileExists: false, paydex: null, U: 0, derogs: [], tradeLines: [] },
    },
    insurance: { policies: {}, claims: {}, losses: {}, emr: 1 },
    tax: {
      elections: {},
      estimateMethod: 'safeHarbor',
      distributionPolicy: 'auto',
      nol: { company: ZERO, owner: ZERO },
      priorYear: { companyTax: ZERO, ownerTax: ZERO, ownerAgi: ZERO },
      basis: { machines: {}, claims: {} },
      akHolidayStartTurn: null,
      installments: [],
    },
    inventory: { pools: {}, cleanedThisWeek: [] },
    locs: {},
    obligationsByBill: {},
    payrollRegister: [],
    payrollYtd: {},
    payrollQtdByJurisdiction: {},
    distress: emptyDistressState(),
    reorg: { active: null, history: [] },
    primaryClimate: 'northernInterior',
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Contract types (S11-6, S11-9, S11-17, S13-2, S10-2)
// ---------------------------------------------------------------------------------------------------------------------

/** `createLoan`'s spec (P1 products: the estate note, the banker stub's fixed loan, the owner loan). */
export interface LoanSpec {
  product: 'estateNote' | 'fixedP1' | 'ownerLoan';
  lenderName: string;
  principalCents: Cents;
  annualRate: number;
  termMonths: number;
  schedule: 'level' | 'seasonal';
  payMonths?: number[];
  fundedTo: 'cash' | 'none';
  guarantee?: Guarantee | null;
  collateral: CollateralRef[];
}

/** The week's not-yet-billed costs and payroll (S10-2: what standing orders must leave room for). */
export interface PendingWeekCosts {
  unbilledCents: Cents;
  payrollCents: Cents;
}

/** `distressStatus` (S11-9, S11-17): the P1 view of the ladder and the counter's levers. */
export interface DistressStatusP1 {
  stage: 0 | 1 | 2 | 3;
  stageKey: 'none' | 'lateVendors' | 'missedLoan' | 'missedPayroll';
  p1Counter: {
    open: boolean;
    openSinceTurn: number | null;
    weeksOpen: number;
    graceWeeks: number;
    netCashCents: Cents;
  };
  counterMoves: {
    kind: 'sellGold' | 'quickSellClaim' | 'sellIron' | 'injectEquity' | 'injectLoan';
    valueCents: Cents;
    ref?: EntityRef;
  }[];
  liquidation: DistressState['liquidation'];
}

/** `fundingPreview` (S13-2): what this week's settlement will need and whether it is funded. */
export interface FundingPreview {
  needCents: Cents;
  fundCents: Cents;
  autoGoldCents: Cents;
  shortfallCents: Cents;
  firstShort: { category: PayCategory; shortCents: Cents; consequenceKey: string } | null;
}

/** `forecast13Week` (P1 outflows S11-14; memoized, S11-23). */
export interface Forecast13Week {
  weeks: {
    turn: number;
    outflowsCents: Cents;
    inflowsSchedCents: Cents;
    inflowsProdCents: Cents;
    endCashCents: Cents;
  }[];
  productionByClaim: Record<ClaimId, Cents>;
}

/** A statement period (§11.19). */
export type FinancePeriod =
  | { kind: 'year'; year: number }
  | { kind: 'quarter'; year: number; quarter: 1 | 2 | 3 | 4 }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'turns'; fromTurn: number; toTurn: number };

/** §11.19.5 cost per ounce of a period. */
export interface CostPerOunce {
  fineOzRecovered: number;
  cashCostCents: Cents;
  aiscCents: Cents;
  cashCostPerOzCents: Cents | null;
  aiscPerOzCents: Cents | null;
}

/** §11.19 one line of a statement. */
export interface StatementLine {
  key: string;
  label: string;
  cents: Cents;
}

/** §11.19 per-claim P&L row. */
export interface ClaimPnLRow {
  claimId: ClaimId;
  revenueCents: Cents;
  costCents: Cents;
  allocatedGaCents: Cents;
  netCents: Cents;
}
