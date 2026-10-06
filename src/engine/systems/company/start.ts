// §1 starts (DESIGN §1 1.6–1.8, D-1.64, D-1.83, D-1.90; P1 contract §1.5 N4 and N9, §4.2). The company shell is built
// from the setup before any init part runs; N9 then opens the start's books through the ledger, so cash has an
// explanation from turn 0. Wave 0 implements the Bootstrapper (the P0 opening capital, moved here from newGame) and
// leaves the other starts' wiring to §1's company package: Backed agreements and the royalty interest (§5), the
// Inheritor's tenures, fleet, site, former hand, estate note and fuel AP (§5, §9, §7, §8, §11), and the Banker
// background's stub loan (§11). `startsAvailable` keeps them out of the wizard and `validateSetup` until then.
import { usdToCents, ZERO_CENTS, type Cents } from '../../core/money';
import { rng } from '../../core/rng';
import { hasContractTuning, contractTuningNumber } from '../../state/partKit';
import { rulesAtLeast } from '../../state/rules';
import type { NewGameSetup, StartType } from '../../state/setup';
import { resolveTuning, tuningNumber, type TuningOverrides } from '../../state/tuning';
import type { GameState, InitCtx, RulesPhase } from '../../state/types';
import type { WeekCalendar } from '../../turn/types';
import { postInto } from '../finance/ledger';
import { addFamilyRecords } from '../knowledge/family';
import { genInheritedGroup } from '../world/inheritor';
import type { CompanySlice, InheritorStreams, OwnerItem, StartPreview } from './types';

/** The start types this build can set up under a rules phase (Wave 0: the Bootstrapper only). */
export function startsAvailable(_rulesPhase: RulesPhase): StartType[] {
  // CONTRACT-STUB(§1) company.startsAvailable
  return ['bootstrapper'];
}

/** The company slice a setup starts from, before the init parts (every 1.18 field at its inert value). */
export function companyShell(setup: NewGameSetup): CompanySlice {
  return {
    name: setup.companyName.trim(),
    entity: setup.entity,
    pendingEntity: null,
    background: setup.background,
    start: setup.start,
    difficulty: setup.difficulty,
    mode: setup.mode,
    owner: {
      name: setup.ownerName.trim(),
      personalCreditScore: 0,
      guarantees: [],
      salaryPerWeekCents: ZERO_CENTS,
      assignment: { kind: 'office' },
      pendingAssignment: null,
      deskDaysUsedThisWeek: 0,
      deskDaysForcedThisWeek: 0,
      deskQueue: [],
      injuredUntilTurn: null,
    },
    investors: {},
    investorIds: [],
    reputation: { value: 0, pending: [], log: [], capsUsedThisYear: {} },
    regulatorStanding: 0,
    safetyRecord: { value: 0, lastLostTimeTurn: null, log: [] },
    scenario: null,
    runStatus: 'active',
    endReason: null,
    liquidationPath: null,
    timeline: [],
  };
}

/** §1 1.8.2 setup streams (D-1.65): built here, handed to their users; building them draws nothing. */
export function inheritorStreams(seed: string): InheritorStreams {
  return {
    ground: rng(seed, 'setup', 'inheritor'),
    pits: rng(seed, 'setup', 'inheritor', 'pits'),
    fleet: (i: number) => rng(seed, 'setup', 'inheritor', 'fleet', i),
    hand: rng(seed, 'setup', 'inheritor', 'hand'),
  };
}

/**
 * N4: the Inheritor's family ground. §3 conditions the reserved family run on §1's streams and §4 shows the family
 * records (never admitted). Other starts do nothing.
 */
export function inheritorGround(draft: GameState, init: InitCtx): void {
  if (init.setup.start !== 'inheritor') return;
  const streams = inheritorStreams(init.seed);
  init.scratch.inheritor = streams;
  const records = genInheritedGroup(draft, streams.ground, streams.pits);
  addFamilyRecords(draft, records);
}

/**
 * The Bootstrapper's opening capital (D-1.64): company cash × `game.startCompanyCashMult` as the owner's capital
 * contribution, personal cash × `game.startPersonalCashMult` into the owner book.
 */
function postBootstrapperCapital(draft: GameState): void {
  const t = draft.meta.tuning;
  const companyCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.companyCashUsd') * tuningNumber(t, 'game.startCompanyCashMult'),
  );
  const personalCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.personalCashUsd') * tuningNumber(t, 'game.startPersonalCashMult'),
  );
  const refs = [{ kind: 'company' as const, id: 'company' }];
  if (companyCents > 0) {
    postInto(draft, {
      book: 'company',
      date: draft.clock.turn,
      lines: [
        { account: 'cash.operating', debit: companyCents },
        { account: 'eq.ownerCapital', credit: companyCents },
      ],
      memo: 'Owner capital contribution',
      refs,
      source: '§1/start',
      counterparty: draft.company.owner.name,
    });
  }
  if (personalCents > 0) {
    postInto(draft, {
      book: 'owner',
      date: draft.clock.turn,
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

/** A start-table value (contract §9.1), or null while the key has not been added to the tuning data. */
function startValue(draft: GameState, key: string): number | null {
  return hasContractTuning(draft.meta.tuning, key) ? contractTuningNumber(draft.meta.tuning, key) : null;
}

/**
 * P1 start values (1.8 table): reputation, regulator standing, the owner's credit score and the safety record's start.
 * Under P0 rules the slice keeps its inert values, so `--rules p0` reproduces P0.
 */
function setStartValues(draft: GameState): void {
  const start = draft.company.start;
  const reputation = startValue(draft, `game.start.${start}.reputation`);
  if (reputation !== null) draft.company.reputation.value = reputation;
  const standing = startValue(
    draft,
    start === 'inheritor' ? 'game.inheritor.regulatorStandingStart' : 'game.start.regulatorStandingStart',
  );
  if (standing !== null) draft.company.regulatorStanding = standing;
  const credit = startValue(draft, `game.start.${start}.personalCreditScore`);
  if (credit !== null) draft.company.owner.personalCreditScore = credit;
  const safety = startValue(draft, 'staff.safetyRecord.start');
  if (safety !== null) draft.company.safetyRecord.value = safety;
}

/** N9: the start's opening books and records (Wave 0: the Bootstrapper; see the header for the rest). */
export function startSetup(draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§1) company.startSetup (Backed, Inheritor and the Banker stub loan)
  postBootstrapperCapital(draft);
  if (rulesAtLeast(draft, 1)) setStartValues(draft);
}

/**
 * The start position before a game exists (S13-4, D-1.90); a test pins it to `netWorth(newGame(...), 'scoring')`.
 * Wave 0: the Bootstrapper's cash (its net worth is its cash).
 */
export function previewStart(setup: NewGameSetup, overrides?: TuningOverrides): StartPreview {
  // CONTRACT-STUB(§1) company.previewStart (Backed, Inheritor)
  const t = resolveTuning(setup, overrides);
  const companyCashCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.companyCashUsd') * tuningNumber(t, 'game.startCompanyCashMult'),
  );
  const personalCashCents = usdToCents(
    tuningNumber(t, 'game.start.bootstrapper.personalCashUsd') * tuningNumber(t, 'game.startPersonalCashMult'),
  );
  return {
    companyCashCents,
    personalCashCents,
    inheritedFleetResaleCents: ZERO_CENTS,
    appraisalCents: ZERO_CENTS,
    debtCents: ZERO_CENTS,
    investorTerms: [],
    companyNwCents: companyCashCents,
    ownerNwCents: (companyCashCents + personalCashCents) as Cents,
  };
}

/** §11 14c owner items: the scheduled draw, the turn-1 formation fee (s01 #2) and the week-13 entity fee. */
export function ownerItemsDue(_state: GameState, _calendar: WeekCalendar): OwnerItem[] {
  // CONTRACT-STUB(§1) company.ownerItemsDue
  return [];
}

/** The living-allowance cap while a reorganization case is open (P4); null otherwise. */
export function ownerPayCapCents(_state: GameState): Cents | null {
  return null;
}
