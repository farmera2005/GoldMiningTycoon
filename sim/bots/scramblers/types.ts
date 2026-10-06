// The scrambler convention (DESIGN §2.12 "Visibility", §2.14 "Bots", D-2.58; S13-12, P1 contract §11 item 4). Every
// section that keeps hidden fields in GameState registers one scrambler in sim/bots/scramblers/s<NN>.ts, in the same
// package that adds the field. A scrambler rewrites only its owner's hidden fields, to different values, as a pure
// function of (state, seed); `strip` deletes exactly those fields from a JSON copy, so "state and twin are equal once
// stripped" proves the scrambler touched nothing visible, and "no field named `hidden` survives the strip" proves no
// hidden block lacks a scrambler. A retained WeekReport may carry truth too (§7's in-process fields, hidden calc
// nodes); `scrambleReport` rewrites the owner's part of it.
import type { GameState, WeekReport } from '../../../src/engine';

/** A scrambler rewrites hidden fields only (never a visible one), deterministically from `seed`. */
export type HiddenScrambler = (state: GameState, seed: string) => GameState;

/** A mutable JSON copy of a state (what `strip` edits). */
export type StateJson = Record<string, unknown>;

export interface ScramblerDef {
  /** The file's name: `s<NN>` for DESIGN section NN. */
  readonly id: string;
  readonly section: number;
  /** The hidden fields it covers, in words (P0/P1 contract §0.5 lists them per owner). */
  readonly covers: readonly string[];
  readonly scramble: HiddenScrambler;
  /** Deletes the owner's hidden fields from a JSON copy of the state. */
  readonly strip: (json: StateJson) => void;
  /** Rewrites the owner's hidden fields in a retained report (beyond calc nodes tagged `hidden`). */
  readonly scrambleReport?: (report: WeekReport, seed: string) => WeekReport;
}

/** FNV-1a 32 over the key, then one mulberry32 step: a uniform in [0, 1) per (seed, key), independent of order. */
export function unit(seed: string, ...key: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const ch of [seed, ...key].join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A scrambler for a section whose hidden fields have not landed yet: it changes nothing and strips nothing. */
export function identityScrambler(id: string, section: number, covers: readonly string[]): ScramblerDef {
  return { id, section, covers, scramble: (state) => state, strip: () => undefined };
}
