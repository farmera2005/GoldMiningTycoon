// Step 10 · Wear, failures, injuries (DESIGN §2.6): §9 (10a) failure rolls → §7 re-resolve masked claims → §9 (10b)
// wear → §7 frozen-damage rolls → §8 injuries, fatigue, skill growth → §12 external-shock tallies. P0 stub.
import type { PipelineStep } from '../types';

export const step10Wear: PipelineStep = {
  index: 10,
  name: 'Wear, failures, injuries',
  sections: [9, 7, 9, 7, 8, 12],
  run: (s) => s,
};
