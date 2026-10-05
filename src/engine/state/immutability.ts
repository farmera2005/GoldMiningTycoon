// Immutability settings (DESIGN §2.2, D-2.4). Reducers use Immer `produce`; auto-freeze is on in development and tests
// (an accidental mutation throws) and off in the simulator, where freezing every week would cost too much. The flag is
// process-wide because Immer's is; it never changes a result, only whether states are frozen.
import { freeze, produce, setAutoFreeze } from 'immer';

/**
 * Immer's `produce` for engine values. GameState's types carry no `readonly` on state fields, so the draft is typed as
 * the value itself; this also spares the compiler from instantiating Immer's recursive `Draft<>` over the tuning
 * table's recursive value type (TS2589).
 */
export function produceState<T extends object>(base: T, recipe: (draft: T) => void): T {
  return (produce as unknown as (b: T, r: (d: T) => void) => T)(base, recipe);
}

let autoFreeze = true;

/** Turns Immer's auto-freeze (and newGame's deep freeze) on or off. The simulator turns it off. */
export function setEngineAutoFreeze(on: boolean): void {
  autoFreeze = on;
  setAutoFreeze(on);
}

export function isEngineAutoFreeze(): boolean {
  return autoFreeze;
}

/** Deep-freezes a value built outside `produce` (newGame, a loaded save) when auto-freeze is on. */
export function freezeIfEnabled<T>(value: T): T {
  return autoFreeze ? freeze(value, true) : value;
}

/** A deep copy of plain JSON data (state, actions, setups), so stored data never aliases a caller's objects. */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
