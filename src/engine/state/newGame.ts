// newGame (DESIGN §2.2, §2.6 turn semantics, D-2.13): builds the turn-0 state (year 1, week 1) and runs the owners'
// week-1 initializations that no pipeline will run for year 1. The first advanceWeek then simulates turn 1.
import { turnToYearWeek } from '../core/calendar';
import { sortedKeysByCodeUnit } from '../core/iter';
import { usdToCents } from '../core/money';
import { postInto } from '../systems/finance/ledger';
import { emptyFinanceSlice } from '../systems/finance/types';
import { emptyClimateSlice } from '../systems/climate/types';
import { emptyCompetitorSlice } from '../systems/competitors/types';
import { emptyEventsSlice } from '../systems/events/types';
import { emptyFleetSlice } from '../systems/fleet/types';
import { emptyGoldSlice } from '../systems/gold/types';
import { emptyHistorySlice } from '../systems/history/types';
import { companySnapshot, marketSnapshot, preHistory } from '../systems/history/snapshot';
import { emptyInboxSlice } from '../systems/inbox/types';
import { emptyKnowledgeSlice } from '../systems/knowledge/types';
import { emptyLandSlice } from '../systems/land/types';
import { emptyOpsSlice } from '../systems/ops/types';
import { emptyPermitSlice } from '../systems/permits/types';
import { emptyStaffSlice } from '../systems/staff/types';
import { generateWorld, worldIdCounters } from '../systems/world/generate';
import type { CompanySlice } from '../systems/company/types';
import { reserveIdsFrom } from './ids';
import { cloneJson, freezeIfEnabled } from './immutability';
import { BUILD_RULES_PHASE, RULES_VERSION, isRulesPhase } from './rules';
import { SetupError, validateSetup, type NewGameSetup } from './setup';
import { resolveTuning, tuningHashOf, tuningNumber, type TuningOverrides } from './tuning';
import type { GameState, IdCounters, RulesPhase } from './types';
import { CURRENT_SCHEMA_VERSION } from './schema';

export interface NewGameOptions {
  /** §2.12 `--rules pN`: the phase rules to run (default: the build's phase; never later than it). */
  rulesPhase?: RulesPhase;
}

function companyFromSetup(setup: NewGameSetup): CompanySlice {
  return {
    name: setup.companyName.trim(),
    entity: setup.entity,
    pendingEntity: null,
    background: setup.background,
    start: setup.start,
    difficulty: setup.difficulty,
    mode: setup.mode,
    owner: { name: setup.ownerName.trim() },
    scenario: null,
    runStatus: 'active',
    endReason: null,
    liquidationPath: null,
  };
}

/**
 * §1 1.8 start setup, P0 form (Bootstrapper): the owner's capital contribution into the company book and the owner's
 * personal cash into the owner book, both through the ledger so cash has an explanation from turn 0.
 */
function postOpeningCapital(state: GameState): void {
  const t = state.meta.tuning;
  const companyCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.companyCashUsd') * tuningNumber(t, 'game.startCompanyCashMult'),
  );
  const personalCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.personalCashUsd') * tuningNumber(t, 'game.startPersonalCashMult'),
  );
  const refs = [{ kind: 'company' as const, id: 'company' }];
  if (companyCents > 0) {
    postInto(state, {
      book: 'company',
      date: state.clock.turn,
      lines: [
        { account: 'cash.operating', debit: companyCents },
        { account: 'eq.ownerCapital', credit: companyCents },
      ],
      memo: 'Owner capital contribution',
      refs,
      source: '§1/start',
      counterparty: state.company.owner.name,
    });
  }
  if (personalCents > 0) {
    postInto(state, {
      book: 'owner',
      date: state.clock.turn,
      lines: [
        { account: 'own.cash', debit: personalCents },
        { account: 'own.equity', credit: personalCents },
      ],
      memo: 'Personal cash at start',
      refs,
      source: '§1/start',
    });
  }
}

/** Builds a new game. Throws SetupError for an invalid setup and TuningError for invalid overrides. */
export function newGame(
  setup: NewGameSetup,
  seed: string,
  tuningOverrides?: TuningOverrides,
  options: NewGameOptions = {},
): GameState {
  const issues = validateSetup(setup);
  if (issues.length > 0) throw new SetupError(issues);
  if (typeof seed !== 'string' || seed.length === 0) throw new RangeError('newGame: seed must be a non-empty string');
  const rulesPhase = options.rulesPhase ?? BUILD_RULES_PHASE;
  if (!isRulesPhase(rulesPhase) || rulesPhase > BUILD_RULES_PHASE) {
    throw new RangeError(
      `newGame: rules phase ${String(rulesPhase)} is not available in a P${BUILD_RULES_PHASE} build`,
    );
  }
  const ownSetup = cloneJson(setup);
  const tuning = resolveTuning(ownSetup, tuningOverrides);
  const templates = ownSetup.world.districtTemplates;
  const world = generateWorld(seed, { districtCount: templates.length, templateIds: [...templates] }, tuning);
  const ids: IdCounters = {};
  reserveIdsFrom(world, ids);
  // Blocks are numbered implicitly (claim.blockIdBase + idx) and appear as strings only in the sparse blockStates, so a
  // scan alone can stop short of the last block; the world's own counters cover every id it minted (D-2.38).
  const minted = worldIdCounters(world);
  for (const prefix of sortedKeysByCodeUnit(minted)) {
    const n = minted[prefix] ?? 0;
    if ((ids[prefix] ?? 0) < n) ids[prefix] = n;
  }
  const { year, week } = turnToYearWeek(0);

  const shell: GameState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { seed, setup: ownSetup, tuningHash: tuningHashOf(tuning), tuning, rulesVersion: RULES_VERSION, rulesPhase },
    clock: { turn: 0, year, week, actionSeq: 0, phase: {} },
    ids,
    climate: emptyClimateSlice(),
    company: companyFromSetup(ownSetup),
    world,
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

  // Week-1 initializations in pipeline order (D-2.13): §1's season roll (P1), the start setup, then §10's opening
  // market and §2's history ring (pre-history plus the turn-0 snapshot). The shell is built here and not yet shared,
  // so it is filled in place and frozen once at the end.
  postOpeningCapital(shell);
  shell.history.weekly = preHistory(shell.meta.tuning);
  shell.history.weekly.push({ turn: 0, market: marketSnapshot(shell), company: companySnapshot(shell) });
  return freezeIfEnabled(shell);
}
