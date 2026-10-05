// Explanation trees (DESIGN §2.8): every displayed number can be re-derived as a CalcNode tree. Formula functions
// return { value, calc } and build calc only when the explain flag is on, so the simulator (explain off) pays nothing
// and the flag never changes state (state hashes with explain on and off are identical, §2.14).
import type { EntityRef } from './ids';
import type { KeyPart } from './rng';
import type { StreamName } from './streams';

/**
 * Units a CalcNode (and §13's <Num>) can carry. Ounce units say which kind they are (§2.4): `oz` is metal oz (grades,
 * estimates, box, losses), `rawOz` weighed raw, `fineOz` fine. `pct` values are decimals 0..1 that the UI shows as
 * percentages; `apr` is an annual rate as a decimal.
 */
export type Unit =
  // money
  | 'usd'
  | 'cents'
  | 'usdPerFineOz'
  | 'usdPerRawOz'
  | 'usdPerOz'
  | 'usdPerBcy'
  | 'usdPerLcy'
  | 'usdPerHour'
  | 'usdPerDay'
  | 'usdPerWeek'
  | 'usdPerMonth'
  | 'usdPerYear'
  | 'usdPerAcre'
  | 'usdPerGal'
  | 'usdPerSt'
  // gold
  | 'oz'
  | 'rawOz'
  | 'fineOz'
  | 'milliOz'
  | 'ozPerBcy'
  | 'gPerM3'
  | 'mg'
  // material, land, water, fuel
  | 'bcy'
  | 'lcy'
  | 'bcyPerHour'
  | 'lcyPerHour'
  | 'acres'
  | 'ft'
  | 'gpm'
  | 'acreFt'
  | 'gal'
  | 'galPerHour'
  // time
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'
  | 'turn'
  // dimensionless
  | 'pct'
  | 'apr'
  | 'ratio'
  | 'mult'
  | 'prob'
  | 'count'
  | 'people'
  | 'score'
  | 'points'
  | 'index'
  | 'zScore'
  // hard rock (§14)
  | 'st'
  | 'ozPerSt'
  | 'station'
  | 'none';

export type CalcOp = 'sum' | 'product' | 'min' | 'max' | 'ratio' | 'lookup' | 'draw' | 'clamp';

export type CalcSource =
  | { kind: 'tuning'; key: string }
  | { kind: 'entity'; ref: EntityRef }
  | { kind: 'rng'; stream: StreamName; key: KeyPart[] };

export interface CalcNode {
  label: string; // "Recovery rate"
  value: number;
  unit: Unit;
  op?: CalcOp;
  children?: CalcNode[];
  source?: CalcSource;
  note?: string; // "Plant fed at 118% of rated capacity: fine-gold penalty applies"
  /** Built from a hidden field (true grade, true health, true honesty …); the renderer shows knownAlt instead. */
  hidden?: true;
  /** The same quantity from player knowledge (e.g. contained gold = bcy × the player's P50 grade). */
  knownAlt?: CalcNode;
  /** 'draw' nodes only: every parameter of the distribution is visible, so a percentile may be shown. */
  publicParams?: true;
}

/** A formula result: the value, plus its explanation when the explain flag is on. */
export interface Calc<T = number> {
  value: T;
  calc?: CalcNode;
}

/** Carries the explain flag into formula functions. */
export interface ExplainCtx {
  readonly on: boolean;
}

export const EXPLAIN_OFF: ExplainCtx = { on: false };
export const EXPLAIN_ON: ExplainCtx = { on: true };

/** Optional CalcNode fields a builder may set. */
export interface CalcExtras {
  source?: CalcSource;
  note?: string;
  hidden?: true;
  knownAlt?: CalcNode | undefined;
  publicParams?: true;
}

function applyExtras(n: CalcNode, extras: CalcExtras | undefined): CalcNode {
  if (extras === undefined) return n;
  if (extras.source !== undefined) n.source = extras.source;
  if (extras.note !== undefined) n.note = extras.note;
  if (extras.hidden === true) n.hidden = true;
  if (extras.knownAlt !== undefined) n.knownAlt = extras.knownAlt;
  if (extras.publicParams === true) n.publicParams = true;
  return n;
}

/** A leaf node, or undefined when explanations are off. */
export function leaf(
  ctx: ExplainCtx,
  label: string,
  value: number,
  unit: Unit,
  extras?: CalcExtras,
): CalcNode | undefined {
  if (!ctx.on) return undefined;
  return applyExtras({ label, value, unit }, extras);
}

/** An interior node over its children (undefined children are dropped), or undefined when explanations are off. */
export function node(
  ctx: ExplainCtx,
  label: string,
  op: CalcOp,
  unit: Unit,
  value: number,
  children: readonly (CalcNode | undefined)[],
  extras?: CalcExtras,
): CalcNode | undefined {
  if (!ctx.on) return undefined;
  const kept: CalcNode[] = [];
  for (const c of children) if (c !== undefined) kept.push(c);
  const n: CalcNode = { label, value, unit, op };
  if (kept.length > 0) n.children = kept;
  return applyExtras(n, extras);
}

/** Builds a node only when explanations are on; use when assembling the tree itself costs work. */
export function lazyCalc(ctx: ExplainCtx, build: () => CalcNode): CalcNode | undefined {
  return ctx.on ? build() : undefined;
}

/** A leaf citing a tuning key (§2.8: tuning constants link to their key). */
export function tuningLeaf(
  ctx: ExplainCtx,
  key: string,
  value: number,
  unit: Unit,
  label: string = key,
): CalcNode | undefined {
  return leaf(ctx, label, value, unit, { source: { kind: 'tuning', key } });
}

/** A leaf citing an entity. */
export function entityLeaf(
  ctx: ExplainCtx,
  ref: EntityRef,
  label: string,
  value: number,
  unit: Unit,
): CalcNode | undefined {
  return leaf(ctx, label, value, unit, { source: { kind: 'entity', ref } });
}

/** A 'draw' node citing its RNG stream and key; publicParams when every parameter of the distribution is visible. */
export function drawNode(
  ctx: ExplainCtx,
  label: string,
  value: number,
  unit: Unit,
  stream: StreamName,
  key: readonly KeyPart[],
  children: readonly (CalcNode | undefined)[] = [],
  publicParams = false,
): CalcNode | undefined {
  const extras: CalcExtras = { source: { kind: 'rng', stream, key: [...key] } };
  if (publicParams) extras.publicParams = true;
  return node(ctx, label, 'draw', unit, value, children, extras);
}

/** Tags a node built from a hidden field (§2.8): the renderer shows `knownAlt`, or "Not observable" without one. */
export function markHidden(n: CalcNode | undefined, knownAlt?: CalcNode): CalcNode | undefined {
  if (n === undefined) return undefined;
  n.hidden = true;
  if (knownAlt !== undefined) n.knownAlt = knownAlt;
  return n;
}

/** Packs a value and an optional explanation into a Calc (omits `calc` when undefined: exactOptionalPropertyTypes). */
export function calcResult<T>(value: T, calc: CalcNode | undefined): Calc<T> {
  return calc === undefined ? { value } : { value, calc };
}
