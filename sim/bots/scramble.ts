// The scrambled-truth twin for the bot test and §13 T8 (DESIGN §2.12 "Visibility", §2.14 "Bots", D-2.58; S13-12,
// P1 contract §11 item 4; CLAUDE.md "Hidden information"): a bot or a screen must give identical output on a state
// whose hidden fields are scrambled, because it may read only selectors and its view. This file is the registry: each
// owner's scrambler lives in sim/bots/scramblers/s<NN>.ts (convention in scramblers/types.ts) and is listed here once.
// `scrambleHidden` applies every scrambler; `withoutHidden` strips every owner's hidden fields, so the scrambled-truth
// test can check that a state and its twin agree on everything visible and that no `hidden` block lacks a scrambler.
// `scrambleReportHidden` does the same for retained WeekReports: every calc node tagged `hidden` (and its hidden
// subtree) gets a different value, and each owner rewrites its own truth fields. The twin is only shown to bots and
// screens; the game itself advances on the true state.
import type { CalcNode, GameState, WeekReport } from '../../src/engine';
import { s01 } from './scramblers/s01';
import { s03 } from './scramblers/s03';
import { s04 } from './scramblers/s04';
import { s05 } from './scramblers/s05';
import { s07 } from './scramblers/s07';
import { s08 } from './scramblers/s08';
import { s10 } from './scramblers/s10';
import { unit, type HiddenScrambler, type ScramblerDef, type StateJson } from './scramblers/types';

export type { HiddenScrambler, ScramblerDef } from './scramblers/types';
export { scrambleWorldTruth } from './scramblers/s03';

/** Every registered scrambler, in section order (each rewrites only its owner's fields, so order cannot matter). */
export const SCRAMBLERS: readonly ScramblerDef[] = [s01, s03, s04, s05, s07, s08, s10];

/** The scrambling functions, applied in order. */
export const HIDDEN_SCRAMBLERS: readonly HiddenScrambler[] = SCRAMBLERS.map((d) => d.scramble);

export function scrambleHidden(state: GameState, seed: string): GameState {
  let s = JSON.parse(JSON.stringify(state)) as GameState;
  for (const def of SCRAMBLERS) s = def.scramble(s, seed);
  return s;
}

/**
 * The state with every hidden field the scramblers cover removed: what a player may see. The scrambled-truth test
 * compares a state and its twin through it (equal), and checks that no field named `hidden` survives it, so a new
 * hidden block cannot be added without a scrambler.
 */
export function withoutHidden(state: GameState): unknown {
  const json = JSON.parse(JSON.stringify(state)) as StateJson;
  for (const def of SCRAMBLERS) def.strip(json);
  return json;
}

/** A hidden calc node's value moved off its truth, and its whole subtree likewise (its `knownAlt` is visible). */
function scrambledCalc(node: CalcNode, seed: string, path: string, inHidden: boolean): CalcNode {
  const hidden = inHidden || node.hidden === true;
  const out: CalcNode = { ...node };
  if (hidden) out.value = node.value * (1.5 + unit(seed, 'calc', path)) + 1;
  if (node.children !== undefined) {
    out.children = node.children.map((c, i) => scrambledCalc(c, seed, `${path}/${i}`, hidden));
  }
  if (node.knownAlt !== undefined) out.knownAlt = scrambledCalc(node.knownAlt, seed, `${path}/alt`, false);
  return out;
}

/** A retained report with its truth scrambled: hidden calc nodes, then each owner's truth fields (S13-12). */
export function scrambleReportHidden(report: WeekReport, seed: string): WeekReport {
  let out: WeekReport = JSON.parse(JSON.stringify(report)) as WeekReport;
  if (out.calc !== undefined) {
    const calc: Record<string, CalcNode> = {};
    for (const key of Object.keys(out.calc).sort()) {
      calc[key] = scrambledCalc(out.calc[key] as CalcNode, seed, key, false);
    }
    out.calc = calc;
  }
  for (const def of SCRAMBLERS) if (def.scrambleReport !== undefined) out = def.scrambleReport(out, seed);
  return out;
}

/** What a player may see of a calc tree: a hidden node becomes its `knownAlt`, or is dropped (§2.8 renderer rule). */
function visibleCalc(node: CalcNode): CalcNode | null {
  if (node.hidden === true) return node.knownAlt === undefined ? null : visibleCalc(node.knownAlt);
  const out: CalcNode = { ...node };
  if (node.children !== undefined) {
    out.children = node.children.map(visibleCalc).filter((c): c is CalcNode => c !== null);
  }
  return out;
}

/** A retained report with its hidden calc nodes replaced as the renderer replaces them. */
export function withoutReportHidden(report: WeekReport): WeekReport {
  const out: WeekReport = JSON.parse(JSON.stringify(report)) as WeekReport;
  if (out.calc !== undefined) {
    const calc: Record<string, CalcNode> = {};
    for (const key of Object.keys(out.calc).sort()) {
      const v = visibleCalc(out.calc[key] as CalcNode);
      if (v !== null) calc[key] = v;
    }
    out.calc = calc;
  }
  return out;
}
