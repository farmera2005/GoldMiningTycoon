// §1 company and owner slice of GameState (DESIGN §1 1.18 `CompanySlice`, 1.14 run status). P0 carries the identity
// fields and the run-status triple that the step-0 guard, step 16d and evaluateStops read. Owner details, investors,
// reputation, regulator standing and the safety record arrive with their systems in P1+ (P0 saves are not loaded by
// later phases, D-2.34, so the slice grows without a migration).
import type { Difficulty, EntityType, GameMode, OwnerBackground, ScenarioId, StartType } from '../../state/setup';

/** §1 1.14: an open reorganization case stays 'active'. */
export type RunStatus = 'active' | 'won' | 'lost' | 'retired';
export type EndReason = 'liquidated' | 'ousted' | 'deadline' | 'forfeited' | 'goal' | 'retired';
/** = §11 `distress.liquidation.cause`, set together with endReason 'liquidated'. */
export type LiquidationPath = 'filed' | 'involuntary' | 'converted' | 'p1Counter';

/** P0 subset of §1 1.9 `Owner`. */
export interface OwnerP0 {
  name: string;
}

export interface ScenarioProgress {
  id: ScenarioId;
  medal: 'gold' | 'silver' | 'bronze' | null;
  metTurn: number | null;
  reorgFiledTurn: number | null;
}

export interface CompanySlice {
  name: string;
  entity: EntityType;
  pendingEntity: { to: EntityType; effectiveTurn: number } | null;
  background: OwnerBackground;
  start: StartType;
  difficulty: Difficulty;
  mode: GameMode;
  owner: OwnerP0;
  scenario: ScenarioProgress | null;
  runStatus: RunStatus;
  endReason: EndReason | null;
  liquidationPath: LiquidationPath | null;
}

export function isRunActive(company: Pick<CompanySlice, 'runStatus'>): boolean {
  return company.runStatus === 'active';
}
