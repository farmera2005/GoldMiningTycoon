// Registry of effect hooks: every value an event may change is read through effective() (DESIGN §2.10, §12 12.3).
// Rows are owned by the reading section; the registry is the union of every owner's published hook list (S12-5), each
// row with the phase its consumer ships in, its base and the ops and scope dimensions modifiers may use (S12-14,
// P1 contract §1.9). P0 ships the empty registry; Wave 0 of P1 writes every row.
import type { RulesPhase } from '../../engine/state/types';
import type { TuningKey } from '../tuning';

export type HookOp = 'mul' | 'add' | 'set';

/** The dimensions a modifier on this hook may be scoped by (the reading formula's query carries all of them). */
export type HookScopeDim =
  'company' | 'district' | 'claim' | 'block' | 'machine' | 'model' | 'brand' | 'employee' | 'lender';

export interface HookDef {
  readonly key: string;
  readonly ownerSection: number;
  readonly unit: string;
  /** The value with no modifier when `base` is 'neutral' (1 for `*Mult`, 0 for `*Add`). */
  readonly neutral: number;
  readonly ops: readonly HookOp[];
  readonly scopeDims: readonly HookScopeDim[];
  /** 'tuning': the base is the resolved tuning value of `baseKey` (or of `key` itself); 'neutral': `neutral`. */
  readonly base: 'neutral' | 'tuning';
  /** For a set-only hook whose base lives under another key (e.g. `permits.noticeMaxAcresSet` → `…noticeMaxAcres`). */
  readonly baseKey?: TuningKey;
  /** The rules phase whose consumer first reads the hook through effective() (S12-6); writers may come later. */
  readonly consumerPhase: RulesPhase;
  readonly mulBounds?: readonly [number, number];
  readonly addBounds?: readonly [number, number];
  readonly setBounds?: readonly [number, number];
}

export const hookRegistry: readonly HookDef[] = [];
