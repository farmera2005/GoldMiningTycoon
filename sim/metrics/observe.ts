// What the harness reads from a game (BALANCE §5 intro: every metric comes from engine selectors, never from bot-side
// estimates). One adapter, so each read is named once and its source documented. Where §2.11 has no selector yet the
// read is of a non-hidden state field and marked "no selector".
// Systems that a phase has not shipped are observed as absent (null); once a later rules phase runs, an input that is
// not wired to its owner's selector throws instead of silently reading zero.
import {
  rulesAtLeast,
  select,
  type EndReason,
  type GameState,
  type LiquidationPath,
  type RulesPhase,
  type RunStatus,
} from '../../src/engine';

export interface WeekObservation {
  readonly turn: number;
  readonly year: number;
  readonly week: number;
  /** §11 cashOnHand. */
  readonly cashCents: number;
  /** §1 1.13 `netWorth(state, 'scoring')`. */
  readonly ownerNwCents: number;
  readonly companyNwCents: number;
  /** §10 cpiIndex (flat 1.0 before P5). */
  readonly cpiIndex: number;
  /** §7 pay bcy washed this week; null while §7 is absent (rules < 1). */
  readonly washedBcy: number | null;
  /** §7 weighed raw oz this week; null while §7 is absent. */
  readonly weighedRawOz: number | null;
  /** §10 recovered fine oz this week; null until §10 publishes it. */
  readonly fineOz: number | null;
  /** §5 claims held; null while §5 is absent. */
  readonly claimsHeld: number | null;
  /** §9 wash capacity of the fleet on hand, bcy/hr (BALANCE §5.2's ≥ 20 test); null while §9 is absent. */
  readonly fleetWashBcyHr: number | null;
  /** §9/§11: a dealer or quick sale of fleet while the insolvency counter is open or stage ≥ 3; null while absent. */
  readonly distressFleetSale: boolean | null;
}

export interface RunOutcome {
  readonly runStatus: RunStatus;
  readonly endReason: EndReason | null;
  /** = §11's distress.liquidation.cause. */
  readonly liquidationPath: LiquidationPath | null;
}

/** §11 11.16 reorganization case facts (P4+). */
export interface ReorgObservation {
  readonly filedTurn: number | null;
  readonly confirmedTurn: number | null;
  readonly completedTurn: number | null;
  readonly convertedTurn: number | null;
  readonly consensual: boolean | null;
}

/** Thrown when a rules phase needs an input this adapter has not been wired to yet. */
export class ObservationNotWiredError extends Error {
  constructor(what: string, phase: RulesPhase) {
    super(
      `sim/metrics/observe.ts: '${what}' must read its owner's selector under P${phase} rules; wire it before running ` +
        `P${phase} games (BALANCE §5 intro)`,
    );
    this.name = 'ObservationNotWiredError';
  }
}

function absentBefore<T>(state: GameState, phase: RulesPhase, what: string, absent: T): T {
  if (rulesAtLeast(state, phase)) throw new ObservationNotWiredError(what, phase);
  return absent;
}

/** The snapshot step 16 wrote for the current turn (§2.5 history ring). */
function currentSnapshot(state: GameState, turn: number) {
  const ring = select.weeklyHistory(state);
  const last = ring[ring.length - 1];
  return last !== undefined && last.turn === turn ? last.company : undefined;
}

export function observeWeek(state: GameState): WeekObservation {
  const date = select.dateView(state);
  const snap = currentSnapshot(state, date.turn);
  const opsShipped = rulesAtLeast(state, 1);
  return {
    turn: date.turn,
    year: date.year,
    week: date.week,
    cashCents: select.cashOnHand(state),
    ownerNwCents: select.netWorth(state, 'scoring'),
    companyNwCents: select.companyNetWorth(state),
    cpiIndex: select.market(state).cpiIndex,
    // §7 writes these snapshot fields from P1; under P0 rules there are no operations, so they are not measured.
    washedBcy: opsShipped ? (snap?.payWashedBcy ?? 0) : null,
    weighedRawOz: opsShipped ? (snap?.weighedRawOz ?? 0) : null,
    fineOz: absentBefore(state, 1, 'fineOz (§10 recovered fine oz)', null),
    claimsHeld: absentBefore(state, 1, 'claimsHeld (§5 tenures)', null),
    fleetWashBcyHr: absentBefore(state, 1, 'fleetWashBcyHr (§9 fleet capacity)', null),
    distressFleetSale: absentBefore(state, 1, 'distressFleetSale (§9 dealer sale under distress)', null),
  };
}

export function runOutcome(state: GameState): RunOutcome {
  return select.runOutcome(state);
}

/** Company-book net income of a completed game year (§2.5 annual rollup). */
export function yearNetIncomeCents(state: GameState, year: number): number | null {
  const rollup = select.annualHistory(state).find((r) => r.year === year);
  return rollup === undefined ? null : rollup.netIncomeCents;
}

/** §11's reorganization case: none can exist before P4 (D-11.73), so the case facts are all empty. */
export function observeReorg(state: GameState): ReorgObservation {
  return absentBefore(state, 4, 'reorganization case (§11 11.16)', {
    filedTurn: null,
    confirmedTurn: null,
    completedTurn: null,
    convertedTurn: null,
    consensual: null,
  });
}

/** BALANCE §5.6: change in unsold gold at the best visible net price; no gold exists before P1. */
export function unsoldGoldValueCents(state: GameState): number | null {
  return absentBefore(state, 1, 'unsold gold value (§10 lots)', 0);
}

/** The first claim's district (O-16); none before P1. */
export function firstClaimDistrict(state: GameState): string | null {
  return absentBefore(state, 1, 'first claim district (§5)', null);
}
