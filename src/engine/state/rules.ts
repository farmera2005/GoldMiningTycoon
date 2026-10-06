// Engine rules version and the phase-rules switch (DESIGN §2.5 meta, §2.12 `--rules`, D-2.18). Later phases keep the
// earlier phases' stub paths behind `rulesAtLeast(state, n)`, so `--rules pN` reproduces phase N in any later build.
import type { GameState, RulesPhase } from './types';

/** Engine semver recorded in meta.rulesVersion and SaveFile.rulesVersion. Bump on any rule change. */
export const RULES_VERSION = '0.2.0';

/** The phase this build implements. A game may run any phase up to it. */
export const BUILD_RULES_PHASE: RulesPhase = 0;

export function isRulesPhase(n: unknown): n is RulesPhase {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6;
}

/** True when the game runs phase-n rules or later. */
export function rulesAtLeast(state: Pick<GameState, 'meta'>, n: RulesPhase): boolean {
  return state.meta.rulesPhase >= n;
}
