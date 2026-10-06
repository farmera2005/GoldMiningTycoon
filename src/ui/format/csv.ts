// CSV export (DESIGN §13.17, §13.21 `ui/exportCsv`, T12). Generated in the browser: RFC 4180 quoting, UTF-8 with a
// BOM so spreadsheets open it cleanly, CRLF line ends, `#` metadata lines (company, period, the in-game week it was
// generated, rules version), one header row with units (`Net cash (USD)`), then the rows of the current view in the
// view's column order. Numbers are unformatted: dollars with 2 decimals and no separators, negatives with `-`, gold
// to 3 dp, grades to 6 dp. Money in cents is printed from the integer, so a total row equals the sum of its lines to
// the cent (T12).
import type { Unit } from '../../engine';
import { roundedParts } from './numbers';

export type CsvCell = string | number | null;

export interface CsvColumn {
  /** The column's label as the table header shows it (`Net cash`). */
  readonly header: string;
  /** How numbers in the column are written; `text` prints the cell as given. */
  readonly unit: Unit | 'text';
}

export interface CsvMeta {
  readonly company: string;
  /** The period as the screen names it (`Last 4 weeks`, `Y1 Wk 1–Y1 Wk 13`). */
  readonly period: string;
  /** The in-game week the file was generated (`Y1 Wk 29`). */
  readonly generated: string;
  readonly rulesVersion: string;
}

export interface CsvDocument {
  readonly meta: CsvMeta;
  readonly columns: readonly CsvColumn[];
  readonly rows: readonly (readonly CsvCell[])[];
}

/** RFC 4180: a field holding a comma, a double quote, CR or LF is quoted, with quotes doubled. */
export function csvField(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The unit as a CSV header suffix (`USD`, `raw oz`, `raw oz/bcy`), or null for plain text and bare numbers. */
export function csvUnitLabel(unit: Unit | 'text'): string | null {
  switch (unit) {
    case 'usd':
    case 'cents':
      return 'USD';
    case 'usdPerFineOz':
      return 'USD/fine oz';
    case 'usdPerRawOz':
    case 'usdPerOz':
      return 'USD/raw oz';
    case 'usdPerBcy':
      return 'USD/bcy';
    case 'usdPerLcy':
      return 'USD/lcy';
    case 'usdPerHour':
      return 'USD/hr';
    case 'usdPerDay':
      return 'USD/day';
    case 'usdPerWeek':
      return 'USD/wk';
    case 'usdPerMonth':
      return 'USD/mo';
    case 'usdPerYear':
      return 'USD/yr';
    case 'usdPerAcre':
      return 'USD/ac';
    case 'usdPerGal':
      return 'USD/gal';
    case 'usdPerSt':
      return 'USD/st';
    case 'oz':
    case 'rawOz':
    case 'milliOz':
      return 'raw oz';
    case 'fineOz':
      return 'fine oz';
    case 'ozPerBcy':
      return 'raw oz/bcy';
    case 'gPerM3':
      return 'g/m³';
    case 'mg':
      return 'mg';
    case 'bcy':
      return 'bcy';
    case 'lcy':
      return 'lcy';
    case 'bcyPerHour':
      return 'bcy/h';
    case 'lcyPerHour':
      return 'lcy/h';
    case 'acres':
      return 'ac';
    case 'ft':
      return 'ft';
    case 'gpm':
      return 'gpm';
    case 'acreFt':
      return 'ac-ft';
    case 'gal':
      return 'gal';
    case 'galPerHour':
      return 'gal/h';
    case 'hours':
      return 'h';
    case 'days':
      return 'days';
    case 'weeks':
      return 'weeks';
    case 'months':
      return 'months';
    case 'years':
      return 'years';
    case 'pct':
    case 'prob':
    case 'apr':
      return '%';
    case 'st':
      return 'st';
    case 'ozPerSt':
      return 'fine oz/st';
    case 'turn':
    case 'ratio':
    case 'mult':
    case 'count':
    case 'people':
    case 'score':
    case 'points':
    case 'index':
    case 'zScore':
    case 'station':
    case 'none':
    case 'text':
      return null;
  }
}

/** `Net cash (USD)`; a header whose label already carries its unit is left alone. */
export function csvHeader(column: CsvColumn): string {
  const unit = csvUnitLabel(column.unit);
  return unit === null || column.header.endsWith(`(${unit})`) ? column.header : `${column.header} (${unit})`;
}

/** `x` × 10^shift to `dp` decimals with an ASCII minus and no grouping (13.17). */
function plain(x: number, dp: number, shift = 0): string {
  const p = roundedParts(x, dp, shift);
  const body = dp > 0 ? `${p.int}.${p.frac}` : p.int;
  return p.negative ? `-${body}` : body;
}

/** Trailing zeros dropped (`12.5000` → `12.5`, `3.000` → `3`), for values with no fixed precision. */
function trim(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** A number written for CSV by its unit (13.17). */
export function csvNumber(value: number, unit: Unit | 'text'): string {
  if (!Number.isFinite(value)) return '';
  switch (unit) {
    case 'cents':
      // Integer cents print exactly: −4512300 → -45123.00.
      return plain(value, 2, -2);
    case 'usd':
    case 'usdPerFineOz':
    case 'usdPerRawOz':
    case 'usdPerOz':
    case 'usdPerBcy':
    case 'usdPerLcy':
    case 'usdPerHour':
    case 'usdPerDay':
    case 'usdPerWeek':
    case 'usdPerMonth':
    case 'usdPerYear':
    case 'usdPerAcre':
    case 'usdPerGal':
    case 'usdPerSt':
      return plain(value, 2);
    case 'oz':
    case 'rawOz':
    case 'fineOz':
    case 'ozPerSt':
      return plain(value, 3);
    case 'milliOz':
      return plain(value, 3, -3);
    case 'ozPerBcy':
      return plain(value, 6);
    case 'bcy':
    case 'lcy':
    case 'count':
    case 'people':
    case 'station':
    case 'gal':
    case 'mg':
    case 'score':
      return plain(value, 0);
    case 'pct':
    case 'prob':
    case 'apr':
      // Percent, as the screen shows it, to 4 decimals (0.78432 → 78.432).
      return trim(plain(value, 4, 2));
    case 'turn':
      return plain(value, 0);
    default:
      return trim(plain(value, 6));
  }
}

function cellText(cell: CsvCell, unit: Unit | 'text'): string {
  if (cell === null) return '';
  if (typeof cell === 'number') return unit === 'text' ? trim(plain(cell, 6)) : csvNumber(cell, unit);
  return cell;
}

export const CSV_BOM = '﻿';
const CRLF = '\r\n';

/** The whole file as text: BOM, `#` metadata lines, the header row, the rows. */
export function toCsv(doc: CsvDocument): string {
  const meta = [
    `# Company: ${doc.meta.company}`,
    `# Period: ${doc.meta.period}`,
    `# Generated: ${doc.meta.generated}`,
    `# Rules version: ${doc.meta.rulesVersion}`,
  ].map(csvField);
  const header = doc.columns.map((c) => csvField(csvHeader(c))).join(',');
  const rows = doc.rows.map((row) => doc.columns.map((c, i) => csvField(cellText(row[i] ?? null, c.unit))).join(','));
  return `${CSV_BOM}${[...meta, header, ...rows].join(CRLF)}${CRLF}`;
}

/** Lower-case ASCII words joined by hyphens (`Ruby Creek Placers, LLC` → `ruby-creek-placers-llc`). */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'game' : slug;
}

/** `gmt_{companySlug}_{reportId}_{periodLabel}.csv` (13.17). */
export function csvFileName(company: string, reportId: string, periodLabel: string): string {
  return `gmt_${slugify(company)}_${slugify(reportId)}_${slugify(periodLabel)}.csv`;
}

export interface CsvFile {
  readonly fileName: string;
  readonly mimeType: 'text/csv;charset=utf-8';
  readonly bytes: Uint8Array;
}

export type CsvExportResult =
  { readonly ok: true; readonly file: CsvFile } | { readonly ok: false; readonly code: 'EXPORT_EMPTY' };

/** `ui/exportCsv` (13.21): the file for a table or report view, or `EXPORT_EMPTY` when the view has no rows. */
export function exportCsv(doc: CsvDocument, reportId: string): CsvExportResult {
  if (doc.rows.length === 0 || doc.columns.length === 0) return { ok: false, code: 'EXPORT_EMPTY' };
  return {
    ok: true,
    file: {
      fileName: csvFileName(doc.meta.company, reportId, doc.meta.period),
      mimeType: 'text/csv;charset=utf-8',
      bytes: new TextEncoder().encode(toCsv(doc)),
    },
  };
}

/**
 * Splits CSV text into rows of fields (RFC 4180, the inverse of `toCsv` without the BOM): for tests and for reading
 * an export back.
 */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && src[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
