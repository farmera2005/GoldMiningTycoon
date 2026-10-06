// The bot's view (DESIGN §2.12 "Visibility"): built only from the engine's public selectors, never from a state field,
// so it can never carry a hidden value. The scrambled-truth test (sim/bots/catalog.test.ts) holds bots to it.
import { rulesAtLeast, select, type GameState, type RulesPhase, type StopReason } from '../../src/engine';
import type { BotView } from './types';

const PHASES_DESC: readonly RulesPhase[] = [6, 5, 4, 3, 2, 1, 0];

/** The game's rules phase through the public `rulesAtLeast` check (no read of meta). */
export function rulesPhaseOf(state: GameState): RulesPhase {
  for (const n of PHASES_DESC) if (rulesAtLeast(state, n)) return n;
  return 0;
}

export function buildBotView(state: GameState, stops: readonly StopReason[]): BotView {
  const date = select.dateView(state);
  return {
    turn: date.turn,
    date,
    rulesPhase: rulesPhaseOf(state),
    cashCents: select.cashOnHand(state),
    ownerNwCents: select.netWorth(state, 'scoring'),
    spotUsdPerFineOz: select.spotUsdPerFineOz(state),
    openDecisions: select.openDecisions(state),
    heldDistrictIds: select.heldDistrictIds(state),
    stops,
    atSetup: date.turn === 0,
  };
}
