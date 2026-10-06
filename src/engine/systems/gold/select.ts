// §10 gold selectors (DESIGN §2.11, §10 10.17; P1 contract §4.10): pure readers over state, spread into `select` by
// select/index.ts. None returns a hidden field: a lot view drops the true alloy fineness and dirt (it shows the stored
// estimate, or the assay once one exists), and a buyer view drops `biasMean`. A name already used by another folder
// fails the composition test.
import type { DistrictId, LotId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import { roundCents, ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { marketSnapshot } from '../history/snapshot';
import type { MarketSnapshot } from '../history/types';
import { quoteChannels } from './lots';
import {
  baseRate,
  cpiIndex,
  dieselRackUsdPerGal,
  goldIdx,
  goldIdxReal,
  goldMomentum,
  realRate,
  spotUsdPerFineOz,
} from './prices';
import type { GoldLot, GoldLotStatus, GoldSaleRow, LocalBuyer, StandingSaleOrder } from './types';

/** A lot as the player sees it. */
export type GoldLotView = Omit<GoldLot, 'trueAlloyFineness' | 'trueDirtFrac'> & {
  rawOz: number;
  /** Fine oz per raw oz the player works with: the assay when one exists, else the stored estimate. */
  fineness: number;
  estFineOz: number;
  valueAtSpotCents: Cents;
  /** Best expected net over the available channels (the §10 package fills it from the quotes). */
  bestNetCents: Cents | null;
};

export type LocalBuyerView = Omit<LocalBuyer, 'biasMean'>;

export interface LotFilter {
  status?: GoldLotStatus;
  districtId?: DistrictId;
}

function lotView(state: GameState, l: GoldLot): GoldLotView {
  const { trueAlloyFineness: _a, trueDirtFrac: _d, ...rest } = l;
  const rawOz = l.rawMilliOz / 1000;
  const fineness = l.assayedFineness ?? l.estFineness;
  const estFineOz = rawOz * fineness;
  return {
    ...rest,
    rawOz,
    fineness,
    estFineOz,
    valueAtSpotCents: roundCents(estFineOz * spotUsdPerFineOz(state) * 100),
    bestNetCents: null,
  };
}

function lotDistrict(state: GameState, l: GoldLot): DistrictId | null {
  if (l.location.kind === 'bankBox') return l.location.districtId;
  if (l.location.kind === 'camp') return state.world.claims[l.location.claimId]?.districtId ?? null;
  return null;
}

function lots(state: GameState, filter: LotFilter = {}): GoldLotView[] {
  return sortedValues(state.gold.lots)
    .filter((l) => filter.status === undefined || l.status === filter.status)
    .filter((l) => filter.districtId === undefined || lotDistrict(state, l) === filter.districtId)
    .map((l) => lotView(state, l));
}

function lot(state: GameState, lotId: LotId): GoldLotView | null {
  const l = state.gold.lots[lotId];
  return l === undefined ? null : lotView(state, l);
}

function buyers(state: GameState, districtId?: DistrictId): LocalBuyerView[] {
  return sortedValues(state.gold.buyers)
    .filter((b) => districtId === undefined || b.districtId === districtId)
    .map(({ biasMean: _b, ...rest }) => rest);
}

function standingOrder(state: GameState): StandingSaleOrder {
  return state.gold.standingOrder;
}

function goldSales(state: GameState): GoldSaleRow[] {
  return state.gold.sales;
}

/** Held gold at spot and at the expected net (the §10 package fills the net from `netSalePerFineOz`). */
function heldGoldValue(state: GameState): { atSpotCents: Cents; expectedNetCents: Cents } {
  let atSpot = 0;
  for (const l of sortedValues(state.gold.lots)) {
    if (l.status !== 'held') continue;
    atSpot += lotView(state, l).valueAtSpotCents;
  }
  // CONTRACT-STUB(§10) gold.heldGoldValue expected net
  return { atSpotCents: atSpot as Cents, expectedNetCents: ZERO_CENTS };
}

/** This week's visible market series (§10; P0–P4 flat). */
function market(state: GameState): MarketSnapshot {
  return marketSnapshot(state);
}

export const goldSelectors = {
  market,
  spotUsdPerFineOz,
  dieselRackUsdPerGal,
  cpiIndex,
  baseRate,
  realRate,
  goldIdx,
  goldIdxReal,
  goldMomentum,
  lots,
  lot,
  buyers,
  standingOrder,
  goldSales,
  heldGoldValue,
  quoteChannels,
} as const;
