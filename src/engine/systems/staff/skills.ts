// §8 skill multiplier functions consumed elsewhere (DESIGN §8.11; P1 contract §4.8): pure (skill 0–100) → multiplier.
// §9's machine rate and wear, §7's recovery loss exponent, §9's inspections and repairs, §6's applications, §4's
// drilled-sample noise and §11's controller effects read them. Wave-0 stubs return the neutral 1 (the same as skill
// at the reference point of each curve) until §8's package implements the 8.11 curves.

/** 0.70 + 0.0065·s − 0.00001·s² (§9 machineEffectiveRate; §4 rigs). */
export function skillProductivityMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.skillProductivityMult
  return 1;
}

/** §9 wearPerHour. */
export function skillWearMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.skillWearMult
  return 1;
}

/** §7 loss exponent (D-7.20). */
export function skillRecoveryMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.skillRecoveryMult
  return 1;
}

/** §9 inspections: health sd, defect detection, optimism. */
export function inspectionAccuracy(_skill: number): { healthSd: number; defectDetectP: number; optimism: number } {
  // CONTRACT-STUB(§8) staff.inspectionAccuracy
  return { healthSd: 0, defectDetectP: 1, optimism: 0 };
}

/** §9 share of the targeted health gain achieved. */
export function repairQuality(_skill: number): number {
  // CONTRACT-STUB(§8) staff.repairQuality
  return 1;
}

/** §9 labor hours per work order. */
export function repairHoursMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.repairHoursMult
  return 1;
}

/** §9 failure hazard on the repaired component for its first 200 h. */
export function reworkHazardMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.reworkHazardMult
  return 1;
}

/** §6 application quality. */
export function permitApplicationQuality(_skill: number): number {
  // CONTRACT-STUB(§8) staff.permitApplicationQuality
  return 1;
}

/** §4 sample noise on company-drilled holes. */
export function drillerNoiseMult(_skill: number): number {
  // CONTRACT-STUB(§8) staff.drillerNoiseMult
  return 1;
}

/** §11's controller effects. */
export function controllerQuality(_skill: number): number {
  // CONTRACT-STUB(§8) staff.controllerQuality
  return 1;
}
