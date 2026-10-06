// §10 gold pipeline parts (DESIGN §10 10.16, §2.6; P1 contract §3) and its init part N7 (contract §1.5). The P5 parts
// (market step, camp-safe revert, pending deals, forward deliveries) are registered empty so the order is fixed now.
import { emptyPart, initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { init, standingOrders, wrapUp } from './week';

export const GOLD_PARTS: readonly PipelinePart[] = [
  emptyPart({ id: 'gold.marketStep', step: 2, order: 1, section: 10, fromPhase: 5 }),
  emptyPart({ id: 'gold.campSafeRevert', step: 4, order: 1, section: 10, fromPhase: 5 }),
  emptyPart({ id: 'gold.pendingDeals', step: 6, order: 3, section: 10, fromPhase: 5 }),
  mutatorPart({ id: 'gold.standingOrders', step: 12, order: 3, section: 10, fromPhase: 1 }, standingOrders),
  emptyPart({ id: 'gold.forwardDeliveries', step: 12, order: 4, section: 10, fromPhase: 5 }),
  mutatorPart({ id: 'gold.wrapUp', step: 16, order: 11, section: 10, fromPhase: 1 }, wrapUp),
];

export const GOLD_INIT_PARTS: readonly InitPart[] = [initPart({ id: 'gold.init', order: 7, section: 10, fromPhase: 1 }, init)];
