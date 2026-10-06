// Report periods (DESIGN §13.11 Reports: This week, Last 4 weeks, MTD, Quarter, Season-to-date per district, YTD,
// Last year, Custom; D-13.18). Months are §1's reporting months: the week containing a month's last day starts in that
// month (§1 1.3), so a week belongs to the month its first day is in, read from the engine's `select.dateView`; quarters
// are 13-week blocks. A period resolves to an inclusive turn range the reports pass to §11's selectors.
import type { DateView } from '../../engine';
import { yearWeek } from '../format';

export type PeriodKind = 'week' | 'last4' | 'mtd' | 'quarter' | 'season' | 'ytd' | 'lastYear' | 'custom';

export interface PeriodSpec {
  readonly kind: PeriodKind;
  /** `custom` only. */
  readonly fromTurn?: number;
  readonly toTurn?: number;
}

export interface PeriodRange {
  readonly fromTurn: number;
  readonly toTurn: number;
  /** `Y1 Wk 1–Y1 Wk 13`, or one week's `Y1 Wk 7`. */
  readonly label: string;
}

export const PERIOD_OPTIONS: readonly { readonly kind: PeriodKind; readonly label: string }[] = [
  { kind: 'week', label: 'This week' },
  { kind: 'last4', label: 'Last 4 weeks' },
  { kind: 'mtd', label: 'Month to date' },
  { kind: 'quarter', label: 'Quarter to date' },
  { kind: 'season', label: 'Season to date' },
  { kind: 'ytd', label: 'Year to date' },
  { kind: 'lastYear', label: 'Last year' },
  { kind: 'custom', label: 'Custom' },
];

const WEEKS_PER_YEAR = 52;
const QUARTER_WEEKS = 13;

export interface PeriodContext {
  /** The current turn. */
  readonly now: number;
  readonly dateView: (turn: number) => Pick<DateView, 'year' | 'week' | 'start'>;
  /** Season-to-date's first turn (§1 the district's operating start this year); absent → no season period. */
  readonly seasonStartTurn?: number;
}

function range(fromTurn: number, toTurn: number, ctx: PeriodContext): PeriodRange {
  const a = ctx.dateView(fromTurn);
  const b = ctx.dateView(toTurn);
  const label =
    fromTurn === toTurn ? yearWeek(a.year, a.week) : `${yearWeek(a.year, a.week)}–${yearWeek(b.year, b.week)}`;
  return { fromTurn, toTurn, label };
}

/** The turn range of a period, or null when it does not exist yet (last year in year 1, no season, a bad custom). */
export function resolvePeriod(spec: PeriodSpec, ctx: PeriodContext): PeriodRange | null {
  const { now } = ctx;
  const view = ctx.dateView(now);
  const yearStart = now - (view.week - 1);
  switch (spec.kind) {
    case 'week':
      return range(now, now, ctx);
    case 'last4':
      return range(Math.max(0, now - 3), now, ctx);
    case 'mtd': {
      let from = now;
      while (from > yearStart && ctx.dateView(from - 1).start.month === view.start.month) from -= 1;
      return range(from, now, ctx);
    }
    case 'quarter':
      return range(yearStart + Math.floor((view.week - 1) / QUARTER_WEEKS) * QUARTER_WEEKS, now, ctx);
    case 'season':
      return ctx.seasonStartTurn === undefined || ctx.seasonStartTurn > now
        ? null
        : range(ctx.seasonStartTurn, now, ctx);
    case 'ytd':
      return range(yearStart, now, ctx);
    case 'lastYear':
      return yearStart === 0 ? null : range(yearStart - WEEKS_PER_YEAR, yearStart - 1, ctx);
    case 'custom': {
      const { fromTurn, toTurn } = spec;
      if (fromTurn === undefined || toTurn === undefined) return null;
      if (!Number.isSafeInteger(fromTurn) || !Number.isSafeInteger(toTurn)) return null;
      if (fromTurn < 0 || toTurn > now || fromTurn > toTurn) return null;
      return range(fromTurn, toTurn, ctx);
    }
  }
}
