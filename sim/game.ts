// One simulated game (DESIGN §2.12 "Harness"): newGame → each week the bot answers open decisions and returns actions,
// each through validateAction / applyAction (a rejection is a bot defect, counted) → advanceWeek with explanations
// off → evaluateStops under defaultStopRules() for pacing → stop when runStatus ≠ 'active' or the year count is
// reached. Used in-process and by every worker, so both paths run the same code.
import {
  advanceWeek,
  applyAction,
  canAdvance,
  defaultRunAnchor,
  defaultStopRules,
  evaluateStops,
  newGame,
  type GameState,
  type NewGameSetup,
  type RulesPhase,
  type RunAnchor,
  type StopReason,
  type StopRule,
  type TuningOverrides,
} from '../src/engine';
import { uiConfig } from '../src/data/tuning/ui';
import { implementedBot, type BotSpec } from './bots/catalog';
import { buildBotView } from './bots/view';
import { GameObserver, WEEKS_PER_YEAR, type GameResult } from './metrics/gameResult';
import { startNetWorthCents } from './metrics/startNetWorth';
import { observeWeek } from './metrics/observe';
import type { CellSetup } from './setup';

/** Everything a worker needs to play any game of one cell (structured-clone safe). */
export interface CellRunSpec {
  readonly cell: CellSetup;
  readonly setup: NewGameSetup;
  readonly bot: BotSpec;
  /** The label written to outputs (`brandOnly(cat)` or the id). */
  readonly botLabel: string;
  readonly rulesPhase: RulesPhase;
  readonly overrides: TuningOverrides;
  readonly years: number;
  readonly seedBase: number;
  readonly games: number;
  /** Games with index below this record a weekly sample (BALANCE §6.6 weekly-sample.csv). */
  readonly sampleGames: number;
}

/** One row of weekly-sample.csv: cash, bcy and gold (BALANCE §6.6). */
export interface WeeklySampleRow {
  turn: number;
  year: number;
  week: number;
  cashCents: number;
  ownerNwCents: number;
  washedBcy: number | null;
  weighedRawOz: number | null;
  fineOz: number | null;
}

export interface GameRecord {
  result: GameResult;
  weekly: WeeklySampleRow[] | null;
  /** advanceWeek wall time per simulated week, ms. Kept out of every deterministic output. */
  weekMs: number[];
}

/** Game i's seed (BALANCE §6.2): `seedBase + i`, as the string newGame takes. */
export function seedFor(seedBase: number, index: number): string {
  return String(seedBase + index);
}

/** The simulator's pacing rules: §13 13.9's defaults with the app's configured parameters (D-2.23). */
export function simStopRules(): StopRule[] {
  return defaultStopRules({
    deadlineNoticeWeeks: uiConfig['ui.runDeadlineNoticeWeeks'],
    goldMoveStopPct: uiConfig['ui.runGoldMoveStopPct'],
  });
}

function sampleRow(state: GameState): WeeklySampleRow {
  const o = observeWeek(state);
  return {
    turn: o.turn,
    year: o.year,
    week: o.week,
    cashCents: o.cashCents,
    ownerNwCents: o.ownerNwCents,
    washedBcy: o.washedBcy,
    weighedRawOz: o.weighedRawOz,
    fineOz: o.fineOz,
  };
}

export type Clock = () => number;

/**
 * Plays game `index` of a cell. Y years end at turn 52·Y − 1, the last week of year Y (turn 0 is newGame's year 1
 * week 1, D-2.13). `clock` times advanceWeek only.
 */
export function playGame(spec: CellRunSpec, index: number, clock: Clock): GameRecord {
  const bot = implementedBot(spec.bot);
  if (bot === null) throw new Error(`playGame: bot ${spec.botLabel} is not implemented in this build`);
  const seed = seedFor(spec.seedBase, index);
  let state = newGame(spec.setup, seed, spec.overrides, { rulesPhase: spec.rulesPhase });
  const observer = new GameObserver(
    {
      index,
      seed,
      bot: spec.botLabel,
      start: spec.cell.start,
      difficulty: spec.cell.difficulty,
      background: spec.cell.background,
      entity: spec.cell.entity,
      rules: spec.rulesPhase,
      years: spec.years,
      startNwCents: startNetWorthCents(spec.cell.start, state.meta.tuning),
    },
    state,
  );
  const weekly = index < spec.sampleGames ? [sampleRow(state)] : null;
  const weekMs: number[] = [];
  const rules = simStopRules();
  const lastTurn = WEEKS_PER_YEAR * spec.years - 1;
  let anchor: RunAnchor = defaultRunAnchor(state);
  let stops: StopReason[] = [];
  let abort: { reason: 'blockingDecisionUnanswered'; turn: number } | null = null;

  while (state.clock.turn < lastTurn && canAdvance(state) !== 'GAME_OVER') {
    // applyAction runs validateAction first (§2.2); a refused action leaves the state unchanged and is a bot defect.
    for (const action of bot.decide(state, buildBotView(state, stops))) {
      const r = applyAction(state, action);
      if (r.ok) state = r.state;
      else observer.rejected(r.error.code);
    }
    const refusal = canAdvance(state);
    if (refusal === 'GAME_OVER') break;
    if (refusal === 'BLOCKING_DECISION_OPEN') {
      abort = { reason: 'blockingDecisionUnanswered', turn: state.clock.turn };
      break;
    }
    const prev = state;
    const t0 = clock();
    const week = advanceWeek(prev, { explain: false });
    weekMs.push(clock() - t0);
    stops = evaluateStops(prev, week, rules, anchor);
    state = week.state;
    observer.week(state, stops);
    weekly?.push(sampleRow(state));
    // A stop ends one run of runToNextDecision; the next run is anchored where it starts (§13 13.9).
    if (stops.length > 0) anchor = defaultRunAnchor(state);
  }
  return { result: observer.finish(state, abort), weekly, weekMs };
}
