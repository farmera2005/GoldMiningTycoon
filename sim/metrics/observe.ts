// What the harness reads from a game (BALANCE §5 intro: every metric comes from engine selectors, never from bot-side
// estimates). One adapter, so each read is named once and its source documented (P1 contract §11.1 wires every P1
// input to its owner's selector; until an owner's package lands the selector is a contract stub with a neutral value).
// Systems that a phase has not shipped are observed as absent (null); once a later rules phase runs, an input that is
// not wired to its owner's selector throws instead of silently reading zero.
import {
  rulesAtLeast,
  select,
  type Cents,
  type ClaimId,
  type DistressStatusP1,
  type EndReason,
  type GameState,
  type LiquidationPath,
  type PayCategory,
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
    // §2 snapshot: weighed raw × the lot's estimated fineness, cleanups and sample lots (s01 #21).
    fineOz: opsShipped ? (snap?.fineOzRecovered ?? 0) : null,
    claimsHeld: opsShipped ? select.controlledClaimCount(state) : null,
    fleetWashBcyHr: opsShipped ? select.fleetWashCapacityBcyHr(state) : null,
    distressFleetSale: opsShipped ? select.distressFleetSale(state, date.turn) : null,
  };
}

/** §11 distress status (P1: the insolvency counter and the stub stage; s02 #18). */
export function observeDistress(state: GameState): DistressStatusP1 {
  return select.distressStatus(state);
}

/** §11 spend by payment category over turns fromTurn…toTurn, optionally one claim's (O-08, M-CLAIMPROFIT; s02 #14). */
export function spendByCategory(
  state: GameState,
  fromTurn: number,
  toTurn: number,
  claimId?: ClaimId,
): Partial<Record<PayCategory, Cents>> {
  return select.spendByCategory(state, fromTurn, toTurn, claimId);
}

/** §9 the machines on a claim (M-CLAIMPROFIT's fleet attribution; s02 #14). */
export function machinesOnClaim(state: GameState, claimId: ClaimId): readonly string[] {
  return select.machinesOnClaim(state, claimId);
}

export function runOutcome(state: GameState): RunOutcome {
  return select.runOutcome(state);
}

/** Company-book net income of a completed game year (§2.5 annual rollup). */
export function yearNetIncomeCents(state: GameState, year: number): number | null {
  const rollup = select.annualHistory(state).find((r) => r.year === year);
  return rollup === undefined ? null : rollup.netIncomeCents;
}

/**
 * The §11 11.2 chart's income and expense codes by family: income is revenue (`rev.`), other income (`inc.`) and
 * gains (`gain.`); every expense is `exp.`. No sub-ledger family is income or expense. sim/metrics/observe.test.ts
 * checks this against the engine's chart, so a new account cannot fall outside it unnoticed.
 */
export const INCOME_CODE_PREFIXES: readonly string[] = ['rev.', 'inc.', 'gain.'];
export const EXPENSE_CODE_PREFIXES: readonly string[] = ['exp.'];

/**
 * Company-book net income over turns fromTurn…toTurn inclusive (income less expenses, §11 11.19), the figure the
 * §2.5 annual rollup records for a full year. BALANCE §5.6 measures the year in which a run ended before week 52
 * through its last turn, like any other year: §11's `periodNetIncome` selector (P1 contract §11.1).
 */
export function netIncomeThroughCents(state: GameState, fromTurn: number, toTurn: number): number {
  return select.periodNetIncome(state, fromTurn, toTurn);
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

/** BALANCE §5.6: change in unsold gold at the best visible net price (§10 `heldGoldValue`); no gold exists before P1. */
export function unsoldGoldValueCents(state: GameState): number | null {
  return rulesAtLeast(state, 1) ? select.heldGoldValue(state).expectedNetCents : 0;
}

/** A claim the company holds (owned, leased, staked or inherited) and its district. */
export interface HeldClaim {
  readonly claimId: string;
  readonly districtId: string;
}

/**
 * The claims the company holds now (§5 tenures that are active), for O-16's first-claim district. None can be held
 * before P1 (no tenures), so P0 reads an empty list.
 */
export function heldClaims(state: GameState): readonly HeldClaim[] {
  if (!rulesAtLeast(state, 1)) return [];
  // A claim's district is public (§3 claim record; no selector).
  return select.heldClaimIds(state).map((claimId) => ({
    claimId,
    districtId: state.world.claims[claimId]?.districtId ?? '',
  }));
}
