// newGame (DESIGN §2.2, §2.6 turn semantics, D-2.13; P1 contract §1.5): builds the turn-0 state (year 1, week 1) and
// runs the owners' week-1 initializations that no pipeline will run for year 1. The first advanceWeek then simulates
// turn 1. The shell holds every slice at its neutral value; the init parts N1 … N11 (state/initParts.ts) then fill it
// in their fixed order, skipping any part from a later rules phase, so `--rules p0` builds exactly the P0 game. The
// shell is built here and not yet shared, so the parts fill it in place and it is frozen once at the end.
import { turnToYearWeek } from '../core/calendar';
import { emptyClimateSlice } from '../systems/climate/types';
import { companyShell } from '../systems/company/start';
import { emptyCompetitorSlice } from '../systems/competitors/types';
import { emptyEventsSlice } from '../systems/events/types';
import { emptyFinanceSlice } from '../systems/finance/types';
import { emptyFleetSlice } from '../systems/fleet/types';
import { emptyGoldSlice } from '../systems/gold/types';
import { emptyHistorySlice } from '../systems/history/types';
import { emptyInboxSlice } from '../systems/inbox/types';
import { emptyKnowledgeSlice } from '../systems/knowledge/types';
import { emptyLandSlice } from '../systems/land/types';
import { emptyOpsSlice } from '../systems/ops/types';
import { emptyPermitSlice } from '../systems/permits/types';
import { emptyStaffSlice } from '../systems/staff/types';
import { emptyWorldSlice } from '../systems/world/types';
import type { FixtureSpec } from './fixture';
import { cloneJson, freezeIfEnabled } from './immutability';
import { INIT_PARTS } from './initParts';
import { BUILD_RULES_PHASE, RULES_VERSION, isRulesPhase } from './rules';
import { CURRENT_SCHEMA_VERSION } from './schema';
import { SetupError, validateSetup, type NewGameSetup } from './setup';
import { resolveTuning, tuningHashOf, type TuningOverrides } from './tuning';
import type { GameMeta, GameState, InitCtx, RulesPhase } from './types';

export interface NewGameOptions {
  /** §2.12 `--rules pN`: the phase rules to run (default: the build's phase; never later than it). */
  rulesPhase?: RulesPhase;
}

/** Builds a new game. Throws SetupError for an invalid setup and TuningError for invalid overrides. */
export function newGame(
  setup: NewGameSetup,
  seed: string,
  tuningOverrides?: TuningOverrides,
  options: NewGameOptions = {},
): GameState {
  return buildNewGame(setup, seed, tuningOverrides, options, null);
}

/**
 * newGame with an optional fixture (`newFixtureGame`, P1 contract §1.6): a fixture game records `meta.fixtureId` and
 * runs §1's mean calendar (`calendarMode: 'mean'`), both set before the init parts run, and part N10 applies it.
 */
export function buildNewGame(
  setup: NewGameSetup,
  seed: string,
  tuningOverrides: TuningOverrides | undefined,
  options: NewGameOptions,
  fixture: FixtureSpec | null,
): GameState {
  const rulesPhase = options.rulesPhase ?? BUILD_RULES_PHASE;
  const issues = validateSetup(setup, rulesPhase);
  if (issues.length > 0) throw new SetupError(issues);
  if (typeof seed !== 'string' || seed.length === 0) throw new RangeError('newGame: seed must be a non-empty string');
  if (!isRulesPhase(rulesPhase) || rulesPhase > BUILD_RULES_PHASE) {
    throw new RangeError(
      `newGame: rules phase ${String(rulesPhase)} is not available in a P${BUILD_RULES_PHASE} build`,
    );
  }
  const ownSetup = cloneJson(setup);
  const tuning = resolveTuning(ownSetup, tuningOverrides);
  const { year, week } = turnToYearWeek(0);
  const meta: GameMeta = {
    seed,
    setup: ownSetup,
    tuningHash: tuningHashOf(tuning),
    tuning,
    rulesVersion: RULES_VERSION,
    rulesPhase,
    calendarMode: fixture === null ? 'drawn' : 'mean',
  };
  if (fixture !== null) meta.fixtureId = fixture.id;

  const shell: GameState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta,
    clock: { turn: 0, year, week, actionSeq: 0, phase: {} },
    ids: {},
    climate: emptyClimateSlice(),
    company: companyShell(ownSetup),
    world: emptyWorldSlice(),
    knowledge: emptyKnowledgeSlice(),
    land: emptyLandSlice(),
    permits: emptyPermitSlice(),
    ops: emptyOpsSlice(),
    staff: emptyStaffSlice(),
    fleet: emptyFleetSlice(),
    gold: emptyGoldSlice(),
    finance: emptyFinanceSlice(),
    events: emptyEventsSlice(),
    competitors: emptyCompetitorSlice(),
    inbox: emptyInboxSlice(),
    history: emptyHistorySlice(),
  };

  const init: InitCtx = {
    seed,
    setup: ownSetup,
    tuning,
    scratch: { candidates: [], inheritor: null, fixture },
  };
  for (const part of INIT_PARTS) if (part.fromPhase <= rulesPhase) part.run(shell, init);
  return freezeIfEnabled(shell);
}
