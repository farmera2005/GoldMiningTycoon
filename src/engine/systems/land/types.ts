// §5 land and tenure slice of GameState (DESIGN §5.2, §5.11, §5.12; P1 contract §4.5). Every collection of 5.2 ships
// from P1 (§2 D-2.60); the P2+ ones (negotiations, auctions, diligence, stakings, JVs, pending true-ups) stay empty
// until their phases. Hidden: `Listing.hidden` (incl. `askNoise` and `royaltyNoiseZ`, s05 #7, #9) and
// `Tenure.hiddenDefects`; never rendered, scrambled by s05.
import type { CalcNode } from '../../core/calc';
import type {
  BlockId,
  ClaimAuctionId,
  ClaimId,
  ClaimListingId,
  ClosingId,
  CompetitorId,
  DefectId,
  DiligenceId,
  HolderId,
  Id,
  JvId,
  LoanId,
  MachineId,
  NegotiationId,
  ObligationId,
  PermitId,
  ProductionInterestId,
  StakingJobId,
  TenureId,
} from '../../core/ids';
import type { Cents, MilliOz } from '../../core/money';
import type { LandRegime, SellerSituation } from '../world/enums';
import type { ListingInfo } from '../world/types';

/** §3 holder 'hld_' or §12 competitor 'cmp_', stable across relistings. */
export type SellerKey = HolderId | CompetitorId;
/** Estates and trustees are npc holders; the channel says which (5.3). */
export type SellerRef = { kind: 'npc' | 'competitor' | 'player' | 'creditor'; id: SellerKey | 'player' | Id };

/** §5.1 what the player holds. */
export type TenureKind = 'ownedUnpatented' | 'staked' | 'ownedPatented' | 'ownedState' | 'leased' | 'jv';

/** The one enum §5 and §6 share (onTenureEnded, 5.14). */
export type TenureEndReason =
  | 'sold'
  | 'relinquished'
  | 'forfeited'
  | 'terminated'
  | 'foreclosed'
  | 'void'
  | 'voidedByExam'
  | 'converted';

/** A §6 obligation attached to a tenure. */
export type ObligationRef = ObligationId;

export type Channel = 'private' | 'estate' | 'distressed' | 'auction' | 'competitorSale' | 'playerSale';
/** What the seller can show (§3 sets it). */
export type EvidenceClass = 'none' | 'anecdotal' | 'history' | 'report' | 'production';

/** §5.5 a negotiable inspection contingency (P5). */
export interface InspectionTerm {
  /** 2–8. */
  weeks: number;
  feeCents: Cents;
  allowedTier: 'casual' | 'notice';
}

export interface SaleTerms {
  priceCents: Cents;
  carry?: { downPct: number; rate: number; years: number; paymentWeek: number };
  /** 0–13, default 0 (§6 6.12; 5.5). */
  sellerBondCarryWeeks?: number;
  inspection?: InspectionTerm;
}

/** §5.7 lease terms. `work.perYear` is bcy for kind 'bcy' and cents for kind 'usd'. */
export interface LeaseTerms {
  sellerBondCarryWeeks?: number;
  inspection?: InspectionTerm;
  /** rawOz ⇔ inKind, grossValue ⇔ cash (D-5.34). P1 generates in-kind leases only (s05 #23). */
  royalty: { rate: number; basis: 'rawOz' | 'grossValue'; settle: 'inKind' | 'cash' };
  amr: {
    amountCents: Cents;
    mode: 'advance' | 'shortfall';
    recoupable: boolean;
    carryforwardYears: number | null;
    maxRecoupShare: number;
  };
  work: {
    kind: 'none' | 'bcy' | 'usd';
    perYear: number;
    startsLeaseYear: number;
    inLieuAllowed: boolean;
    inLieuCentsPerUnit: Cents;
  };
  termYears: number;
  renewal: { years: number; royaltyStepPts: number } | null;
  option?: { priceCents: Cents; feeCents: Cents; royaltiesCreditedShare: 0 | 0.5 | 1 };
  buyDown?: { centsPerPoint: Cents; minRate: number };
}

/** §5.10 joint-venture terms (P6). */
export interface JvTerms {
  splitBasis: 'gross' | 'afterCosts';
  ownerShare: number;
  overheadRate: number;
  carryInterestRate: number;
  minWorkBcyPerYear: number;
  termYears: number;
  buyout: { multiple: number; floorCents: Cents };
  ownerContributedMachineIds?: MachineId[];
}

export interface LeaseState {
  terms: LeaseTerms;
  lessor: SellerRef;
  signedTurn: number;
  /** 1 = the first 52 weeks. */
  leaseYear: number;
  anniversaryTurn: number;
  termEndTurn: number;
  renewalsUsed: number;
  renewElection: boolean;
  /** From §7/§11, refreshed weekly. */
  workThisYear: { bcy: number; usdCents: Cents };
  optionExpiresTurn?: number;
  surrenderEffectiveTurn?: number;
  cure?: { obligationId: ObligationId; deadlineTurn: number; reason: 'amr' | 'work' | 'fee' };
}

export type DefectType =
  | 'voidClaim'
  | 'overstaking'
  | 'lien'
  | 'undisclosedReclamation'
  | 'nonTransferablePermit'
  | 'recordedRoyalty'
  | 'misstatedPermit';

/** §5.6 a title defect (P5); hidden until found. */
export interface TitleDefect {
  id: DefectId;
  type: DefectType;
  costCents: Cents;
  params: { fracLost?: number; blockIds?: BlockId[]; extraAcres?: number; royaltyRate?: number };
  knownToSeller: boolean;
  disclosed: boolean;
  /** One uniform per defect, drawn at listing; detected at level L iff detectU < p_L. */
  detectU: number;
  naturalDiscoveryDelay?: number;
  naturalDiscoveryTurn?: number;
  status: 'hidden' | 'disclosed' | 'found' | 'resolved';
  suit?: { filedTurn: number; resolveTurn: number; win: boolean; recoveryCents: Cents };
}

export type TitleDefectPublic = Pick<TitleDefect, 'id' | 'type' | 'costCents' | 'status'>;

/** §5.2 the player's holding of a claim. */
export interface Tenure {
  id: TenureId;
  claimId: ClaimId;
  kind: TenureKind;
  regime: LandRegime;
  origin: 'purchase' | 'lease' | 'staked' | 'auction' | 'inherited' | 'jv' | 'optionExercise';
  startTurn: number;
  /** Original location date, carried through transfers. */
  locatedTurn: number;
  units: { acres: number; claimCount: number; association: boolean };
  /** Posted to mineral.properties. */
  costBasisCents: Cents;
  /** Patented only (5.1). */
  assessedValueCents?: Cents;
  obligations: ObligationRef[];
  productionInterests: ProductionInterestId[];
  lease?: LeaseState;
  jvId?: JvId;
  carryLoanId?: LoanId;
  /** Blocks lost to boundary disputes. */
  lostBlockIds: BlockId[];
  /** Blocks closed by §12 land.excludeBlocks; still held, never mined. */
  excludedBlockIds: { blockId: BlockId; reason: string }[];
  assumedReclamation: { acres: number; disclosedAcres: number };
  /** Defects undiscovered at close (never shown). */
  hiddenDefects: TitleDefect[];
  /** Discovered after close: liens, disputes, suits. */
  knownDefects: TitleDefect[];
  /** An open playerSale listing (incl. a forced sale, 5.14). */
  listedAs?: ClaimListingId;
  status: 'active' | 'inDefault' | 'ending' | 'ended';
  endedReason?: TenureEndReason;
  /** A 'terminated' lease's cause, for reputation and alerts (D-5.78, s05 #24c). */
  endDetail?: 'default' | 'surrender' | 'expiry';
}

/** §5.5 the player's active inspection period on a listing. */
export interface InspectionGrant {
  weeks: number;
  feeCents: Cents;
  allowedTier: 'casual' | 'notice';
  startTurn: number;
  untilTurn: number;
  sellerNoticePermitId?: PermitId;
}

/** §5.4 the seller's hidden disposition (never rendered). */
export interface SellerDisposition {
  motivation0: number;
  patience0: number;
  discountRate: number;
  carryWillingness: boolean;
  carryMinDownPct: number;
  defects: TitleDefect[];
  /** 0..1, refreshed weekly. */
  competingInterest: number;
  /** Casual sampling with seller permission (true in P1). */
  allowsSiteSampling: boolean;
  /** Stored draw so weekly re-pricing is deterministic (D-5.65, s05 #7). */
  askNoise: number;
  /** The royalty ask's N(0,1), stored so lease terms re-price weekly (s05 #9). */
  royaltyNoiseZ: number;
}

/** §5.2 a claim listing. */
export interface Listing {
  id: ClaimListingId;
  claimId: ClaimId;
  seller: SellerRef;
  channel: Channel;
  /** §3's snapshot at candidate creation (shown; 3.9). */
  info: ListingInfo;
  situation: SellerSituation;
  listedTurn: number;
  expiresTurn: number;
  /** Probate / trustee deadline, then auction. */
  deadlineTurn?: number;
  firstLookUntilTurn?: number;
  starterLease?: boolean;
  /** What the seller will entertain. */
  structures: { sale?: SaleTerms; lease?: LeaseTerms; jv?: JvTerms };
  statedReason:
    | 'testingMarket'
    | 'retiring'
    | 'movingOn'
    | 'needsCash'
    | 'health'
    | 'estate'
    | 'trusteeSale'
    | 'refocusing';
  disclosedIssues: TitleDefectPublic[];
  weeksOnMarket: number;
  priceReducedCount: number;
  relistCount: number;
  inspection?: InspectionGrant;
  forced?: { loanId: LoanId; reserveCents: Cents; untilTurn: number };
  courtSale?: {
    planSale?: { reserveCents: Cents; deadlineTurn: number };
    stalking?: {
      buyer: { kind: 'background' | 'competitor' | 'quickSaleBuyer'; id?: Id };
      priceCents: Cents;
      maxCents: Cents;
      acceptTurn: number;
    };
    hearingTurn?: number;
    overbidders: { kind: 'background' | 'competitor'; id?: Id; maxCents: Cents; arrivedTurn: number }[];
  };
  /** Never rendered. */
  hidden: SellerDisposition;
  status: 'open' | 'underOffer' | 'closing' | 'sold' | 'withdrawn' | 'toAuction';
}

export interface Closing {
  id: ClosingId;
  listingId?: ClaimListingId;
  tenureId?: TenureId;
  kind: 'purchase' | 'lease' | 'optionExercise' | 'playerSale' | 'auction';
  terms: SaleTerms | LeaseTerms;
  /** Held in cash.restricted.escrow. */
  escrowCents: Cents;
  closingCostsCents: Cents;
  startTurn: number;
  completeTurn: number;
  recordsCheck: 'none' | 'pending' | 'clear' | 'findings';
  titleReview: 'none' | 'pending' | 'clear' | 'findings';
  findingDecisionId?: Id;
}

export interface DiligenceJob {
  id: DiligenceId;
  listingId: ClaimListingId;
  level: 'basic' | 'full';
  costCents: Cents;
  startTurn: number;
  readyTurn: number;
  skillAtOrder: number;
  /** Defect ids. */
  findings: DefectId[];
}

export interface StakingJob {
  id: StakingJobId;
  parcelId: ClaimId;
  units: number;
  regime: LandRegime;
  createdTurn: number;
  createdSeq: number;
  fieldDoneTurn: number;
  locatedTurn?: number;
  recordingObligationIds: ObligationId[];
  countyRecorded: boolean;
  filed: boolean;
  autoFile: boolean;
  conflicts: { unit: number; status: 'pending' | 'yielded' | 'contested' | 'won' | 'lost'; resolveTurn?: number }[];
  status: 'field' | 'located' | 'filed' | 'void' | 'aborted';
}

export interface Auction {
  id: ClaimAuctionId;
  listingId: ClaimListingId;
  format: 'ascending' | 'sealed';
  absolute: boolean;
  /** Hidden; 0 if absolute. */
  reserveCents: Cents;
  openingBidCents: Cents;
  noticeTurn: number;
  closeTurn: number;
  playerBid?: { maxOrSealedCents: Cents; depositCents: Cents; placedTurn: number; placedSeq: number };
  result?: {
    winner: 'player' | 'competitor' | 'background' | 'none';
    winnerId?: Id;
    hammerCents: Cents;
    runnerUp?: { id: Id; capCents: Cents };
    dueTurn: number;
  };
}

export interface JvAgreement {
  id: JvId;
  tenureId: TenureId;
  owner: SellerRef;
  terms: JvTerms;
  startTurn: number;
  unrecoveredCents: Cents;
  ownerExpectationCents: Cents;
  ytdOwnerValueCents: Cents;
  exitNoticeBy?: 'player' | 'owner';
  status: 'active' | 'exiting' | 'ended';
}

/** §5.11 negotiation (P5; §9 and §11 reach it only through `resolveOffer`). */
export type TermKey = string;
export type Terms = SaleTerms | LeaseTerms | JvTerms | Record<TermKey, number>;
export type NegotiationOutcome = 'accept' | 'counter' | 'reject' | 'walk';
export type NegotiationTone = 'final' | 'firm' | 'flexible' | 'eager';
export interface CounterpartyRef {
  kind: 'seller' | 'lessor' | 'jvOwner' | 'buyer' | 'dealer' | 'lender' | 'vendor';
  id: Id;
}

export interface Negotiation {
  id: NegotiationId;
  counterparty: CounterpartyRef;
  subject: 'landSale' | 'landLease' | 'landJv' | 'landBuyer' | 'leaseAmendment' | 'equipment' | 'loan' | 'vendorPlan';
  subjectRef: Id;
  utilityModel: 'landSale' | 'landLease' | 'landJv' | 'landBuyer' | 'equipmentSale' | 'loanRestructure' | 'vendorPlan';
  askTerms: Terms;
  lastCounterTerms: Terms;
  currentOffer: Terms | null;
  /** Hidden from here to rivalBidU. */
  motivation: number;
  reservationU: number;
  askU: number;
  patience: number;
  patience0: number;
  rounds: number;
  deadlineTurn: number;
  competingInterest: number;
  rivalBidU?: number;
  /** landSkill ≥ 70 only. */
  hintBand?: [Cents, Cents];
  status:
    | 'awaitingCounterparty'
    | 'awaitingPlayer'
    | 'bestAndFinal'
    | 'accepted'
    | 'walked'
    | 'expired'
    | 'lostToRival'
    | 'withdrawn';
  history: { turn: number; by: 'player' | 'counterparty'; terms: Terms; outcome?: NegotiationOutcome; tone?: NegotiationTone }[];
}

/** §5.12 production interests (D-5.27): royalties, JV splits, streams, the Backed royalty, government royalties. */
export interface ProductionInterest {
  id: ProductionInterestId;
  /** Absent = company-wide (applies to all attributable production). */
  claimId?: ClaimId;
  holder: { kind: 'npc' | 'competitor' | 'investor' | 'lender' | 'government'; id: Id };
  kind: 'leaseRoyalty' | 'jvSplit' | 'stream' | 'investorRoyalty' | 'governmentRoyalty';
  origin: 'lease' | 'recordedOverride' | 'jv' | 'stream' | 'financing' | 'startInvestor' | 'regime' | 'inherited';
  level: 'property' | 'jv' | 'attributable';
  /** Recording turn; lower settles first within a level (ties: id order). */
  seniority: number;
  /** fineOz + inKind settles as rawOz (D-5.34). */
  basis: 'rawOz' | 'fineOz' | 'grossValue' | 'netIncome';
  rate: number;
  rateUnit: 'fraction' | 'usdPerOz';
  settle: 'inKind' | 'cash';
  trigger: 'cleanup' | 'sale' | 'annual';
  minimumAnnual?: {
    amountCents: Cents;
    mode: 'advance' | 'shortfall';
    recoupable: boolean;
    carryforwardYears: number | null;
    maxRecoupShare: number;
    anniversaryWeek: number;
    startsYear?: number;
    endsWhenStepped?: boolean;
  };
  advanceRecoupable?: boolean;
  /** FIFO. */
  recoupCredits: { cents: Cents; createdTurn: number; expiresTurn: number | null }[];
  buyDown?: { centsPerPoint: Cents; minRate: number };
  /** usd amounts in cents; reaching it ends the interest. */
  cap?: { kind: 'oz' | 'usd'; amount: number };
  stepDown?: { threshold: { kind: 'oz' | 'usd'; amount: number }; newRate: number; stepped: boolean };
  runsWithClaims?: boolean;
  excludedClaimIds: ClaimId[];
  costRecovery?: { unrecoveredCents: Cents; overheadRate: number; carryInterestRate: number };
  streamPricePerFineOzCents?: Cents;
  startTurn: number;
  endTurn?: number;
  status: 'active' | 'suspended' | 'ended';
  /** valueCents: in-kind oz valued at v on delivery. */
  paidToDate: { rawOz: number; cashCents: Cents; valueCents: Cents };
}

/** §5.12 a cash interest accrued at f_est, awaiting §10's assay (P5). */
export interface CashAccrual {
  interestId: ProductionInterestId;
  claimId: ClaimId;
  turn: number;
  fEst: number;
  valCents: Cents;
  /** The player's lot raw oz from that cleanup. */
  lotRawOz: number;
  untrueRawOz: number;
}

/** §5.2 `LandSlice`: every Record has a sorted order array that systems iterate (§2.3). */
export interface LandSlice {
  tenures: Record<TenureId, Tenure>;
  tenureIds: TenureId[];
  listings: Record<ClaimListingId, Listing>;
  listingIds: ClaimListingId[];
  negotiations: Record<NegotiationId, Negotiation>;
  negotiationIds: NegotiationId[];
  auctions: Record<ClaimAuctionId, Auction>;
  auctionIds: ClaimAuctionId[];
  interests: Record<ProductionInterestId, ProductionInterest>;
  interestIds: ProductionInterestId[];
  closings: Record<ClosingId, Closing>;
  closingIds: ClosingId[];
  diligence: Record<DiligenceId, DiligenceJob>;
  diligenceIds: DiligenceId[];
  stakings: Record<StakingJobId, StakingJob>;
  stakingIds: StakingJobId[];
  jvs: Record<JvId, JvAgreement>;
  jvIds: JvId[];
  sellerMemory: Record<SellerKey, { walkedTurn?: number; lowballWalks: number; lapsedListings: Record<ClaimId, number> }>;
  pendingTrueUps: CashAccrual[];
}

export function emptyLandSlice(): LandSlice {
  return {
    tenures: {},
    tenureIds: [],
    listings: {},
    listingIds: [],
    negotiations: {},
    negotiationIds: [],
    auctions: {},
    auctionIds: [],
    interests: {},
    interestIds: [],
    closings: {},
    closingIds: [],
    diligence: {},
    diligenceIds: [],
    stakings: {},
    stakingIds: [],
    jvs: {},
    jvIds: [],
    sellerMemory: {},
    pendingTrueUps: [],
  };
}

/** §5.5 who may sample a claim and how (canonical shape, also read by §4's program checks). */
export interface SamplingAccess {
  tier: 'none' | 'casual' | 'operator';
  untilTurn: number | null;
  reason: 'owned' | 'leased' | 'staked' | 'jv' | 'sellerPermission' | 'inspectionPeriod' | 'none';
  maxAuthority?: 'casual' | 'notice';
  sellerNoticePermitId?: PermitId;
}

/** `settleProductionInterests` result, in milli-ounces (contract §0.6 item 7). */
export interface Settlement {
  deliveries: {
    interestId: ProductionInterestId;
    holder: ProductionInterest['holder'];
    rawMilliOz: MilliOz;
    valueCents: Cents;
  }[];
  cashAccruals: CashAccrual[];
  playerRawMilliOz: MilliOz;
  calc?: CalcNode;
}

export interface NewTenure {
  claimId: ClaimId;
  kind: 'ownedUnpatented' | 'leased';
  origin: Tenure['origin'];
  costBasisCents: Cents;
  lease?: { terms: LeaseTerms; lessor: SellerRef };
}

export type NewProductionInterest = Omit<
  ProductionInterest,
  'id' | 'recoupCredits' | 'excludedClaimIds' | 'paidToDate' | 'status'
>;

/** §5.13 the player's valuation of a claim. */
export interface ClaimValuation {
  p10Cents: Cents;
  p50Cents: Cents;
  p90Cents: Cents;
  breakdown: { burden: number; amrCents: Cents; holdingCents: Cents; opPvCents: Cents; npvCents: Cents };
}

/** A listing opened, re-priced or closed this week (`ctx.week.land`). */
export interface ListingEvent {
  listingId: ClaimListingId;
  claimId: ClaimId;
  kind: 'new' | 'priceChanged' | 'closed';
}

/** §5.14 a buyer's view of a claim for a quick sale (oz view = §4 minableOzP50 only, s05 #12). */
export interface BuyerClaimView {
  minableOzP50: number;
  valueCents: Cents;
}
