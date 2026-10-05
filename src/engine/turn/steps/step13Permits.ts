// Step 13 · Permits & compliance (DESIGN §2.6): §6 a–j (P1: f only) with §5 and §1 callbacks. Statutory obligations
// unsatisfied at the end of sub-step f of dueTurn + graceWeeks take their consequence; billable ones are judged missed
// at dueTurn + graceWeeks + 1 (D-2.12). P0 stub.
import type { PipelineStep } from '../types';

export const step13Permits: PipelineStep = {
  index: 13,
  name: 'Permits & compliance',
  sections: [6, 5, 1],
  run: (s) => s,
};
