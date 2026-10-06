// Step 4 · Events (DESIGN §2.6): §10 reverts camp-safe lots (part 4.1, P5) → §12 4a expire modifiers → 4b director
// budget reset → 4c scheduled effects → 4d multi-week instances and decision defaults → 4e weekly rolls → 4f director
// → 4g apply (part 4.2; P1 runs it on the empty catalog).
import type { StepDef } from '../types';

export const step04Events: StepDef = { index: 4, name: 'Events', sections: [10, 12] };
