// Shapes and DESIGN-stated ranges per tuning key, composed from one file per namespace (P1 contract §0.3: each
// namespace's schema file belongs to the package that owns the namespace after P1 Wave 0). Every object- or array-valued
// key must appear here (its shape is checked); scalar keys take the naming rules in `scalarRule` and may add a stricter
// schema in their namespace file.
import { z } from 'zod';
import { nonNeg, nonNegInt, pos, prob } from '../common';
import { FLEET_TUNING_KEY_SCHEMAS } from '../equipment';
import { EVENTS_TUNING_SCHEMAS } from './events';
import { FINANCE_TUNING_SCHEMAS } from './finance';
import { GAME_TUNING_SCHEMAS } from './game';
import { GEOLOGY_TUNING_SCHEMAS } from './geology';
import { LAND_TUNING_SCHEMAS } from './land';
import { MARKET_TUNING_SCHEMAS } from './market';
import { OPS_TUNING_SCHEMAS } from './ops';
import { PERMITS_TUNING_SCHEMAS } from './permits';
import { STAFF_TUNING_SCHEMAS } from './staff';

export { BACKGROUNDS } from './staff';
export { STARTS, WEATHER_TEMPLATES } from './game';

/** The per-namespace tables, in src/data/tuning's namespace order (ai.* and hardrock.* have no keys yet). */
export const TUNING_SCHEMAS_BY_NAMESPACE: Readonly<Record<string, Readonly<Record<string, z.ZodType>>>> = {
  game: GAME_TUNING_SCHEMAS,
  geology: GEOLOGY_TUNING_SCHEMAS,
  ops: OPS_TUNING_SCHEMAS,
  fleet: FLEET_TUNING_KEY_SCHEMAS, // §9 9.15, with the catalog schemas in tests/data/schemas/equipment.ts
  staff: STAFF_TUNING_SCHEMAS,
  land: LAND_TUNING_SCHEMAS,
  permits: PERMITS_TUNING_SCHEMAS,
  market: MARKET_TUNING_SCHEMAS,
  finance: FINANCE_TUNING_SCHEMAS,
  events: EVENTS_TUNING_SCHEMAS,
};

/** Every namespace's shapes in one flat table (a key appears in exactly one namespace file). */
export const TUNING_KEY_SCHEMAS: Readonly<Record<string, z.ZodType>> = Object.assign(
  {},
  ...Object.values(TUNING_SCHEMAS_BY_NAMESPACE),
) as Readonly<Record<string, z.ZodType>>;

/**
 * Naming rules for scalar keys (CLAUDE.md "Names carry units"; DESIGN's tables): probabilities, shares and fractions
 * lie in [0, 1]; multipliers are positive; money, spreads and counts of weeks are non-negative.
 */
export function scalarRule(key: string): z.ZodType {
  const last = key.slice(key.lastIndexOf('.') + 1);
  if (/(P|Prob|Share|Frac)$/.test(last)) return prob;
  if (/Mult$/.test(last)) return pos;
  if (/(Usd|UsdPer[A-Za-z]+)$/.test(last)) return nonNeg;
  if (/(Sd|LogSd|Sigma|Cv)$/.test(last)) return nonNeg;
  if (/(Weeks|Wk)$/.test(last)) return nonNegInt;
  return z.union([z.number(), z.boolean(), z.string()]);
}
