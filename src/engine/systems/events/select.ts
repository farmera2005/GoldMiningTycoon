// §12 events selectors (DESIGN §2.11, §12 12.2, 12.16; P1 contract §4.12): pure readers over state, spread into `select`
// by select/index.ts. None reads a hidden field: an instance view drops `hidden`, and the modifier list shows only
// modifiers already visible this turn (`visibleFromTurn`, the §13 Tuning viewer). A name already used by another folder
// fails the composition test.
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import type { EffectModifier, EventInstance, ScheduledEffect } from './types';

export type EventInstanceView = Omit<EventInstance, 'hidden'>;

/** Active event instances that affect the player (12.6 exposure rule). */
function activeEvents(state: GameState): EventInstanceView[] {
  return sortedValues(state.events.active)
    .filter((e) => e.affectsPlayer)
    .map(({ hidden: _h, ...rest }) => rest);
}

/** Modifiers in force or announced that the player may see this turn. */
function visibleEffectModifiers(state: GameState): EffectModifier[] {
  const turn = state.clock.turn;
  return sortedValues(state.events.modifiers).filter((m) => m.visibleFromTurn <= turn && m.untilTurn >= turn);
}

/** Announced future effects (for the calendar). */
function scheduledEventEffects(state: GameState): ScheduledEffect[] {
  return state.events.scheduled;
}

export const eventsSelectors = {
  activeEvents,
  visibleEffectModifiers,
  scheduledEventEffects,
} as const;
