import { describe, expect, it } from 'vitest';
import {
  MONTH_END_WEEKS,
  QUARTER_END_WEEKS,
  dateOf,
  daysInMonth,
  displayYear,
  doy,
  isMonthEndWeek,
  isQuarterEndWeek,
  monthOfWeek,
  quarter,
  reportingMonth,
  reportingMonthWeeks,
  turnToYearWeek,
  weekOf,
  weekRange,
  turnDate,
  weekToDateRange,
  yearWeekToTurn,
  type Month,
} from './calendar';

const MONTHS: Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('weekOf (DESIGN §1 1.3)', () => {
  it('maps the rule dates to their weeks', () => {
    expect(weekOf(9, 1)).toBe(35); // Sept 1 claim fee
    expect(weekOf(12, 30)).toBe(52);
    expect(weekOf(12, 31)).toBe(52); // week 52 absorbs Dec 31
    expect(weekOf(1, 1)).toBe(1);
    expect(weekOf(4, 1)).toBe(13);
    expect(weekOf(4, 30)).toBe(18);
    expect(weekOf(10, 31)).toBe(44);
    expect(weekOf(2, 10)).toBe(6);
    expect(weekOf(11, 30)).toBe(48);
  });

  it('matches the key calendar dates table', () => {
    const table: [Month, number, number][] = [
      [1, 15, 3],
      [4, 15, 15],
      [6, 15, 24],
      [9, 15, 37],
      [12, 3, 49],
      [12, 9, 49],
      [12, 15, 50],
    ];
    for (const [m, d, w] of table) expect(weekOf(m, d), `${m}/${d}`).toBe(w);
  });

  it('rejects impossible dates (no leap days)', () => {
    expect(() => weekOf(2, 29)).toThrow(RangeError);
    expect(() => weekOf(13 as Month, 1)).toThrow(RangeError);
    expect(() => doy(4, 31)).toThrow(RangeError);
  });
});

describe('weeks, months and quarters', () => {
  it('covers 365 days with 52 weeks, week 52 being 8 days', () => {
    expect(weekRange(1)).toEqual({ startDoy: 1, endDoy: 7 });
    expect(weekRange(51)).toEqual({ startDoy: 351, endDoy: 357 });
    expect(weekRange(52)).toEqual({ startDoy: 358, endDoy: 365 });
    expect(() => weekRange(53)).toThrow(RangeError);
    expect(() => weekRange(0)).toThrow(RangeError);
  });

  it('labels weeks with their dates (§13 T1: turn 28 → Y1 Wk 29 · Jul 16–22)', () => {
    expect(turnToYearWeek(28)).toEqual({ year: 1, week: 29 });
    expect(weekToDateRange(29)).toEqual({ start: { month: 7, day: 16 }, end: { month: 7, day: 22 } });
    expect(displayYear(1, 2027)).toBe(2027);
    // §1 worked example: turn 60 → year 2, week 9 → "Wk 9 · Feb 26–Mar 4, 2028", month-end for February
    expect(turnToYearWeek(60)).toEqual({ year: 2, week: 9 });
    expect(weekToDateRange(9)).toEqual({ start: { month: 2, day: 26 }, end: { month: 3, day: 4 } });
    expect(displayYear(2, 2027)).toBe(2028);
    expect(isMonthEndWeek(9)).toBe(true);
    // Wk 35 contains Sept 1
    expect(weekToDateRange(35)).toEqual({ start: { month: 8, day: 27 }, end: { month: 9, day: 2 } });
    expect(weekToDateRange(52)).toEqual({ start: { month: 12, day: 24 }, end: { month: 12, day: 31 } });
    expect(turnDate(28, 2027)).toEqual({
      turn: 28,
      year: 1,
      week: 29,
      displayYear: 2027,
      start: { month: 7, day: 16 },
      end: { month: 7, day: 22 },
    });
    expect(turnDate(-1, 2027)).toMatchObject({ year: 0, week: 52, displayYear: 2026 });
  });

  it('has month-end weeks equal to the week of each month’s last day', () => {
    expect(MONTH_END_WEEKS).toEqual([5, 9, 13, 18, 22, 26, 31, 35, 39, 44, 48, 52]);
    MONTHS.forEach((m, i) => expect(weekOf(m, daysInMonth(m))).toBe(MONTH_END_WEEKS[i]));
  });

  it('partitions weeks into reporting months exactly as MONTH_END_WEEKS does', () => {
    for (let w = 1; w <= 52; w++) {
      const m = reportingMonth(w);
      const { first, last } = reportingMonthWeeks(m);
      expect(w >= first && w <= last, `week ${w} in month ${m}`).toBe(true);
      expect(isMonthEndWeek(w)).toBe(w === last);
    }
    expect(reportingMonth(5)).toBe(1); // Jan 29–Feb 4 reports in January…
    expect(monthOfWeek(5)).toBe(2); // …but draws February weather
    expect(reportingMonthWeeks(1)).toEqual({ first: 1, last: 5 });
    expect(reportingMonthWeeks(12)).toEqual({ first: 49, last: 52 });
  });

  it('has quarter-end weeks 13, 26, 39, 52', () => {
    expect(QUARTER_END_WEEKS).toEqual([13, 26, 39, 52]);
    expect([1, 13, 14, 26, 27, 39, 40, 52].map(quarter)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    for (let w = 1; w <= 52; w++) expect(isQuarterEndWeek(w)).toBe(QUARTER_END_WEEKS.includes(w));
  });

  it('round-trips day of year and dates', () => {
    for (let d = 1; d <= 365; d++) {
      const { month, day } = dateOf(d);
      expect(doy(month, day)).toBe(d);
    }
    expect(() => dateOf(366)).toThrow(RangeError);
  });
});

describe('turns', () => {
  it('maps turns to year and week (turn 0 = year 1 week 1)', () => {
    expect(turnToYearWeek(0)).toEqual({ year: 1, week: 1 });
    expect(turnToYearWeek(51)).toEqual({ year: 1, week: 52 });
    expect(turnToYearWeek(52)).toEqual({ year: 2, week: 1 });
    expect(turnToYearWeek(-1)).toEqual({ year: 0, week: 52 }); // §10 pre-history
    expect(turnToYearWeek(-156)).toEqual({ year: -2, week: 1 });
    expect(() => turnToYearWeek(1.5)).toThrow(RangeError);
  });

  it('round-trips turn ↔ (year, week), negative turns included', () => {
    for (let t = -400; t <= 600; t++) {
      const { year, week } = turnToYearWeek(t);
      expect(week >= 1 && week <= 52).toBe(true);
      expect(yearWeekToTurn(year, week)).toBe(t);
    }
  });
});
