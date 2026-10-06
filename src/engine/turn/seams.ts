// Test seams of the weekly pipeline (DESIGN §2.14 "declared sub-order independence"; P1 plan, frame). Tests only:
// production code always runs NO_SEAMS through advanceWeek. A seam changes how the week runs, never what the engine
// is allowed to do, so a test that passes with a seam proves a property of the real pipeline:
//   - `orderParts` permutes a step's parts (§4, §8 and §9 in step 3 may run in any order, D-2.11);
//   - `swapDrawdownAndRecordProduction` swaps §11's deferred-revenue drawdowns with §4 recordProduction in the step-12
//     cleanup chain (D-2.10).
// Stream perturbation (pipeline stream isolation) needs no engine seam: tests/seams/rngPerturbation.ts mocks core rng.
import type { GameState } from '../state/types';
import { runWeek, type AdvanceOpts } from './advanceWeek';
import { NO_SEAMS, type PipelinePart, type PipelineSeams, type WeekResult } from './types';

export type { PipelineSeams } from './types';

/** advanceWeek with seams; unspecified seams keep their production value. */
export function advanceWeekWithSeams(
  state: GameState,
  seams: Partial<PipelineSeams>,
  opts: AdvanceOpts = {},
): WeekResult {
  return runWeek(state, opts, { ...NO_SEAMS, ...seams });
}

/** A seam that reverses the parts of the given steps (the simplest non-identity permutation). */
export function reverseStepParts(
  steps: readonly number[],
): (step: number, parts: readonly PipelinePart[]) => readonly PipelinePart[] {
  return (step, parts) => (steps.includes(step) ? [...parts].reverse() : parts);
}

/** A seam that orders the given step's parts by a list of part ids (parts not listed keep their place after them). */
export function orderStepParts(
  step: number,
  ids: readonly string[],
): (s: number, parts: readonly PipelinePart[]) => readonly PipelinePart[] {
  return (s, parts) => {
    if (s !== step) return parts;
    const listed = ids.flatMap((id) => parts.filter((p) => p.id === id));
    return [...listed, ...parts.filter((p) => !ids.includes(p.id))];
  };
}
