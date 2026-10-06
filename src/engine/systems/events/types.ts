// §12 events slice of GameState (DESIGN §12 12.1 `EventsSlice`; S12-4; P1 contract §4.12). The modifier store that
// effective() reads (D-2.28) plus, at their neutral values, the instances, history, annual counts, cooldowns, category
// blocks, the director, scheduled effects and preparations that §12 fills from P3/P5 (D-2.60). Hidden: an instance's
// `hidden` truths (12.8).
import type { CalcNode } from '../../core/calc';
import type { EffectModifier, HookKey } from '../../core/effective';
import type { DecId, EvtId, Id, PrepId } from '../../core/ids';
import type { Cents } from '../../core/money';
import type { ClimateTemplateId } from '../world/types';

export type { EffectModifier, EffectQuery, EffectScope, HookKey } from '../../core/effective';

export type EventSeverity = 'minor' | 'moderate' | 'major' | 'catastrophic';
export type EventCategory =
  | 'weather'
  | 'water'
  | 'fire'
  | 'ground'
  | 'equipment'
  | 'supply'
  | 'security'
  | 'safety'
  | 'camp'
  | 'labor'
  | 'regulatory'
  | 'community'
  | 'land'
  | 'finance'
  | 'market'
  | 'opportunity';
export type ScopeKind = 'world' | 'regime' | 'district' | 'claim' | 'machine' | 'employee' | 'lender' | 'location' | 'company';

/** A catalog event id (data/events/catalog.ts). */
export type EventId = string;
/** Names in engine/events' predicate, driver, one-shot and prep-check registries (the §12 package). */
export type PreconditionName = string;
export type DriverName = string;
export type OneShotHook = string;
export type PrepCheckName = string;
/** A DESIGN section number. */
export type SectionNum = number;

/** The scope instance an event rolled on: its kind and key (an entity id, a location key, or null for world/company). */
export interface ScopeRef {
  kind: ScopeKind;
  key: string | null;
}

export type EffectSpec =
  | {
      kind: 'modifier';
      target: HookKey;
      op: 'mul' | 'add' | 'set';
      value: number | [number, number];
      weeks?: [number, number];
      afterPrev?: boolean;
    }
  | { kind: 'oneShot'; hook: OneShotHook; params: Record<string, number | [number, number] | string> };

export interface ResponseSpec {
  id: string;
  labelKey: string;
  costUsd?: number | [number, number];
  requires?: PrepCheckName;
  outcome: EffectSpec[];
  successProb?: { base: number; drivers?: DriverName[] };
  isDefault?: boolean;
  tradeoffKey: string;
}

export interface EventDef {
  id: EventId;
  name: string;
  category: EventCategory;
  phase: 3 | 4 | 5 | 6;
  target: SectionNum[];
  scope: ScopeKind;
  climates?: ClimateTemplateId[];
  window?:
    | { kind: 'weeks'; from: number; to: number }
    | { kind: 'relative'; anchor: 'breakupTrue' | 'freezeUpTrue'; from: number; to: number; annualProb: number };
  trigger: 'weekly' | 'onBlockStripped' | 'onBlockMined' | 'onCleanup' | 'competitor';
  preconditions: { fn: PreconditionName; args?: unknown }[];
  baseWeeklyProb: number | { byCondition: { when: PreconditionName; p: number }[] };
  drivers: { fn: DriverName; args?: unknown }[];
  severityWeights: [number, number, number, number];
  severityFromLoss?: [number, number, number];
  severityTiltDrivers?: DriverName[];
  effects: Record<EventSeverity, EffectSpec[]>;
  durationWeeks: Record<EventSeverity, [number, number]>;
  mitigations: { prep: PrepCheckName; probMult?: number; severityShift?: number; lossMult?: number }[];
  responses?: ResponseSpec[];
  blocking?: boolean;
  responseDeadlineWeeks?: number;
  cooldown: { sameScopeWeeks: number; excludes?: EventId[] };
  consequential?: boolean;
  opportunity?: boolean;
  directorExempt?: boolean;
  text: { titleKey: string; bodyKey: string; mitigationKey: string; newsKey?: string };
}

export interface EventInstance {
  id: EvtId;
  defId: EventId;
  severity: EventSeverity;
  /** Drawn before director and preparation shifts. */
  severityDrawn: EventSeverity;
  scope: ScopeRef;
  startTurn: number;
  endTurn: number;
  status: 'active' | 'awaitingResponse' | 'resolved';
  modifierIds: string[];
  oneShots: { hook: OneShotHook; params: Record<string, unknown>; result: unknown }[];
  lossCents: Cents;
  insuredCents: Cents;
  decisionId: DecId | null;
  /** Truths not shown (12.8). */
  hidden: { recoveredFrac?: number; insider?: boolean };
  affectsPlayer: boolean;
  consequential: boolean;
  /** Built for every accepted instance, whatever the explain flag (12.2). */
  calc: CalcNode;
}

/** A §12-owned preparation (12.4): catalog row. */
export interface PrepDef {
  id: string;
  scope: ScopeKind;
  costUsd: number;
  buildWeeks: number;
  lifeWeeks: number | null;
  upkeepUsdPerYear: number;
  textKey: string;
}

/** A built or building preparation (12.4). */
export interface PrepRecord {
  id: PrepId;
  defId: string;
  scope: ScopeRef;
  orderedTurn: number;
  readyTurn: number;
  untilTurn: number | null;
  costCents: Cents;
  status: 'building' | 'active' | 'lapsed';
}

export interface EventHistoryRow {
  turn: number;
  evtId: EvtId;
  defId: EventId;
  severity: EventSeverity;
  scope: ScopeRef;
  lossCents: Cents;
}

export interface DirectorState {
  halfIndex: number;
  pointsUsed: number;
  catastropheBlockedUntil: number;
  acceptedThisWeek: number;
  /** §9/§8 shocks counted for stacking (12.6). */
  external: { kind: 'failure' | 'injury'; ref: Id; untilTurn: number }[];
}

export interface ScheduledEffect {
  id: string;
  evtId: EvtId;
  applyTurn: number;
  effects: EffectSpec[];
}

/** §12 12.1 `EventsSlice`. */
export interface EventsSlice {
  active: Record<EvtId, EventInstance>;
  activeIds: EvtId[];
  /** 156-week ring. */
  history: EventHistoryRow[];
  annualCounts: Record<number, Partial<Record<EventCategory, number>>>;
  modifiers: Record<string, EffectModifier>;
  /** Modifier ids per target hook, ascending compareIds order; mirrors `modifiers` exactly. */
  modifierIdsByTarget: Record<HookKey, string[]>;
  /** Bumps on every add or remove (§12 12.1); part of effective()'s memo key. */
  modifiersVersion: number;
  /** `defId|scopeKey` → blocked through turn. */
  cooldowns: Record<string, number>;
  categoryBlockedUntil: Partial<Record<EventCategory, number>>;
  director: DirectorState;
  scheduled: ScheduledEffect[];
  preps: Record<PrepId, PrepRecord>;
  prepIds: PrepId[];
}

export function emptyEventsSlice(): EventsSlice {
  return {
    active: {},
    activeIds: [],
    history: [],
    annualCounts: {},
    modifiers: {},
    modifierIdsByTarget: {},
    modifiersVersion: 0,
    cooldowns: {},
    categoryBlockedUntil: {},
    director: { halfIndex: 0, pointsUsed: 0, catastropheBlockedUntil: 0, acceptedThisWeek: 0, external: [] },
    scheduled: [],
    preps: {},
    prepIds: [],
  };
}
