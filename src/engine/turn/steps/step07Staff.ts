// Step 7 · Staff availability (DESIGN §2.6): §1 (owner assignment, desk days, injury) → §3 (site visits) → §8 (a)–(h)
// (arrivals, morale, quits, absences, availableFraction, foremanFor, lead hands, camp). P0 stub.
import type { PipelineStep } from '../types';

export const step07Staff: PipelineStep = { index: 7, name: 'Staff availability', sections: [1, 3, 8], run: (s) => s };
