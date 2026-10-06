// The §7 rows of src/data/tuning/ops.ts against the ops kernel (DESIGN §7 7.21). The kernel reads every `ops.*` number
// through OPS_KERNEL_TUNING_KEYS with a fixed nested shape, and its tests pin DESIGN's defaults in a test-only fixture
// (kernel/testing/designTuning.ts, OPS_DESIGN_TUNING). The live table must hold exactly those values and shapes, so
// the kernel tests and a game's resolved tuning can never disagree, and a new game's tuning must feed the kernel.
import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningValue } from '../../src/data/tuning';
import { opsTuning } from '../../src/data/tuning/ops';
import { defaultNewGameSetup, newGame, resolveTuning } from '../../src/engine';
import {
  OPS_KERNEL_TUNING_KEYS,
  opsKernelParams,
  readOpsKernelParams,
} from '../../src/engine/systems/ops/kernel/params';
import { DESIGN_PARAMS, OPS_DESIGN_TUNING } from '../../src/engine/systems/ops/kernel/testing/designTuning';

const KERNEL_KEYS = Object.keys(OPS_KERNEL_TUNING_KEYS);
const BASE: Readonly<Record<string, TuningValue>> = baseTuning;

describe('ops.* tuning ↔ the §7 kernel (DESIGN 7.21)', () => {
  it('the kernel fixture names exactly the kernel’s keys', () => {
    expect(Object.keys(OPS_DESIGN_TUNING).sort()).toEqual([...KERNEL_KEYS].sort());
  });

  it('resolved standard tuning deep-equals the kernel’s DESIGN fixture on every kernel key', () => {
    const standard = resolveTuning(defaultNewGameSetup({ companyName: 'Ops Tuning' })) as Readonly<
      Record<string, TuningValue>
    >;
    for (const key of KERNEL_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(standard, key), `${key} is missing`).toBe(true);
      expect(standard[key], key).toEqual(OPS_DESIGN_TUNING[key]);
    }
  });

  it('reads the same kernel parameters from the base tables as from the fixture', () => {
    const fromBase = readOpsKernelParams((k) => BASE[k]);
    expect(fromBase).toEqual(DESIGN_PARAMS);
  });

  it('opsKernelParams(newGame(…).meta.tuning) reads every key without throwing, at every difficulty', () => {
    for (const difficulty of ['easy', 'standard', 'hard'] as const) {
      const state = newGame(defaultNewGameSetup({ companyName: 'Ops Tuning', difficulty }), 'ops-tuning-seed');
      const params = opsKernelParams(state.meta.tuning);
      // No ops.* key is difficulty-scaled (§1 1.11 lists none), so every difficulty reads DESIGN's parameters.
      expect(params, difficulty).toEqual(DESIGN_PARAMS);
    }
  });

  it('every kernel key lives in ops.ts, which also carries the 7.21 rows the kernel does not read', () => {
    const opsKeys = Object.keys(opsTuning);
    for (const key of KERNEL_KEYS) expect(opsKeys, key).toContain(key);
    const extra = opsKeys.filter((k) => !KERNEL_KEYS.includes(k));
    // Hours and lines, P1 heat and fire hours, P5 precipitation hours, ponds, stockpile and surge caps, the P3 day
    // tank and frozen damage, site footprint, earthworks and reclamation, bottleneck and alert thresholds, audit cost.
    expect(extra.sort()).toEqual(
      [
        'ops.hoursPerShiftMin',
        'ops.hoursPerShiftMax',
        'ops.maxPlantLinesPerClaim',
        'ops.extraLineMinAcres',
        'ops.foremanRedeployMax',
        'ops.weatherHoursMult',
        'ops.heat.thresholdF',
        'ops.heat.slopePerF',
        'ops.heat.floor',
        'ops.heat.nightMult',
        'ops.fireLevelHoursMult',
        'ops.fireLevel3DayShiftMaxHours',
        'ops.freezeDamageProb',
        'ops.defaultBedrockTakeFt',
        'ops.stockpileCapMaxBcy',
        'ops.tailingsSurgeBcy',
        'ops.pondSludgeFrac',
        'ops.pondDepthFt',
        'ops.pondBuildDozerHrPerKBcy',
        'ops.pondDesignFreeboardFrac',
        'ops.reseedHoursPerAcre',
        'ops.siteDayTankGal',
        'ops.siteFootprintAcres',
        'ops.siteRoadAcres',
        'ops.swellOverburden',
        'ops.swellGravel',
        'ops.wasteDumpHeightFt',
        'ops.backfillUsableFrac',
        'ops.reclaimBackfillThreshold',
        'ops.reclaimRegradeBcyPerAcre',
        'ops.topsoilRespreadBcyPerAcre',
        'ops.pondCloseBcyPerAcre',
        'ops.siteReclaimBcyPerAcre',
        'ops.reclaimPushMult',
        'ops.bottleneckMinShare',
        'ops.coverageAlertWeeks',
        'ops.alertPlantIdlePct',
        'ops.tailingsAuditUsd',
        'ops.tailingsAuditPlantOpHours',
      ].sort(),
    );
  });

  it('keeps the paired 7.21 limits ordered', () => {
    const n = (k: string): number => BASE[k] as number;
    expect(n('ops.hoursPerShiftMin')).toBeLessThanOrEqual(n('ops.hoursPerShiftMax'));
    expect(n('ops.foremanEffMin')).toBeLessThanOrEqual(n('ops.foremanEffMax'));
    expect(n('ops.tailingsAuditCvMin')).toBeLessThanOrEqual(n('ops.tailingsAuditCvMax'));
    expect(n('ops.defaultBedrockTakeFt')).toBeLessThanOrEqual(n('ops.bedrockTakeFtMax'));
    expect(n('ops.padFreeBcy')).toBeLessThanOrEqual(n('ops.stockpileCapMaxBcy'));
    expect(n('ops.fireLevel3DayShiftMaxHours')).toBeLessThanOrEqual(n('ops.hoursPerShiftMax'));
    // The heat curve: day shift × clamp(1 − slope × (T − threshold), floor, 1); 7.21 / §1 1.5.6: 88 °F → 0.76.
    const heat = (t: number): number =>
      Math.min(1, Math.max(n('ops.heat.floor'), 1 - n('ops.heat.slopePerF') * (t - n('ops.heat.thresholdF'))));
    expect(heat(88)).toBeCloseTo(0.76, 12);
    expect(heat(92)).toBeCloseTo(0.64, 12);
    expect(heat(100)).toBe(0.55);
    expect(heat(70)).toBe(1);
  });
});
