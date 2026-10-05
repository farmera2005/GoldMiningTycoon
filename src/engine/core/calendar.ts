// The fixed game calendar (DESIGN §1 1.3, §2.4). 52 weeks and 365 days, no leap days. Week w covers day-of-year
// 7(w−1)+1 … 7w, and week 52 also absorbs Dec 31. Turn 0 is year 1 week 1; negative turns (§10's pre-history) map to
// year 0, −1, … the same way. Rules dated D are due in weekOf(D) (Sept 1 → 35, Dec 30/31 → 52).

export const WEEKS_PER_YEAR = 52;
export const DAYS_PER_YEAR = 365;

/** A calendar month, 1 = January … 12 = December. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface MonthDay {
  readonly month: Month;
  readonly day: number;
}

export interface YearWeek {
  readonly year: number;
  /** 1..52 */
  readonly week: number;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
/** Days before each month (cumDays in §1 1.3). */
const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const;

/** The week containing each month's last day: §11's month-end cadence and §13's periods (§1 1.3). */
export const MONTH_END_WEEKS: readonly number[] = [5, 9, 13, 18, 22, 26, 31, 35, 39, 44, 48, 52];

/** Quarter-end weeks (13, 26, 39, 52). */
export const QUARTER_END_WEEKS: readonly number[] = [13, 26, 39, 52];

function assertMonth(month: number): asserts month is Month {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`calendar: bad month ${month}`);
}

function assertWeek(week: number): void {
  if (!Number.isInteger(week) || week < 1 || week > WEEKS_PER_YEAR) throw new RangeError(`calendar: bad week ${week}`);
}

export function daysInMonth(month: Month): number {
  assertMonth(month);
  return MONTH_DAYS[month - 1] as number;
}

/** Day of year, 1..365. */
export function doy(month: Month, day: number): number {
  assertMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > (MONTH_DAYS[month - 1] as number)) {
    throw new RangeError(`calendar: bad day ${month}/${day}`);
  }
  return (CUM_DAYS[month - 1] as number) + day;
}

/** The calendar date of a day of year 1..365. */
export function dateOf(dayOfYear: number): MonthDay {
  if (!Number.isInteger(dayOfYear) || dayOfYear < 1 || dayOfYear > DAYS_PER_YEAR) {
    throw new RangeError(`calendar: bad day of year ${dayOfYear}`);
  }
  let m = 12;
  while ((CUM_DAYS[m - 1] as number) >= dayOfYear) m--;
  return { month: m as Month, day: dayOfYear - (CUM_DAYS[m - 1] as number) };
}

/** The game week (1..52) containing a calendar date; week 52 absorbs Dec 31. */
export function weekOf(month: Month, day: number): number {
  return Math.min(WEEKS_PER_YEAR, Math.floor((doy(month, day) - 1) / 7) + 1);
}

/** First and last day of year of a week: [7(w−1)+1, w < 52 ? 7w : 365]. */
export function weekRange(week: number): { readonly startDoy: number; readonly endDoy: number } {
  assertWeek(week);
  return { startDoy: 7 * (week - 1) + 1, endDoy: week < WEEKS_PER_YEAR ? 7 * week : DAYS_PER_YEAR };
}

/** Calendar dates of a week, for labels such as "Wk 29 · Jul 16–22" (§13 formats them; the year comes from displayYear). */
export function weekToDateRange(week: number): { readonly start: MonthDay; readonly end: MonthDay } {
  const r = weekRange(week);
  return { start: dateOf(r.startDoy), end: dateOf(r.endDoy) };
}

/** Month containing the week's first day: §11 reporting periods and §13 reports. Partitions weeks as MONTH_END_WEEKS does. */
export function reportingMonth(week: number): Month {
  assertWeek(week);
  return dateOf(7 * (week - 1) + 1).month;
}

/** Month containing the week's middle day (day 4). CLIMATOLOGY ONLY (§1 1.5); everything else uses reportingMonth. */
export function monthOfWeek(week: number): Month {
  assertWeek(week);
  return dateOf(7 * (week - 1) + 4).month;
}

/** First and last week of a reporting month (the weeks w with reportingMonth(w) = month). */
export function reportingMonthWeeks(month: Month): { readonly first: number; readonly last: number } {
  assertMonth(month);
  return {
    first: month === 1 ? 1 : (MONTH_END_WEEKS[month - 2] as number) + 1,
    last: MONTH_END_WEEKS[month - 1] as number,
  };
}

export function isMonthEndWeek(week: number): boolean {
  assertWeek(week);
  return MONTH_END_WEEKS.includes(week);
}

/** Quarter 1..4: ceil(w / 13). */
export function quarter(week: number): 1 | 2 | 3 | 4 {
  assertWeek(week);
  return Math.ceil(week / 13) as 1 | 2 | 3 | 4;
}

export function isQuarterEndWeek(week: number): boolean {
  assertWeek(week);
  return week % 13 === 0;
}

/** turn → {year, week}: year = floor(turn/52) + 1, week = (turn mod 52) + 1. Negative turns give year ≤ 0. */
export function turnToYearWeek(turn: number): YearWeek {
  if (!Number.isSafeInteger(turn)) throw new RangeError(`calendar: turn must be an integer, got ${turn}`);
  const yearIndex = Math.floor(turn / WEEKS_PER_YEAR);
  return { year: yearIndex + 1, week: turn - yearIndex * WEEKS_PER_YEAR + 1 };
}

export function yearWeekToTurn(year: number, week: number): number {
  if (!Number.isSafeInteger(year)) throw new RangeError(`calendar: year must be an integer, got ${year}`);
  assertWeek(week);
  return (year - 1) * WEEKS_PER_YEAR + (week - 1);
}

/** Calendar year shown for game year `year`: startCalendarYear + year − 1 (`game.startCalendarYear`, default 2027). */
export function displayYear(year: number, startCalendarYear: number): number {
  return startCalendarYear + year - 1;
}

/** Everything a week label needs, e.g. turn 28 → Y1 Wk 29 · Jul 16–22, 2027 (§13 13.2 formats it). */
export interface TurnDate {
  readonly turn: number;
  readonly year: number;
  readonly week: number;
  readonly displayYear: number;
  readonly start: MonthDay;
  readonly end: MonthDay;
}

/** §1's weekToDateRange(year, week) with its display year, keyed by turn. */
export function turnDate(turn: number, startCalendarYear: number): TurnDate {
  const { year, week } = turnToYearWeek(turn);
  const { start, end } = weekToDateRange(week);
  return { turn, year, week, displayYear: displayYear(year, startCalendarYear), start, end };
}
