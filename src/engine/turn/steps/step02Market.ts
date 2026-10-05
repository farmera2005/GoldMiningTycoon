// Step 2 · Macro & gold price (DESIGN §2.6; §10 (a)–(o)): queued market shocks → macro step → F → v, μ, m → regime →
// GARCH → z, e → land last week's jump → return and bounds → ema13, goldIdx, rings → reset local-buyer caps → forward
// MTM and margin → draw next week's jump → news and analysts → week record. P1: constants, no draws.
// P0 stub: the flat market is read from tuning by the step-16 history snapshot.
import type { PipelineStep } from '../types';

export const step02Market: PipelineStep = { index: 2, name: 'Macro & gold price', sections: [10], run: (s) => s };
