// Step 4 · Events (DESIGN §2.6): §10 reverts camp-safe lots → §12 4a expire modifiers → 4b director budget reset →
// 4c scheduled effects → 4d multi-week instances and decision defaults → 4e weekly rolls → 4f director → 4g apply.
// P0 stub (§12's framework ships in P1 with empty event tables; events from P3/P5).
import type { PipelineStep } from '../types';

export const step04Events: PipelineStep = { index: 4, name: 'Events', sections: [10, 12], run: (s) => s };
