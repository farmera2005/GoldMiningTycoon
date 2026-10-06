// §5 land and tenure pipeline parts (DESIGN §2.6; P1 contract §3) and newGame init parts (contract §1.5): this folder's
// entries in the part tables. Each names its step (or init order), its position in the step's §2.6 sub-order and the
// first rules phase it runs under; the table tests pin the order.
import { initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { createInitialListings, marketsRefresh, pendingDeals, wrapUp } from './week';

export const LAND_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'land.marketsRefresh', step: 3, order: 1, section: 5, fromPhase: 1 }, marketsRefresh),
  mutatorPart({ id: 'land.pendingDeals', step: 6, order: 1, section: 5, fromPhase: 1 }, pendingDeals),
  mutatorPart({ id: 'land.wrapUp', step: 16, order: 7, section: 5, fromPhase: 1 }, wrapUp),
];

export const LAND_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'land.createInitialListings', order: 5, section: 5, fromPhase: 1 }, createInitialListings),
];
