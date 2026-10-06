// §7 operations pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that
// turn/parts.ts concatenates. The flow (step 9) and the cleanup chain (step 12) run through the framework's chains,
// which call this folder's functions; the P3 re-resolve (10.2) and frozen-ground damage (10.4) are registered empty so
// the order is fixed now.
import { emptyPart, mutatorPart } from '../../state/partKit';
import type { PipelinePart } from '../../turn/types';
import { siteTasks, wrapUp } from './site';

export const OPS_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'ops.siteTasks', step: 6, order: 6, section: 7, fromPhase: 1 }, siteTasks),
  emptyPart({ id: 'ops.reResolve', step: 10, order: 2, section: 7, fromPhase: 3 }),
  emptyPart({ id: 'ops.freezeDamage', step: 10, order: 4, section: 7, fromPhase: 3 }),
  mutatorPart({ id: 'ops.wrapUp', step: 16, order: 8, section: 7, fromPhase: 1 }, wrapUp),
];
