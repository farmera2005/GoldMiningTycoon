// Stop rules (DESIGN §13 13.9, §2.7). evaluateStops is a pure engine function, so the simulator, the tests and the UI
// worker stop identically (§13 T6). Reasons, ordered: blocking decision, game over, alert (critical, then warning),
// season phase, rule; deduplicated by ref. The caller adds `maxWeeks`. A blocking decision and a critical alert
// always stop; a warning stops unless its kind is muted (D-2.23).
import { MONTH_END_WEEKS } from '../core/calendar';
import { sortedKeys } from '../core/iter';
import type { ClaimId, DecId, DistrictId, EntityRef, MsgId } from '../core/ids';
import type { Cents } from '../core/money';
import { openDecisions } from '../actions/decisions';
import { select } from '../select';
import type { GameState } from '../state/types';
import type { AlertKind, Severity } from '../systems/inbox/types';
import type { WeekResult } from './types';

/** §13's saved-search filter (the P2 listing-match rule carries its filters; the shape is §13's, P2). */
export type ListingFilter = Readonly<Record<string, string | number | boolean | readonly (string | number)[]>>;

export type StopRule =
  | { kind: 'warningKinds'; muted: AlertKind[] }
  | { kind: 'seasonPhase'; scope: 'held' | 'all'; enabled: boolean }
  | { kind: 'deadlineWithin'; weeks: number; enabled: boolean }
  | { kind: 'everyCleanup'; claimIds: ClaimId[] | 'all'; enabled: boolean }
  | { kind: 'goldMove'; pct: number; enabled: boolean }
  | { kind: 'cashBelow'; cents: Cents; enabled: boolean }
  | { kind: 'machineFailure'; enabled: boolean }
  | { kind: 'listingMatch'; searches: { id: string; filter: ListingFilter }[]; enabled: boolean }
  | { kind: 'monthStart'; enabled: boolean }
  | { kind: 'atTurn'; turn: number };

/** UI data (D-13.35); the engine only reads it. */
export interface RunAnchor {
  runId: string;
  startTurn: number;
  startSpotUsdPerFineOz: number;
  startCashCents: Cents;
}

export type StopReasonKind = 'blockingDecision' | 'alert' | 'seasonPhase' | 'rule' | 'maxWeeks' | 'gameOver';

export interface StopReason {
  kind: StopReasonKind;
  rule?: StopRule['kind'];
  ref?: MsgId | DecId | EntityRef;
  label: string;
  severity?: Severity;
}

/** One deadline the player must act on (§13 13.9 `upcomingDeadlines`). */
export interface DeadlineItem {
  ref: DecId | EntityRef;
  dueTurn: number;
  createdTurn: number;
  label: string;
}

/**
 * §13 13.9 upcomingDeadlines, P0 form: non-blocking decision deadlines. §6 obligations that need an action, §5
 * negotiation, inspection and auction deadlines, §9 auction closes and §11 reorganization deadlines join with their
 * phases.
 */
export function upcomingDeadlines(state: GameState): DeadlineItem[] {
  return openDecisions(state)
    .filter((d) => !d.blocking)
    .map((d) => ({ ref: d.id, dueTurn: d.deadlineTurn, createdTurn: d.createdTurn, label: `Decision due: ${d.kind}` }));
}

/**
 * Parameters of the default stop rules. They are §13's presentation config (`ui.runDeadlineNoticeWeeks`,
 * `ui.runGoldMoveStopPct` in src/data/tuning/ui.ts), which the engine may not import (ui.* sits outside
 * TuningResolved, DESIGN §2.10). The UI and the simulator pass their configured values; these defaults mirror them
 * and a UI test keeps the two in step.
 */
export interface StopRuleParams {
  readonly deadlineNoticeWeeks: number;
  readonly goldMoveStopPct: number;
}

export const STOP_RULE_DEFAULTS: StopRuleParams = { deadlineNoticeWeeks: 2, goldMoveStopPct: 0.05 };

/** §13 13.9 defaults (also the simulator's pacing rules, BALANCE O-13). Blocking and critical stops are not rules. */
export function defaultStopRules(params: StopRuleParams = STOP_RULE_DEFAULTS): StopRule[] {
  return [
    { kind: 'warningKinds', muted: [] },
    { kind: 'seasonPhase', scope: 'held', enabled: true },
    { kind: 'deadlineWithin', weeks: params.deadlineNoticeWeeks, enabled: true },
    { kind: 'everyCleanup', claimIds: 'all', enabled: false },
    { kind: 'cashBelow', cents: 0 as Cents, enabled: false },
    { kind: 'machineFailure', enabled: false },
    { kind: 'listingMatch', searches: [], enabled: false },
    { kind: 'monthStart', enabled: false },
    { kind: 'goldMove', pct: params.goldMoveStopPct, enabled: false },
  ];
}

/** The anchor of a run that starts at `state` (the default when the caller supplies none). */
export function defaultRunAnchor(state: GameState): RunAnchor {
  return {
    runId: `run_t${state.clock.turn}`,
    startTurn: state.clock.turn,
    startSpotUsdPerFineOz: select.spotUsdPerFineOz(state),
    startCashCents: select.cashOnHand(state),
  };
}

function refKey(r: StopReason): string {
  if (r.ref === undefined) return `${r.kind}|${r.rule ?? ''}|${r.label}`;
  return typeof r.ref === 'string' ? r.ref : `${r.ref.kind}:${r.ref.id}`;
}

const CATEGORY_ORDER: Readonly<Record<StopReasonKind, number>> = {
  blockingDecision: 0,
  gameOver: 1,
  alert: 2,
  seasonPhase: 3,
  rule: 4,
  maxWeeks: 5,
};

function rank(r: StopReason): number {
  // Within alerts, critical (and blocking) before warning.
  const alertBump = r.kind === 'alert' && r.severity === 'warning' ? 0.5 : 0;
  return CATEGORY_ORDER[r.kind] + alertBump;
}

function mutedKinds(rules: readonly StopRule[]): readonly AlertKind[] {
  const out: AlertKind[] = [];
  for (const r of rules) if (r.kind === 'warningKinds') out.push(...r.muted);
  return out;
}

function decisionAndAlertReasons(week: WeekResult, rules: readonly StopRule[]): StopReason[] {
  const s = week.state;
  const t = s.clock.turn;
  const out: StopReason[] = [];
  for (const d of openDecisions(s)) {
    if (d.blocking && d.createdTurn === t) {
      out.push({ kind: 'blockingDecision', ref: d.id, label: `Decision needed: ${d.kind}`, severity: 'blocking' });
    }
  }
  const muted = mutedKinds(rules);
  for (const c of week.report.stopCandidates) {
    if (c.kind === 'decision') {
      out.push({ kind: 'blockingDecision', ref: c.ref, label: 'Decision needed', severity: 'blocking' });
    } else if (c.severity === 'critical' || c.severity === 'blocking') {
      out.push({ kind: 'alert', ref: c.ref, label: `Critical: ${c.kind}`, severity: c.severity });
    } else if (c.severity === 'warning' && !muted.includes(c.kind)) {
      out.push({ kind: 'alert', ref: c.ref, label: `Warning: ${c.kind}`, severity: 'warning' });
    }
  }
  return out;
}

function seasonPhaseReasons(prev: GameState, s: GameState, scope: 'held' | 'all'): StopReason[] {
  const held = select.heldDistrictIds(s);
  const districts = sortedKeys({ ...prev.clock.phase, ...s.clock.phase }) as DistrictId[];
  const out: StopReason[] = [];
  for (const d of districts) {
    const before = prev.clock.phase[d];
    const after = s.clock.phase[d];
    if (before === after || after === undefined) continue;
    if (scope === 'held' && !held.includes(d)) continue;
    out.push({
      kind: 'seasonPhase',
      rule: 'seasonPhase',
      ref: { kind: 'district', id: d },
      label: `Season phase: ${after} in ${d}`,
    });
  }
  return out;
}

function ruleReasons(prev: GameState, week: WeekResult, rule: StopRule, anchor: RunAnchor): StopReason[] {
  const s = week.state;
  const t = s.clock.turn;
  switch (rule.kind) {
    case 'warningKinds':
      return [];
    case 'seasonPhase':
      return rule.enabled ? seasonPhaseReasons(prev, s, rule.scope) : [];
    case 'deadlineWithin':
      if (!rule.enabled) return [];
      return upcomingDeadlines(s)
        .filter((i) => i.dueTurn - t <= rule.weeks && (i.dueTurn - (t - 1) > rule.weeks || i.createdTurn === t))
        .map((i): StopReason => ({ kind: 'rule', rule: 'deadlineWithin', ref: i.ref, label: i.label }));
    case 'everyCleanup': {
      if (!rule.enabled) return [];
      const out: StopReason[] = [];
      for (const claimId of sortedKeys(week.report.ops)) {
        const entry = week.report.ops[claimId];
        if (entry === undefined || entry.cleanups.length === 0) continue;
        if (rule.claimIds !== 'all' && !rule.claimIds.includes(claimId)) continue;
        const lines = entry.cleanups.map((c) => c.lineId).join(', ');
        out.push({
          kind: 'rule',
          rule: 'everyCleanup',
          ref: { kind: 'claim', id: claimId },
          label: `Cleanup on ${claimId} (${lines})`,
        });
      }
      return out;
    }
    case 'goldMove': {
      if (!rule.enabled || !(anchor.startSpotUsdPerFineOz > 0)) return [];
      const move = select.spotUsdPerFineOz(s) / anchor.startSpotUsdPerFineOz - 1;
      return Math.abs(move) >= rule.pct
        ? [{ kind: 'rule', rule: 'goldMove', label: 'Gold moved from the run start' }]
        : [];
    }
    case 'cashBelow':
      if (!rule.enabled) return [];
      return select.cashOnHand(prev) >= rule.cents && select.cashOnHand(s) < rule.cents
        ? [{ kind: 'rule', rule: 'cashBelow', label: 'Cash fell below the threshold' }]
        : [];
    case 'machineFailure':
      if (!rule.enabled) return [];
      return week.report.alerts.some((a) => a.kind === 'machine.failure')
        ? [{ kind: 'rule', rule: 'machineFailure', label: 'Machine failure' }]
        : [];
    case 'listingMatch':
      // §5 listings arrive in P1 and saved searches in P2; nothing can match before then.
      return [];
    case 'monthStart': {
      if (!rule.enabled) return [];
      const w = s.clock.week;
      return w === 1 || MONTH_END_WEEKS.includes(w - 1)
        ? [{ kind: 'rule', rule: 'monthStart', label: 'Start of month' }]
        : [];
    }
    case 'atTurn':
      return t === rule.turn ? [{ kind: 'rule', rule: 'atTurn', label: `Reached turn ${rule.turn}` }] : [];
  }
}

function gameOverReason(s: GameState): StopReason[] {
  if (s.company.runStatus === 'active') return [];
  const why = s.company.endReason ?? s.company.runStatus;
  const path = s.company.liquidationPath === null ? '' : ` (${s.company.liquidationPath})`;
  return [{ kind: 'gameOver', label: `Run ended: ${why}${path}` }];
}

/** §13 13.9 evaluateStops(prev, week, rules, anchor). */
export function evaluateStops(
  prev: GameState,
  week: WeekResult,
  rules: readonly StopRule[],
  anchor: RunAnchor,
): StopReason[] {
  const all: StopReason[] = [...decisionAndAlertReasons(week, rules), ...gameOverReason(week.state)];
  for (const rule of rules) all.push(...ruleReasons(prev, week, rule, anchor));
  const seen: Record<string, true> = {};
  const unique: StopReason[] = [];
  // Stable sort by category first, so dedupe keeps the highest-priority reason for a ref.
  const ordered = all.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i);
  for (const { r } of ordered) {
    const key = `#${refKey(r)}`;
    if (seen[key] === true) continue;
    seen[key] = true;
    unique.push(r);
  }
  return unique;
}
