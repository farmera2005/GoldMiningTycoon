// The chart palette (DESIGN §13.20 "Chart palette", §13.2 series rules, D-13.57): every color a chart uses comes from
// here, and each is a CSS token reference, so a theme switch repaints every chart with no re-render. Series slots 1–8
// in fixed order; a claim keeps its slot everywhere (slot = acquisition order mod 8, 13.2) and no chart shows two series
// in one slot; past eight series a chart folds the rest into `Other`. One sequential ramp per layer (`seq-gold` for
// gold, `seq-slate` for everything else); diverging (slate below, gold above) only against a reference. Status colors
// never mark a series. Animation only when reduced motion is off and the chart has fewer than 500 points (13.18).
import { useSyncExternalStore } from 'react';
import type { Unit } from '../../engine';
import { formatValue } from '../format';
import { useUi } from '../store/store';

export const SERIES_SLOTS = 8;

/** The token of series slot `slot` (0-based, wraps at 8). */
export function seriesColor(slot: number): string {
  const n = ((Math.trunc(slot) % SERIES_SLOTS) + SERIES_SLOTS) % SERIES_SLOTS;
  return `var(--series-${n + 1})`;
}

/** 13.2: a claim's slot is the order in which it was acquired, mod 8, the same on every chart in a session. */
export function claimSlot(acquisitionOrder: number): number {
  return ((acquisitionOrder % SERIES_SLOTS) + SERIES_SLOTS) % SERIES_SLOTS;
}

export type Ramp = 'gold' | 'slate';

/** A sequential ramp step 1–7 (100–700); Lamplight flips the anchor in the tokens themselves (13.20). */
export function rampColor(ramp: Ramp, step: 1 | 2 | 3 | 4 | 5 | 6 | 7): string {
  return `var(--seq-${ramp}-${step}00)`;
}

export const CHART_COLORS = {
  /** Gridlines (decorative, 13.19). */
  grid: 'var(--hairline)',
  /** Axis baselines and the zero line. */
  axis: 'var(--axis)',
  /** Tick labels, values and legends: ink tokens, never a series color (13.20). */
  label: 'var(--ink-2)',
  ink: 'var(--ink-1)',
  muted: 'var(--ink-3)',
  surface: 'var(--surface-1)',
  /** The 2 px surface gap between adjacent fills (13.20 marks). */
  gap: 'var(--surface-1)',
  divNeg: 'var(--div-neg-2)',
  divPos: 'var(--div-pos-2)',
  divMid: 'var(--div-mid)',
} as const;

/** Marks (13.20): 2 px lines, markers ≥ 8 px, a 2 px surface gap between fills. */
export const MARKS = { lineWidth: 2, markerSize: 8, fillGap: 2 } as const;

/** Above this many points a chart never animates (13.18). */
export const MAX_ANIMATED_POINTS = 500;

function subscribeMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true;
}

/** Whether motion is reduced: `Prefs.reducedMotion` on/off, or the OS setting for `system` (13.19). */
export function useReducedMotion(): boolean {
  const pref = useUi((s) => s.prefs.reducedMotion);
  const system = useSyncExternalStore(subscribeMotion, systemReducedMotion, () => true);
  return pref === 'on' ? true : pref === 'off' ? false : system;
}

/** 13.18: animate only with reduced motion off and fewer than 500 points. */
export function shouldAnimate(reducedMotion: boolean, points: number): boolean {
  return !reducedMotion && points < MAX_ANIMATED_POINTS;
}

/** Axis tick text: money compact (13.2 "compact: KPI tiles and chart axes only"), everything else by its unit. */
export function tickText(value: number, unit: Unit): string {
  if (unit === 'cents' || unit === 'usd') return formatValue(value, unit, { money: 'compact' });
  return formatValue(value, unit);
}
