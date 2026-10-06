// §12 competitors pipeline parts (DESIGN §12 12.19, §2.6; P1 contract §3): the P5 reduced-form step (5.1), registered
// empty so the order is fixed now.
import { emptyPart } from '../../state/partKit';
import type { PipelinePart } from '../../turn/types';

export const COMPETITORS_PARTS: readonly PipelinePart[] = [
  emptyPart({ id: 'competitors.step', step: 5, order: 1, section: 12, fromPhase: 5 }),
];
