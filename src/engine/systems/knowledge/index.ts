// §4 Prospecting and resource estimation: the system's surface inside the engine. estimateFromEvidence is pure and
// never receives truth (§4.18); executeSample is the only §4 function that reads truth (sample execution, §4.3).
export type * from './types';
export { CONFIDENCE_CLASSES, emptyKnowledgeSlice } from './types';
export { estimatorParams, type EstimatorParams } from './params';
export {
  anchoredStatisticalEstimate,
  estimateAnchored,
  estimateFromEvidence,
  estimatorMemoStats,
  statisticalEstimate,
  type EstimateContext,
  type StatisticalEstimate,
} from './estimate';
export {
  anchorTurn,
  appendProduction,
  FULL_SOLVE_ANCHOR_TURN,
  frozenFullSolve,
  fullSolveAnchor,
  refreshAnchor,
  splitAtAnchor,
  takeAnchor,
  type AppendedSolve,
  type EstimateAnchor,
} from './incremental';
export {
  auditChainRatio,
  MIN_ATTRIBUTED_OZ,
  prepareProduction,
  productionEvidenceOf,
  productionObservation,
  productionRecords,
  type CleanupResult,
  type ModeledChain,
  type PreparedProduction,
  type ProductionEvidence,
  type ProductionRecordDraft,
  type RecordProductionInput,
} from './production';
export {
  assayNEff,
  cleanupAssay,
  drawSampleAssay,
  finenessPosterior,
  sampleAssayDue,
  sampleAssaySd,
  type FinenessParams,
} from './fineness';
export { geologistOnClaim, quantizeBlockState, type AnchorBlockState } from './statistical';
export { defaultPlanning, planningPrice } from './economic';
export { classifyConfidence, type GateValues } from './confidence';
export { canonicalEvidence, emptyEvidence, evidenceHash } from './evidence';
export {
  executeSample,
  executionParams,
  type ExecuteRequest,
  type ExecuteResult,
  type ExecutionParams,
  type Logger,
} from './execute';
export { findProbability, recordsParams, recordsReview, reviewerMult, type RecordsParams } from './records';
export { effectiveDrawParams, methodSpec, noiseMult } from './methods';
export { coarseRatioPrior, overlapShare, priorModel, type PriorModel } from './prior';
export { lognormalLimit, smallCount } from './smallCount';
export { digamma, invTrigamma, trigamma } from './special';
export {
  pileMinable,
  pilePrior,
  pileRawOzEst,
  TAILINGS_GRADE_LOG_SD,
  TAILINGS_VOLUME_CV,
  tailingsEraOf,
  type PileEstimate,
  type PilePriorParams,
  type TailingsEra,
} from './tailings';
