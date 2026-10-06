// The per-game result record (BALANCE §6.6 games.csv; DESIGN §2.12 outputs). It holds the raw timeline the §5 metric
// definitions need (sim/metrics/survival.ts derives B_N, S_N, RS_N, BK_N from it), every figure as the engine's
// selectors showed it, and null wherever the phase cannot compute a figure yet. Timings never enter it: it must be
// byte-identical across runs and worker counts.
import type {
  Difficulty,
  EndReason,
  EntityType,
  GameState,
  LiquidationPath,
  OwnerBackground,
  RulesPhase,
  RunStatus,
  StopReason,
  StopReasonKind,
} from '../../src/engine';
import type { SimStart } from '../setup';
import {
  firstClaimDistrict,
  observeReorg,
  observeWeek,
  runOutcome,
  unsoldGoldValueCents,
  yearNetIncomeCents,
  type ReorgObservation,
  type WeekObservation,
} from './observe';

export const WEEKS_PER_YEAR = 52;

/** BALANCE §6.6 lossCause. */
export type LossCause = 'liquidated' | 'ousted' | 'scenario';
/** BALANCE §6.6 reorgStatus at the end of the run. */
export type ReorgStatus = 'none' | 'filed' | 'confirmed' | 'completed' | 'converted';
/** Why the harness stopped a game early (a bot defect, counted and reported). */
export type AbortReason = 'blockingDecisionUnanswered';

export const STOP_KINDS: readonly StopReasonKind[] = [
  'blockingDecision',
  'gameOver',
  'alert',
  'seasonPhase',
  'rule',
  'maxWeeks',
];

/** The state at the end of game year N (week 52, turn 52N − 1), or the run's last state carried forward. */
export interface YearEnd {
  year: number;
  /** The turn observed: 52·year − 1, or the run's last turn when it ended or was aborted earlier. */
  turn: number;
  /** True when the run had already ended (or been aborted) before this year's week 52. */
  carried: boolean;
  ownerNwCents: number;
  companyNwCents: number;
  cashCents: number;
  cpiIndex: number;
  claimsHeld: number | null;
  fleetWashBcyHr: number | null;
  /** Year totals; null while the owning system is absent. */
  washedBcy: number | null;
  weighedRawOz: number | null;
  fineOz: number | null;
  /** Company-book net income of the year (§2.5 annual rollup); null for a year the run did not complete. */
  netIncomeCents: number | null;
  /** BALANCE §5.4 per producing season (§11 11.19.5); null until §11 reports cost per ounce. */
  cashCostUsdPerOz: number | null;
  aiscUsdPerOz: number | null;
  /** Weeks of the year in which evaluateStops gave at least one reason (one stop of runToNextDecision each). */
  stops: number;
  /** Of those, stops between freeze-up and breakup (O-13); null until seasons exist (P1). */
  stopsOffSeason: number | null;
}

export interface GameResult {
  index: number;
  seed: string;
  bot: string;
  start: SimStart;
  difficulty: Difficulty;
  background: OwnerBackground;
  entity: EntityType;
  rules: RulesPhase;
  years: number;
  tuningHash: string;
  /** The first claim's district (O-16); null with no claim. */
  district: string | null;
  /** BALANCE §5.3's start NW for this start and difficulty (NW ratio denominator); null when not derivable yet. */
  startNwCents: number | null;
  finalTurn: number;
  runStatus: RunStatus;
  endReason: EndReason | null;
  lostTurn: number | null;
  lossCause: LossCause | null;
  liquidationCause: LiquidationPath | null;
  /** §11 11.16 reorganization case; every turn null when no case was filed. */
  reorg: ReorgObservation;
  /** First distress fleet sale (BALANCE §5.2); null when none (or no fleet system yet). */
  distressFleetSaleTurn: number | null;
  /** Index N − 1 = year N, for N = 1..years. */
  byYear: YearEnd[];
  /** BALANCE §5.6 term: change in unsold gold over year 1 at the best visible net price; null if not computable. */
  unsoldGoldChangeY1Cents: number | null;
  minCashCents: number;
  minCashTurn: number;
  claimsAcquired: number | null;
  claimsProfitable: number | null;
  explorationSpendCents: number | null;
  firstSeasonCommitmentCents: number | null;
  ownerInjectionCents: number | null;
  /** §12 events affecting the company, by severity; null until events exist (P3). */
  events: { minor: number; moderate: number; major: number; catastrophic: number } | null;
  /** Use of the multi-claim options (D-2.32): zero for every bot that keeps the defaults. */
  options: { maxPlantLines: number; smallCrewClaimWeeks: number; poolMechanicWeeks: number };
  stopsByKind: Record<StopReasonKind, number>;
  /** Longest run of consecutive weeks without a stop (O-13's 26-week rule reads it once seasons exist). */
  longestQuietWeeks: number;
  /** Bot actions the validator rejected (a bot defect), with their codes. */
  rejectedActions: number;
  rejectionsByCode: Record<string, number>;
  abortReason: AbortReason | null;
  abortedTurn: number | null;
}

export interface GameIdentity {
  index: number;
  seed: string;
  bot: string;
  start: SimStart;
  difficulty: Difficulty;
  background: OwnerBackground;
  entity: EntityType;
  rules: RulesPhase;
  years: number;
  startNwCents: number | null;
}

function lossCauseOf(endReason: EndReason | null): LossCause | null {
  switch (endReason) {
    case 'liquidated':
      return 'liquidated';
    case 'ousted':
      return 'ousted';
    case 'deadline':
    case 'forfeited':
      return 'scenario';
    case 'goal':
    case 'retired':
    case null:
      return null;
  }
}

function zeroStops(): Record<StopReasonKind, number> {
  return { blockingDecision: 0, gameOver: 0, alert: 0, seasonPhase: 0, rule: 0, maxWeeks: 0 };
}

interface YearAccumulator {
  washedBcy: number | null;
  weighedRawOz: number | null;
  fineOz: number | null;
  stops: number;
}

function addNullable(total: number | null, x: number | null): number | null {
  return total === null || x === null ? null : total + x;
}

/**
 * Builds a GameResult by watching a game week by week: `start` at turn 0, `week` after each advanceWeek, `finish` at
 * the end. It reads the game only through sim/metrics/observe.ts.
 */
export class GameObserver {
  private readonly id: GameIdentity;
  private readonly tuningHash: string;
  private readonly district: string | null;
  private readonly startUnsoldGold: number | null;
  private unsoldGoldY1: number | null = null;
  private readonly years: YearEnd[] = [];
  private acc: YearAccumulator;
  private last: WeekObservation;
  private minCashCents: number;
  private minCashTurn: number;
  private readonly stopsByKind = zeroStops();
  private quiet = 0;
  private longestQuiet = 0;
  private distressSaleTurn: number | null = null;
  rejectedActions = 0;
  readonly rejectionsByCode: Record<string, number> = {};

  constructor(identity: GameIdentity, start: GameState) {
    this.id = identity;
    this.tuningHash = start.meta.tuningHash;
    this.district = firstClaimDistrict(start);
    this.startUnsoldGold = unsoldGoldValueCents(start);
    this.last = observeWeek(start);
    this.minCashCents = this.last.cashCents;
    this.minCashTurn = this.last.turn;
    this.acc = this.freshYear(this.last);
  }

  private freshYear(o: WeekObservation): YearAccumulator {
    // Turn 0 is newGame's week 1 (D-2.13): nothing is produced in it, so year totals start at zero (or n/a).
    return {
      washedBcy: o.washedBcy === null ? null : 0,
      weighedRawOz: o.weighedRawOz === null ? null : 0,
      fineOz: o.fineOz === null ? null : 0,
      stops: 0,
    };
  }

  rejected(code: string): void {
    this.rejectedActions++;
    this.rejectionsByCode[code] = (this.rejectionsByCode[code] ?? 0) + 1;
  }

  /** After the week that produced `state`, with that week's stop reasons. */
  week(state: GameState, stops: readonly StopReason[]): void {
    const o = observeWeek(state);
    this.acc.washedBcy = addNullable(this.acc.washedBcy, o.washedBcy);
    this.acc.weighedRawOz = addNullable(this.acc.weighedRawOz, o.weighedRawOz);
    this.acc.fineOz = addNullable(this.acc.fineOz, o.fineOz);
    if (o.cashCents < this.minCashCents) {
      this.minCashCents = o.cashCents;
      this.minCashTurn = o.turn;
    }
    if (o.distressFleetSale === true && this.distressSaleTurn === null) this.distressSaleTurn = o.turn;
    if (stops.length > 0) {
      this.acc.stops++;
      for (const r of stops) this.stopsByKind[r.kind]++;
      this.quiet = 0;
    } else {
      this.quiet++;
      this.longestQuiet = Math.max(this.longestQuiet, this.quiet);
    }
    this.last = o;
    if (o.week === WEEKS_PER_YEAR) this.closeYear(state, false);
    if (o.year === 1 && o.week === WEEKS_PER_YEAR) {
      const now = unsoldGoldValueCents(state);
      this.unsoldGoldY1 = now === null || this.startUnsoldGold === null ? null : now - this.startUnsoldGold;
    }
  }

  private closeYear(state: GameState, carried: boolean): void {
    const o = this.last;
    const year = this.years.length + 1;
    this.years.push({
      year,
      turn: o.turn,
      carried,
      ownerNwCents: o.ownerNwCents,
      companyNwCents: o.companyNwCents,
      cashCents: o.cashCents,
      cpiIndex: o.cpiIndex,
      claimsHeld: o.claimsHeld,
      fleetWashBcyHr: o.fleetWashBcyHr,
      washedBcy: this.acc.washedBcy,
      weighedRawOz: this.acc.weighedRawOz,
      fineOz: this.acc.fineOz,
      netIncomeCents: carried ? null : yearNetIncomeCents(state, year),
      cashCostUsdPerOz: null,
      aiscUsdPerOz: null,
      stops: this.acc.stops,
      stopsOffSeason: null,
    });
    // After the run ends nothing more happens, so carried years add no production or stops.
    this.acc = this.freshYear(o);
  }

  finish(state: GameState, abort: { reason: AbortReason; turn: number } | null): GameResult {
    const out = runOutcome(state);
    // A year still open when the run stopped keeps its partial totals; later years are carried forward from the end.
    while (this.years.length < this.id.years) this.closeYear(state, true);
    const ended = out.runStatus !== 'active';
    const lossCause = out.runStatus === 'lost' ? lossCauseOf(out.endReason) : null;
    return {
      ...this.id,
      tuningHash: this.tuningHash,
      district: this.district,
      finalTurn: this.last.turn,
      runStatus: out.runStatus,
      endReason: out.endReason,
      lostTurn: out.runStatus === 'lost' && ended ? this.last.turn : null,
      lossCause,
      liquidationCause: lossCause === 'liquidated' ? out.liquidationPath : null,
      reorg: observeReorg(state),
      distressFleetSaleTurn: this.distressSaleTurn,
      byYear: this.years.slice(0, this.id.years),
      unsoldGoldChangeY1Cents: this.unsoldGoldY1,
      minCashCents: this.minCashCents,
      minCashTurn: this.minCashTurn,
      claimsAcquired: null,
      claimsProfitable: null,
      explorationSpendCents: null,
      firstSeasonCommitmentCents: null,
      ownerInjectionCents: null,
      events: null,
      options: { maxPlantLines: 0, smallCrewClaimWeeks: 0, poolMechanicWeeks: 0 },
      stopsByKind: { ...this.stopsByKind },
      longestQuietWeeks: this.longestQuiet,
      rejectedActions: this.rejectedActions,
      rejectionsByCode: { ...this.rejectionsByCode },
      abortReason: abort?.reason ?? null,
      abortedTurn: abort?.turn ?? null,
    };
  }
}
