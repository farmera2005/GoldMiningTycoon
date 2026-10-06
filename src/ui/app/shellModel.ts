// What the top bar shows about the game (DESIGN §13.1): a pure view model over the game slice and the engine's
// selectors (date from §1 via `select.dateView`, cash from §11 `select.cashOnHand`, the Advance state from
// `canAdvance`). The top bar renders it and does no game math.
import { select, type Cents, type EntityType, type ExplainRef, type GameState } from '../../engine';
import { assertNever } from '../lib/assertNever';
import { gameDate, weekShort } from '../format';
import { cashRef } from '../explain/refs';
import type { AdvanceBlock } from '../engine/engineClient';
import type { GameSlice } from '../store/gameSlice';
import { t } from '../text';

export type SaveIndicator =
  { readonly kind: 'saved'; readonly label: string } | { readonly kind: 'unsaved' } | { readonly kind: 'never' };

export interface AdvanceView {
  readonly enabled: boolean;
  /** `Advance`, or `Resolve 1 decision` while a blocking decision is open (13.1). */
  readonly label: string;
  /** `Advance to Wk 22 · May 28–Jun 3`, or the reason it is disabled. */
  readonly tooltip: string;
  readonly block: AdvanceBlock | null;
}

export interface ShellStatus {
  readonly company: { readonly name: string; readonly entityBadge: string };
  /** `Y{year} Wk {week} · {Mon d}–{Mon d}, {displayYear}` (13.2 dates). */
  readonly date: string;
  readonly cash: { readonly cents: Cents; readonly explain: ExplainRef };
  readonly save: SaveIndicator;
  readonly advance: AdvanceView;
}

export function entityBadge(entity: EntityType): string {
  switch (entity) {
    case 'llc':
      return 'LLC';
    case 'corp':
      return 'Corp';
    case 'soleProp':
      return 'Sole prop';
    default:
      return assertNever(entity);
  }
}

function blockingCount(state: GameState): number {
  return select.openDecisions(state).filter((d) => d.blocking).length;
}

export function advanceView(state: GameState, block: AdvanceBlock | null): AdvanceView {
  if (block === null) {
    const now = select.dateView(state);
    const next = select.dateView(state, state.clock.turn + 1);
    return { enabled: true, label: 'Advance', tooltip: `Advance to ${weekShort(next, now)}`, block };
  }
  if (block === 'BLOCKING_DECISION_OPEN') {
    const n = blockingCount(state);
    return {
      enabled: false,
      label: `Resolve ${n} decision${n === 1 ? '' : 's'}`,
      tooltip: t('advance.BLOCKING_DECISION_OPEN'),
      block,
    };
  }
  return { enabled: false, label: 'Advance', tooltip: t(`advance.${block}`), block };
}

/** 13.1 save state: `Saved Wk 21`, or the `Unsaved changes` dot after any action or week since the last write. */
export function saveIndicator(game: GameSlice): SaveIndicator {
  if (game.state === null) return { kind: 'never' };
  if (game.dirty) return { kind: 'unsaved' };
  if (game.savedTurn === null) return { kind: 'never' };
  return { kind: 'saved', label: `Saved Wk ${select.dateView(game.state, game.savedTurn).week}` };
}

export function shellStatus(game: GameSlice, block: AdvanceBlock | null): ShellStatus | null {
  const state = game.state;
  if (state === null) return null;
  return {
    company: { name: state.company.name, entityBadge: entityBadge(state.company.entity) },
    date: gameDate(select.dateView(state)),
    cash: { cents: select.cashOnHand(state), explain: cashRef },
    save: saveIndicator(game),
    advance: advanceView(state, block),
  };
}
