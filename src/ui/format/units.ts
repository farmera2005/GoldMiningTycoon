// Volumes, percentages, rates, hours, area, water, scores and counts (DESIGN §13.2). Decimal places come from
// ui.fmt.* where 13.25 names a key.
import { uiConfig } from '../../data/tuning/ui';
import { fixed } from './numbers';

interface SignOpt {
  readonly plus?: boolean;
}

/** Bank cubic yards as integers: `6,435 bcy`. */
export function bcy(x: number, o: SignOpt = {}): string {
  return `${fixed(x, 0, o)} bcy`;
}

/** Loose cubic yards (haul detail only), labelled: `7,722 lcy`. */
export function lcy(x: number, o: SignOpt = {}): string {
  return `${fixed(x, 0, o)} lcy`;
}

/** A decimal fraction as a percentage to ui.fmt.pctDecimals: 0.78432 → `78.4%`. */
export function pct(fraction: number, o: SignOpt = {}): string {
  return `${fixed(fraction * 100, uiConfig['ui.fmt.pctDecimals'], o)}%`;
}

/** A change in a rate, in percentage points, always signed: 0.005 → `+0.5 pp`. */
export function pp(deltaFraction: number): string {
  return `${fixed(deltaFraction * 100, uiConfig['ui.fmt.pctDecimals'], { plus: true })} pp`;
}

/** Interest rates and APRs to ui.fmt.rateDecimals (D-13.16): 0.0875 → `8.75%`. */
export function rate(fraction: number, o: SignOpt = {}): string {
  return `${fixed(fraction * 100, uiConfig['ui.fmt.rateDecimals'], o)}%`;
}

/** A machine hour meter, integer: `12,430 h`. */
export function hoursMeter(h: number): string {
  return `${fixed(h, 0)} h`;
}

/** Weekly hours, 1 dp: `71.5 h`. */
export function hoursWeekly(h: number, o: SignOpt = {}): string {
  return `${fixed(h, 1, o)} h`;
}

/** Acres, 1 dp: `4.2 ac`. */
export function acres(a: number): string {
  return `${fixed(a, 1)} ac`;
}

/** Gallons per minute, integer: `680 gpm`. */
export function gpm(x: number): string {
  return `${fixed(x, 0)} gpm`;
}

/** Scores are integers with their scale: `62/100`, `714 (300-850)`. */
export function score(x: number, scale: string = '/100'): string {
  return scale.startsWith('/') ? `${fixed(x, 0)}${scale}` : `${fixed(x, 0)} ${scale}`;
}

/** A plain count with grouping: `1,234`. */
export function count(n: number, o: SignOpt = {}): string {
  return fixed(n, 0, o);
}

/** Storage size for the Saves table: one decimal below 10 kB (`8.4 kB`), whole kB above (`312 kB`). */
export function kilobytes(bytes: number): string {
  const kb = bytes / 1000;
  return `${fixed(kb, kb < 10 ? 1 : 0)} kB`;
}
