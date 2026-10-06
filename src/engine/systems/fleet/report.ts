// §9 fleet's week scratch and week record (P1 contract §1.3, §4.9, s02 #10, S09-16). The scratch carries each claim's
// machine availability, derived in part 8.1 and read by §7 and §4 in step 9 (from P3 also the failure masks of step
// 10). The record lists the deliveries, stalled transports and the week's maintenance spend.
import type { ClaimId, MachineId, TransportJobId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { MachineAvailability } from './types';

export type { MachineAvailability } from './types';

export interface FleetWeekScratch {
  availability: Record<ClaimId, Record<MachineId, MachineAvailability>>;
}

export interface FleetWeekRecord {
  deliveries: MachineId[];
  transportsStalled: TransportJobId[];
  maintenanceCents: Cents;
}

export function emptyFleetWeekScratch(): FleetWeekScratch {
  return { availability: {} };
}

export function emptyFleetWeekRecord(): FleetWeekRecord {
  return { deliveries: [], transportsStalled: [], maintenanceCents: ZERO_CENTS };
}
