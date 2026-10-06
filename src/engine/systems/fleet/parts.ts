// §9 fleet pipeline parts (DESIGN §9 9.12, §2.6; P1 contract §3) and its init part N6 (contract §1.5). The P3 failure
// rolls (10.1) are registered empty so the order is fixed now.
import { emptyPart, initPart, mutatorPart } from '../../state/partKit';
import type { InitPart } from '../../state/types';
import type { PipelinePart } from '../../turn/types';
import { availability, initMarket, marketsRefresh, meters, pendingDeals, shop, wrapUp } from './week';

export const FLEET_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'fleet.marketsRefresh', step: 3, order: 4, section: 9, fromPhase: 1 }, marketsRefresh),
  mutatorPart({ id: 'fleet.pendingDeals', step: 6, order: 2, section: 9, fromPhase: 1 }, pendingDeals),
  mutatorPart({ id: 'fleet.availability', step: 8, order: 1, section: 9, fromPhase: 1 }, availability),
  emptyPart({ id: 'fleet.failures', step: 10, order: 1, section: 9, fromPhase: 3 }),
  mutatorPart({ id: 'fleet.meters', step: 10, order: 3, section: 9, fromPhase: 1 }, meters),
  mutatorPart({ id: 'fleet.shop', step: 11, order: 1, section: 9, fromPhase: 1 }, shop),
  mutatorPart({ id: 'fleet.wrapUp', step: 16, order: 10, section: 9, fromPhase: 1 }, wrapUp),
];

export const FLEET_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'fleet.initMarket', order: 6, section: 9, fromPhase: 1 }, initMarket),
];
