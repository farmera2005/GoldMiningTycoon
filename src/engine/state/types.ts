// The GameState frame (DESIGN §2.5). Each system defines its own slice in its folder; this is the frame they plug
// into. State is plain serializable data: Records keyed by ids, no classes, Maps, Sets, Dates or functions, and no
// property whose value is undefined (an optional property is either present with a value or absent).
import type { TuningResolved } from '../../data/tuning';
import type { IdPrefix } from '../core/ids';
import type { ClimateSlice, SeasonPhaseByDistrict } from '../systems/climate/types';
import type { CompanySlice } from '../systems/company/types';
import type { CompetitorSlice } from '../systems/competitors/types';
import type { EventsSlice } from '../systems/events/types';
import type { FinanceSlice } from '../systems/finance/types';
import type { FleetSlice } from '../systems/fleet/types';
import type { GoldSlice } from '../systems/gold/types';
import type { HardRockSlice } from '../systems/hardrock/types';
import type { HistorySlice } from '../systems/history/types';
import type { InboxSlice } from '../systems/inbox/types';
import type { KnowledgeSlice } from '../systems/knowledge/types';
import type { LandSlice } from '../systems/land/types';
import type { OpsSlice } from '../systems/ops/types';
import type { PermitSlice } from '../systems/permits/types';
import type { StaffSlice } from '../systems/staff/types';
import type { WorldSlice } from '../systems/world/types';
import type { InheritorStreams } from '../systems/company/types';
import type { ListingCandidate } from '../systems/world/types';
import type { CalendarMode } from '../systems/climate/types';
import type { FixtureSpec } from './fixture';
import type { NewGameSetup } from './setup';

/**
 * Phase rules in force (§2.12 `--rules`, D-2.18). DESIGN's type is 1–6; 0 is the P0 build's own phase (no system
 * rules beyond the frame), so a P0 game records what it actually ran.
 */
export type RulesPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Per-prefix id counters (§2.4). A prefix that has never minted an id is absent (= 0). */
export type IdCounters = Partial<Record<IdPrefix, number>>;

export interface GameMeta {
  seed: string;
  setup: NewGameSetup;
  /** Hash of `tuning` (canonical JSON, FNV-1a 64), fixed at creation (§2.10). */
  tuningHash: string;
  /**
   * The game's resolved tuning (base → difficulty → scenario → setup → sim overrides). It travels with the save, so a
   * game keeps the tuning it was created with until the player migrates it (§2.9, §2.10).
   */
  tuning: TuningResolved;
  /** Engine rules version at creation. */
  rulesVersion: string;
  rulesPhase: RulesPhase;
  /**
   * §1's season calendar (s02 #3): 'drawn' rolls seasons and weather from their streams; 'mean' (fixture games only,
   * set by `newFixtureGame` before the init parts run) uses the climatological calendar and draws nothing.
   */
  calendarMode: CalendarMode;
  /** BALANCE §2.1 fixture id of a fixture game (absent otherwise), so a replay can rebuild it. */
  fixtureId?: string;
}

export interface Clock {
  /** Absolute week index; turn 0 = year 1 week 1 (§2.4). */
  turn: number;
  year: number;
  /** 1..52 */
  week: number;
  /** Count of actions applied so far (keys only the flavor-text `action` stream, §2.3 rule d). */
  actionSeq: number;
  phase: SeasonPhaseByDistrict;
}

export interface GameState {
  schemaVersion: number;
  meta: GameMeta;
  clock: Clock;
  ids: IdCounters;
  climate: ClimateSlice;
  company: CompanySlice;
  world: WorldSlice;
  knowledge: KnowledgeSlice;
  land: LandSlice;
  permits: PermitSlice;
  ops: OpsSlice;
  staff: StaffSlice;
  fleet: FleetSlice;
  gold: GoldSlice;
  finance: FinanceSlice;
  events: EventsSlice;
  competitors: CompetitorSlice;
  inbox: InboxSlice;
  history: HistorySlice;
  hardRock?: HardRockSlice;
}

/** Slice keys of GameState, in §2.5 order (save validation and tests walk them). */
export const SLICE_KEYS = [
  'climate',
  'company',
  'world',
  'knowledge',
  'land',
  'permits',
  'ops',
  'staff',
  'fleet',
  'gold',
  'finance',
  'events',
  'competitors',
  'inbox',
  'history',
] as const satisfies readonly (keyof GameState)[];

/**
 * newGame's per-game scratch (P1 contract §1.5): handoffs between init parts, never stored in state. `candidates` are
 * §3's initial listing candidates for §5 (N3 → N5), `inheritor` §1's setup streams (N4 → N9), `fixture` the spec of a
 * fixture game (N10).
 */
export interface InitScratch {
  candidates: ListingCandidate[];
  inheritor: InheritorStreams | null;
  fixture: FixtureSpec | null;
}

export interface InitCtx {
  readonly seed: string;
  readonly setup: NewGameSetup;
  readonly tuning: TuningResolved;
  readonly scratch: InitScratch;
}

/**
 * One week-1 initialization of newGame (D-2.13; P1 contract §1.5): N1 … N11 in a fixed order, because ids mint in this
 * order (`lst` goes §5 then §9, D-9.43). A part runs only when the game's rules phase is at least `fromPhase`. It mutates
 * the new game's shell in place (the shell is not shared until newGame freezes it).
 */
export interface InitPart {
  /** '<folder>.<name>', unique. */
  readonly id: string;
  /** N1 = 1 … N11 = 11 (N8b = 8.5). */
  readonly order: number;
  readonly section: number;
  readonly fromPhase: RulesPhase;
  run(draft: GameState, init: InitCtx): void;
}
