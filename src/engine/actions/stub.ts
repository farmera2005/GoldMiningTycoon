// Stub action rows (P1 contract §0.2). Wave 0 registers every P1 action type before its owner implements it, so the
// action union, the error-code lists, the UI's dispatch and the contract tests exist from the start. A stub row
// validates every action of its type to NOT_IMPLEMENTED and has a no-op handler; `stubbedActionTypes()` lists the
// rows still stubbed (P1 exit requires none). The owning package replaces the row in its folder's actions.ts.
import type { RulesPhase } from '../state/types';
import type { ActionDef, AnyAction } from './types';

export interface StubFlags {
  readonly reveals: boolean;
  readonly commits: boolean;
  /** Default 1: every P1 action (P1 contract §1.2). */
  readonly fromPhase?: RulesPhase;
}

export function stubActionDef<T extends string>(
  type: T,
  ownerSection: number,
  flags: StubFlags,
): ActionDef<AnyAction & { readonly type: T }> {
  return {
    type,
    ownerSection,
    reveals: flags.reveals,
    commits: flags.commits,
    fromPhase: flags.fromPhase ?? 1,
    stub: true,
    validate: () => ({ code: 'NOT_IMPLEMENTED', message: `${type} is not implemented yet` }),
    handle: () => undefined,
  };
}
