// §10 gold slice of GameState (DESIGN §10 10.9, 10.10, 10.17; S10-1, S10-4, S10-5, S10-6; P1 contract §4.10). The P1
// subset of 10.17: local buyers, lots, the standing order, the sales log, the archive, the inventory identity and the
// week's sales accumulator; the P5 collections are typed per 10.17 and empty (D-2.60). The price, macro, news and
// analyst state arrive with P5 (P1 prices are flat, read from the market snapshot). Hidden (scrambler s10): a lot's
// `trueAlloyFineness` and `trueDirtFrac`, a buyer's `biasMean`.
import type {
  ClaimId,
  CourierMoveId,
  DistrictId,
  ForwardId,
  Id,
  LocalBuyerId,
  LotId,
  PutId,
  ShipmentId,
} from '../../core/ids';
import type { Cents, MilliOz } from '../../core/money';

/** A refinery in data/market (P5). */
export type RefineryId = string;

export type FinenessBasis = 'regionPrior' | 'sampleAssays' | 'districtAssays' | 'claimAssays';

export type GoldLotLocation =
  | { kind: 'camp'; claimId: ClaimId; inSafe: boolean }
  | { kind: 'bankBox'; districtId: DistrictId }
  | { kind: 'transit'; moveId: CourierMoveId }
  | { kind: 'refinery'; shipmentId: ShipmentId };

export type GoldLotStatus = 'held' | 'inTransit' | 'atRefinery' | 'assayed' | 'sold' | 'stolen';

export interface GoldLot {
  id: LotId;
  sourceClaimId: ClaimId | null;
  cleanupTurn: number;
  source: 'cleanup' | 'sample' | 'split';
  /** Integer milli-oz as weighed, incl. residual dirt (D-10.50, S10-5). */
  rawMilliOz: MilliOz;
  /** HIDDEN: Au share of the metal. */
  trueAlloyFineness: number;
  /** HIDDEN: non-metal share of raw weight. */
  trueDirtFrac: number;
  /** The player's estimate, fine oz per raw oz, stored at creation (D-10.47). */
  estFineness: number;
  estBasis: FinenessBasis;
  assayedFineness: number | null;
  /** P1 uses only `{ kind: 'camp'; claimId; inSafe: false }`. */
  location: GoldLotLocation;
  /** P1 uses 'held' | 'sold'. */
  status: GoldLotStatus;
  /** 0 before P4 (S11-1, D-11.76). */
  costBasisCents: Cents;
  parentLotId?: LotId;
  terminalTurn?: number;
}

export interface LocalBuyer {
  id: LocalBuyerId;
  districtId: DistrictId;
  name: string;
  basis: 'estimatedFine';
  seasonal: false;
  /** HIDDEN. */
  biasMean: number;
}

export type StandingSaleOrder =
  | { mode: 'none' }
  | { mode: 'sellAllAtCleanup'; channel: 'local'; buyer: 'bestLocal' | LocalBuyerId }
  | { mode: 'keepCashAbove'; cashFloorCents: Cents; buyer: 'bestLocal' | LocalBuyerId };

export type SaleChannel = 'local' | 'refinery' | 'metalAccount' | 'forward' | 'prepay';

/** One sale: estimated fine oz, never true (D-10.52). Last 104 weeks. */
export interface GoldSaleRow {
  turn: number;
  channel: SaleChannel;
  lotIds: LotId[];
  rawMilliOz: MilliOz;
  fineOz: number;
  netCents: Cents;
  spotUsd: number;
}

/** S10-8. */
export interface ChannelQuote {
  channel: 'local';
  buyerId?: LocalBuyerId;
  basis: 'estimatedFine';
  fineOz: number;
  grossCents: Cents;
  deductions: { key: string; cents: Cents }[];
  netCents: Cents;
  cashTurn: number;
  netPerRawOz: number;
  pctOfSpot: number;
  priceRisk: 'none';
  impliedFineness?: number;
  yourFineness: number;
}

export interface ClaimFineness {
  alloy: number;
  alloyBasis: FinenessBasis;
  dirt: number;
  dirtBasis: 'tuning' | 'assay';
}

export interface Shipment {
  id: ShipmentId;
  refineryId: RefineryId;
  lotIds: LotId[];
  rawMilliOz: MilliOz;
  estFineOz: number;
  singleClaimId: ClaimId | null;
  shipTurn: number;
  arriveTurn: number;
  assayTurn: number;
  settleTurn: number;
  pricing: 'assay' | 'lockAtShip';
  lockedSpot?: number;
  disposition: 'sell' | 'toAccount' | 'deliverForward';
  fwdId?: ForwardId;
  advanceCents?: Cents;
  status: 'inTransit' | 'atRefinery' | 'assayed' | 'settled';
  assay?: {
    fineOz: number;
    doreOz: number;
    agOz: number;
    payableFineOz: number;
    priceUsd: number;
    grossCents: Cents;
    silverCents: Cents;
    feesCents: Cents;
    netCents: Cents;
  };
}

export interface ForwardContract {
  id: ForwardId;
  counterparty: 'refinery' | 'dealer' | 'bank' | 'prepay';
  counterpartyId: Id;
  fineOz: number;
  deliveredOz: number;
  /** F; 0 for prepay. */
  priceUsd: number;
  openTurn: number;
  deliveryTurn: number;
  settle: 'physical' | 'cash';
  rolls: number;
  imCents: Cents;
  postedCents: Cents;
  marginCall?: { amountCents: Cents; issuedTurn: number; dueTurn: number };
  hedgeLoanId?: Id;
  agreementId?: Id;
  deliveryResult?: { deliveredFineOz: number; shortfallFineOz: number; updatedTurn: number };
  status: 'open' | 'delivered' | 'closed' | 'forcedClose';
}

export interface PutOption {
  strikeUsd: number;
  fineOz: number;
  expiryTurn: number;
  premiumCents: Cents;
  status: 'open' | 'expired' | 'paid';
}

export interface CourierMove {
  lotIds: LotId[];
  to: GoldLotLocation;
  arriveTurn: number;
}

/** §10 10.17 `GoldSlice`, P1 subset plus the P5 collections empty. */
export interface GoldSlice {
  buyers: Record<LocalBuyerId, LocalBuyer>;
  buyerIds: LocalBuyerId[];
  lots: Record<LotId, GoldLot>;
  lotIds: LotId[];
  /** Empty in P1–P4: derived on read from §4 (D-10.47). */
  claimFineness: Record<ClaimId, ClaimFineness>;
  standingOrder: StandingSaleOrder;
  /** Last 104 weeks. */
  sales: GoldSaleRow[];
  archive: {
    rawMilliOzByStatus: { assayed: number; sold: number; stolen: number };
    lots: number;
    shipments: number;
    forwards: number;
  };
  /** Incremented in addLot; the inventory identity (S10-6, D-10.51). */
  createdRawMilliOz: { cleanup: number; sample: number };
  /** Every sale adds; reset by §2's step-16 snapshot (D-2.62). */
  weekSales: { fineOz: number; rawMilliOz: number; netCents: Cents };
  // P5 collections (empty in P1)
  storage: { bankBoxes: Record<DistrictId, { boxes: number }> };
  moves: Record<CourierMoveId, CourierMove>;
  moveIds: CourierMoveId[];
  shipments: Record<ShipmentId, Shipment>;
  shipmentIds: ShipmentId[];
  metalAccounts: Record<RefineryId, { fineOz: number; pledgedFineOz: number; costBasisCents: Cents }>;
  refineryHistory: Record<RefineryId, { settled: { turn: number; fineOz: number }[] }>;
  forwards: Record<ForwardId, ForwardContract>;
  forwardIds: ForwardId[];
  puts: Record<PutId, PutOption>;
  putIds: PutId[];
}

/** N7's standing order (P1 contract §4.10). */
export const DEFAULT_STANDING_ORDER: Readonly<StandingSaleOrder> = {
  mode: 'keepCashAbove',
  cashFloorCents: 0 as Cents,
  buyer: 'bestLocal',
};

export function emptyGoldSlice(): GoldSlice {
  return {
    buyers: {},
    buyerIds: [],
    lots: {},
    lotIds: [],
    claimFineness: {},
    standingOrder: { ...DEFAULT_STANDING_ORDER },
    sales: [],
    archive: { rawMilliOzByStatus: { assayed: 0, sold: 0, stolen: 0 }, lots: 0, shipments: 0, forwards: 0 },
    createdRawMilliOz: { cleanup: 0, sample: 0 },
    weekSales: { fineOz: 0, rawMilliOz: 0, netCents: 0 as Cents },
    storage: { bankBoxes: {} },
    moves: {},
    moveIds: [],
    shipments: {},
    shipmentIds: [],
    metalAccounts: {},
    refineryHistory: {},
    forwards: {},
    forwardIds: [],
    puts: {},
    putIds: [],
  };
}
