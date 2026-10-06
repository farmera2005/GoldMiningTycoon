// The kernel's parameter reader (DESIGN §7 7.21): every key it reads exists in the DESIGN-default table with the right
// shape, malformed data throws, and the cached reader returns one object per tuning object.
import { describe, expect, it } from 'vitest';
import type { TuningResolved, TuningValue } from '../../../../data/tuning';
import { sortedKeys } from '../../../core/iter';
import { OPS_KERNEL_TUNING_KEYS, opsKernelParams, readOpsKernelParams } from './params';
import { DESIGN_PARAMS, OPS_DESIGN_TUNING, designParamsWith } from './testing/designTuning';

describe('readOpsKernelParams', () => {
  it('reads every kernel key from the DESIGN 7.21 table', () => {
    expect(sortedKeys(OPS_DESIGN_TUNING)).toEqual(sortedKeys(OPS_KERNEL_TUNING_KEYS));
    expect(DESIGN_PARAMS.contactMeanFt.standard).toBe(0.5);
    expect(DESIGN_PARAMS.digMult.gravelFrozen).toBe(0.35);
    expect(DESIGN_PARAMS.stripFrozenMult.dozerRipper).toBe(0.3);
    expect(DESIGN_PARAMS.baseCapture.centrifuge.ultrafine).toBe(0.7);
    expect(DESIGN_PARAMS.goldRoomLoss.table.fine).toBe(0.01);
    expect(DESIGN_PARAMS.goldRoomDirtFracNoTable).toBe(0.04);
    expect(DESIGN_PARAMS.nightLightFreeWeeksNorth).toEqual([22, 30]);
    expect(DESIGN_PARAMS.taskLoadFactor.ripping).toBe(1.15);
    expect(DESIGN_PARAMS.makeupFrac.arid).toBe(0.15);
    expect(DESIGN_PARAMS.clayScrubFactor.scrubber).toBe(0.1);
  });

  it('carries a content key that changes with any value', () => {
    expect(DESIGN_PARAMS.key).toMatch(/^[0-9a-f]{16}$/);
    expect(readOpsKernelParams((k) => OPS_DESIGN_TUNING[k]).key).toBe(DESIGN_PARAMS.key);
    expect(designParamsWith({ haulJobEff: 0.8 }).key).not.toBe(DESIGN_PARAMS.key);
    expect(designParamsWith({}).key).toBe(DESIGN_PARAMS.key);
  });

  it('throws on a missing key, a non-number and a table missing a field', () => {
    const without = (key: string) => (k: string) => (k === key ? undefined : OPS_DESIGN_TUNING[k]);
    expect(() => readOpsKernelParams(without('ops.haulJobEff'))).toThrow(/ops\.haulJobEff/);
    const bad = (key: string, v: TuningValue) => (k: string) => (k === key ? v : OPS_DESIGN_TUNING[k]);
    expect(() => readOpsKernelParams(bad('ops.haulJobEff', 'x'))).toThrow(/finite number/);
    expect(() => readOpsKernelParams(bad('ops.thawK', { cool: 1.2 }))).toThrow(/ops\.thawK\.deepCold/);
    expect(() => readOpsKernelParams(bad('ops.baseCapture', { sluice: { coarse: 1 } }))).toThrow(/baseCapture/);
    expect(() => readOpsKernelParams(bad('ops.nightLightFreeWeeksNorth', [22]))).toThrow(/pair/);
  });

  it('caches per tuning object', () => {
    const tuning = { ...OPS_DESIGN_TUNING } as unknown as TuningResolved;
    const a = opsKernelParams(tuning);
    expect(opsKernelParams(tuning)).toBe(a);
    expect(a).toEqual(DESIGN_PARAMS);
    const other = { ...OPS_DESIGN_TUNING } as unknown as TuningResolved;
    expect(opsKernelParams(other)).toEqual(a);
  });
});
