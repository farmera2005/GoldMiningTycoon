// §12 events pipeline parts (DESIGN §12 12.19, §2.6; P1 contract §3). The P3 shock tally (10.6) is registered empty so
// the order is fixed now.
import { emptyPart, mutatorPart } from '../../state/partKit';
import type { PipelinePart } from '../../turn/types';
import { eventsStep, wrapUp } from './week';

export const EVENTS_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'events.eventsStep', step: 4, order: 2, section: 12, fromPhase: 1 }, eventsStep),
  emptyPart({ id: 'events.tallyShocks', step: 10, order: 6, section: 12, fromPhase: 3 }),
  mutatorPart({ id: 'events.wrapUp', step: 16, order: 12, section: 12, fromPhase: 1 }, wrapUp),
];
