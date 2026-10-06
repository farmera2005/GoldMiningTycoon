// Cell → NewGameSetup (DESIGN §2.12 flags, §1 1.6). A simulator cell is bot × start × difficulty × background ×
// entity × rules phase (BALANCE §3.0); the setup carries the first five's game-side part and newGame's options the
// sixth. The engine's validateSetup is the authority on what this build can run.
import {
  BUILD_RULES_PHASE,
  defaultNewGameSetup,
  validateSetup,
  type Difficulty,
  type EntityType,
  type NewGameSetup,
  type OwnerBackground,
  type RulesPhase,
  type SetupIssue,
} from '../src/engine';

/** §2.12 `--start`: the §1 start type, with the Backed terms folded in. */
export type SimStart = 'bootstrapper' | 'backedEquity' | 'backedRoyalty' | 'inheritor';

export const SIM_STARTS: readonly SimStart[] = ['bootstrapper', 'backedEquity', 'backedRoyalty', 'inheritor'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'standard', 'hard'];
export const BACKGROUNDS: readonly OwnerBackground[] = [
  'none',
  'operator',
  'mechanic',
  'geologist',
  'banker',
  'landman',
];
export const ENTITIES: readonly EntityType[] = ['soleProp', 'llc', 'corp'];

export interface CellSetup {
  readonly start: SimStart;
  readonly difficulty: Difficulty;
  readonly background: OwnerBackground;
  readonly entity: EntityType;
}

/** Fixed names: every simulated game is the same company, so names never separate two cells' states. */
export const SIM_COMPANY_NAME = 'Simulated Placer Co';
export const SIM_OWNER_NAME = 'Sim Owner';

export function setupForCell(cell: CellSetup): NewGameSetup {
  const backed = cell.start === 'backedEquity' || cell.start === 'backedRoyalty';
  return defaultNewGameSetup({
    companyName: SIM_COMPANY_NAME,
    ownerName: SIM_OWNER_NAME,
    entity: cell.entity,
    background: cell.background,
    start: backed ? 'backed' : cell.start === 'inheritor' ? 'inheritor' : 'bootstrapper',
    backedTerms: cell.start === 'backedEquity' ? 'equity' : cell.start === 'backedRoyalty' ? 'royalty' : null,
    difficulty: cell.difficulty,
  });
}

/** Setup codes that mean "a later build runs this", with the phase that ships it (CLAUDE.md phase plan). */
const LATER_PHASE: Readonly<Partial<Record<SetupIssue['code'], number>>> = {
  // P1: "setup with every entity, background and start".
  START_NOT_IN_PHASE: 1,
  // P6: Alaska-style, Yukon-style and temperate templates.
  DISTRICT_TEMPLATE_NOT_IN_PHASE: 6,
};

export interface SetupVerdict {
  readonly issues: readonly SetupIssue[];
  /** Set when every issue only needs a later build: the earliest phase that runs this setup. */
  readonly availableFrom: number | null;
}

/** The setup checked against the rules phase the run plays (§1 1.6: starts and templates are per phase). */
export function checkSetup(setup: NewGameSetup, rulesPhase: RulesPhase = BUILD_RULES_PHASE): SetupVerdict {
  const issues = validateSetup(setup, rulesPhase);
  if (issues.length === 0) return { issues, availableFrom: null };
  const phases = issues.map((i) => LATER_PHASE[i.code] ?? null);
  const allLater = phases.every((p) => p !== null);
  return { issues, availableFrom: allLater ? Math.max(...(phases as number[])) : null };
}
