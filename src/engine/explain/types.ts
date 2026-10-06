// Explain references (DESIGN §13 13.13 `ExplainRef`). Every displayed number carries one; the engine's explainers
// (`explain.<name>(state, ...args)`) answer the `live` kind on demand.
import type { TuningKey } from '../../data/tuning';
import type { LedgerFilter } from '../systems/finance/types';
import type { HistoryMetric } from '../systems/history/types';
import type { explain } from './index';

/** Names of the engine's on-demand explainers: the keys of the composed registry (S13-5). */
export type ExplainerName = keyof typeof explain;

export type ExplainRef =
  | { kind: 'live'; explainer: ExplainerName; args: readonly unknown[] }
  | { kind: 'report'; turn: number; path: readonly string[] }
  | { kind: 'ledger'; filter: LedgerFilter }
  | { kind: 'history'; metric: HistoryMetric; turn: number }
  | { kind: 'tuning'; key: TuningKey }
  | { kind: 'input'; label: string; route: string };
