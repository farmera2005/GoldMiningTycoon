// Method rows and the logging-quality rules shared by sample execution (truth side, true skill) and the estimator
// (player side, shown skill), DESIGN §4.2, §4.3 step 3, §4.13.
import { prospectingMethods } from '../../../data/prospecting/methods';
import type { SampleMethodParams } from '../world/types';
import type { LoggedBy, MethodId, SamplingMethodSpec } from './types';

export function methodSpec(id: MethodId): SamplingMethodSpec {
  return prospectingMethods[id];
}

export interface LoggingRules {
  readonly geoNoiseMultBase: number;
  readonly geoNoiseMultPerSkill: number;
  readonly unloggedNoiseMult: number;
  readonly unloggedCaptureMult: number;
}

/** nm(skill) = geoNoiseMultBase − geoNoiseMultPerSkill × skill; no geologist: unloggedNoiseMult (§4.13). */
export function noiseMult(kind: LoggedBy['kind'], skill: number, r: LoggingRules): number {
  return kind === 'none' ? r.unloggedNoiseMult : r.geoNoiseMultBase - r.geoNoiseMultPerSkill * skill;
}

/** With no geologist the crew pans concentrates down carelessly: capture × unloggedCaptureMult (§4.3 step 3). */
export function samplerCaptureMult(kind: LoggedBy['kind'], r: LoggingRules): number {
  return kind === 'none' ? r.unloggedCaptureMult : 1;
}

/**
 * The method row as drawn: the logger's noise multiplier on volumeCv, weighCv, geomCv and thickCv (§4.3 step 3), an
 * optional driller multiplier on volumeCv and weighCv (§8, P3), and the reach for machine-limited methods.
 */
export function effectiveDrawParams(
  draw: SampleMethodParams,
  nm: number,
  opts: {
    readonly maxDepthFt?: number | null;
    readonly bedrockPenFt?: number;
    readonly drillerNoiseMult?: number;
  } = {},
): SampleMethodParams {
  const dn = opts.drillerNoiseMult ?? 1;
  return {
    ...draw,
    maxDepthFt: opts.maxDepthFt !== undefined ? opts.maxDepthFt : draw.maxDepthFt,
    bedrockPenFt: opts.bedrockPenFt ?? draw.bedrockPenFt,
    volumeCv: draw.volumeCv * nm * dn,
    weighCv: draw.weighCv * nm * dn,
    geomCv: draw.geomCv * nm,
    thickCv: (draw.thickCv ?? 0.1) * nm,
  };
}
