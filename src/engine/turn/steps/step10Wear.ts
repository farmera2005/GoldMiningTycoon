// Step 10 · Wear, failures, injuries (DESIGN §2.6): §9 (10a) failure rolls → §7 re-resolve masked claims → §9 (10b)
// wear and meters → §7 frozen-damage rolls → §8 injuries, fatigue, hours and skill growth → §12 external-shock tallies
// (parts 10.1–10.6).
import type { StepDef } from '../types';

export const step10Wear: StepDef = {
  index: 10,
  name: 'Wear, failures, injuries',
  sections: [9, 7, 9, 7, 8, 12],
};
