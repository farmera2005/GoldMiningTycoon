// The fast version of the §3.7 / §3.18 world calibration (BALANCE T-02): a small seeded sample with every gating band
// widened by half its span. The full harness runs on demand: `npm run calibrate:world -- --worlds 200` (or set
// WORLD_CALIBRATION_WORLDS here to run the strict bands on a large sample).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../src/data/tuning';
import { snapshotGenParams } from '../../src/engine/systems/world';
import { bandChecks, runCalibration } from '../../sim/calibration/world-stats';

const WORLDS = Number(process.env['WORLD_CALIBRATION_WORLDS'] ?? 24);
const LOOSE = WORLDS >= 200 ? 0 : 0.5;

describe('world calibration (§3.7, §3.18)', () => {
  const result = runCalibration({ worlds: WORLDS, seedBase: 1000 });
  const checks = bandChecks(result, snapshotGenParams(baseTuning, []).prior.statusMult.listed, LOOSE);

  it('passes every gating band on the sample', () => {
    const failed = checks
      .filter((c) => c.gating && !c.pass)
      .map((c) => `${c.id} ${c.templateId} ${c.what}: ${c.value}`);
    expect(failed).toEqual([]);
  }, 120_000);

  it('measures both P1 templates with the full generator', () => {
    expect(Object.keys(result.templates).sort()).toEqual(['aridFederal', 'northernFederal']);
    for (const s of Object.values(result.templates)) {
      expect(s.districts).toBe(WORLDS);
      const pool = s.classes.pool;
      expect(pool.uneconomic + pool.marginal + pool.good + pool.excellent).toBeCloseTo(1, 9);
      // Open ground is poorer than the held stock (selection, D-3.8) and the pool sits between them (D-3.9).
      expect(s.classes.open.uneconomic).toBeGreaterThan(s.classes.held.uneconomic);
      expect(pool.uneconomic).toBeGreaterThan(s.classes.held.uneconomic);
    }
  });
});
