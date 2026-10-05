// Replaying an action log (DESIGN §2.3 item 5, §2.14 golden replays). Same seed + setup + action log ⇒ byte-identical
// states: newGame, then for each week the actions logged at that turn (in actionSeq order) followed by advanceWeek.
// Golden tests, `npm run replay` and bug reports share this one implementation.
import { applyAction } from '../actions/apply';
import type { LoggedAction } from '../actions/types';
import { hashState } from '../state/hash';
import { newGame } from '../state/newGame';
import type { NewGameSetup } from '../state/setup';
import type { TuningOverrides } from '../state/tuning';
import type { GameState, RulesPhase } from '../state/types';
import { advanceWeek } from '../turn/advanceWeek';
import type { WeekReport } from '../turn/types';

export const REPLAY_FORMAT = 'gmt-replay';

/** A recorded game: everything needed to rebuild it exactly. */
export interface ReplayLog {
  format: typeof REPLAY_FORMAT;
  version: 1;
  name?: string;
  seed: string;
  setup: NewGameSetup;
  overrides?: TuningOverrides;
  rulesPhase?: RulesPhase;
  /** How many weeks to advance. */
  weeks: number;
  /** Applied at `turn`, before that turn's advance (or at the end, for turn = weeks). */
  actions: LoggedAction[];
}

export interface TurnHash {
  turn: number;
  hash: string;
}

export interface ReplayOptions {
  explain?: boolean;
  /** Called after newGame (report null) and after every week. */
  onWeek?: (state: GameState, report: WeekReport | null) => void;
}

export interface ReplayResult {
  state: GameState;
  /** turn 0 (after newGame and its turn-0 actions) and every advanced week. */
  hashes: TurnHash[];
}

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

function checkLog(log: ReplayLog): void {
  if (log.format !== REPLAY_FORMAT || log.version !== 1) throw new ReplayError('not a gmt-replay v1 log');
  if (!Number.isSafeInteger(log.weeks) || log.weeks < 0) throw new ReplayError(`weeks must be ≥ 0, got ${log.weeks}`);
  let last: LoggedAction | undefined;
  for (const a of log.actions) {
    if (!Number.isSafeInteger(a.turn) || a.turn < 0 || a.turn > log.weeks) {
      throw new ReplayError(`action at turn ${a.turn} is outside 0…${log.weeks}`);
    }
    if (last !== undefined && (a.turn < last.turn || a.actionSeq <= last.actionSeq)) {
      throw new ReplayError(`actions must ascend by turn and actionSeq (at turn ${a.turn}, seq ${a.actionSeq})`);
    }
    last = a;
  }
}

function applyLogged(state: GameState, entry: LoggedAction): GameState {
  if (entry.actionSeq !== state.clock.actionSeq + 1) {
    throw new ReplayError(
      `turn ${entry.turn}: logged actionSeq ${entry.actionSeq}, state expects ${state.clock.actionSeq + 1}`,
    );
  }
  const r = applyAction(state, entry.action);
  if (!r.ok) throw new ReplayError(`turn ${entry.turn}, seq ${entry.actionSeq}: ${r.error.code} ${r.error.message}`);
  return r.state;
}

/** Rebuilds a logged game and returns the final state with the per-week state hashes. */
export function replayLog(log: ReplayLog, opts: ReplayOptions = {}): ReplayResult {
  checkLog(log);
  const newGameOpts = log.rulesPhase === undefined ? {} : { rulesPhase: log.rulesPhase };
  let state = newGame(log.setup, log.seed, log.overrides, newGameOpts);
  let next = 0;
  const applyDue = (): void => {
    while (next < log.actions.length && (log.actions[next] as LoggedAction).turn === state.clock.turn) {
      state = applyLogged(state, log.actions[next] as LoggedAction);
      next++;
    }
  };
  applyDue();
  opts.onWeek?.(state, null);
  const hashes: TurnHash[] = [{ turn: state.clock.turn, hash: hashState(state) }];
  for (let w = 0; w < log.weeks; w++) {
    const week = advanceWeek(state, { explain: opts.explain === true });
    state = week.state;
    applyDue();
    opts.onWeek?.(state, week.report);
    hashes.push({ turn: state.clock.turn, hash: hashState(state) });
  }
  if (next < log.actions.length)
    throw new ReplayError(`${log.actions.length - next} logged actions were never reached`);
  return { state, hashes };
}
