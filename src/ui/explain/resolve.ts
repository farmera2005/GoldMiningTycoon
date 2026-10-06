// Resolving an ExplainRef into what the popover and drawer render (DESIGN §13.13 "Precomputed vs on demand"):
// `live` refs call the engine's explainers on the current state, `report` refs read the retained calc weeks, `ledger`
// refs filter the postings, `history` refs read the weekly snapshot, `tuning` refs read the game's resolved tuning.
// Every tree passes through redaction before anything renders it (D-13.9).
import { baseTuning, type TuningKey, type TuningValue } from '../../data/tuning';
import {
  explain,
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

/** The engine explainer for a `live` ref. P0's explainers take only the state (netWorth is always 'scoring'). */
export function runExplainer(state: GameState, name: ExplainerName): CalcNode {
  switch (name) {
    case 'cash':
      return explain.cash(state);
    case 'netWorth':
      return explain.netWorth(state);
    default:
      return assertNever(name);
  }
}

const HISTORY_METRICS: Readonly<Record<HistoryMetric, { readonly label: string; readonly unit: Unit }>> = {
  spot: { label: 'Gold spot', unit: 'usdPerFineOz' },
  goldIdx: { label: 'Gold index', unit: 'index' },
  cpiIndex: { label: 'Consumer price index', unit: 'index' },
  cpiYoY: { label: 'Inflation, year on year', unit: 'pct' },
  baseRate: { label: 'Base interest rate', unit: 'apr' },
  realRate: { label: 'Real interest rate', unit: 'apr' },
  usdIdx: { label: 'US dollar index', unit: 'index' },
  cbPublished: { label: 'Central-bank gold buying', unit: 'index' },
  geoRisk: { label: 'Geopolitical risk', unit: 'index' },
  eqSentiment: { label: 'Equity sentiment', unit: 'index' },
  dieselRack: { label: 'Diesel rack price', unit: 'usdPerGal' },
  cashCents: { label: 'Cash on hand at week end', unit: 'cents' },
  ownerNwCents: { label: 'Owner net worth at week end', unit: 'cents' },
  companyNwCents: { label: 'Company net worth at week end', unit: 'cents' },
  payWashedBcy: { label: 'Pay washed', unit: 'bcy' },
  weighedRawOz: { label: 'Raw gold weighed', unit: 'rawOz' },
  soldFineOz: { label: 'Fine gold sold', unit: 'fineOz' },
};

export function historyMetricInfo(metric: HistoryMetric): { readonly label: string; readonly unit: Unit } {
  return HISTORY_METRICS[metric];
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

/** A `report` ref's node: the calc key, then child labels down the tree. */
function reportNode(report: WeekReport, path: readonly string[]): CalcNode | null {
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

function ledgerView(state: GameState, filter: LedgerFilter, query: LedgerQuery): ViewNode {
  const week = (turn: number): string => {
    const v = select.dateView(state, turn);
    return yearWeek(v.year, v.week);
  };
  const children: ViewNode[] = [
    ...query.summaries.map((s) => ({
      label: s.label,
      value: (s.debitCents - s.creditCents) / 100,
      unit: 'usd' as const,
      children: [],
      note: s.account,
    })),
    ...query.rows.map((r) => ({
      label: r.memo,
      value: (r.debitCents - r.creditCents) / 100,
      unit: 'usd' as const,
      children: [],
      source: { kind: 'entity' as const, ref: { kind: 'ledgerTxn' as const, id: r.txnId } },
      note: `${r.account} · ${r.source} · ${week(r.turn)}`,
    })),
  ];
  return {
    label: describeLedgerFilter(state, filter),
    value: query.netCents / 100,
    unit: 'usd',
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
    case 'live':
      return { kind: 'tree', root: redact(runExplainer(state, ref.explainer), { reveal: ctx.reveal }) };
    case 'report': {
      const report = ctx.calcReports.find((r) => r.turn === ref.turn);
      const node = report === undefined ? null : reportNode(report, ref.path);
      if (node === null) {
        return {
          kind: 'unavailable',
          reason: 'EXPLAIN_EXPIRED',
          root: message(
            ref.path[ref.path.length - 1] ?? 'Explanation',
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
