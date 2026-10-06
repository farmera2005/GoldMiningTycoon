// §7 operations selectors (DESIGN §2.11, §7.19; P1 contract §4.7): pure readers over state, spread into `select` by
// select/index.ts. The claim and week views drop every hidden field (gold in pads, boxes, blocks and tailings; losses;
// the operator skills behind the wear model; the skim). A name already used by another folder fails the composition
// test.
import type { ClaimId } from '../../core/ids';
import type { GameState } from '../../state/types';
import { defaultMinePlan, opsHints, productionForecast, projectOpsVisible } from './visible';
import { disturbance, maxPlantLines, siteStatus } from './site';
import type { ClaimOps, MinePlan, TailingsAuditReport, WeekOpsResult, Well } from './types';

/** The visible view of a claim's operations. */
export type ClaimOpsView = Pick<
  ClaimOps,
  | 'claimId'
  | 'plan'
  | 'site'
  | 'siteTask'
  | 'rehandleBcy'
  | 'workOrders'
  | 'disturbance'
  | 'auditReports'
  | 'payDugLast4'
  | 'status'
  | 'leftTurn'
> & {
  season: Omit<ClaimOps['season'], never>;
  wells: Well[];
};

/** The visible view of last week's result (hidden gold and skill fields dropped). */
export type WeekOpsView = Omit<
  WeekOpsResult,
  | 'containedRawOz'
  | 'containedBySize'
  | 'recoveredRawOz'
  | 'recoveredBySize'
  | 'lostRawOzBySize'
  | 'lostToWasteOz'
  | 'leftInPitOz'
  | 'hoursByMachine'
  | 'lines'
  | 'cleanups'
>;

function claimOps(state: GameState, claimId: ClaimId): ClaimOpsView | null {
  const c = state.ops.claims[claimId];
  if (c === undefined) return null;
  const view: ClaimOpsView = {
    claimId: c.claimId,
    plan: c.plan,
    site: c.site,
    rehandleBcy: c.rehandleBcy,
    workOrders: c.workOrders,
    disturbance: c.disturbance,
    auditReports: c.auditReports,
    payDugLast4: c.payDugLast4,
    status: c.status,
    leftTurn: c.leftTurn,
    season: c.season,
    // A well's yield stays hidden until it is ready (D-7.64).
    wells: c.wells.map((w) => (w.status === 'ready' ? w : { ...w, yieldGpm: null })),
  };
  return c.siteTask === undefined ? view : { ...view, siteTask: c.siteTask };
}

function minePlan(state: GameState, claimId: ClaimId): MinePlan | null {
  return state.ops.claims[claimId]?.plan ?? null;
}

function lastWeekOps(state: GameState, claimId: ClaimId): WeekOpsView | null {
  const r = state.ops.lastWeek[claimId];
  if (r === undefined) return null;
  const {
    containedRawOz: _a,
    containedBySize: _b,
    recoveredRawOz: _c,
    recoveredBySize: _d,
    lostRawOzBySize: _e,
    lostToWasteOz: _f,
    leftInPitOz: _g,
    hoursByMachine: _h,
    lines: _i,
    cleanups: _j,
    ...view
  } = r;
  return view;
}

function wells(state: GameState, claimId: ClaimId): Well[] {
  return claimOps(state, claimId)?.wells ?? [];
}

function auditReports(state: GameState, claimId: ClaimId): TailingsAuditReport[] {
  return [...(state.ops.claims[claimId]?.auditReports ?? [])];
}

export const opsSelectors = {
  claimOps,
  minePlan,
  siteStatus,
  lastWeekOps,
  projectOpsVisible,
  opsHints,
  productionForecast,
  defaultMinePlan,
  maxPlantLines,
  wells,
  disturbance,
  auditReports,
} as const;
