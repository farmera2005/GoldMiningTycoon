// Synthetic GameResults for the metric tests (BALANCE §5.1–5.7 cases). Not used by the harness.
import type { GameResult, YearEnd } from './gameResult';

export function syntheticYear(year: number, over: Partial<YearEnd> = {}): YearEnd {
  return {
    year,
    turn: 52 * year - 1,
    carried: false,
    ownerNwCents: 52_000_000,
    companyNwCents: 40_000_000,
    cashCents: 40_000_000,
    cpiIndex: 1,
    claimsHeld: 0,
    fleetWashBcyHr: 0,
    washedBcy: 0,
    weighedRawOz: 0,
    fineOz: 0,
    netIncomeCents: 0,
    cashCostUsdPerOz: null,
    aiscUsdPerOz: null,
    stops: 0,
    stopsOffSeason: null,
    ...over,
  };
}

export function syntheticResult(
  over: Partial<GameResult> = {},
  years = 5,
  yearOver: (n: number) => Partial<YearEnd> = () => ({}),
): GameResult {
  return {
    index: 0,
    seed: '1000',
    bot: 'cautious',
    start: 'bootstrapper',
    difficulty: 'standard',
    background: 'none',
    entity: 'llc',
    rules: 1,
    years,
    tuningHash: '0000000000000000',
    district: null,
    startNwCents: 52_000_000,
    finalTurn: 52 * years - 1,
    runStatus: 'active',
    endReason: null,
    lostTurn: null,
    lossCause: null,
    liquidationCause: null,
    reorg: { filedTurn: null, confirmedTurn: null, completedTurn: null, convertedTurn: null, consensual: null },
    distressFleetSaleTurn: null,
    byYear: Array.from({ length: years }, (_, i) => syntheticYear(i + 1, yearOver(i + 1))),
    unsoldGoldChangeY1Cents: 0,
    minCashCents: 40_000_000,
    minCashTurn: 0,
    claimsAcquired: null,
    claimsProfitable: null,
    explorationSpendCents: null,
    firstSeasonCommitmentCents: null,
    ownerInjectionCents: null,
    events: null,
    options: { maxPlantLines: 0, smallCrewClaimWeeks: 0, poolMechanicWeeks: 0 },
    stopsByKind: { blockingDecision: 0, gameOver: 0, alert: 0, seasonPhase: 0, rule: 0, maxWeeks: 0 },
    longestQuietWeeks: 0,
    rejectedActions: 0,
    rejectionsByCode: {},
    abortReason: null,
    abortedTurn: null,
    ...over,
  };
}

/** A going concern every year: washed, one claim and a 40 bcy/hr fleet at every year end. */
export const operating = (): Partial<YearEnd> => ({ washedBcy: 50_000, claimsHeld: 1, fleetWashBcyHr: 40 });
