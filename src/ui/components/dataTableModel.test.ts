// DataTable's rules (DESIGN §13.2 tables, §13.17, §13.21 ui/setTableLayout): filters by column kind, global search,
// sorting with blanks last and shift-click multi-sort, the persisted layout round trip (and a damaged one), totals
// over the view, column reordering and the view's CSV.
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../format/csv';
import { nextSort } from './DataTable';
import {
  columnTotal,
  compareCells,
  defaultColumnIds,
  filterActive,
  layoutFromView,
  matchesFilter,
  matchesSearch,
  moveColumn,
  sanitizeFilter,
  sortRows,
  viewCsv,
  viewFromLayout,
  viewRows,
  type DataColumn,
} from './dataTableModel';

interface Lot {
  id: string;
  claim: string;
  status: 'held' | 'sold';
  rawOz: number | null;
  week: number;
}

const ROWS: Lot[] = [
  { id: 'lot_000003', claim: 'Caribou Fork #3', status: 'held', rawOz: 52.901, week: 20 },
  { id: 'lot_000001', claim: 'Ironwood Wash', status: 'sold', rawOz: 12.5, week: 8 },
  { id: 'lot_000002', claim: 'Bonanza Bench', status: 'held', rawOz: null, week: 14 },
  { id: 'lot_000010', claim: 'Caribou Fork #10', status: 'sold', rawOz: 100, week: 30 },
];

const COLUMNS: DataColumn<Lot>[] = [
  { id: 'id', header: 'Lot', kind: 'text', value: (r) => r.id, width: 120 },
  { id: 'claim', header: 'Claim', kind: 'text', value: (r) => r.claim },
  {
    id: 'status',
    header: 'Status',
    kind: 'enum',
    value: (r) => r.status,
    options: [
      { value: 'held', label: 'Held' },
      { value: 'sold', label: 'Sold' },
    ],
  },
  {
    id: 'rawOz',
    header: 'Raw gold (raw oz)',
    kind: 'number',
    unit: 'rawOz',
    value: (r) => r.rawOz,
    cell: (r) => String(r.rawOz),
    total: 'sum',
    totalCell: (t) => String(t),
  },
  { id: 'week', header: 'Cleanup week', kind: 'week', value: (r) => r.week, defaultVisible: false },
];

const ids = (rows: readonly Lot[]): string[] => rows.map((r) => r.id);

describe('filters (13.2: text contains, numeric range, enum multi-select, week range)', () => {
  it('treat empty values as no filter', () => {
    expect(filterActive('text', '  ')).toBe(false);
    expect(filterActive('enum', [])).toBe(false);
    expect(filterActive('number', {})).toBe(false);
    expect(filterActive('week', { from: undefined })).toBe(false);
    expect(filterActive('number', { min: 0 })).toBe(true);
  });

  it('match by kind, inclusive ranges, and drop empty cells only when filtering', () => {
    expect(matchesFilter('text', 'Caribou Fork', 'fork')).toBe(true);
    expect(matchesFilter('text', 'Ironwood', 'fork')).toBe(false);
    expect(matchesFilter('enum', 'held', ['held', 'sold'])).toBe(true);
    expect(matchesFilter('enum', 'held', ['sold'])).toBe(false);
    expect(matchesFilter('number', 12.5, { min: 12.5, max: 12.5 })).toBe(true);
    expect(matchesFilter('number', 12.5, { min: 13 })).toBe(false);
    expect(matchesFilter('week', 14, { from: 8, to: 20 })).toBe(true);
    expect(matchesFilter('week', 30, { to: 20 })).toBe(false);
    expect(matchesFilter('number', null, { min: 0 })).toBe(false);
    expect(matchesFilter('number', null, {})).toBe(true);
  });

  it('search needs every word somewhere in the row', () => {
    expect(matchesSearch(['Caribou Fork #3', 'Held'], 'caribou held')).toBe(true);
    expect(matchesSearch(['Caribou Fork #3', 'Held'], 'caribou sold')).toBe(false);
    expect(matchesSearch(['x'], '   ')).toBe(true);
  });
});

describe('sorting (13.2: header click, shift-click secondary)', () => {
  it('orders numbers, natural ids and text; blanks last either way', () => {
    expect(compareCells(2, 10)).toBeLessThan(0);
    expect(compareCells('lot_000002', 'lot_000010')).toBeLessThan(0);
    expect(compareCells('clm_2', 'clm_10')).toBeLessThan(0);
    expect(compareCells(null, 1)).toBeGreaterThan(0);
    expect(ids(sortRows(ROWS, [{ id: 'rawOz', desc: false }], COLUMNS))).toEqual([
      'lot_000001',
      'lot_000003',
      'lot_000010',
      'lot_000002',
    ]);
    expect(ids(sortRows(ROWS, [{ id: 'rawOz', desc: true }], COLUMNS))).toEqual([
      'lot_000010',
      'lot_000003',
      'lot_000001',
      'lot_000002',
    ]);
  });

  it('sorts by a second key within ties of the first, stably', () => {
    const sorted = sortRows(
      ROWS,
      [
        { id: 'status', desc: false },
        { id: 'week', desc: true },
      ],
      COLUMNS,
    );
    expect(ids(sorted)).toEqual(['lot_000003', 'lot_000002', 'lot_000010', 'lot_000001']);
  });

  it('cycles a header asc → desc → off, and shift adds a further key', () => {
    expect(nextSort([], 'a', false)).toEqual([{ id: 'a', desc: false }]);
    expect(nextSort([{ id: 'a', desc: false }], 'a', false)).toEqual([{ id: 'a', desc: true }]);
    expect(nextSort([{ id: 'a', desc: true }], 'a', false)).toEqual([]);
    expect(nextSort([{ id: 'a', desc: false }], 'b', false)).toEqual([{ id: 'b', desc: false }]);
    expect(nextSort([{ id: 'a', desc: false }], 'b', true)).toEqual([
      { id: 'a', desc: false },
      { id: 'b', desc: false },
    ]);
    expect(
      nextSort(
        [
          { id: 'a', desc: false },
          { id: 'b', desc: true },
        ],
        'b',
        true,
      ),
    ).toEqual([{ id: 'a', desc: false }]);
  });
});

describe('the view and its persisted layout (13.21 ui/setTableLayout)', () => {
  it('opens on the defaults, or on a saved layout, dropping unknown columns and malformed filters', () => {
    expect(defaultColumnIds(COLUMNS)).toEqual(['id', 'claim', 'status', 'rawOz']);
    expect(viewFromLayout(COLUMNS, undefined, [{ id: 'rawOz', desc: true }])).toEqual({
      columns: ['id', 'claim', 'status', 'rawOz'],
      sort: [{ id: 'rawOz', desc: true }],
      filters: {},
    });
    const view = viewFromLayout(COLUMNS, {
      columns: ['week', 'gone', 'claim'],
      sort: [
        { id: 'gone', desc: false },
        { id: 'week', desc: true },
      ],
      filters: [
        { id: 'status', value: ['held'] },
        { id: 'rawOz', value: 'not a range' },
        { id: 'gone', value: 'x' },
        { id: 'claim', value: '' },
      ],
    });
    expect(view).toEqual({ columns: ['week', 'claim'], sort: [{ id: 'week', desc: true }], filters: { status: ['held'] } });
  });

  it('round-trips through the layout it persists', () => {
    const view = {
      columns: ['claim', 'rawOz'],
      sort: [{ id: 'claim', desc: false }],
      filters: { rawOz: { min: 10 }, claim: 'fork' },
    };
    const layout = layoutFromView(COLUMNS, view);
    expect(layout).toEqual({
      columns: ['claim', 'rawOz'],
      sort: [{ id: 'claim', desc: false }],
      filters: [
        { id: 'claim', value: 'fork' },
        { id: 'rawOz', value: { min: 10 } },
      ],
    });
    expect(viewFromLayout(COLUMNS, layout)).toEqual(view);
  });

  it('sanitizes saved filter values by kind', () => {
    expect(sanitizeFilter('number', { min: 1, max: 'x' })).toEqual({ min: 1 });
    expect(sanitizeFilter('enum', ['a', 3])).toBeUndefined();
    expect(sanitizeFilter('week', { from: 2, to: Number.NaN })).toEqual({ from: 2 });
    expect(sanitizeFilter('text', 5)).toBeUndefined();
  });

  it('shows filtered, searched and sorted rows; search reads visible text and enum labels only', () => {
    const view = { columns: ['id', 'claim', 'status'], sort: [{ id: 'id', desc: false }], filters: {} };
    expect(ids(viewRows(ROWS, COLUMNS, view, 'caribou'))).toEqual(['lot_000003', 'lot_000010']);
    expect(ids(viewRows(ROWS, COLUMNS, view, 'sold'))).toEqual(['lot_000001', 'lot_000010']);
    // The hidden week column's values are not searched.
    expect(ids(viewRows(ROWS, COLUMNS, view, '30'))).toEqual([]);
    expect(ids(viewRows(ROWS, COLUMNS, { ...view, filters: { week: { from: 14 } } }, ''))).toEqual([
      'lot_000002',
      'lot_000003',
      'lot_000010',
    ]);
  });

  it('totals a summing column over the rows in view; moves columns within bounds', () => {
    expect(columnTotal(COLUMNS[3] as DataColumn<Lot>, ROWS)).toBeCloseTo(165.401, 9);
    expect(columnTotal(COLUMNS[1] as DataColumn<Lot>, ROWS)).toBeNull();
    expect(moveColumn(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveColumn(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveColumn(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('the view as CSV (13.17)', () => {
  it('writes the visible columns in view order with raw values, labels for enums and weeks as text', () => {
    const view = { columns: ['status', 'rawOz', 'week'], sort: [{ id: 'week', desc: false }], filters: {} };
    const rows = viewRows(ROWS, COLUMNS, view, '');
    const doc = viewCsv(COLUMNS, view, rows, { company: 'A', period: 'All', generated: 'Y1 Wk 31', rulesVersion: '0.2.0' }, (t) =>
      `Wk ${t + 1}`,
    );
    const parsed = parseCsv(toCsv(doc)).slice(4);
    expect(parsed).toEqual([
      ['Status', 'Raw gold (raw oz)', 'Cleanup week'],
      ['Sold', '12.500', 'Wk 9'],
      ['Held', '', 'Wk 15'],
      ['Held', '52.901', 'Wk 21'],
      ['Sold', '100.000', 'Wk 31'],
    ]);
  });
});
