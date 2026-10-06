// Building blocks for the owners' part tables and Wave-0 stubs (P1 contract §0.2, §1.4, §1.5). An owner's step part
// wraps one mutator `(draft, ctx) => void` in one produceState, so a part whose mutator changes nothing returns the
// same state object (Immer's structural sharing). Init parts (newGame N1–N11) mutate the new game's shell in place.
// Explainer stubs return a zero leaf that says so, so every explainer is callable on a fresh P1 state (contract §12).
import type { TuningResolved, TuningValue } from '../../data/tuning';
import type { CalcNode, Unit } from '../core/calc';
import type { PipelinePart, StepContext } from '../turn/types';
import { produceState } from './immutability';
import { TuningError } from './tuning';
import type { GameState, InitPart, InitCtx, RulesPhase } from './types';

/**
 * A tuning value read by key name before the key is in `baseTuning`'s type. The Wave-0 W0-real bodies (`ownerSkill`,
 * `recordReputation`, the start values of N9) read keys that the parallel `contracts-data` package adds (contract
 * §9.1); `TuningKey` is derived from the data, so a typed read would not compile until both have merged. Throws
 * TUNING_KEY_UNKNOWN when the key is missing, so a body never runs on a silent default. Once both packages have merged
 * the owning package switches these reads to `tuningNumber`.
 */
export function contractTuningValue(tuning: TuningResolved, key: string): TuningValue {
  const table = tuning as Readonly<Record<string, TuningValue>>;
  if (!Object.prototype.hasOwnProperty.call(table, key)) {
    throw new TuningError('TUNING_KEY_UNKNOWN', key, 'read by a Wave-0 contract body before its key exists');
  }
  return table[key] as TuningValue;
}

/** As `contractTuningValue`, for a finite number. */
export function contractTuningNumber(tuning: TuningResolved, key: string): number {
  const v = contractTuningValue(tuning, key);
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TuningError('TUNING_VALUE_INVALID', key, 'not a number');
  return v;
}

/** True when the resolved tuning has the key (a Wave-0 body that may run before `contracts-data` has merged). */
export function hasContractTuning(tuning: TuningResolved, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(tuning, key);
}

export interface PartSlot {
  readonly id: string;
  readonly step: number;
  readonly order: number;
  readonly section: number;
  readonly fromPhase: RulesPhase;
}

/** A pipeline part that runs one owner mutator on a draft of the state. */
export function mutatorPart(slot: PartSlot, fn: (draft: GameState, ctx: StepContext) => void): PipelinePart {
  return {
    ...slot,
    run: (state, ctx) =>
      produceState(state, (draft) => {
        fn(draft, ctx);
      }),
  };
}

/** A registered part with no body yet (a later phase's work, kept so the §2.6 order is fixed now). */
export function emptyPart(slot: PartSlot): PipelinePart {
  return { ...slot, run: (state) => state };
}

export interface InitSlot {
  readonly id: string;
  /** Position in newGame's fixed init order (N1 = 1 … N11 = 11; N8b = 8.5). */
  readonly order: number;
  readonly section: number;
  readonly fromPhase: RulesPhase;
}

export function initPart(slot: InitSlot, run: (draft: GameState, init: InitCtx) => void): InitPart {
  return { ...slot, run };
}

/** The note every stub explainer carries until its owner implements it. */
export const STUB_EXPLAIN_NOTE = 'Not computed yet: this explanation arrives with its system.';

/** A zero leaf for an explainer whose owner has not implemented it (callable, never hidden). */
export function stubCalcNode(label: string, unit: Unit): CalcNode {
  return { label, value: 0, unit, note: STUB_EXPLAIN_NOTE };
}
