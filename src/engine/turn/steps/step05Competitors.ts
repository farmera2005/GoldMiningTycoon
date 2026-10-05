// Step 5 · Competitors (DESIGN §2.6): §12 5a–5g per competitor, ascending cmpId (reduced-form ops and finance, bust
// check, strategy, market actions, labor, offers, respawn). P0 stub (competitors arrive in P5).
import type { PipelineStep } from '../types';

export const step05Competitors: PipelineStep = { index: 5, name: 'Competitors', sections: [12], run: (s) => s };
