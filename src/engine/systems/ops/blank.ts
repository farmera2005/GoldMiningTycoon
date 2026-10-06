// Zero-valued §7 records (DESIGN §7.16): a claim week where nothing ran and a cleanup that weighed nothing. §7's flow
// starts each claim's result from `blankWeekOpsResult` and fills it; tests build their records from these so they
// stay valid as the shapes grow. Pure; no draw, no state read.
import type { ClaimId, LineId } from '../../core/ids';
import type { SizeRecord } from '../world/enums';
import type { CleanupResult, WeekOpsResult } from './types';

function zeroSizes(): SizeRecord {
  return { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
}

export function blankWeekOpsResult(claimId: ClaimId, turn: number): WeekOpsResult {
  return {
    claimId,
    turn,
    site: 'none',
    feedMode: 'none',
    hoursScheduled: 0,
    hoursByMachine: {},
    overburdenBcy: 0,
    frozenOverburdenBcy: 0,
    payMinedBcy: 0,
    payHauledBcy: 0,
    payWashedBcy: 0,
    padStartBcy: 0,
    padEndBcy: 0,
    tailingsBcy: 0,
    containedRawOz: 0,
    containedBySize: zeroSizes(),
    recoveredRawOz: 0,
    recoveredBySize: zeroSizes(),
    lostRawOzBySize: zeroSizes(),
    lostToWasteOz: 0,
    leftInPitOz: 0,
    recoveryInputs: {
      phiAvg: 0,
      omegaAvg: 0,
      circuit: 'sluice',
      plantOpSkillShown: { lo: 0, hi: 0 },
      riffleLoad: 'ok',
    },
    idleBreakdown: [],
    bottleneck: 'plant',
    plantIdlePct: 0,
    stageCapacityBcyWk: {},
    lines: [],
    strip: { needBcyWk: 0, doneBcyWk: 0, coverageWeeks: 0, standalone: {} },
    water: {
      needGpm: 0,
      pumpGpm: 0,
      sourceGpm: 0,
      wellGpm: 0,
      truckGpm: 0,
      recirc: 0,
      dischargeMode: 'closedLoop',
      limitedHours: 0,
    },
    power: { demandKw: 0, supplyKw: 0, shed: [] },
    fuelGal: 0,
    fuelOnHandGal: 0,
    costLines: [],
    disturbedAcresAdded: 0,
    reclaimedAcresAdded: 0,
    openAcres: 0,
    disturbedAcresByType: {},
    reclaimedAcresByType: {},
    permitUsage: {
      waterGpmAvg: 0,
      windowWeeksWorked: [],
      channelBlocksWorked: [],
      mechanized: false,
      pond: null,
      plantFeedBcyHr: 0,
      plantRatedBcyHr: 0,
      plantHoursPerDay: 0,
    },
    crewHours: {},
    ownerHours: 0,
    cleanups: [],
  };
}

export function blankCleanupResult(turn: number, lineId: LineId): CleanupResult {
  return {
    turn,
    lineId,
    purpose: 'production',
    rawOzWeighed: 0,
    rawOzBySize: zeroSizes(),
    interestsTaken: [],
    bcyWashedSince: 0,
    bcyByBlock: {},
    recoveredGradeOzPerBcy: 0,
    inSituBcyByBlock: {},
    pileBcyWashed: 0,
    pileRawOzEst: 0,
    modeledChainFactor: 0,
    modeledChain: {
      miningFactorByBlock: {},
      sizeMixP50: zeroSizes(),
      captureBySize: zeroSizes(),
      goldRoomLossBySize: zeroSizes(),
      estDirtFrac: 0,
    },
    foremanEstimateOz: 0,
    nominalRecoveryBySize: zeroSizes(),
    skimOz: 0,
  };
}
