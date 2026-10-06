// ui/format (DESIGN §13.2, CLAUDE.md "Formatting lives only in ui/format"): every number the UI shows is formatted
// here, from its value and its §2.8 Unit. Locale is fixed to en-US (D-13.12): nothing in this folder calls Intl or
// toLocaleString, so the browser locale cannot change a digit.
import type { DateView, Unit } from '../../engine';
import { assertNever } from '../lib/assertNever';
import { yearWeek } from './dates';
import { gold } from './gold';
import { grade, gramsPerM3 } from './grade';
import { goldPrice, unitCost, usd, usdFromCents, type MoneyStyle } from './money';
import { fixed, trimmed } from './numbers';
import { bcy, count, hoursMeter, hoursWeekly, lcy, pct, pp, rate, score } from './units';

export { MINUS, fixed, groupDigits, roundHalfAway, trimmed } from './numbers';
export { dollarsToCents, goldPrice, unitCost, usd, usdFromCents, type MoneyOptions, type MoneyStyle } from './money';
export { gold, type OzKind } from './gold';
export { grade, gradeMetric, gradeWithMetric, gramsPerM3 } from './grade';
export { acres, bcy, count, gpm, hoursMeter, hoursWeekly, kilobytes, lcy, pct, pp, rate, score } from './units';
export { dayRange, gameDate, monthAbbr, wallClock, weekShort, yearWeek } from './dates';

/** Per-number formatting options (§13.13 `NumProps.fmt`). */
export interface FmtOptions {
  /** Money style (13.2); default `general`. */
  readonly money?: MoneyStyle;
  /** A change rather than a level: positive values take `+`, and a `pct` change is shown in percentage points. */
  readonly delta?: boolean;
  /** `hours` as a machine meter (integer) or weekly hours (1 dp, the default). */
  readonly hours?: 'weekly' | 'meter';
  /** A score's scale (`/100` default, or a range such as `(300-850)`). */
  readonly scale?: string;
}

function plural(x: number, one: string, many: string): string {
  const text = trimmed(x, 1);
  return `${text} ${text === '1' ? one : many}`;
}

/** What formatting may need from the game: the engine's calendar for `turn` values. */
export interface FormatContext {
  readonly dateView?: (turn: number) => Pick<DateView, 'year' | 'week'>;
}

/** Formats a value by its Unit (13.2). `usd` values are float dollars; `cents` values are integer cents. */
export function formatValue(value: number, unit: Unit, fmt: FmtOptions = {}, ctx: FormatContext = {}): string {
  const plus = fmt.delta === true;
  const money = { style: fmt.money ?? 'general', plus } as const;
  switch (unit) {
    case 'usd':
      return usd(value, money);
    case 'cents':
      return usdFromCents(value, money);
    case 'usdPerFineOz':
      return goldPrice(value, 'fine');
    case 'usdPerRawOz':
    case 'usdPerOz':
      return goldPrice(value, 'raw');
    case 'usdPerBcy':
      return unitCost(value, '/bcy', { plus });
    case 'usdPerLcy':
      return unitCost(value, '/lcy', { plus });
    case 'usdPerHour':
      return unitCost(value, '/hr', { plus });
    case 'usdPerDay':
      return unitCost(value, '/day', { plus });
    case 'usdPerWeek':
      return unitCost(value, '/wk', { plus });
    case 'usdPerMonth':
      return unitCost(value, '/mo', { plus });
    case 'usdPerYear':
      return unitCost(value, '/yr', { plus });
    case 'usdPerAcre':
      return unitCost(value, '/ac', { plus });
    case 'usdPerGal':
      return unitCost(value, '/gal', { plus });
    case 'usdPerSt':
      return unitCost(value, '/st', { plus });
    case 'oz':
    case 'rawOz':
      return gold(value, 'raw', { plus });
    case 'fineOz':
      return gold(value, 'fine', { plus });
    case 'milliOz':
      return gold(value / 1000, 'raw', { plus });
    case 'ozPerBcy':
      return grade(value);
    case 'gPerM3':
      return gramsPerM3(value);
    case 'mg':
      return `${fixed(value, 0, { plus })} mg`;
    case 'bcy':
      return bcy(value, { plus });
    case 'lcy':
      return lcy(value, { plus });
    case 'bcyPerHour':
      return `${fixed(value, 0, { plus })} bcy/h`;
    case 'lcyPerHour':
      return `${fixed(value, 0, { plus })} lcy/h`;
    case 'acres':
      return `${fixed(value, 1, { plus })} ac`;
    case 'ft':
      return `${fixed(value, 1, { plus })} ft`;
    case 'gpm':
      return `${fixed(value, 0, { plus })} gpm`;
    case 'acreFt':
      return `${fixed(value, 1, { plus })} ac-ft`;
    case 'gal':
      return `${fixed(value, 0, { plus })} gal`;
    case 'galPerHour':
      return `${fixed(value, 1, { plus })} gal/h`;
    case 'hours':
      return fmt.hours === 'meter' ? hoursMeter(value) : hoursWeekly(value, { plus });
    case 'days':
      return plural(value, 'day', 'days');
    case 'weeks':
      return plural(value, 'week', 'weeks');
    case 'months':
      return plural(value, 'month', 'months');
    case 'years':
      return plural(value, 'year', 'years');
    case 'turn': {
      // The calendar is the engine's (select.dateView); without it a turn is shown as its index.
      const view = ctx.dateView?.(value);
      return view === undefined ? `turn ${fixed(value, 0)}` : yearWeek(view.year, view.week);
    }
    case 'pct':
    case 'prob':
      return plus ? pp(value) : pct(value);
    case 'apr':
      return rate(value, { plus });
    case 'ratio':
      return fixed(value, 2, { plus });
    case 'mult':
      return `×${fixed(value, 2)}`;
    case 'count':
    case 'people':
    case 'station':
      return count(value, { plus });
    case 'score':
      return score(value, fmt.scale);
    case 'points':
      return `${fixed(value, 1, { plus })} pts`;
    case 'index':
      return fixed(value, 1, { plus });
    case 'zScore':
      return fixed(value, 2, { plus: true });
    case 'st':
      return `${fixed(value, 1, { plus })} st`;
    case 'ozPerSt':
      return `${fixed(value, 3)} fine oz/st`;
    case 'none':
      return trimmed(value, 4);
    default:
      return assertNever(unit);
  }
}
