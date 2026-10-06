// §3 world pipeline parts (DESIGN §2.6; P1 contract §3) and newGame init parts (contract §1.5): this folder's entries
// in the part tables. Each names its step (or init order), its position in the step's §2.6 sub-order and the first
// rules phase it runs under; the table tests pin the order. The supply tick runs inside §5's part 3.1 (§5 calls
// `supplyTick` first, then creates the listings), so §3 has no part of its own in step 3.
import { initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { generateInto } from './init';
import { initialCandidates } from './market';
import { resolveSiteVisits } from './siteVisit';
import { wrapUp } from './wrapUp';

export const WORLD_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'world.resolveSiteVisits', step: 7, order: 2, section: 3, fromPhase: 1 }, resolveSiteVisits),
  mutatorPart({ id: 'world.wrapUp', step: 16, order: 5, section: 3, fromPhase: 1 }, wrapUp),
];

export const WORLD_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'world.generate', order: 1, section: 3, fromPhase: 0 }, generateInto),
  initPart({ id: 'world.initialCandidates', order: 3, section: 3, fromPhase: 1 }, initialCandidates),
];
