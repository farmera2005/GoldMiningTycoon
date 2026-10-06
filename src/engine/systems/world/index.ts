// §3 World and geology: the system's public surface inside the engine (src/engine/index.ts re-exports what UI, bots
// and tests may use). Functions that read hidden truth (claimTruth, blockTruth, refEconomics, revealTruth) are for engine
// physics, the simulator, tests and the dev reveal only (CLAUDE.md "Hidden information").
export type * from './types';
export {
  ACCESS_CLASSES,
  BEDROCK_TYPES,
  DEPOSIT_TYPES,
  ECON_CLASSES,
  HOLDER_SITUATIONS,
  LISTING_SETTINGS,
  OLD_TIMER_KINDS,
  SELLER_HONESTIES,
  SIZE_CLASSES,
  SIZE_SETTINGS,
  TOWN_TIERS,
  VISIBLE_FEATURES,
} from './enums';
export { emptyWorldSlice } from './empty';
export { generateWorld, worldIdCounters, type WorldGenOptions } from './generate';
export { snapshotGenParams, templateOf } from './params';
export { BCY_PER_ACRE_FT, BLOCK_FT, MG_PER_OZ } from './constants';
export { packTruth, unpackTruth, decodeClaimTruth, truthHashOf } from './pack';
export {
  blockCoords,
  blockIdOf,
  blockStateOf,
  blockTruth,
  claimTruth,
  drawContextFor,
  type BlockCoords,
  type WorldHolder,
} from './query';
export {
  cumulativeGoldShare,
  positionMult,
  positionMultProfile,
  profileOf,
  verticalGoldShare,
  verticalGoldShareProfile,
} from './vertical';
export {
  DrawSampleError,
  UNTOUCHED_BLOCK,
  drawSample,
  sampleGoldLines,
  sampleInterval,
  type SampleInterval,
} from './sample';
export { classLambdas, deWijsVar, effectiveMassMg, logVarMeas, medianRatio, nEff, particleCv } from './closedForms';
export {
  claimPriors,
  listingSettingOf,
  oldTimerOdds,
  priorContainedOz,
  priorStatusOf,
  visibleDepositType,
  visiblePrior,
  visiblePriorFor,
  visibleSizeSetting,
} from './priors';
export {
  classify,
  refBlockEconomics,
  refBreakEvenGrade,
  refEconomics,
  refRecovery,
  remainingVolumes,
  type RefBlockEcon,
  type RefEconResult,
} from './refEconomics';
export { accessFactors, accessFactorsFor, claimAccessClass, degradeAccess, type AccessFactors } from './access';
export { lowFlowGpm, sourceScale, waterAvailableFromFlow } from './water';
export { publicRecord, recordsQuality } from './records';
export { DEFAULT_LISTING_LIFE, listingPoolWeight, listingPoolWeights, type ListingLifeParams } from './supplyPool';
export { revealTruth, type RevealedClaim } from './reveal';
