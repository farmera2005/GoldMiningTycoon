// Step 13 · Permits & compliance (DESIGN §2.6): §6 a–j (P1: f and j) with §5 and §1 callbacks (part 13.1). Statutory
// obligations unsatisfied at the end of sub-step f of dueTurn + graceWeeks take their consequence; billable ones are
// judged missed at dueTurn + graceWeeks + 1 (D-2.12).
import type { StepDef } from '../types';

export const step13Permits: StepDef = { index: 13, name: 'Permits & compliance', sections: [6, 5, 1] };
