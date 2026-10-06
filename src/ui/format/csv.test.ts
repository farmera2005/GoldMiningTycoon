// T12 CSV (DESIGN §13.27 T12, §13.17): RFC 4180 quoting of commas, quotes and newlines in memos; statement totals
// equal the sum of their lines to the cent; no thousands separators; unformatted numbers by unit; the file name,
// BOM, metadata and header rows; EXPORT_EMPTY.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  csvField,
  csvFileName,
  csvHeader,
  csvNumber,
  exportCsv,
  parseCsv,
  slugify,
  toCsv,
  type CsvDocument,
} from './csv';

const META = {
  company: 'Ruby Creek Placers, LLC',
  period: 'Last 4 weeks',
  generated: 'Y1 Wk 29',
  rulesVersion: '0.2.0',
};

describe('RFC 4180 quoting', () => {
  it.each([
    ['plain', 'plain'],
    ['fuel, camp', '"fuel, camp"'],
    ['the "big" truck', '"the ""big"" truck"'],
    ['line one\nline two', '"line one\nline two"'],
    ['cr\r\nlf', '"cr\r\nlf"'],
    ['', ''],
  ])('%j → %j', (input, out) => {
    expect(csvField(input)).toBe(out);
  });

  it('round-trips any memo through quoting and parsing', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 5 }), (fields) => {
        const line = fields.map(csvField).join(',');
        expect(parseCsv(`${line}\r\n`)).toEqual([fields]);
      }),
    );
  });
});

describe('numbers (13.17: unformatted, 2 dp dollars, 3 dp gold, 6 dp grades, `-` negatives)', () => {
  it.each([
    [123_456_789, 'cents', '1234567.89'],
    [-4_512_300, 'cents', '-45123.00'],
    [5, 'cents', '0.05'],
    [-0.4, 'cents', '0.00'],
    [1234567.891, 'usd', '1234567.89'],
    [-45123, 'usd', '-45123.00'],
    [13.6, 'usdPerBcy', '13.60'],
    [52.9014, 'rawOz', '52.901'],
    [1234.5, 'fineOz', '1234.500'],
    [46_553, 'milliOz', '46.553'],
    [0.009512, 'ozPerBcy', '0.009512'],
    [6435.4, 'bcy', '6435'],
    [0.78432, 'pct', '78.432'],
    [0.0875, 'apr', '8.75'],
    [12, 'count', '12'],
    [1.13, 'ratio', '1.13'],
    [Number.NaN, 'usd', ''],
  ] as const)('%d %s → %s', (value, unit, out) => {
    expect(csvNumber(value, unit)).toBe(out);
  });

  it('never prints a thousands separator or a typographic minus', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), (cents) => {
        const text = csvNumber(cents, 'cents');
        expect(text).toMatch(/^-?\d+\.\d{2}$/);
        expect(Number(text)).toBeCloseTo(cents / 100, 6);
      }),
    );
  });
});

describe('the file (13.17)', () => {
  const doc: CsvDocument = {
    meta: META,
    columns: [
      { header: 'Week', unit: 'text' },
      { header: 'Memo', unit: 'text' },
      { header: 'Net cash', unit: 'cents' },
      { header: 'Gold sold', unit: 'fineOz' },
    ],
    rows: [
      ['Y1 Wk 28', 'Fuel, camp and "extras"', -1_234_567, null],
      ['Y1 Wk 29', 'Gold sale\nlocal buyer', 22_000_000, 52.9014],
    ],
  };

  it('starts with a BOM and # metadata, then the header with units, then the rows, CRLF line ends', () => {
    const text = toCsv(doc);
    expect(text.startsWith(CSV_BOM)).toBe(true);
    const lines = text.slice(1).split('\r\n');
    expect(lines.slice(0, 5)).toEqual([
      '"# Company: Ruby Creek Placers, LLC"',
      '# Period: Last 4 weeks',
      '# Generated: Y1 Wk 29',
      '# Rules version: 0.2.0',
      'Week,Memo,Net cash (USD),Gold sold (fine oz)',
    ]);
    expect(parseCsv(text).slice(5)).toEqual([
      ['Y1 Wk 28', 'Fuel, camp and "extras"', '-12345.67', ''],
      ['Y1 Wk 29', 'Gold sale\nlocal buyer', '220000.00', '52.901'],
    ]);
  });

  it('IS export totals equal statement totals to the cent (T12)', () => {
    const lines = [12_345_67, -987_65, 4_000_000_01, -3, 15];
    const total = lines.reduce((a, b) => a + b, 0);
    const statement: CsvDocument = {
      meta: META,
      columns: [
        { header: 'Line', unit: 'text' },
        { header: 'Amount', unit: 'cents' },
      ],
      rows: [...lines.map((c, i): [string, number] => [`Line ${i + 1}`, c]), ['Total', total]],
    };
    const parsed = parseCsv(toCsv(statement)).slice(5);
    const cents = (s: string): number => Math.round(Number(s) * 100);
    const sumOfLines = parsed.slice(0, -1).reduce((a, r) => a + cents(r[1] ?? ''), 0);
    expect(cents(parsed[parsed.length - 1]?.[1] ?? '')).toBe(sumOfLines);
    expect(sumOfLines).toBe(total);
  });

  it('names the file gmt_{companySlug}_{reportId}_{periodLabel}.csv and refuses an empty view', () => {
    expect(csvFileName('Ruby Creek Placers, LLC', 'is', 'Last 4 weeks')).toBe(
      'gmt_ruby-creek-placers-llc_is_last-4-weeks.csv',
    );
    expect(slugify('Ña Mining Co.')).toBe('na-mining-co');
    expect(slugify('!!!')).toBe('game');
    const ok = exportCsv(doc, 'ledger');
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.file.fileName).toBe('gmt_ruby-creek-placers-llc_ledger_last-4-weeks.csv');
      expect([...ok.file.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      expect(ok.file.mimeType).toBe('text/csv;charset=utf-8');
    }
    expect(exportCsv({ ...doc, rows: [] }, 'ledger')).toEqual({ ok: false, code: 'EXPORT_EMPTY' });
  });

  it('labels units in the header once', () => {
    expect(csvHeader({ header: 'Net cash', unit: 'cents' })).toBe('Net cash (USD)');
    expect(csvHeader({ header: 'Net cash (USD)', unit: 'usd' })).toBe('Net cash (USD)');
    expect(csvHeader({ header: 'Grade', unit: 'ozPerBcy' })).toBe('Grade (raw oz/bcy)');
    expect(csvHeader({ header: 'Count', unit: 'count' })).toBe('Count');
  });
});
