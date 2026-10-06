// §9 fleet selectors (DESIGN §2.11, §9 9.13; P1 contract §4.9): pure readers over state, spread into `select` by
// select/index.ts. P1 machines and listings carry no hidden field (S09-20); from P3 a listing view drops `truth` and a
// machine view the true component state, which these views already do so the shape does not change then. A name
// already used by another folder fails the composition test.
import type { DistrictId, EquipListingId, FactoryOrderId, MachineId } from '../../core/ids';
import { sortedKeys, sortedValues } from '../../core/iter';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { machineCostPerHour, resaleEstimate } from './machine';
import { distressFleetSale, fleetWashCapacityBcyHr, machinesOnClaim } from './site';
import type {
  ComponentKey,
  ComponentState,
  EquipmentListing,
  FactoryOrder,
  FleetSaleEvent,
  Machine,
  PmLevel,
  Range,
  TransportJob,
} from './types';

/** A machine as the player sees it: component truth, PM truth and lemon masks stripped (P3 fields). */
export type MachineView = Omit<Machine, 'components' | 'pm'> & {
  knownHealth: Partial<Record<ComponentKey, Range | null>>;
  pmKnownLastAt: Partial<Record<PmLevel, number>> | null;
};

/** A listing as the player sees it, with its landed cost (ask, sales tax and transport). */
export type EquipmentListingView = Omit<EquipmentListing, 'truth' | 'bids'> & {
  landedCents: Cents | null;
};

function machineView(m: Machine): MachineView {
  const { components, pm, ...rest } = m;
  const knownHealth: Partial<Record<ComponentKey, Range | null>> = {};
  const byKey = components as Readonly<Record<ComponentKey, ComponentState | undefined>>;
  for (const key of sortedKeys(byKey)) knownHealth[key] = byKey[key]?.knownHealth ?? null;
  return { ...rest, knownHealth, pmKnownLastAt: pm?.knownLastAt ?? null };
}

function equipmentListingView(l: EquipmentListing): EquipmentListingView {
  const { truth: _truth, bids: _bids, ...rest } = l;
  // CONTRACT-STUB(§9) fleet.listingView landed cost
  return { ...rest, landedCents: rest.askCents ?? null };
}

function machines(state: GameState): MachineView[] {
  return sortedValues(state.fleet.machines).map(machineView);
}

function machine(state: GameState, machineId: MachineId): MachineView | null {
  const m = state.fleet.machines[machineId];
  return m === undefined ? null : machineView(m);
}

function equipmentListings(state: GameState, districtId?: DistrictId): EquipmentListingView[] {
  return sortedValues(state.fleet.listings)
    .filter((l) => districtId === undefined || (l.location.kind !== 'claim' && l.location.kind !== 'transit' && l.location.id === districtId))
    .map(equipmentListingView);
}

function listingView(state: GameState, listingId: EquipListingId): EquipmentListingView | null {
  const l = state.fleet.listings[listingId];
  return l === undefined ? null : equipmentListingView(l);
}

function orders(state: GameState): FactoryOrder[] {
  return sortedValues(state.fleet.orders);
}

function order(state: GameState, orderId: FactoryOrderId): FactoryOrder | null {
  return state.fleet.orders[orderId] ?? null;
}

function transports(state: GameState): TransportJob[] {
  return sortedValues(state.fleet.transports);
}

function saleLog(state: GameState): FleetSaleEvent[] {
  return state.fleet.saleLog;
}

function resaleEstimateCents(state: GameState, machineId: MachineId): Cents {
  return state.fleet.machines[machineId] === undefined ? ZERO_CENTS : resaleEstimate(state, machineId).value;
}

export const fleetSelectors = {
  machines,
  machine,
  equipmentListings,
  listingView,
  orders,
  order,
  transports,
  machinesOnClaim,
  fleetWashCapacityBcyHr,
  distressFleetSale,
  saleLog,
  resaleEstimate: resaleEstimateCents,
  machineCostPerHour,
} as const;
