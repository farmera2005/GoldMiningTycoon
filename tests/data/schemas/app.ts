// Application data outside the engine's tuning: balance seeds, `ui.*` configuration and the UI text table.
import { z } from 'zod';
import { nonNegInt, keyed } from './common';

/** src/data/balance/seeds.json (BALANCE §6.2): one fixed base per rules phase, p0…p6, each a safe integer. */
export const seedsSchema = keyed(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'], nonNegInt.max(Number.MAX_SAFE_INTEGER));

/** src/data/tuning/ui.ts (DESIGN §13.25): app configuration, `ui.*` keys only, with the units its names carry. */
export const uiConfigSchema = z
  .record(z.string().regex(/^ui\.[A-Za-z0-9.]+$/), z.union([z.number(), z.boolean(), z.string()]))
  .superRefine((cfg, ctx) => {
    const bad = (k: string, message: string) =>
      ctx.addIssue({ code: 'custom', message: `${k}: ${message}`, path: [k] });
    for (const [k, v] of Object.entries(cfg)) {
      if (typeof v !== 'number') continue;
      const last = k.slice(k.lastIndexOf('.') + 1);
      if (/(Pct|Frac|Opacity[A-Za-z]*)$/.test(last) && (v < 0 || v > 1)) bad(k, 'must lie in [0, 1]');
      if (/(Px|Weeks|Kb|Slots|Keep|Entries|Children|Depth|InMemory|Threshold|Decimals[A-Za-z0-9]*)$/.test(last)) {
        if (!Number.isInteger(v) || v < 0) bad(k, 'must be a non-negative integer');
      }
      if (/(Ms|Usd|Ratio[0-9]|Step|PerGPerM3)$/.test(last) && !(v > 0)) bad(k, 'must be positive');
    }
    if (!['system', 'daylight', 'lamplight'].includes(String(cfg['ui.theme.default']))) {
      bad('ui.theme.default', 'must be system, daylight or lamplight');
    }
  });

/** src/data/text/ui.ts (DESIGN §13.19): `group.CODE` keys to non-empty English strings. */
// Keys are dotted camelCase families (`setup.NAME_EMPTY`, `quickSave.failed`), as CLAUDE.md names alert kinds and tuning keys.
export const uiTextSchema = z.record(z.string().regex(/^[a-z][A-Za-z]*\.[A-Za-z_]+$/), z.string().min(1));
