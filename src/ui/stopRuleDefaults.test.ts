import { describe, expect, it } from 'vitest';
import { STOP_RULE_DEFAULTS } from '../engine';
import { uiConfig } from '../data/tuning/ui';

// The engine cannot import ui.* config (DESIGN §2.10), so its default stop-rule parameters mirror §13's ui.* keys.
// This keeps the two in step.
describe('default stop-rule parameters', () => {
  it('match the ui.* run settings', () => {
    expect(STOP_RULE_DEFAULTS.deadlineNoticeWeeks).toBe(uiConfig['ui.runDeadlineNoticeWeeks']);
    expect(STOP_RULE_DEFAULTS.goldMoveStopPct).toBe(uiConfig['ui.runGoldMoveStopPct']);
  });
});
