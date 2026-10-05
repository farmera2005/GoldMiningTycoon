// Entity ids (DESIGN §2.4 "IDs"): strings `prefix_000123` from per-prefix counters in `state.ids`, zero-padded to six
// digits (wider past 999,999). Every prefix is registered here with its owning section; a lint rule and a registry
// test reject unregistered prefixes. `lst` is the one counter shared by two owners (§5 claim listings and §9
// equipment listings, D-2.8) and `emp_owner` is the only id not drawn from a counter.

export interface IdPrefixDef {
  /** Owning DESIGN section(s). Exactly one, except `lst` (§5 and §9 share one counter). */
  readonly owners: readonly number[];
  readonly label: string;
}

export const ID_PREFIXES = {
  // §1
  ivr: { owners: [1], label: 'investor agreement' },
  // §2
  dec: { owners: [2], label: 'pending decision' },
  // §3
  dst: { owners: [3], label: 'district' },
  clm: { owners: [3], label: 'claim' },
  blk: { owners: [3], label: 'block' },
  crk: { owners: [3], label: 'creek' },
  hld: { owners: [3], label: 'holder (NPC seller key)' },
  // §4
  prog: { owners: [4], label: 'prospecting program' },
  smp: { owners: [4], label: 'sample' },
  rec: { owners: [4], label: 'record finding' },
  rpt: { owners: [4], label: 'report' },
  ctr: { owners: [4], label: 'prospecting contractor' },
  eng: { owners: [4], label: 'consultant engagement' },
  // §5 (lst shared with §9)
  lst: { owners: [5, 9], label: 'listing (claim or equipment)' },
  ten: { owners: [5], label: 'tenure' },
  neg: { owners: [5], label: 'negotiation' },
  auc: { owners: [5], label: 'claim auction' },
  pi: { owners: [5], label: 'production interest' },
  stk: { owners: [5], label: 'staking job' },
  jv: { owners: [5], label: 'joint venture' },
  cls: { owners: [5], label: 'closing' },
  dil: { owners: [5], label: 'diligence' },
  def: { owners: [5], label: 'title defect' },
  // §6
  prm: { owners: [6], label: 'permit' },
  app: { owners: [6], label: 'permit application' },
  obl: { owners: [6], label: 'obligation' },
  bnd: { owners: [6], label: 'bond' },
  sq: { owners: [6], label: 'surety quote' },
  insp: { owners: [6], label: 'regulatory inspection' },
  vio: { owners: [6], label: 'violation' },
  ord: { owners: [6], label: 'stop-work or abatement order' },
  // §7
  well: { owners: [7], label: 'drilled well' },
  swo: { owners: [7], label: 'site work order' },
  // §8 (emp_owner is reserved, see EMP_OWNER)
  emp: { owners: [8], label: 'employee' },
  cand: { owners: [8], label: 'candidate' },
  inj: { owners: [8], label: 'injury record' },
  rcr: { owners: [8], label: 'recruiter order' },
  // §9
  mch: { owners: [9], label: 'machine' },
  fo: { owners: [9], label: 'factory order' },
  aev: { owners: [9], label: 'equipment auction event' },
  wo: { owners: [9], label: 'shop work order' },
  po: { owners: [9], label: 'parts order' },
  rct: { owners: [9], label: 'rental, lease or rent-to-own contract' },
  trn: { owners: [9], label: 'transport job' },
  mi: { owners: [9], label: 'machine inspection' },
  fsc: { owners: [9], label: 'field-service callout' },
  sale: { owners: [9], label: 'private sale' },
  // §10
  lot: { owners: [10], label: 'gold lot' },
  fwd: { owners: [10], label: 'forward' },
  shp: { owners: [10], label: 'shipment' },
  nws: { owners: [10], label: 'news item' },
  put: { owners: [10], label: 'put option' },
  lb: { owners: [10], label: 'local buyer' },
  mov: { owners: [10], label: 'courier move' },
  // §11
  acct: { owners: [11], label: 'bank account' },
  txn: { owners: [11], label: 'ledger transaction' },
  loan: { owners: [11], label: 'loan' },
  lease: { owners: [11], label: 'lease money record' },
  bill: { owners: [11], label: 'bill' },
  arr: { owners: [11], label: 'arrear' },
  lien: { owners: [11], label: 'lien' },
  pol: { owners: [11], label: 'insurance policy' },
  icl: { owners: [11], label: 'insurance claim' },
  loss: { owners: [11], label: 'loss event' },
  lapp: { owners: [11], label: 'loan application' },
  foff: { owners: [11], label: 'finance offer' },
  agr: { owners: [11], label: 'financing agreement' },
  cov: { owners: [11], label: 'covenant' },
  card: { owners: [11], label: 'card account' },
  vac: { owners: [11], label: 'vendor account' },
  loc: { owners: [11], label: 'standby letter of credit' },
  reo: { owners: [11], label: 'reorganization case' },
  // §12 (modifier ids are `${evtId}/m${k}` or `${prpId}/m${k}`, not counter ids)
  evt: { owners: [12], label: 'event instance' },
  cmp: { owners: [12], label: 'competitor' },
  prp: { owners: [12], label: 'preparation' },
  // §13
  msg: { owners: [13], label: 'inbox message' },
  // §14 (optional hard-rock track)
  lod: { owners: [14], label: 'lode system' },
  vn: { owners: [14], label: 'vein' },
  hrs: { owners: [14], label: 'hard-rock site' },
  mil: { owners: [14], label: 'mill' },
  tml: { owners: [14], label: 'toll mill' },
  tc: { owners: [14], label: 'toll contract' },
  tl: { owners: [14], label: 'toll lot' },
  cap: { owners: [14], label: 'capital project' },
  lab: { owners: [14], label: 'lab' },
} as const satisfies Record<string, IdPrefixDef>;

export type IdPrefix = keyof typeof ID_PREFIXES;

/** A counter id with prefix P. The brand stops a ClaimId from being passed where a MachineId is expected. */
export type Id<P extends IdPrefix = IdPrefix> = string & { readonly __idPrefix: P };

export type InvestorAgreementId = Id<'ivr'>;
export type DecId = Id<'dec'>;
export type DistrictId = Id<'dst'>;
export type ClaimId = Id<'clm'>;
export type BlockId = Id<'blk'>;
export type CreekId = Id<'crk'>;
export type HolderId = Id<'hld'>;
export type ProgramId = Id<'prog'>;
export type SampleId = Id<'smp'>;
export type RecordFindingId = Id<'rec'>;
export type ReportId = Id<'rpt'>;
export type ContractorId = Id<'ctr'>;
export type EngagementId = Id<'eng'>;
/** §5 claim listing. Shares the `lst` counter with equipment listings, but the brand keeps the stores apart. */
export type ClaimListingId = Id<'lst'> & { readonly __listing: 'claim' };
/** §9 equipment listing. Shares the `lst` counter with claim listings. */
export type EquipListingId = Id<'lst'> & { readonly __listing: 'equip' };
export type TenureId = Id<'ten'>;
export type NegotiationId = Id<'neg'>;
export type ClaimAuctionId = Id<'auc'>;
export type ProductionInterestId = Id<'pi'>;
export type StakingJobId = Id<'stk'>;
export type JvId = Id<'jv'>;
export type ClosingId = Id<'cls'>;
export type DiligenceId = Id<'dil'>;
export type DefectId = Id<'def'>;
export type PermitId = Id<'prm'>;
export type ApplicationId = Id<'app'>;
export type ObligationId = Id<'obl'>;
export type BondId = Id<'bnd'>;
export type SuretyQuoteId = Id<'sq'>;
export type RegInspectionId = Id<'insp'>;
export type ViolationId = Id<'vio'>;
export type OrderId = Id<'ord'>;
export type WellId = Id<'well'>;
export type SiteWorkOrderId = Id<'swo'>;
/** Includes the reserved owner pseudo-employee `emp_owner`. */
export type EmployeeId = Id<'emp'>;
export type CandidateId = Id<'cand'>;
export type InjuryId = Id<'inj'>;
export type RecruiterOrderId = Id<'rcr'>;
export type MachineId = Id<'mch'>;
export type FactoryOrderId = Id<'fo'>;
export type AuctionEventId = Id<'aev'>;
export type ShopWorkOrderId = Id<'wo'>;
export type PartsOrderId = Id<'po'>;
export type RentalContractId = Id<'rct'>;
export type TransportJobId = Id<'trn'>;
export type MachineInspectionId = Id<'mi'>;
export type FieldServiceCalloutId = Id<'fsc'>;
export type PrivateSaleId = Id<'sale'>;
export type LotId = Id<'lot'>;
export type ForwardId = Id<'fwd'>;
export type ShipmentId = Id<'shp'>;
export type NewsId = Id<'nws'>;
export type PutId = Id<'put'>;
export type LocalBuyerId = Id<'lb'>;
export type CourierMoveId = Id<'mov'>;
export type AccountId = Id<'acct'>;
export type TxnId = Id<'txn'>;
export type LoanId = Id<'loan'>;
export type LeaseId = Id<'lease'>;
export type BillId = Id<'bill'>;
export type ArrearId = Id<'arr'>;
export type LienId = Id<'lien'>;
export type PolicyId = Id<'pol'>;
export type InsuranceClaimId = Id<'icl'>;
export type LossId = Id<'loss'>;
export type LoanApplicationId = Id<'lapp'>;
export type FinanceOfferId = Id<'foff'>;
export type FinancingAgreementId = Id<'agr'>;
export type CovenantId = Id<'cov'>;
export type CardId = Id<'card'>;
export type VendorAccountId = Id<'vac'>;
export type LetterOfCreditId = Id<'loc'>;
export type ReorgCaseId = Id<'reo'>;
export type EvtId = Id<'evt'>;
export type CompetitorId = Id<'cmp'>;
export type PrepId = Id<'prp'>;
export type MsgId = Id<'msg'>;
export type LodeId = Id<'lod'>;
export type VeinId = Id<'vn'>;
export type HardRockSiteId = Id<'hrs'>;
export type MillId = Id<'mil'>;
export type TollMillId = Id<'tml'>;
export type TollContractId = Id<'tc'>;
export type TollLotId = Id<'tl'>;
export type CapitalProjectId = Id<'cap'>;
export type LabId = Id<'lab'>;

/** The owner pseudo-employee (§8): the only id not drawn from a counter; sorts before every numbered `emp_`. */
export const EMP_OWNER = 'emp_owner' as EmployeeId;

/** Plant lines are positional, not counter ids (D-2.31): a claim's lines are exactly L1 … Ln. */
export type LineId = 'L1' | 'L2' | 'L3';
export const LINE_IDS: readonly LineId[] = ['L1', 'L2', 'L3'];

/** `${claimId}/${lineId}`, the EntityRef id of a plant line (D-2.31), e.g. `clm_000042/L2`. */
export type PlantLineRefId = `${ClaimId}/${LineId}`;

export function plantLineRefId(claimId: ClaimId, lineId: LineId): PlantLineRefId {
  return `${claimId}/${lineId}`;
}

/** Deterministic modifier id `${sourceId}/m${k}` (k = effect index), for event and preparation modifiers (§2.10). */
export function modifierId(sourceId: EvtId | PrepId, k: number): string {
  if (!Number.isSafeInteger(k) || k < 0)
    throw new RangeError(`modifierId: effect index must be an integer ≥ 0, got ${k}`);
  return `${sourceId}/m${k}`;
}

/**
 * Entity kinds for EntityRef (§2.4). Each counter kind maps to its prefix; `lst` backs two kinds. Non-counter kinds
 * name entities whose ids are data keys or composites: plant lines, effect modifiers, the player's company, and the
 * data-defined lenders, equipment models and brands.
 */
export const COUNTER_ENTITY_KINDS = {
  investorAgreement: 'ivr',
  decision: 'dec',
  district: 'dst',
  claim: 'clm',
  block: 'blk',
  creek: 'crk',
  holder: 'hld',
  program: 'prog',
  sample: 'smp',
  recordFinding: 'rec',
  report: 'rpt',
  contractor: 'ctr',
  engagement: 'eng',
  claimListing: 'lst',
  tenure: 'ten',
  negotiation: 'neg',
  claimAuction: 'auc',
  productionInterest: 'pi',
  stakingJob: 'stk',
  jointVenture: 'jv',
  closing: 'cls',
  diligence: 'dil',
  defect: 'def',
  permit: 'prm',
  application: 'app',
  obligation: 'obl',
  bond: 'bnd',
  suretyQuote: 'sq',
  regInspection: 'insp',
  violation: 'vio',
  order: 'ord',
  well: 'well',
  siteWorkOrder: 'swo',
  employee: 'emp',
  candidate: 'cand',
  injury: 'inj',
  recruiterOrder: 'rcr',
  machine: 'mch',
  equipListing: 'lst',
  factoryOrder: 'fo',
  auctionEvent: 'aev',
  shopWorkOrder: 'wo',
  partsOrder: 'po',
  rentalContract: 'rct',
  transportJob: 'trn',
  machineInspection: 'mi',
  fieldServiceCallout: 'fsc',
  privateSale: 'sale',
  lot: 'lot',
  forward: 'fwd',
  shipment: 'shp',
  newsItem: 'nws',
  putOption: 'put',
  localBuyer: 'lb',
  courierMove: 'mov',
  bankAccount: 'acct',
  ledgerTxn: 'txn',
  loan: 'loan',
  lease: 'lease',
  bill: 'bill',
  arrear: 'arr',
  lien: 'lien',
  policy: 'pol',
  insuranceClaim: 'icl',
  lossEvent: 'loss',
  loanApplication: 'lapp',
  financeOffer: 'foff',
  financingAgreement: 'agr',
  covenant: 'cov',
  cardAccount: 'card',
  vendorAccount: 'vac',
  letterOfCredit: 'loc',
  reorgCase: 'reo',
  event: 'evt',
  competitor: 'cmp',
  preparation: 'prp',
  message: 'msg',
  lodeSystem: 'lod',
  vein: 'vn',
  hardRockSite: 'hrs',
  mill: 'mil',
  tollMill: 'tml',
  tollContract: 'tc',
  tollLot: 'tl',
  capitalProject: 'cap',
  lab: 'lab',
} as const satisfies Record<string, IdPrefix>;

export type CounterEntityKind = keyof typeof COUNTER_ENTITY_KINDS;
export const NON_COUNTER_ENTITY_KINDS = ['plantLine', 'modifier', 'company', 'lender', 'model', 'brand'] as const;
export type NonCounterEntityKind = (typeof NON_COUNTER_ENTITY_KINDS)[number];
export type EntityKind = CounterEntityKind | NonCounterEntityKind;

/** Names an entity unambiguously for explain links and §13 routes (§2.4). */
export interface EntityRef {
  kind: EntityKind;
  id: string;
}

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export function isIdPrefix(s: string): s is IdPrefix {
  return hasOwn(ID_PREFIXES, s);
}

/** `prefix_000123`: six digits minimum, wider once the counter passes 999,999 (§2.4). */
export function formatId<P extends IdPrefix>(prefix: P, n: number): Id<P> {
  if (!isIdPrefix(prefix)) throw new RangeError(`formatId: unregistered prefix '${String(prefix)}'`);
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`formatId: counter must be a safe integer ≥ 0, got ${n}`);
  return `${prefix}_${String(n).padStart(6, '0')}` as Id<P>;
}

export interface ParsedId {
  readonly prefix: IdPrefix;
  /** The counter value; null for the reserved `emp_owner`. */
  readonly num: number | null;
}

const CANONICAL_ID = /^([a-z]+)_(\d{6,})$/;

/** Parses a canonical registered id (exactly what formatId produces, or `emp_owner`); anything else gives null. */
export function parseId(id: string): ParsedId | null {
  if (id === EMP_OWNER) return { prefix: 'emp', num: null };
  const m = CANONICAL_ID.exec(id);
  if (m === null) return null;
  const prefix = m[1] as string;
  const digits = m[2] as string;
  if (!isIdPrefix(prefix)) return null;
  const num = Number(digits);
  if (!Number.isSafeInteger(num) || formatId(prefix, num) !== id) return null;
  return { prefix, num };
}

/** True when `id` is a canonical id with the given prefix (`emp_owner` counts as an `emp` id). */
export function isIdOf<P extends IdPrefix>(id: string, prefix: P): id is Id<P> {
  return parseId(id)?.prefix === prefix;
}

/**
 * Draws the next id for `prefix`: increments the counter (first id is `_000001`) and returns the formatted id.
 * Mutates `counters`; call it on an Immer draft of `state.ids`.
 */
export function nextId<P extends IdPrefix>(counters: Partial<Record<IdPrefix, number>>, prefix: P): Id<P> {
  const n = (counters[prefix] ?? 0) + 1;
  counters[prefix] = n;
  return formatId(prefix, n);
}

export function nextClaimListingId(counters: Partial<Record<IdPrefix, number>>): ClaimListingId {
  return nextId(counters, 'lst') as ClaimListingId;
}

export function nextEquipListingId(counters: Partial<Record<IdPrefix, number>>): EquipListingId {
  return nextId(counters, 'lst') as EquipListingId;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ordering (§2.3 item 3, D-2.20). compareIds is a total order over all strings:
//   • an id-shaped string `prefix_digits[/rest]` (prefix in a–z) sorts by prefix (code units), then `emp_owner`
//     before every numbered id of its prefix, then the numeric value of the digits (not lexically, so clm_1000000
//     follows clm_999999), then the composite tail (`/L2`, `/m10`) in natural order (digit runs numerically);
//   • any other string compares by UTF-16 code units, and against an id it compares with the id's prefix (a string
//     equal to the prefix sorts first);
//   • remaining ties (e.g. leading zeros: clm_01 vs clm_1) fall back to code-unit order.
// Every string maps to a tuple — [s] for other strings, [prefix, rank, digitCount, digits, tail, s] for ids — and the
// order is lexicographic over these tuples, which makes it reflexive, antisymmetric and transitive.
// ---------------------------------------------------------------------------------------------------------------------

/** Decomposed sort key of an id-shaped string. */
export interface IdShape {
  readonly prefix: string;
  /** 0 for the reserved `emp_owner`, 1 for numbered ids. */
  readonly rank: 0 | 1;
  /** Digits without leading zeros ('0' for zero). */
  readonly digits: string;
  /** Composite tail including its leading '/', or ''. */
  readonly tail: string;
}

const ID_SHAPE = /^([a-z]+)_(\d+)(\/[\s\S]*)?$/;
const OWNER_SHAPE: IdShape = { prefix: 'emp', rank: 0, digits: '', tail: '' };

export function idShape(s: string): IdShape | null {
  if (s === EMP_OWNER) return OWNER_SHAPE;
  const m = ID_SHAPE.exec(s);
  if (m === null) return null;
  const raw = m[2] as string;
  let z = 0;
  while (z < raw.length - 1 && raw.charCodeAt(z) === 48) z++;
  return { prefix: m[1] as string, rank: 1, digits: z === 0 ? raw : raw.slice(z), tail: m[3] ?? '' };
}

/** UTF-16 code-unit order (what `<` does on strings): locale-free, identical in every engine. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

const isDigit = (c: number): boolean => c >= 48 && c <= 57;

/** Natural order for composite tails: digit runs compare numerically, other runs by code units. A total preorder. */
function compareNatural(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const aDigit = isDigit(a.charCodeAt(i));
    const bDigit = isDigit(b.charCodeAt(j));
    let ie = i + 1;
    while (ie < a.length && isDigit(a.charCodeAt(ie)) === aDigit) ie++;
    let je = j + 1;
    while (je < b.length && isDigit(b.charCodeAt(je)) === bDigit) je++;
    let ta = a.slice(i, ie);
    let tb = b.slice(j, je);
    if (aDigit && bDigit) {
      ta = ta.replace(/^0+(?=\d)/, '');
      tb = tb.replace(/^0+(?=\d)/, '');
      if (ta.length !== tb.length) return ta.length - tb.length;
    }
    const c = compareCodeUnits(ta, tb);
    if (c !== 0) return c;
    i = ie;
    j = je;
  }
  return (a.length - i > 0 ? 1 : 0) - (b.length - j > 0 ? 1 : 0);
}

/** compareIds over pre-computed shapes (lets sorts parse each string once). */
export function compareShaped(a: string, sa: IdShape | null, b: string, sb: IdShape | null): number {
  if (a === b) return 0;
  const pa = sa === null ? a : sa.prefix;
  const pb = sb === null ? b : sb.prefix;
  if (pa !== pb) return pa < pb ? -1 : 1;
  if (sa === null) return -1;
  if (sb === null) return 1;
  if (sa.rank !== sb.rank) return sa.rank - sb.rank;
  if (sa.digits.length !== sb.digits.length) return sa.digits.length - sb.digits.length;
  if (sa.digits !== sb.digits) return sa.digits < sb.digits ? -1 : 1;
  const t = compareNatural(sa.tail, sb.tail);
  if (t !== 0) return t;
  return a < b ? -1 : 1;
}

/** The engine's id order (§2.4): prefix, then numeric suffix; a total order over all strings (see above). */
export function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return compareShaped(a, idShape(a), b, idShape(b));
}
