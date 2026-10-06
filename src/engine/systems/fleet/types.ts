// §9 equipment slice of GameState (DESIGN §9 9.1; P1 contract §4.9). Verbatim 9.1 with the P1 deltas: `Machine.pm`
// optional and unset (S09-20), `Machine.grade` always set in P1, `Machine.book` (S09-17), the `town` location (S09-9),
// `EquipmentListing.truth` optional and unset in P1, `FactoryOrder.heldSinceTurn` (D-9.67) and the 52-week `saleLog`
// (S09-14). P3 collections ship empty and `shopPolicy` at its 9.1 defaults (D-2.60). Id types keep the code names
// (`FactoryOrderId`, `TransportJobId`, `RentalContractId`, …; S10-16): DESIGN's `OrderId`, `AuctionId`, `WorkOrderId`,
// `ContractId`, `TransportId`, `InspectionId`, `CalloutId` and `SaleId` are these. Hidden (from P3): true `health`,
// `hoursSinceRebuild`, `rework`, `defect`, `pm.lastAt`, `EquipmentListing.truth`, `FieldCallout.techSkill`.
import type {
  AuctionEventId,
  ClaimId,
  CompetitorId,
  DistrictId,
  EmployeeId,
  EquipListingId,
  FactoryOrderId,
  FieldServiceCalloutId,
  Id,
  MachineId,
  MachineInspectionId,
  PartsOrderId,
  PrivateSaleId,
  RentalContractId,
  ShopWorkOrderId,
  TransportJobId,
} from '../../core/ids';
import type { Cents } from '../../core/money';
import type { Access } from '../world/enums';
import type { BrandId, ClassId, MachineOptionId, ModelId, SizeKey } from './catalog';

export type { BrandId, ClassId, ModelId, SizeKey, EquipmentModel, ClassDef, InheritedFleetSpec } from './catalog';

export type Grade = 'A' | 'B' | 'C' | 'D';
export type MachineOption = MachineOptionId;
export type PmLevel = 250 | 500 | 1000 | 2000;
/** Inclusive, clipped to [0, 1]. */
export interface Range {
  lo: number;
  hi: number;
}
/** A catalog parts SKU (P3). */
export type PartsSku = string;

export type ComponentKey =
  | 'engine'
  | 'hydraulics'
  | 'undercarriage'
  | 'tires'
  | 'drivetrain'
  | 'electrical'
  | 'structure'
  | 'screen'
  | 'pumpEnd'
  | 'sluiceRiffles';

export interface ComponentState {
  /** TRUE 0..1 (hidden). 1 = new; 0 = worn out. */
  health: number;
  /** The player's latest range; undefined = never assessed. */
  knownHealth?: Range;
  knownAt?: {
    hours: number;
    turn: number;
    source: 'inspection' | 'dealer' | 'pmLook' | 'repair' | 'symptom' | 'damage' | 'delivery';
    inspector?: string;
  };
  /** TRUE (hidden); seller records may claim a value. */
  hoursSinceRebuild: number;
  /** §8 reworkHazardMult of the last mechanic to repair or rebuild it (9.7.5). */
  rework?: { mult: number; untilHours: number };
  /** Lemon mask (9.6). */
  defect?: { facade: number; revealAtHours: number };
}

export type LocationRef =
  | { kind: 'claim'; id: ClaimId }
  | { kind: 'yard' | 'dealer' | 'auctionSite'; id: DistrictId }
  /** The district's service town: P1 rotating used listings, stalled moves (D-9.64). */
  | { kind: 'town'; id: DistrictId }
  | { kind: 'transit'; id: TransportJobId };

export type Channel = 'dealerNew' | 'dealerCertified' | 'private' | 'auction' | 'inherited' | 'rental' | 'rentToOwn' | 'lease';

export type MachineStatus = 'working' | 'idle' | 'down' | 'inShop' | 'inTransit' | 'rentedOut' | 'assembling' | 'destroyed';
export type DownReason = 'failure' | 'waitingParts' | 'damage' | 'lenderLockout' | 'grounded' | 'stolen' | 'fire';
export type Acquisition = 'owned' | 'financed' | 'operatingLease' | 'financeLease' | 'rental' | 'rentToOwn';

export interface MachineWeekLog {
  turn: number;
  work: number;
  smr: number;
  outputBcy: number;
  fuelGal: number;
  costCents: Record<'fuel' | 'pm' | 'repairs' | 'operator' | 'rental' | 'holding', Cents>;
  downHours: number;
  failures: number;
}

export interface Machine {
  id: MachineId;
  modelId: ModelId;
  classId: ClassId;
  sizeClass: SizeKey;
  brandId: BrandId;
  modelYear: number;
  /** SMR meter, true and visible. */
  hours: number;
  /** The family's list (9.2.5); empty in P1–P2 and for `site` items. */
  components: Partial<Record<ComponentKey, ComponentState>>;
  /** P1–P2 visible condition grade; always set in P1 (new = 'A', D-9.59). */
  grade?: Grade;
  status: MachineStatus;
  downReason?: DownReason;
  location: LocationRef;
  acquisition: Acquisition;
  financeRef?: Id;
  contractRef?: RentalContractId;
  /** TRUE meter hours at the last service of each level; unset in P1–P2 (D-9.73, S09-20). */
  pm?: { lastAt: Record<PmLevel, number>; knownLastAt?: Partial<Record<PmLevel, number>> };
  options: MachineOption[];
  warranty?: { untilTurn: number; untilHours: number; scope: 'full' | 'powertrain' | 'structure' };
  purchase: { turn: number; costCents: Cents; channel: Channel; capitalizedCents: Cents };
  /** Book value = capitalizedCents − accumDepCents − unpostedDepCents; §11 posts the unposted accrual at month end (D-9.70). */
  book: { accumDepCents: Cents; unpostedDepCents: Cents };
  down?: { workOrderIds: ShopWorkOrderId[]; readyTurnFrac?: number };
  /** Ring of 52 for 9.10. */
  weekly: MachineWeekLog[];
}

export interface Promo {
  kind: 'none' | 'rebateOnly' | 'promoOrRebate';
  rebatePct: number;
  apr?: number;
  months?: number;
  untilTurn: number;
}

export type ConditionBand = 'excellent' | 'good' | 'fair' | 'worn' | 'needsWork';

export interface EquipmentListing {
  id: EquipListingId;
  channel: 'dealerNew' | 'dealerCertified' | 'private' | 'auction';
  modelId: ModelId;
  location: LocationRef;
  modelYear: number;
  hours: number;
  askCents?: Cents;
  expiresTurn: number;
  auctionId?: AuctionEventId;
  brandId: BrandId;
  shown: {
    bands?: Partial<Record<ComponentKey, ConditionBand>>;
    records?: 'full' | 'partial' | 'none';
    report?: Partial<Record<ComponentKey, Range>>;
    grade?: Grade;
    runs?: 'runs' | 'nonRunner';
    source?: 'repo' | 'estate' | 'consignment' | 'bust';
    deliveryWeeks?: number;
    promo?: Promo;
  };
  /** Hidden; unset in P1–P2 (D-9.73). */
  truth?: {
    components: Partial<Record<ComponentKey, ComponentState>>;
    care: number;
    pmLastAt: Record<PmLevel, number>;
    inspectAllowed: boolean;
    sellerType?: 'honest' | 'optimistic' | 'concealing' | 'lemon';
  };
  /** Sealed (P3). */
  bids?: { by: 'player' | CompetitorId; maxCents: Cents; actionSeq: number }[];
}

export interface AuctionEvent {
  id: AuctionEventId;
  site: LocationRef;
  siteAccess: Access;
  previewTurn: number;
  closeTurn: number;
  lotIds: EquipListingId[];
}

export interface FactoryOrder {
  id: FactoryOrderId;
  listingId: EquipListingId;
  modelId: ModelId;
  brandId: BrandId;
  depositCents: Cents;
  balanceCents: Cents;
  etaTurn: number;
  deliverTo: LocationRef;
  payment: 'cash' | { applicationId: Id } | { leaseQuoteId: Id };
  options: MachineOption[];
  promoChoice?: 'rebate' | 'promo';
  /** Balance unpaid at delivery: held at the dealer, lapses after `fleet.newOrderHoldWeeks` (D-9.67). */
  heldSinceTurn: number | null;
}

export interface WorkOrder {
  id: ShopWorkOrderId;
  machineId: MachineId;
  kind: 'pm' | 'repair' | 'rebuild' | 'exchange' | 'rebuildAll' | 'inspect' | 'routine';
  component?: ComponentKey;
  pmLevel?: PmLevel;
  severity?: 'minor' | 'major' | 'catastrophic';
  stdHours: number;
  doneHours: number;
  weldShare: number;
  parts: { sku?: PartsSku; costCents: Cents; status: 'none' | 'onHand' | 'ordered' | 'arrived'; etaTurnFrac?: number };
  assignee: 'auto' | EmployeeId | 'fieldService' | 'dealer';
  priority: number;
  playerPriority?: number;
  createdTurn: number;
  source: 'failure' | 'schedule' | 'player' | 'warranty';
  status: 'requested' | 'waitingParts' | 'inProgress' | 'done' | 'cancelled';
  blocking: boolean;
  fabricate?: boolean;
}

export interface PartsStock {
  sku: PartsSku;
  qty: number;
  unitCostCents: Cents;
  location: LocationRef;
  minQty?: number;
  maxQty?: number;
}

export interface PartsOrder {
  id: PartsOrderId;
  sku: PartsSku;
  qty: number;
  costCents: Cents;
  etaTurnFrac: number;
  mode: 'normal' | 'expedite' | 'charter';
  deliverTo: LocationRef;
  forWorkOrder?: ShopWorkOrderId;
}

export interface RentalContract {
  id: RentalContractId;
  machineId: MachineId;
  vendorDistrict: DistrictId;
  term: 'weekly' | 'monthly';
  rateCents: Cents;
  basisHours: number;
  damageWaiver: boolean;
  startTurn: number;
  endTurn?: number;
  periodHours: number;
  rpo?: { priceCents: Cents; creditedCents: Cents };
}

/** Physical lease terms; payment and overage rate are §11's. */
export interface EquipmentLeaseTerms {
  id: RentalContractId;
  machineId: MachineId;
  kind: 'operating' | 'finance';
  termMonths: number;
  hourCapPerYear: number;
  hoursThisLeaseYear: number;
  returnMinHealth: number;
  financeRef: Id;
}

export interface RentToOwnContract {
  id: RentalContractId;
  machineId: MachineId;
  monthlyCents: Cents;
  months: number;
  paid: number;
  missed: number;
}

export type TransportMode = 'road' | 'barge' | 'air';

export interface TransportLeg {
  kind: 'paved' | 'seasonalRoad' | 'winterTrail';
  miles: number;
  doneMiles: number;
}

export interface TransportJob {
  id: TransportJobId;
  machineIds: MachineId[];
  from: LocationRef;
  to: LocationRef;
  mode: TransportMode;
  legs: TransportLeg[];
  costCents: Cents;
  startTurn: number;
  arriveTurnFrac: number;
  ownLowboyId?: MachineId;
  assembleUntilTurnFrac?: number;
  stalled?: 'accessClosed';
}

export interface InspectionReport {
  turn: number;
  hoursAtInspection: number;
  by: InspectionJob['by'];
  /** Never the skill. */
  inspectorLabel: string;
  components: Partial<Record<ComponentKey, Range | 'notAssessed'>>;
  defectFound?: ComponentKey;
  refused?: boolean;
  pmRecords?: 'full' | 'partial' | 'none';
  notes: string[];
}

export interface InspectionJob {
  id: MachineInspectionId;
  target: { listingId: EquipListingId } | { machineId: MachineId };
  by: 'ownMechanic' | 'owner' | 'thirdParty' | 'auctionPreview';
  employeeId?: EmployeeId;
  oilSample: boolean;
  orderedTurn: number;
  dueTurn: number;
  costCents: Cents;
  report?: InspectionReport;
}

export interface FieldCallout {
  id: FieldServiceCalloutId;
  claimId: ClaimId;
  workOrderIds: ShopWorkOrderId[];
  arriveTurnFrac: number;
  /** Hidden. */
  techSkill: number;
  stdHoursPerWeek: number;
  ratePerHrCents: Cents;
  travelCents: Cents;
}

export interface PrivateSale {
  id: PrivateSaleId;
  machineId: MachineId;
  askCents: Cents;
  listedTurn: number;
  expiresTurn: number;
  counter?: { priceCents: Cents; expiresTurn: number };
}

export interface ShopPolicy {
  autoPm: boolean;
  autoFieldService: boolean;
  partsPolicy: 'normal' | 'expediteMajor' | 'expediteAll';
  autoReorder: boolean;
  baselineServiceOnPurchase: boolean;
}

export interface DealerState {
  brands: BrandId[];
  promos: Record<BrandId, Promo>;
  certified: EquipListingId[];
  rental: Record<SizeKey, { available: boolean; offerId?: Id }>;
}

/** D-9.69: the last 52 weeks of machine sales. */
export interface FleetSaleEvent {
  turn: number;
  machineIds: MachineId[];
  proceedsCents: Cents;
  distress: boolean;
}

/** `ctx.week.fleet.availability` (written in part 8.1, read by §7 and §4 in step 9). */
export interface MachineAvailability {
  downShare: number;
  reason?: 'inTransit' | 'assembling' | 'down';
}

/** §9 failure re-resolve input for §7 (P3). */
export interface FailureMask {
  machineId: MachineId;
  atWorkFrac: number;
  downHours?: number;
}

export interface CostPerHourBreakdown {
  window: 'ttm' | 'season';
  smrHours: number;
  workHours: number;
  outputBcy: number;
  lines: Record<
    'econDep' | 'interest' | 'insurance' | 'leaseRental' | 'fuel' | 'pm' | 'repairs' | 'operator' | 'partsHolding',
    Cents
  >;
  perSmrHourCents: Cents;
  perWorkHourCents: Cents;
  perBcyCents?: Cents;
  availability: number;
}

export type UsedMarketGroup = 'placer' | 'general' | 'light';

export interface FleetMarket {
  usedMult: Record<UsedMarketGroup, number>;
  newMult: number;
  floodIdx: number;
  repoBustLots13w: number[];
}

/** §9 9.1 `FleetSlice`. */
export interface FleetSlice {
  machines: Record<MachineId, Machine>;
  machineIds: MachineId[];
  listings: Record<EquipListingId, EquipmentListing>;
  listingIds: EquipListingId[];
  auctions: Record<AuctionEventId, AuctionEvent>;
  /** 0 = not banned (9.3.4). */
  auctionBanUntilTurn: number;
  orders: Record<FactoryOrderId, FactoryOrder>;
  workOrders: Record<ShopWorkOrderId, WorkOrder>;
  workOrderIds: ShopWorkOrderId[];
  parts: Record<PartsSku, PartsStock>;
  partsOrders: Record<PartsOrderId, PartsOrder>;
  /** Physical terms; §11 holds the money side. */
  contracts: Record<RentalContractId, RentalContract | EquipmentLeaseTerms | RentToOwnContract>;
  transports: Record<TransportJobId, TransportJob>;
  inspections: Record<MachineInspectionId, InspectionJob>;
  callouts: Record<FieldServiceCalloutId, FieldCallout>;
  /** The player's private sale listings (9.10). */
  sales: Record<PrivateSaleId, PrivateSale>;
  shopPolicy: ShopPolicy;
  /** Rented heated bays in the district's town. */
  shopBays: Record<DistrictId, number>;
  dealers: Record<DistrictId, DealerState>;
  /** Cached in step 3; fixed in P1. */
  market: FleetMarket;
  saleLog: FleetSaleEvent[];
}

export const DEFAULT_SHOP_POLICY: Readonly<ShopPolicy> = {
  autoPm: true,
  autoFieldService: true,
  partsPolicy: 'expediteMajor',
  autoReorder: false,
  baselineServiceOnPurchase: true,
};

export function emptyFleetSlice(): FleetSlice {
  return {
    machines: {},
    machineIds: [],
    listings: {},
    listingIds: [],
    auctions: {},
    auctionBanUntilTurn: 0,
    orders: {},
    workOrders: {},
    workOrderIds: [],
    parts: {},
    partsOrders: {},
    contracts: {},
    transports: {},
    inspections: {},
    callouts: {},
    sales: {},
    shopPolicy: { ...DEFAULT_SHOP_POLICY },
    shopBays: {},
    dealers: {},
    market: { usedMult: { placer: 1, general: 1, light: 1 }, newMult: 1, floodIdx: 0, repoBustLots13w: [] },
    saleLog: [],
  };
}
