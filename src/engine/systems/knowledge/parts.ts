// §4 knowledge pipeline parts (DESIGN §2.6; P1 contract §3) and newGame init parts (contract §1.5): this folder's
// entries in the part tables. Program work in step 9 and the production and sample chains of step 12 run through the
// framework's chains (turn/steps), which call this folder's functions in order.
import { initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { initContractors, marketsRefresh, pendingDeals } from './programs';
import { wrapUp } from './week';

export const KNOWLEDGE_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'knowledge.marketsRefresh', step: 3, order: 2, section: 4, fromPhase: 1 }, marketsRefresh),
  mutatorPart({ id: 'knowledge.pendingDeals', step: 6, order: 5, section: 4, fromPhase: 1 }, pendingDeals),
  mutatorPart({ id: 'knowledge.wrapUp', step: 16, order: 6, section: 4, fromPhase: 1 }, wrapUp),
];

export const KNOWLEDGE_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'knowledge.initContractors', order: 8.5, section: 4, fromPhase: 1 }, initContractors),
];
