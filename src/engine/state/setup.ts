// New-game setup (DESIGN §1 1.6). Setup is `newGame(setup, seed)`, not an action: the wizard (or the simulator)
// assembles a NewGameSetup, `validateSetup` returns §1's typed codes, and newGame refuses an invalid setup.
import type { Difficulty } from '../../data/difficulty';
import { gameTuning } from '../../data/tuning/game';
import { startsAvailable } from '../systems/company/start';
import { BUILD_RULES_PHASE } from './rules';
import type { RulesPhase } from './types';

export type { Difficulty } from '../../data/difficulty';

export type EntityType = 'soleProp' | 'llc' | 'corp';
/** §1 1.7. `'none'` is the simulator-only owner with no edge (D-2.27); the wizard never offers it. */
export type OwnerBackground = 'operator' | 'mechanic' | 'geologist' | 'banker' | 'landman' | 'none';
export type StartType = 'bootstrapper' | 'backed' | 'inheritor';
export type BackedTerms = 'equity' | 'royalty';
export type GameMode = 'sandbox' | 'scenario';
/** §3 region template ids (§1 1.4.1 maps each to a climate template). P1–P5 offer the first two. */
export type RegionTemplateId = 'northernFederal' | 'aridFederal' | 'alaskaState' | 'yukon' | 'temperateFederal';
/** §1 1.10 goal scenarios live in data/scenarios (none ship before P6). */
export type ScenarioId = string;

export interface NewGameSetup {
  /** 1–40 characters each (§1 1.6). */
  companyName: string;
  ownerName: string;
  entity: EntityType;
  background: OwnerBackground;
  start: StartType;
  /** Required iff start = 'backed'. */
  backedTerms: BackedTerms | null;
  mode: GameMode;
  scenarioId: ScenarioId | null;
  difficulty: Difficulty;
  world: {
    startCalendarYear: number;
    districtTemplates: RegionTemplateId[];
    /** null ⇒ market.openingSpotUsdPerFineOz (4,200); otherwise it overrides that key (and §10's referenceSpot). */
    openingSpotUsdPerFineOz: number | null;
  };
  tutorial: boolean;
}

export type SetupErrorCode =
  | 'NAME_EMPTY'
  | 'NAME_TOO_LONG'
  | 'BACKED_TERMS_REQUIRED'
  | 'BACKED_TERMS_UNEXPECTED'
  | 'ENTITY_NOT_ALLOWED'
  | 'SCENARIO_UNKNOWN'
  | 'DISTRICT_TEMPLATE_NOT_IN_PHASE'
  | 'INHERITOR_NEEDS_NORTHERN'
  | 'START_NOT_IN_PHASE'
  | 'START_YEAR_INVALID'
  | 'OPENING_SPOT_INVALID';

export interface SetupIssue {
  readonly code: SetupErrorCode;
  readonly field: string;
}

/** Thrown by newGame for a setup that `validateSetup` rejects. */
export class SetupError extends Error {
  readonly issues: readonly SetupIssue[];

  constructor(issues: readonly SetupIssue[]) {
    super(`invalid new-game setup: ${issues.map((i) => `${i.field} ${i.code}`).join(', ')}`);
    this.name = 'SetupError';
    this.issues = issues;
  }
}

export const NAME_MAX_LENGTH = 40;
/** §1 1.6: P1–P5 worlds are these two districts; P6 adds templates. */
export const DEFAULT_DISTRICT_TEMPLATES: readonly RegionTemplateId[] = ['northernFederal', 'aridFederal'];
/** Templates a game can generate under a rules phase (§1 1.6 DISTRICT_TEMPLATE_NOT_IN_PHASE; P6 adds templates). */
export function templatesAvailable(_rulesPhase: RulesPhase): readonly RegionTemplateId[] {
  return DEFAULT_DISTRICT_TEMPLATES;
}
/** No scenario content ships before P6 (§1 1.10). */
const KNOWN_SCENARIOS: readonly ScenarioId[] = [];

/**
 * A complete setup from the P0 wizard's two fields (§13 13.24: name + seed) and P0 defaults: Bootstrapper, LLC, the
 * simulator's no-edge owner, standard difficulty, sandbox, the two P1 districts (brief for the framework package).
 */
export function defaultNewGameSetup(overrides: Partial<NewGameSetup> & { companyName: string }): NewGameSetup {
  const base: NewGameSetup = {
    companyName: overrides.companyName,
    ownerName: 'Owner',
    entity: 'llc',
    background: 'none',
    start: 'bootstrapper',
    backedTerms: null,
    mode: 'sandbox',
    scenarioId: null,
    difficulty: 'standard',
    world: {
      startCalendarYear: gameTuning['game.startCalendarYear'],
      districtTemplates: [...DEFAULT_DISTRICT_TEMPLATES],
      openingSpotUsdPerFineOz: null,
    },
    tutorial: false,
  };
  return { ...base, ...overrides, world: { ...base.world, ...overrides.world } };
}

function nameIssue(name: string, field: string): SetupIssue | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { code: 'NAME_EMPTY', field };
  if (trimmed.length > NAME_MAX_LENGTH) return { code: 'NAME_TOO_LONG', field };
  return null;
}

/**
 * §1 1.6 validation, plus the limits of the rules phase the game will run (templates and starts available; P1
 * contract §1.5). Returns every issue (empty when valid).
 */
export function validateSetup(setup: NewGameSetup, rulesPhase: RulesPhase = BUILD_RULES_PHASE): SetupIssue[] {
  const issues: SetupIssue[] = [];
  const push = (i: SetupIssue | null): void => {
    if (i !== null) issues.push(i);
  };
  push(nameIssue(setup.companyName, 'companyName'));
  push(nameIssue(setup.ownerName, 'ownerName'));
  if (setup.start === 'backed' && setup.backedTerms === null)
    push({ code: 'BACKED_TERMS_REQUIRED', field: 'backedTerms' });
  if (setup.start !== 'backed' && setup.backedTerms !== null)
    push({ code: 'BACKED_TERMS_UNEXPECTED', field: 'backedTerms' });
  // §1 1.6: a sole proprietorship cannot take equity investors (Backed equity needs an LLC or corp).
  if (setup.start === 'backed' && setup.backedTerms === 'equity' && setup.entity === 'soleProp') {
    push({ code: 'ENTITY_NOT_ALLOWED', field: 'entity' });
  }
  if (setup.mode === 'sandbox' ? setup.scenarioId !== null : !KNOWN_SCENARIOS.includes(setup.scenarioId ?? '')) {
    push({ code: 'SCENARIO_UNKNOWN', field: 'scenarioId' });
  }
  const templates = setup.world.districtTemplates;
  const templatesInPhase = templatesAvailable(rulesPhase);
  if (templates.length === 0 || templates.some((t) => !templatesInPhase.includes(t))) {
    push({ code: 'DISTRICT_TEMPLATE_NOT_IN_PHASE', field: 'world.districtTemplates' });
  }
  if (setup.start === 'inheritor' && !templates.includes('northernFederal')) {
    push({ code: 'INHERITOR_NEEDS_NORTHERN', field: 'world.districtTemplates' });
  }
  if (!startsAvailable(rulesPhase).includes(setup.start)) push({ code: 'START_NOT_IN_PHASE', field: 'start' });
  const year = setup.world.startCalendarYear;
  if (!Number.isSafeInteger(year) || year < 1900 || year > 2500) {
    push({ code: 'START_YEAR_INVALID', field: 'world.startCalendarYear' });
  }
  const spot = setup.world.openingSpotUsdPerFineOz;
  if (spot !== null && !(Number.isFinite(spot) && spot > 0)) {
    push({ code: 'OPENING_SPOT_INVALID', field: 'world.openingSpotUsdPerFineOz' });
  }
  return issues;
}
