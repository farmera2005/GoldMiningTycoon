// Effect modifiers and the effective() resolution (DESIGN §2.10 = §12 12.3, D-2.28). Every value an event may change
// is a registered hook (data/events/hooks.ts) read through effective(state, key, q) from P1. This module holds the pure
// resolution; the GameState wrapper and its memo (keyed by turn, events.modifiersVersion, key and query) belong to the
// events framework.
import type { HookDef } from '../../data/events/hooks';
import {
  compareIds,
  type BlockId,
  type ClaimId,
  type DistrictId,
  type EmployeeId,
  type EvtId,
  type MachineId,
} from './ids';

/** A hook key (the name the reading section publishes in data/events/hooks.ts). */
export type HookKey = string;
/** A §6 permitting regime id. */
export type Regime = string;

/** The scope dimensions of a modifier: every field set must equal the query's field (blockIds: q.blockId ∈ blockIds). */
export interface EffectScope {
  districtId?: DistrictId;
  claimId?: ClaimId;
  machineId?: MachineId;
  employeeId?: EmployeeId;
  /** §11 lender (data id). */
  lenderId?: string;
  /** §9 equipment model (data id). */
  modelId?: string;
  /** §9 brand (data id). */
  brandId?: string;
  regime?: Regime;
  blockIds?: BlockId[];
}

export interface EffectModifier {
  /** `${sourceEvtId}/m${k}` (k = effect index), deterministic; preparation modifiers `${prepId}/m${k}`. */
  id: string;
  target: HookKey;
  op: 'mul' | 'add' | 'set';
  value: number;
  scope: EffectScope;
  /** Inclusive; untilTurn = Number.MAX_SAFE_INTEGER for permanent rule changes. */
  startTurn: number;
  untilTurn: number;
  /** §13's Tuning viewer omits the modifier before this turn (a season shift: the week it lands). */
  visibleFromTurn: number;
  sourceEvtId: EvtId | null;
}

/** The full context of a read, e.g. { districtId, claimId } for a claim or { districtId, claimId, machineId, modelId, brandId } for a machine. */
export interface EffectQuery {
  districtId?: DistrictId;
  claimId?: ClaimId;
  machineId?: MachineId;
  employeeId?: EmployeeId;
  lenderId?: string;
  modelId?: string;
  brandId?: string;
  regime?: Regime;
  blockId?: BlockId;
}

/** Default bounds (§12 12.3): product of muls [0, 5], sum of adds ±10 in the hook's unit, set values [0, 1]. */
export const DEFAULT_MUL_BOUNDS: readonly [number, number] = [0, 5];
export const DEFAULT_ADD_BOUNDS: readonly [number, number] = [-10, 10];
export const DEFAULT_SET_BOUNDS: readonly [number, number] = [0, 1];

const SCALAR_SCOPE_FIELDS = [
  'districtId',
  'claimId',
  'machineId',
  'employeeId',
  'lenderId',
  'modelId',
  'brandId',
  'regime',
] as const;

function clamp(v: number, bounds: readonly [number, number]): number {
  return Math.min(bounds[1], Math.max(bounds[0], v));
}

/** True when every scope field set on the modifier equals the query's field (blockIds: the query's block is listed). */
export function scopeMatches(scope: EffectScope, q: EffectQuery): boolean {
  for (const f of SCALAR_SCOPE_FIELDS) {
    const want = scope[f];
    if (want !== undefined && want !== q[f]) return false;
  }
  if (scope.blockIds !== undefined) {
    if (q.blockId === undefined || !scope.blockIds.includes(q.blockId)) return false;
  }
  return true;
}

/**
 * The active set A for a read at `turn`: modifiers on this hook with startTurn ≤ turn ≤ untilTurn whose scope matches,
 * in ascending compareIds order of their ids. When `hook` is given, modifiers targeting another key are ignored, so
 * the caller may pass either the hook's own modifiers or the whole list.
 */
export function activeModifiers(
  hook: HookDef | undefined,
  modifiers: readonly EffectModifier[],
  turn: number,
  q: EffectQuery,
): EffectModifier[] {
  const active: EffectModifier[] = [];
  for (const m of modifiers) {
    if (hook !== undefined && m.target !== hook.key) continue;
    if (m.startTurn > turn || turn > m.untilTurn) continue;
    if (!scopeMatches(m.scope, q)) continue;
    active.push(m);
  }
  // A fixed order makes the floating-point product and sum independent of how the modifier list was built.
  active.sort((a, b) => compareIds(a.id, b.id));
  return active;
}

/**
 * effective() resolution (§2.10, §12 12.3):
 *  - `base` is TuningResolved[key] for a tuning key (difficulty and scenario already applied), else hook.neutral;
 *  - if A holds any 'set', the one with the latest startTurn wins (tie: lowest id), clamped to the set bounds;
 *  - otherwise v = base × clamp(Π mul) + clamp(Σ add), with the hook's bounds (defaults: [0, 5], ±10).
 * Muls and adds are folded in ascending id order.
 */
export function effectiveValue(
  base: number,
  hook: HookDef | undefined,
  modifiers: readonly EffectModifier[],
  turn: number,
  q: EffectQuery,
): number {
  const active = activeModifiers(hook, modifiers, turn, q);
  if (active.length === 0) return base;
  let winner: EffectModifier | undefined;
  for (const m of active) {
    if (m.op === 'set' && (winner === undefined || m.startTurn > winner.startTurn)) winner = m;
  }
  if (winner !== undefined) return clamp(winner.value, hook?.setBounds ?? DEFAULT_SET_BOUNDS);
  let product = 1;
  let sum = 0;
  for (const m of active) {
    if (m.op === 'mul') product *= m.value;
    else sum += m.value;
  }
  return (
    base * clamp(product, hook?.mulBounds ?? DEFAULT_MUL_BOUNDS) + clamp(sum, hook?.addBounds ?? DEFAULT_ADD_BOUNDS)
  );
}

/** Canonical text of a query for memo keys: every scope field in a fixed order, absent fields empty. */
export function effectQueryKey(q: EffectQuery): string {
  return [
    q.districtId ?? '',
    q.claimId ?? '',
    q.machineId ?? '',
    q.employeeId ?? '',
    q.lenderId ?? '',
    q.modelId ?? '',
    q.brandId ?? '',
    q.regime ?? '',
    q.blockId ?? '',
  ].join('\u001f');
}
