// Explainers (DESIGN §2.8; S13-5, P1 contract §1.1): pure (state, ...args) → CalcNode trees for numbers that are
// functions of current state. The UI calls them on demand for `live` ExplainRefs, generically as
// `explain[name](state, ...args)`; dice-dependent numbers are explained from the WeekReport instead. `explain` spreads
// every folder's explain.ts, and a test fails when two folders define the same name. After Wave 0 owners edit only
// their own folder's explain.ts, never this file.
import { climateExplainers } from '../systems/climate/explain';
import { companyExplainers } from '../systems/company/explain';
import { competitorsExplainers } from '../systems/competitors/explain';
import { eventsExplainers } from '../systems/events/explain';
import { financeExplainers } from '../systems/finance/explain';
import { fleetExplainers } from '../systems/fleet/explain';
import { goldExplainers } from '../systems/gold/explain';
import { historyExplainers } from '../systems/history/explain';
import { inboxExplainers } from '../systems/inbox/explain';
import { investorsExplainers } from '../systems/investors/explain';
import { knowledgeExplainers } from '../systems/knowledge/explain';
import { landExplainers } from '../systems/land/explain';
import { opsExplainers } from '../systems/ops/explain';
import { permitsExplainers } from '../systems/permits/explain';
import { staffExplainers } from '../systems/staff/explain';
import { worldExplainers } from '../systems/world/explain';

/** Every source of explainers, by folder; the composition test checks names are disjoint. */
export const EXPLAINER_SOURCES = {
  climate: climateExplainers,
  company: companyExplainers,
  investors: investorsExplainers,
  history: historyExplainers,
  world: worldExplainers,
  knowledge: knowledgeExplainers,
  land: landExplainers,
  permits: permitsExplainers,
  ops: opsExplainers,
  staff: staffExplainers,
  fleet: fleetExplainers,
  gold: goldExplainers,
  finance: financeExplainers,
  events: eventsExplainers,
  competitors: competitorsExplainers,
  inbox: inboxExplainers,
} as const;

export const explain = {
  ...climateExplainers,
  ...companyExplainers,
  ...investorsExplainers,
  ...historyExplainers,
  ...worldExplainers,
  ...knowledgeExplainers,
  ...landExplainers,
  ...permitsExplainers,
  ...opsExplainers,
  ...staffExplainers,
  ...fleetExplainers,
  ...goldExplainers,
  ...financeExplainers,
  ...eventsExplainers,
  ...competitorsExplainers,
  ...inboxExplainers,
} as const;

export type Explainers = typeof explain;
export type { ExplainerName, ExplainRef } from './types';
