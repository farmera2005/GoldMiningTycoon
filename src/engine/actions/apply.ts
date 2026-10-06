// applyAction and validateAction (DESIGN §2.2; P1 contract §1.2). Validation is total and pure; a valid action may
// carry non-blocking warnings (s07 #3, S13-3), which validateAction and applyAction return alike so bots and the UI
// see the same list. A successful action applies its handler to an Immer draft, collates its alert effects into the
// inbox at once (§13 13.10 'action' mode, S12-3) and reports `undoable`, which the engine (not the UI) decides: false
// when the handler drew from any RNG stream (detected through the handler context), or when its row declares that it
// reveals hidden information or commits to a counterparty (D-2.22).
import { cloneJson, produceState } from '../state/immutability';
import { rngFromState, streamState, type KeyPart, type Rng } from '../core/rng';
import type { StreamName } from '../core/streams';
import type { GameState } from '../state/types';
import { collateAlerts } from '../systems/inbox/collate';
import type { AlertSignal } from '../systems/inbox/types';
import './catalog';
import { getActionDef, validateWithRegistry, warningsWithRegistry } from './registry';
import type {
  Action,
  ActionEffect,
  ActionOrigin,
  ActionResult,
  ActionWarning,
  AnyAction,
  HandlerContext,
  ValidationResult,
} from './types';

interface RunFlags {
  drew: boolean;
  reveals: boolean;
  commits: boolean;
}

/** Validation for an action at the player's hand: the run must be active, then the registry row decides. */
export function validateAction(state: GameState, action: Action): ValidationResult {
  if (state.company.runStatus !== 'active') {
    return { ok: false, error: { code: 'GAME_OVER', message: 'the run has ended; the save is read-only' } };
  }
  const error = validateWithRegistry(state, action);
  return error === null ? { ok: true, warnings: warningsWithRegistry(state, action) } : { ok: false, error };
}

function makeContext(draft: GameState, origin: ActionOrigin, flags: RunFlags, effects: ActionEffect[]): HandlerContext {
  const ctx: HandlerContext = {
    origin,
    turn: draft.clock.turn,
    rng: (seed: string, stream: StreamName, ...keys: KeyPart[]): Rng => {
      flags.drew = true;
      return rngFromState(streamState(seed, stream, ...keys));
    },
    effect: (e) => {
      effects.push(cloneJson(e));
    },
    markReveals: () => {
      flags.reveals = true;
    },
    markCommits: () => {
      flags.commits = true;
    },
    applyNested: (nested: AnyAction) => {
      const def = getActionDef(nested.type);
      if (def === undefined) throw new Error(`applyNested: no action type '${nested.type}'`);
      if (def.reveals) flags.reveals = true;
      if (def.commits) flags.commits = true;
      def.handle(draft, nested, ctx);
    },
  };
  return ctx;
}

/**
 * Applies an action that has already passed validation. Player actions advance `clock.actionSeq` (it keys only the
 * flavor-text `action` stream); pipeline-applied ones (decision defaults) do not. The handler's alert effects are
 * collated in 'action' mode in the same draft, so the inbox shows them before the next week.
 */
export function applyValidated(
  state: GameState,
  action: AnyAction,
  origin: ActionOrigin,
): { state: GameState; effects: ActionEffect[]; undoable: boolean } {
  const def = getActionDef(action.type);
  if (def === undefined) throw new Error(`applyValidated: no action type '${action.type}'`);
  const flags: RunFlags = { drew: false, reveals: def.reveals, commits: def.commits };
  const effects: ActionEffect[] = [];
  const stored = cloneJson(action);
  const next = produceState(state, (draft) => {
    if (origin === 'player') draft.clock.actionSeq += 1;
    def.handle(draft, stored, makeContext(draft, origin, flags, effects));
    const signals: AlertSignal[] = [];
    for (const e of effects) if (e.kind === 'alert') signals.push(e.signal);
    if (signals.length > 0) collateAlerts(draft, signals, draft.clock.turn, 'action');
  });
  return { state: next, effects, undoable: !flags.drew && !flags.reveals && !flags.commits };
}

/** §2.2 applyAction: validates, then applies; on failure the state is unchanged and the typed error returned. */
export function applyAction(state: GameState, action: Action): ActionResult {
  const v = validateAction(state, action);
  if (!v.ok) return { ok: false, error: v.error };
  const warnings: ActionWarning[] = v.warnings;
  const r = applyValidated(state, action, 'player');
  return { ok: true, state: r.state, effects: r.effects, undoable: r.undoable, warnings };
}
