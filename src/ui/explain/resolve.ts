// Resolving an ExplainRef into what the popover and drawer render (DESIGN §13.13 "Precomputed vs on demand"):
// `live` refs call the engine's explainers on the current state, `report` refs read the retained calc weeks, `ledger`
// refs filter the postings, `history` refs read the weekly snapshot, `tuning` refs read the game's resolved tuning.
// Every tree passes through redaction before anything renders it (D-13.9).
import { baseTuning, type TuningKey, type TuningValue } from '../../data/tuning';
import {
  HISTORY_METRIC_INFO,
  explain,
  parseReportCalcKey,
  select,
  type CalcNode,
  type ExplainRef,
  type ExplainerName,
  type GameState,
  type HistoryMetric,
  type LedgerFilter,
  type Unit,
  type WeekReport,
} from '../../engine';
import { assertNever } from '../lib/assertNever';
import { gameDate, yearWeek } from '../format';
import { describeLedgerFilter, queryLedger, type LedgerQuery } from './ledger';
import { redact, type ViewNode } from './redact';

export interface ResolveContext {
  readonly state: GameState | null;
  /** Retained full reports, newest first (ui.calcRetentionWeeks). */
  readonly calcReports: readonly WeekReport[];
  /** Dev reveal: raw trees, hidden nodes included (never in production builds). */
  readonly reveal: boolean;
}

export type Resolved =
  | { readonly kind: 'tree'; readonly root: ViewNode }
  | { readonly kind: 'ledger'; readonly root: ViewNode; readonly filter: LedgerFilter; readonly query: LedgerQuery }
  | {
      readonly kind: 'tuning';
      readonly root: ViewNode;
      readonly key: string;
      readonly resolved: TuningValue | undefined;
      readonly base: TuningValue | undefined;
    }
  | { readonly kind: 'input'; readonly root: ViewNode; readonly route: string }
  /** EXPLAIN_EXPIRED (13.21): beyond retention; NO_GAME; NOT_FOUND: the ref names nothing in this game. */
  | {
      readonly kind: 'unavailable';
      readonly root: ViewNode;
      readonly reason: 'EXPLAIN_EXPIRED' | 'NO_GAME' | 'NOT_FOUND';
    };

function message(label: string, text: string): ViewNode {
  return { label, value: null, valueText: text, unit: 'none', children: [] };
}

type AnyExplainer = (state: GameState, ...args: readonly unknown[]) => CalcNode;

/** True when the engine's composed registry has an explainer of this name (a stale ref after a rename has not). */
export function isExplainer(name: string): name is ExplainerName {
  return Object.hasOwn(explain, name);
}

/**
 * The engine explainer for a `live` ref, called generically as `explain[name](state, ...args)` over the typed registry
 * (S13-5): every owner's explainer is reachable without a UI-side table. The args are the ref's, as the screen built
 * them through the owner's selectors.
 */
export function runExplainer(state: GameState, name: ExplainerName, args: readonly unknown[] = []): CalcNode {
  const fn = explain[name] as AnyExplainer;
  return fn(state, ...args);
}

/** Label and unit of a history series: §2's table (S13-8), never a copy of it. */
export function historyMetricInfo(metric: HistoryMetric): { readonly label: string; readonly unit: Unit } {
  return HISTORY_METRIC_INFO[metric];
}

/** A metric's value in the weekly history snapshot of `turn`, or null outside the kept ring. */
export function historyValue(state: GameState, metric: HistoryMetric, turn: number): number | null {
  const snap = select.weeklyHistory(state).find((s) => s.turn === turn);
  if (snap === undefined) return null;
  if (metric in snap.market) return snap.market[metric as keyof typeof snap.market];
  const company = snap.company;
  if (company === undefined) return null;
  const v = company[metric as Exclude<HistoryMetric, keyof typeof snap.market>];
  return typeof v === 'number' ? v : null;
}

/**
 * The label of an expired report: the child it pointed to, else its metric's history label when §2 keeps that series
 * (`ops/payWashedBcy/clm_…` → `Pay washed`), else the key itself.
 */
function expiredLabel(path: readonly string[]): string {
  const last = path[path.length - 1] ?? 'Explanation';
  if (path.length > 1) return last;
  const parts = parseReportCalcKey(last);
  if (parts !== null && Object.hasOwn(HISTORY_METRIC_INFO, parts.metric)) {
    return HISTORY_METRIC_INFO[parts.metric as HistoryMetric].label;
  }
  return last;
}

/** A `report` ref's node: the calc key, then child labels down the tree. */
export function reportNode(report: WeekReport, path: readonly string[]): CalcNode | null {
  const [key, ...rest] = path;
  let node = key === undefined ? undefined : report.calc?.[key];
  for (const label of rest) node = node?.children?.find((c) => c.label === label);
  return node ?? null;
}

function tuningView(key: string, value: TuningValue | undefined): ViewNode {
  const base = { label: key, unit: 'none' as const, children: [], source: { kind: 'tuning' as const, key } };
  if (typeof value === 'number') return { ...base, value };
  return { ...base, value: null, valueText: value === undefined ? 'not set' : JSON.stringify(value) };
}

/** The ledger is the record of account: its amounts stay integer cents and always show them (13.2, D-13.13). */
const LEDGER_MONEY = { unit: 'cents', fmt: { money: 'ledger' } } as const;

function ledgerView(state: GameState, filter: LedgerFilter, query: LedgerQuery): ViewNode {
  const week = (turn: number): string => {
    const v = select.dateView(state, turn);
    return yearWeek(v.year, v.week);
  };
  const children: ViewNode[] = [
    ...query.summaries.map((s) => ({
      label: s.label,
      value: s.debitCents - s.creditCents,
      ...LEDGER_MONEY,
      children: [],
      note: s.account,
    })),
    ...query.rows.map((r) => ({
      label: r.memo,
      value: r.debitCents - r.creditCents,
      ...LEDGER_MONEY,
      children: [],
      source: { kind: 'entity' as const, ref: { kind: 'ledgerTxn' as const, id: r.txnId } },
      note: `${r.account} · ${r.source} · ${week(r.turn)}`,
    })),
  ];
  return {
    label: describeLedgerFilter(state, filter),
    value: query.netCents,
    ...LEDGER_MONEY,
    op: 'sum',
    children,
    note: 'Net of the matching postings (debits less credits), exact to the cent',
  };
}

export function resolveExplain(ref: ExplainRef, ctx: ResolveContext): Resolved {
  const { state } = ctx;
  // A player input explains itself (its editor) whether or not a game is loaded.
  if (ref.kind === 'input') return { kind: 'input', route: ref.route, root: message(ref.label, 'Set by you') };
  if (state === null)
    return { kind: 'unavailable', reason: 'NO_GAME', root: message('Explanation', 'No game is loaded.') };
  switch (ref.kind) {
    case 'live': {
      if (!isExplainer(ref.explainer)) {
        return { kind: 'unavailable', reason: 'NOT_FOUND', root: message('Explanation', 'This number has no explanation.') };
      }
      let node: CalcNode;
      try {
        node = runExplainer(state, ref.explainer, ref.args);
      } catch {
        // An entity the ref names may be gone (a sold machine's old number), or its owner's explainer not built yet.
        return {
          kind: 'unavailable',
          reason: 'NOT_FOUND',
          root: message('Explanation', 'This number cannot be explained in the current game.'),
        };
      }
      return { kind: 'tree', root: redact(node, { reveal: ctx.reveal }) };
    }
    case 'report': {
      const report = ctx.calcReports.find((r) => r.turn === ref.turn);
      const node = report === undefined ? null : reportNode(report, ref.path);
      if (node === null) {
        return {
          kind: 'unavailable',
          reason: 'EXPLAIN_EXPIRED',
          root: message(
            expiredLabel(ref.path),
            `The breakdown for ${gameDate(select.dateView(state, ref.turn))} is no longer kept; the weekly history and the ledger still hold its values.`,
          ),
        };
      }
      return { kind: 'tree', root: redact(node, { reveal: ctx.reveal }) };
    }
    case 'ledger': {
      const query = queryLedger(state, ref.filter);
      return { kind: 'ledger', filter: ref.filter, query, root: ledgerView(state, ref.filter, query) };
    }
    case 'history': {
      const info = historyMetricInfo(ref.metric);
      const value = historyValue(state, ref.metric, ref.turn);
      if (value === null) {
        return {
          kind: 'unavailable',
          reason: 'EXPLAIN_EXPIRED',
          root: message(info.label, 'This week is outside the kept history.'),
        };
      }
      return {
        kind: 'tree',
        root: {
          label: info.label,
          value,
          unit: info.unit,
          children: [],
          note: `Weekly history snapshot, ${gameDate(select.dateView(state, ref.turn))}`,
        },
      };
    }
    case 'tuning': {
      const resolved = (state.meta.tuning as Readonly<Record<string, TuningValue>>)[ref.key];
      const base = (baseTuning as Readonly<Record<TuningKey, TuningValue>>)[ref.key];
      return { kind: 'tuning', key: ref.key, resolved, base, root: tuningView(ref.key, resolved) };
    }
    default:
      return assertNever(ref);
  }
}
