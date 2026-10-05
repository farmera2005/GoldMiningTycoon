// Base tuning: every namespace merged into one flat, dotted-key table (DESIGN §2.10).
// Each namespace file owns its keys; a data test checks prefixes and that no key appears in two files.
import { gameTuning } from './game';
import { geologyTuning } from './geology';
import { opsTuning } from './ops';
import { fleetTuning } from './fleet';
import { staffTuning } from './staff';
import { landTuning } from './land';
import { permitsTuning } from './permits';
import { marketTuning } from './market';
import { financeTuning } from './finance';
import { eventsTuning } from './events';
import { aiTuning } from './ai';
import { hardrockTuning } from './hardrock';
import type { TuningTable, TuningValue } from './types';

export const tuningNamespaces = {
  game: gameTuning,
  geology: geologyTuning,
  ops: opsTuning,
  fleet: fleetTuning,
  staff: staffTuning,
  land: landTuning,
  permits: permitsTuning,
  market: marketTuning,
  finance: financeTuning,
  events: eventsTuning,
  ai: aiTuning,
  hardrock: hardrockTuning,
} as const;

export const baseTuning = {
  ...gameTuning,
  ...geologyTuning,
  ...opsTuning,
  ...fleetTuning,
  ...staffTuning,
  ...landTuning,
  ...permitsTuning,
  ...marketTuning,
  ...financeTuning,
  ...eventsTuning,
  ...aiTuning,
  ...hardrockTuning,
} as const satisfies TuningTable;

export type TuningKey = keyof typeof baseTuning;
/** Resolved tuning for one game: base → difficulty → scenario → overrides (resolved once at newGame). */
export type TuningResolved = { readonly [K in TuningKey]: TuningValue };
export type { TuningScalar, TuningTable, TuningValue } from './types';
