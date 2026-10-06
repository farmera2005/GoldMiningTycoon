// Bot contract (DESIGN §2.12 "Visibility", §2.12.1 rules common to every bot; BALANCE §4.0). A bot sees only what a
// player sees: the engine's public selectors and the view built from them. Bots use no RNG and break ties by entity
// id (compareIds), so the same visible state always gives the same actions.
import type { Action, DateView, GameState, PendingDecision, RulesPhase, StopReason } from '../../src/engine';

/** Every bot id of DESIGN §2.12.1 (CLAUDE.md's list). `brandOnly` takes a brand id parameter (`brandOnly(<brandId>)`). */
export type BotId =
  | 'cautious'
  | 'balanced'
  | 'aggressive'
  | 'undercap'
  | 'noTest'
  | 'heavyProspector'
  | 'leaseOnly'
  | 'buyOnly'
  | 'gradeDFleet'
  | 'gradeAFleet'
  | 'maxHours'
  | 'noStripAhead'
  | 'passive'
  | 'smallCrewNoForeman'
  | 'exceeder'
  | 'abandoner'
  | 'noMaintenance'
  | 'auctionOnlyFleet'
  | 'newOnlyFleet'
  | 'rentOnlyFleet'
  | 'brandOnly'
  | 'multiLine'
  | 'poolMechanics'
  | 'allHardMoney'
  | 'royaltyEveryWinter'
  | 'hedge50'
  | 'noHedge'
  | 'alwaysLocalBuyer'
  | 'hardrockSeeker';

/**
 * What a bot may look at this week, built only from the engine's public selectors (sim/bots/view.ts). The state is
 * also passed to `decide` so a bot can call further selectors; it never reads a state field directly.
 */
export interface BotView {
  readonly turn: number;
  readonly date: DateView;
  readonly rulesPhase: RulesPhase;
  /** §11 cash on hand (operating + reserve), cents. */
  readonly cashCents: number;
  /** §1 1.13 owner NW, `netWorth(state, 'scoring')`, cents. */
  readonly ownerNwCents: number;
  readonly spotUsdPerFineOz: number;
  /** Open decisions in ascending id order. */
  readonly openDecisions: readonly PendingDecision[];
  readonly heldDistrictIds: readonly string[];
  /**
   * Stop reasons of the week just resolved (bots act at every stop reason, §2.12.1); empty at setup (turn 0) and in
   * a quiet week.
   */
  readonly stops: readonly StopReason[];
  /** True at turn 0, before the first week: the setup decision point. */
  readonly atSetup: boolean;
}

export interface Bot {
  readonly id: BotId;
  /** Returns the week's actions, in the order they are applied; a quiet week returns []. Must be pure. */
  decide(state: GameState, view: BotView): Action[];
}
