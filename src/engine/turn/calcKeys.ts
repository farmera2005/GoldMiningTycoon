// Report calc keys (S13-6; DESIGN §13 13.13 `report` refs). Every calc tree a pipeline part writes into
// `WeekReport.calc` is keyed `<systemFolder>/<metric>/<entityId>[/<lineId>]`, e.g. `ops/directCostPerBcy/clm_000012/L1`,
// so a `report` ExplainRef names a number the same way in every system. Owners export key builders made with
// `reportCalcKey`, and the UI builds refs only through them. (P0's `finance.cashOnHand` tree predates the convention
// and keeps its key until §11 re-keys it.)

/** The engine's system folders (P1 contract §1.1), each owned by one DESIGN section. */
export const SYSTEM_FOLDERS = [
  'climate',
  'company',
  'investors',
  'history',
  'world',
  'knowledge',
  'land',
  'negotiation',
  'permits',
  'ops',
  'staff',
  'fleet',
  'gold',
  'finance',
  'events',
  'competitors',
  'inbox',
  'hardrock',
] as const;

export type SystemFolder = (typeof SYSTEM_FOLDERS)[number];

export interface ReportCalcKeyParts {
  folder: SystemFolder;
  metric: string;
  /** An entity id (`clm_000012`, `emp_owner`) or `company` for company-wide figures. */
  entityId: string;
  lineId: string | null;
}

export class CalcKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcKeyError';
  }
}

const METRIC = /^[a-z][a-zA-Z0-9]*$/;
const ENTITY = /^(company|[a-z]+_[A-Za-z0-9]+)$/;
const LINE = /^L[1-9][0-9]*$/;

function isSystemFolder(s: string): s is SystemFolder {
  return (SYSTEM_FOLDERS as readonly string[]).includes(s);
}

/** Builds a report calc key; throws CalcKeyError on a malformed part (a key is an identifier, never free text). */
export function reportCalcKey(folder: SystemFolder, metric: string, entityId: string, lineId?: string): string {
  if (!isSystemFolder(folder)) throw new CalcKeyError(`calc key: unknown system folder '${String(folder)}'`);
  if (!METRIC.test(metric)) throw new CalcKeyError(`calc key: metric '${metric}' is not camelCase`);
  if (!ENTITY.test(entityId)) throw new CalcKeyError(`calc key: '${entityId}' is not an entity id or 'company'`);
  if (lineId !== undefined && !LINE.test(lineId)) throw new CalcKeyError(`calc key: '${lineId}' is not a line id`);
  return lineId === undefined ? `${folder}/${metric}/${entityId}` : `${folder}/${metric}/${entityId}/${lineId}`;
}

/** Splits a key built by `reportCalcKey`; null for anything else (including P0's dotted legacy key). */
export function parseReportCalcKey(key: string): ReportCalcKeyParts | null {
  const parts = key.split('/');
  if (parts.length !== 3 && parts.length !== 4) return null;
  const [folder, metric, entityId, lineId] = parts as [string, string, string, string | undefined];
  if (!isSystemFolder(folder) || !METRIC.test(metric) || !ENTITY.test(entityId)) return null;
  if (lineId !== undefined && !LINE.test(lineId)) return null;
  return { folder, metric, entityId, lineId: lineId ?? null };
}
