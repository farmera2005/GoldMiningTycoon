// `ui.*` configuration (DESIGN §13.25, D-13.32): presentation keys live outside TuningResolved, so changing one can
// never change meta.tuningHash (the T11 clause that the save half of the harness relies on).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../data/tuning';
import { uiConfig } from '../data/tuning/ui';

describe('ui.* configuration', () => {
  it('namespaces every key under ui. and keeps all of them out of the engine tuning table', () => {
    const engineKeys = new Set(Object.keys(baseTuning));
    for (const key of Object.keys(uiConfig)) {
      expect(key.startsWith('ui.'), key).toBe(true);
      expect(engineKeys.has(key), `${key} must not be engine tuning`).toBe(false);
    }
    for (const key of engineKeys) expect(key.startsWith('ui.'), key).toBe(false);
  });

  it('carries the 13.25 defaults the shell and saves depend on', () => {
    expect(uiConfig['ui.autosaveRotatingSlots']).toBe(3);
    expect(uiConfig['ui.autosaveYearlyKeep']).toBe(5);
    expect(uiConfig['ui.autosaveEveryRunWeeks']).toBe(8);
    expect(uiConfig['ui.theme.default']).toBe('system');
    expect(uiConfig['ui.theme.grainOpacityDaylight']).toBe(0.05);
    expect(uiConfig['ui.theme.grainOpacityLamplight']).toBe(0.07);
    expect(uiConfig['ui.theme.displayMinPx']).toBe(16);
    expect(uiConfig['ui.fonts.maxKb']).toBe(260);
    expect([
      uiConfig['ui.layout.navPx'],
      uiConfig['ui.layout.railPx'],
      uiConfig['ui.layout.drawerPx'],
      uiConfig['ui.layout.topBarPx'],
    ]).toEqual([224, 56, 440, 56]);
  });
});
