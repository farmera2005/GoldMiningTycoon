// Step 2 · Macro & gold price (DESIGN §2.6; §10 (a)–(o)): queued market shocks → macro step → F → v, μ, m → regime →
// GARCH → z, e → land last week's jump → return and bounds → ema13, goldIdx, rings → reset local-buyer caps → forward
// MTM and margin → draw next week's jump → news and analysts → week record. §10's part (2.1) runs from P5; P1–P4 read
// the flat market from tuning.
import type { StepDef } from '../types';

export const step02Market: StepDef = { index: 2, name: 'Macro & gold price', sections: [10] };
