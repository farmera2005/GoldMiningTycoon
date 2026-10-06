// Fixture games (s02 #2, #3, S08-27; P1 contract §1.6): BALANCE §2.1's reference operations, built directly into a
// game so the simulator (`npm run sim -- --fixture <id>`) and tests can measure a known claim, fleet and crew without
// playing the acquisition game. Only sim/ and tests call it; the UI never does (a lint rule forbids it in src/ui).
//
// `newFixtureGame` builds a Bootstrapper game in the fixture's district with the spec's entity and background, its
// cash passed as overrides of the start-cash keys (plus `spec.tuningOverrides`, e.g. staff noise off, S08-21), then
// applies the fixture through the owners' builders: §3 reference claim, §5 tenure and production interests, §9
// machines, §8 crew, §7 site and plan, §11 loans. The state records `meta.fixtureId` so a replay can rebuild it, and
// the fixture runs on §1's mean calendar (s02 #3), both set before the init parts run. Those builders and the two
// meta fields arrive with their owners' contracts; until then `applyFixture` is a creation stub and throws.
import { ContractStubError } from '../core/assert';
import type { Access, SizeClass } from '../systems/world/enums';
import { produceState } from './immutability';
import { newGame, type NewGameOptions } from './newGame';
import { defaultNewGameSetup, type EntityType, type NewGameSetup, type OwnerBackground } from './setup';
import type { TuningOverrides } from './tuning';
import type { GameState } from './types';

/**
 * Owner types the spec names that later Wave-0 contracts define (§9 `ModelId`, `Grade`, `MachineOption`; §8 `Role`;
 * §7 `MinePlan`; §5 lease and interest specs). Placeholders until those land; the owning packages narrow them.
 */
export type FixtureModelId = string;
export type FixtureGrade = 'A' | 'B' | 'C' | 'D';
export type FixtureMachineOption = string;
export type FixtureRole = string;
export type FixtureLeaseSpec = Readonly<Record<string, unknown>>;
export type FixtureInterestSpec = Readonly<Record<string, unknown>>;
export type FixtureMinePlanSpec = Readonly<Record<string, unknown>>;

/** §3's reference claim: uniform truth, the fixture's water and access (P1 contract §1.6). */
export interface ReferenceClaimSpec {
  acres: number;
  blocks: number;
  gradeOzPerBcy: number;
  payFt: number;
  bedrockFt: number;
  overburdenFt: number;
  permafrost: number;
  clay: number;
  boulders: number;
  cementation: number;
  sizeMix: Record<SizeClass, number>;
  alloyFineness: number;
  water: { kind: 'creek'; gpm: number } | { kind: 'arid'; wellYieldGpm: number | null; springGpm: number | null };
  access: Access;
  roadMi: number;
}

export interface FixtureSpec {
  /** BALANCE §2.1 fixture id. */
  id: string;
  template: 'northernFederal' | 'aridFederal';
  start: { entity: EntityType; background: OwnerBackground; companyCashUsd: number; personalCashUsd: number };
  claim: ReferenceClaimSpec;
  tenure: { kind: 'ownedUnpatented' | 'leased'; costBasisUsd: number; lease?: FixtureLeaseSpec };
  interests: FixtureInterestSpec[];
  fleet: { modelId: FixtureModelId; grade: FixtureGrade; options?: FixtureMachineOption[] }[];
  crew: { role: FixtureRole; skill: number; reliability?: number; safety?: number; payCentsPerHour?: number }[];
  owner: { assignment: 'foreman' | 'operator' | 'office'; operatorModelId?: FixtureModelId };
  loans: { product: 'fixedP1'; principalUsd: number; annualRate: number; termMonths: number }[];
  site: 'none' | 'ready' | 'winterized';
  /** Pre-stripped blocks (an established season). */
  stripAheadBlocks: number;
  plan: 'default' | FixtureMinePlanSpec;
  /** S08-21: e.g. { 'staff.quitHazardMult': 0, 'staff.absence.base': 0 }. */
  tuningOverrides?: TuningOverrides;
}

/** The Bootstrapper setup a fixture plays (one district: the fixture's template). */
export function fixtureSetup(spec: FixtureSpec): NewGameSetup {
  const setup = defaultNewGameSetup({
    companyName: `Fixture ${spec.id}`.slice(0, 40),
    entity: spec.start.entity,
    background: spec.start.background,
  });
  return { ...setup, world: { ...setup.world, districtTemplates: [spec.template] } };
}

/** The fixture's cash through the start-cash keys, then its own overrides (which win on a shared key). */
export function fixtureOverrides(spec: FixtureSpec): TuningOverrides {
  return {
    'game.start.bootstrapper.companyCashUsd': spec.start.companyCashUsd,
    'game.start.bootstrapper.personalCashUsd': spec.start.personalCashUsd,
    ...spec.tuningOverrides,
  };
}

/** Applies the fixture to a fresh game's draft through the owners' builders (part N10). */
export function applyFixture(_draft: GameState, spec: FixtureSpec): void {
  // CONTRACT-STUB(§2): the §3, §5, §7, §8, §9 and §11 fixture builders and meta.fixtureId / meta.calendarMode.
  throw new ContractStubError(`fixture.apply(${spec.id})`);
}

/** A fixture game (BALANCE §2.1). Throws ContractStubError until the owners' builders land. */
export function newFixtureGame(spec: FixtureSpec, seed: string, opts: NewGameOptions = {}): GameState {
  const base = newGame(fixtureSetup(spec), seed, fixtureOverrides(spec), opts);
  return produceState(base, (draft) => applyFixture(draft, spec));
}
