// T1 Formatting (DESIGN §13.27 T1, §13.2): the 13.2 table as a table-driven test, the date labels from the engine's
// own calendar, and identical output when the default locale is de-DE or ar (D-13.12).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultNewGameSetup, newGame, select, type DateView } from '../../engine';
import {
  bcy,
  dayRange,
  formatValue,
  gameDate,
  gold,
  gradeMetric,
  gradeWithMetric,
  hoursMeter,
  hoursWeekly,
  kilobytes,
  pct,
  pp,
  rate,
  usd,
  usdFromCents,
  wallClock,
  weekShort,
  yearWeek,
} from '.';
import { fixed, groupDigits, roundHalfAway, trimmed } from './numbers';

vi.setConfig({ testTimeout: 60_000 });

const view = (turn: number, year: number, week: number, start: [number, number], end: [number, number]): DateView =>
  ({
    turn,
    year,
    week,
    displayYear: 2026 + year,
    start: { month: start[0], day: start[1] },
    end: { month: end[0], day: end[1] },
  }) as DateView;

/** [input description, actual, expected] rows of T1 (13.27) and the 13.2 example column. */
function t1Rows(): [string, string, string][] {
  return [
    ['123456789¢', usdFromCents(123_456_789), '$1,234,568'],
    ['99950¢', usdFromCents(99_950), '$999.50'],
    ['−4512300¢ general', usdFromCents(-4_512_300), '−$45,123'],
    ['−4512300¢ statement', usdFromCents(-4_512_300, { style: 'statement' }), '($45,123)'],
    ['−4512300¢ ledger', usdFromCents(-4_512_300, { style: 'ledger' }), '−$45,123.00'],
    ['4512307¢ ledger', usdFromCents(4_512_307, { style: 'ledger' }), '$45,123.07'],
    ['$1,234,567 compact', usd(1_234_567, { style: 'compact' }), '$1.23M'],
    ['$99,999 compact', usd(99_999, { style: 'compact' }), '$99,999'],
    ['$412,300 compact', usd(412_300, { style: 'compact' }), '$412k'],
    ['52.9014 raw', gold(52.9014, 'raw'), '52.901 raw oz'],
    ['1234.5 fine', gold(1234.5, 'fine'), '1,234.50 fine oz'],
    ['0.009512 grade', gradeWithMetric(0.009512), '0.0095 oz/bcy (0.39 g/m³)'],
    ['6435.4 bcy', bcy(6435.4), '6,435 bcy'],
    ['0.78432 pct', pct(0.78432), '78.4%'],
    ['0.005 pp', pp(0.005), '+0.5 pp'],
    ['0.0875 rate', rate(0.0875), '8.75%'],
    ['13.6 $/bcy', formatValue(13.6, 'usdPerBcy'), '$13.60/bcy'],
    ['212.4 $/hr', formatValue(212.4, 'usdPerHour'), '$212.40/hr'],
    ['4200 $/fine oz', formatValue(4200, 'usdPerFineOz'), '$4,200/fine oz'],
    ['12430 h meter', hoursMeter(12_430), '12,430 h'],
    ['71.5 h weekly', hoursWeekly(71.5), '71.5 h'],
    ['4.2 ac', formatValue(4.2, 'acres'), '4.2 ac'],
    ['680 gpm', formatValue(680, 'gpm'), '680 gpm'],
    ['62 score', formatValue(62, 'score'), '62/100'],
    ['turn 28', gameDate(view(28, 1, 29, [7, 16], [7, 22])), 'Y1 Wk 29 · Jul 16–22, 2027'],
    ['Wk 22 tooltip', weekShort(view(21, 1, 22, [5, 28], [6, 3])), 'Wk 22 · May 28–Jun 3'],
  ];
}

describe('T1: the 13.2 table', () => {
  it.each(t1Rows())('%s → %s', (_input, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe('money rules (13.2, D-13.13)', () => {
  it.each([
    [0, '$0.00'],
    [-1, '−$0.01'],
    [99_999, '$999.99'],
    [100_000, '$1,000'],
    [100_049, '$1,000'],
    [100_050, '$1,001'],
    [-150, '−$1.50'],
    [-123_456_750, '−$1,234,568'],
  ])('general %i¢ → %s', (cents, text) => {
    expect(usdFromCents(cents)).toBe(text);
  });

  it('hides cents on the rounded value, so $999.996 shows as $1,000', () => {
    expect(usd(999.996)).toBe('$1,000');
    expect(usd(999.994)).toBe('$999.99');
  });

  it('rounds dollars to cents half away from zero, as the engine posts them', () => {
    expect(usd(0.125)).toBe('$0.13');
    expect(usd(-0.125)).toBe('−$0.13');
    expect(usd(-0.004)).toBe('$0.00');
  });

  it('writes statements in whole dollars with parentheses and the ledger in exact cents', () => {
    expect(usdFromCents(4_512_349, { style: 'statement' })).toBe('$45,123');
    expect(usdFromCents(-49, { style: 'statement' })).toBe('$0');
    expect(usdFromCents(0, { style: 'ledger' })).toBe('$0.00');
    expect(usdFromCents(123_456_789, { style: 'ledger' })).toBe('$1,234,567.89');
  });

  it('keeps three significant digits in compact form and rolls over at the k/M boundary', () => {
    expect(usd(100_000, { style: 'compact' })).toBe('$100k');
    expect(usd(999_600, { style: 'compact' })).toBe('$1.00M');
    expect(usd(12_345_678, { style: 'compact' })).toBe('$12.3M');
    expect(usd(-1_234_567, { style: 'compact' })).toBe('−$1.23M');
    expect(usd(1_200_000, { style: 'compact' })).toBe('$1.20M');
  });

  it('signs deltas: + on gains, a true minus on losses, nothing on zero', () => {
    expect(formatValue(46_900, 'usd', { delta: true })).toBe('+$46,900');
    expect(formatValue(-46_900, 'usd', { delta: true })).toBe('−$46,900');
    expect(formatValue(0, 'cents', { delta: true })).toBe('$0.00');
    expect(formatValue(-0.5, 'usdPerBcy')).toBe('−$0.50/bcy');
  });
});

describe('gold, grade, volume and rates', () => {
  it('switches from 3 to 2 dp at 100 oz on the rounded value and always says raw or fine', () => {
    expect(gold(99.9994, 'raw')).toBe('99.999 raw oz');
    expect(gold(99.9996, 'raw')).toBe('100.00 raw oz');
    expect(gold(0.001, 'fine')).toBe('0.001 fine oz');
    expect(formatValue(52.901, 'oz')).toBe('52.901 raw oz');
    expect(formatValue(46_553, 'milliOz')).toBe('46.553 raw oz');
  });

  it('converts grade with ui.fmt.ozPerYd3PerGPerM3 (0.012 oz/bcy = 0.49 g/m³)', () => {
    expect(gradeMetric(0.012)).toBe('0.49 g/m³');
    expect(formatValue(0.012, 'ozPerBcy')).toBe('0.0120 oz/bcy');
  });

  it('formats the other 13.2 units', () => {
    expect(formatValue(0.0875, 'apr')).toBe('8.75%');
    expect(formatValue(0.005, 'pct', { delta: true })).toBe('+0.5 pp');
    expect(formatValue(12_430, 'hours', { hours: 'meter' })).toBe('12,430 h');
    expect(formatValue(1.22, 'ratio')).toBe('1.22');
    expect(formatValue(0.92, 'mult')).toBe('×0.92');
    expect(formatValue(714, 'score', { scale: '(300-850)' })).toBe('714 (300-850)');
    expect(formatValue(1, 'weeks')).toBe('1 week');
    expect(formatValue(3, 'weeks')).toBe('3 weeks');
    expect(formatValue(0.92, 'none')).toBe('0.92');
    expect(formatValue(28, 'turn')).toBe('turn 28');
    expect(formatValue(28, 'turn', {}, { dateView: () => ({ year: 1, week: 29 }) })).toBe('Y1 Wk 29');
  });

  it('formats save sizes', () => {
    expect(kilobytes(8_400)).toBe('8.4 kB');
    expect(kilobytes(312_400)).toBe('312 kB');
  });
});

describe('number primitives', () => {
  it('rounds half away from zero on the binary value', () => {
    expect([2.5, -2.5, 0.49999999999999994, -0.5, 1.4999].map(roundHalfAway)).toEqual([3, -3, 0, -1, 1]);
    expect(Object.is(roundHalfAway(-0.2), 0)).toBe(true);
  });

  it('groups digits in threes and never prints a negative zero', () => {
    expect(['1', '12', '123', '1234', '1234567'].map(groupDigits)).toEqual(['1', '12', '123', '1,234', '1,234,567']);
    expect(fixed(-0.0004, 3)).toBe('0.000');
    expect(fixed(-1234.5, 2)).toBe('−1,234.50');
    expect(fixed(5, 1, { plus: true })).toBe('+5.0');
    expect(trimmed(3, 4)).toBe('3');
    expect(trimmed(0.125, 2)).toBe('0.13');
  });

  it('stays exact for amounts beyond 2^53 cents scaling', () => {
    expect(fixed(1e17, 2)).toBe('100,000,000,000,000,000.00');
  });
});

describe('dates from the engine calendar (§1 1.3)', () => {
  const state = newGame(defaultNewGameSetup({ companyName: 'Format Test' }), 'format-test');

  it('labels turn 28 as Y1 Wk 29 · Jul 16–22, 2027', () => {
    expect(gameDate(select.dateView(state, 28))).toBe('Y1 Wk 29 · Jul 16–22, 2027');
  });

  it('puts Sept 1 in week 35 (Aug 27–Sep 2)', () => {
    expect(dayRange(select.dateView(state, 34))).toBe('Aug 27–Sep 2');
  });

  it('ends week 52 on Dec 31 and spells the year out across a year boundary', () => {
    expect(gameDate(select.dateView(state, 51))).toBe('Y1 Wk 52 · Dec 24–31, 2027');
    const next = select.dateView(state, 52);
    expect(weekShort(next, select.dateView(state, 51))).toBe('Y2 Wk 1 · Jan 1–7, 2028');
    expect(yearWeek(next.year, next.week)).toBe('Y2 Wk 1');
  });
});

describe('locale independence (D-13.12)', () => {
  const realNumberFormat = Intl.NumberFormat;
  const realDateTimeFormat = Intl.DateTimeFormat;
  const realNumToLocale = Number.prototype.toLocaleString;
  const realDateToLocale = Date.prototype.toLocaleString;

  /** Makes every locale-sensitive API default to `locale`, as a browser set to that language would. */
  function stubDefaultLocale(locale: string): void {
    const nf = function (locales?: string | string[], options?: Intl.NumberFormatOptions) {
      return new realNumberFormat(locales ?? locale, options);
    } as unknown as typeof Intl.NumberFormat;
    const df = function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      return new realDateTimeFormat(locales ?? locale, options);
    } as unknown as typeof Intl.DateTimeFormat;
    Intl.NumberFormat = nf;
    Intl.DateTimeFormat = df;
    Number.prototype.toLocaleString = function (this: number, locales?: string | string[], o?: object) {
      return realNumToLocale.call(this, locales ?? locale, o);
    };
    Date.prototype.toLocaleString = function (this: Date, locales?: string | string[], o?: object) {
      return realDateToLocale.call(this, locales ?? locale, o);
    };
  }

  afterEach(() => {
    Intl.NumberFormat = realNumberFormat;
    Intl.DateTimeFormat = realDateTimeFormat;
    Number.prototype.toLocaleString = realNumToLocale;
    Date.prototype.toLocaleString = realDateToLocale;
  });

  const savedAt = new Date(2026, 9, 6, 15, 4).toISOString();
  const sample = (): string[] => [...t1Rows().map((r) => r[1]), wallClock(savedAt), kilobytes(8_400)];

  it.each(['de-DE', 'ar'])('gives identical output under a %s default locale', (locale) => {
    const enUs = sample();
    stubDefaultLocale(locale);
    // The stub is live: an implementation that relied on the default locale would now get this one.
    expect(new Intl.NumberFormat().resolvedOptions().locale).toBe(locale);
    if (locale === 'de-DE') expect((1234.5).toLocaleString()).toBe('1.234,5');
    expect(sample()).toEqual(enUs);
    expect(wallClock(savedAt)).toBe('Oct 6, 2026, 3:04 PM');
  });
});
