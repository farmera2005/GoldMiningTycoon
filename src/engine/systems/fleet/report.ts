// §9 fleet's week scratch and week record (P1 contract §1.3, s02 #10, S09-16). The scratch carries each claim's
// machine availability, derived in step 8 and read by §7 and §4 in step 9 (from P3 also the failure masks of step 10).
// The record lists the deliveries, stalled transports and the week's maintenance spend.
import type { ClaimId, MachineId, TransportJobId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';

/** One machine's availability this week. Placeholder until §9's `MachineAvailability` (contract §4.9) replaces it. */
export type MachineAvailability = Readonly<Record<string, unknown>>;

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
