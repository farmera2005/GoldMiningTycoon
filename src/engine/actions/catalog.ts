// Registers every engine action type (DESIGN §2.2; P1 contract §1.1): §2's `decision/answer` and every folder's
// actions.ts rows (s02 #11). Owners add rows only in their own folder; this file only composes. §13 test T24 checks
// that every action a screen dispatches is registered under its owner's name.
import { CLIMATE_ACTIONS } from '../systems/climate/actions';
import { COMPANY_ACTIONS } from '../systems/company/actions';
import { COMPETITORS_ACTIONS } from '../systems/competitors/actions';
import { EVENTS_ACTIONS } from '../systems/events/actions';
import { FINANCE_ACTIONS } from '../systems/finance/actions';
import { FLEET_ACTIONS } from '../systems/fleet/actions';
import { GOLD_ACTIONS } from '../systems/gold/actions';
import { HISTORY_ACTIONS } from '../systems/history/actions';
import { INBOX_ACTIONS } from '../systems/inbox/actions';
import { INVESTORS_ACTIONS } from '../systems/investors/actions';
import { KNOWLEDGE_ACTIONS } from '../systems/knowledge/actions';
import { LAND_ACTIONS } from '../systems/land/actions';
import { OPS_ACTIONS } from '../systems/ops/actions';
import { PERMITS_ACTIONS } from '../systems/permits/actions';
import { STAFF_ACTIONS } from '../systems/staff/actions';
import { WORLD_ACTIONS } from '../systems/world/actions';
import { sortedKeysByCodeUnit } from '../core/iter';
import { decisionAnswerDef } from './handlers/decision';
import { ActionRegistryError, getActionDef, registerAction } from './registry';
import type { ActionDef } from './types';

/** Every source of rows, by folder ('framework' = §2's own). */
export const ACTION_SOURCES: Readonly<Record<string, readonly ActionDef[]>> = {
  framework: [decisionAnswerDef as unknown as ActionDef],
  climate: CLIMATE_ACTIONS,
  company: COMPANY_ACTIONS,
  investors: INVESTORS_ACTIONS,
  history: HISTORY_ACTIONS,
  world: WORLD_ACTIONS,
  knowledge: KNOWLEDGE_ACTIONS,
  land: LAND_ACTIONS,
  permits: PERMITS_ACTIONS,
  ops: OPS_ACTIONS,
  staff: STAFF_ACTIONS,
  fleet: FLEET_ACTIONS,
  gold: GOLD_ACTIONS,
  finance: FINANCE_ACTIONS,
  events: EVENTS_ACTIONS,
  competitors: COMPETITORS_ACTIONS,
  inbox: INBOX_ACTIONS,
};

const SOURCE_ROWS: readonly ActionDef[] = sortedKeysByCodeUnit(ACTION_SOURCES).flatMap(
  (source) => ACTION_SOURCES[source] ?? [],
);

/** The engine's action types, sorted (documentation and tests; the registry is keyed by type). */
export const ENGINE_ACTION_TYPES: readonly string[] = SOURCE_ROWS.map((r) => r.type).sort();

// A re-evaluated module (hot reload, a duplicated test import) finds its own rows already registered and skips them;
// a type registered by two different rows (two folders, or a test row shadowing an engine row) throws.
for (const def of SOURCE_ROWS) {
  const existing = getActionDef(def.type);
  if (existing === undefined) registerAction(def);
  else if (existing !== def) throw new ActionRegistryError(`action type '${def.type}' is registered by two rows`);
}
