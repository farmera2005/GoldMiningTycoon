// §9 transport and the month-end depreciation hand-off (DESIGN §9 9.5, 9.10, 9.13; D-9.70, D-11.88, S11-16; P1
// contract §4.9). `monthDepreciation` sums and clears each machine's `unpostedDepCents`, split by claim by the month's
// hours, for §11's step 14h. Wave-0 stubs return nothing.
import type { ClaimId, MachineId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { Month } from '../../core/calendar';
import type { GameState } from '../../state/types';
import type { LocationRef, TransportLeg, TransportMode } from './types';

/** The reporting month being closed (§1 calendar). */
export interface MonthWindow {
  year: number;
  month: Month;
  fromTurn: number;
  toTurn: number;
}

export interface TransportQuote {
  mode: TransportMode;
  loads: number;
  costCents: Cents;
  weeks: number;
  legs: Omit<TransportLeg, 'doneMiles'>[];
  /** The access outlook shows no open week for the route in its horizon (D-9.65). */
  accessClosed: boolean;
}

export interface MonthDepreciationLine {
  machineId: MachineId;
  claimId: ClaimId | null;
  cents: Cents;
}

export function transportLegs(_state: GameState, _from: LocationRef, _to: LocationRef): Omit<TransportLeg, 'doneMiles'>[] {
  // CONTRACT-STUB(§9) fleet.transportLegs
  return [];
}

export function transportQuote(
  _state: GameState,
  _machineIds: readonly MachineId[],
  _from: LocationRef,
  _to: LocationRef,
  mode: TransportMode,
): TransportQuote {
  // CONTRACT-STUB(§9) fleet.transportQuote
  return { mode, loads: 0, costCents: ZERO_CENTS, weeks: 0, legs: [], accessClosed: false };
}

export function monthDepreciation(_draft: GameState, _calendar: MonthWindow): MonthDepreciationLine[] {
  // CONTRACT-STUB(§9) fleet.monthDepreciation
  return [];
}
