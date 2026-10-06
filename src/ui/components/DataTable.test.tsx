// DataTable in the DOM (DESIGN §13.2 tables, §13.17, §13.19, T13's virtualization part): sorting by header (shift for a
// second key), the filter row and search, the column chooser and its persisted layout, virtualization with
// aria-rowcount / aria-rowindex (20,000 rows render ≤ 60 DOM rows), keyboard rows (j / k, Enter, Space), bulk
// selection, totals, Export CSV and EXPORT_EMPTY.
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithStore } from '../testing/render';
import { freshState } from '../testing/harness';
import { parseCsv } from '../format/csv';
import { DataTable, type DataColumn } from './DataTable';
import { Button } from './primitives';

vi.setConfig({ testTimeout: 60_000 });

interface Lot {
  id: string;
  claim: string;
  status: 'held' | 'sold';
  rawOz: number;
  week: number;
}

const LOTS: Lot[] = [
  { id: 'lot_000003', claim: 'Caribou Fork #3', status: 'held', rawOz: 52.901, week: 20 },
  { id: 'lot_000001', claim: 'Ironwood Wash', status: 'sold', rawOz: 12.5, week: 8 },
  { id: 'lot_000002', claim: 'Bonanza Bench', status: 'held', rawOz: 7.25, week: 14 },
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
    cell: (r) => <span data-cell="rawOz">{r.rawOz}</span>,
    total: 'sum',
    totalCell: (t) => <span data-total="">{t.toFixed(3)}</span>,
  },
  { id: 'week', header: 'Cleanup week', kind: 'week', value: (r) => r.week },
];

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function bodyIds(): string[] {
  return [...document.querySelectorAll('tbody tr[data-row-id]')].map((tr) => tr.getAttribute('data-row-id') ?? '');
}

function renderTable(props: Partial<Parameters<typeof DataTable<Lot>>[0]> = {}, rows: readonly Lot[] = LOTS) {
  return renderWithStore(
    <DataTable<Lot>
      tableId="test.lots"
      label="Gold lots"
      columns={COLUMNS}
      rows={rows}
      rowId={(r) => r.id}
      {...props}
    />,
    { state: freshState() },
  );
}

describe('sorting and filtering (13.2)', () => {
  it('sorts by a header click, reverses on the second, and adds a second key with Shift', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'Gold lots' });
    const header = within(table).getByRole('columnheader', { name: /Raw gold/ });
    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(bodyIds()).toEqual(['lot_000002', 'lot_000001', 'lot_000003', 'lot_000010']);
    fireEvent.click(within(header).getByRole('button'));
    expect(header.getAttribute('aria-sort')).toBe('descending');
    expect(bodyIds()[0]).toBe('lot_000010');
    const status = within(table).getByRole('columnheader', { name: /Status/ });
    fireEvent.click(within(status).getByRole('button'));
    fireEvent.click(within(header).getByRole('button'), { shiftKey: true });
    expect(bodyIds()).toEqual(['lot_000002', 'lot_000003', 'lot_000001', 'lot_000010']);
  });

  it('filters by text, enum, number range and week range, and searches', () => {
    renderTable();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Claim' }), { target: { value: 'caribou' } });
    expect(bodyIds()).toEqual(['lot_000003', 'lot_000010']);
    expect(screen.getByText('2 of 4 rows')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Claim' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sold' }));
    expect(bodyIds()).toEqual(['lot_000001', 'lot_000010']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sold' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter Raw gold (raw oz), minimum' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter Raw gold (raw oz), maximum' }), {
      target: { value: '60' },
    });
    expect(bodyIds()).toEqual(['lot_000003', 'lot_000001']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter Cleanup week, from' }), { target: { value: '14' } });
    expect(bodyIds()).toEqual(['lot_000003']);
    const weekOptions = within(screen.getByRole('combobox', { name: 'Filter Cleanup week, from' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(weekOptions).toEqual(['from', 'Y1 Wk 9', 'Y1 Wk 15', 'Y1 Wk 21', 'Y1 Wk 31']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Gold lots' }), { target: { value: 'nothing' } });
    expect(bodyIds()).toEqual([]);
    expect(screen.getByText('Nothing to show.')).toBeTruthy();
  });

  it('shows week columns as game weeks and totals the rows in view', () => {
    renderTable();
    expect(document.querySelector('tbody tr[data-row-id="lot_000003"]')?.textContent).toContain('Y1 Wk 21');
    const totals = document.querySelector('[data-totals-row]');
    expect(totals?.textContent).toContain('Total');
    expect(totals?.querySelector('[data-total]')?.textContent).toBe('172.651');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Claim' }), { target: { value: 'bench' } });
    expect(document.querySelector('[data-total]')?.textContent).toBe('7.250');
  });
});

describe('columns and the persisted layout (13.2, 13.21 ui/setTableLayout)', () => {
  it('hides, shows and reorders columns, and keeps the layout per tableId across mounts', () => {
    const r = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const chooser = document.querySelector('[data-column-chooser]') as HTMLElement;
    fireEvent.click(within(chooser).getByRole('checkbox', { name: 'Claim' }));
    expect(screen.queryByRole('columnheader', { name: /Claim/ })).toBeNull();
    fireEvent.click(within(chooser).getByRole('button', { name: 'Move Status earlier' }));
    const headers = (): string[] =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((h) => h.textContent ?? '');
    expect(headers()).toEqual(['Status', 'Lot', 'Raw gold (raw oz)', 'Cleanup week']);
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Lot/ })).getByRole('button'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Filter Raw gold (raw oz), minimum' }), {
      target: { value: '10' },
    });
    expect(r.harness.store.getState().persisted.tableLayouts['test.lots']).toEqual({
      columns: ['status', 'id', 'rawOz', 'week'],
      sort: [{ id: 'id', desc: false }],
      filters: [{ id: 'rawOz', value: { min: 10 } }],
    });
    cleanup();
    renderWithStore(
      <DataTable<Lot> tableId="test.lots" label="Gold lots" columns={COLUMNS} rows={LOTS} rowId={(x) => x.id} />,
      { harness: r.harness },
    );
    expect(headers()).toEqual(['Status', 'Lot', 'Raw gold (raw oz)', 'Cleanup week']);
    expect(bodyIds()).toEqual(['lot_000001', 'lot_000003', 'lot_000010']);
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Default columns' }));
    expect(headers()).toEqual(['Lot', 'Claim', 'Status', 'Raw gold (raw oz)', 'Cleanup week']);
  });
});

describe('virtualization (13.2, T13)', () => {
  const many = (n: number): Lot[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `lot_${String(i + 1).padStart(6, '0')}`,
      claim: `Claim ${i % 7}`,
      status: i % 2 === 0 ? 'held' : 'sold',
      rawOz: i,
      week: i % 52,
    }));

  it('does not virtualize at or below ui.virtualizeRowThreshold', () => {
    renderTable({}, many(100));
    expect(screen.getByRole('table').hasAttribute('data-virtualized')).toBe(false);
    expect(bodyIds()).toHaveLength(100);
  });

  it('renders 20,000 rows as at most 60 DOM rows, with aria-rowcount and aria-rowindex', () => {
    renderTable({}, many(20_000));
    const table = screen.getByRole('table');
    expect(table.hasAttribute('data-virtualized')).toBe(true);
    expect(table.getAttribute('aria-rowcount')).toBe('20001');
    const rows = document.querySelectorAll('tbody tr[data-row-id]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(60);
    expect(rows[0]?.getAttribute('aria-rowindex')).toBe('2');
  });
});

describe('rows by keyboard and mouse (13.2, 13.15)', () => {
  it('moves with j and k, opens the quick view on click or Space and the full route on Enter or double-click', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick, rowHref: (r) => `#/gold/inventory?lot=${r.id}` });
    const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('tbody tr[data-row-id]')];
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
    act(() => rows()[0]?.focus());
    fireEvent.keyDown(rows()[0] as HTMLElement, { key: 'j' });
    return Promise.resolve().then(() => {
      expect(document.activeElement?.getAttribute('data-row-id')).toBe('lot_000001');
      fireEvent.keyDown(rows()[1] as HTMLElement, { key: ' ' });
      expect(onRowClick).toHaveBeenLastCalledWith(LOTS[1]);
      fireEvent.keyDown(rows()[1] as HTMLElement, { key: 'Enter' });
      expect(window.location.hash).toBe('#/gold/inventory?lot=lot_000001');
      fireEvent.click(rows()[2] as HTMLElement);
      expect(onRowClick).toHaveBeenLastCalledWith(LOTS[2]);
      fireEvent.doubleClick(rows()[3] as HTMLElement);
      expect(window.location.hash).toBe('#/gold/inventory?lot=lot_000010');
    });
  });
});

describe('bulk selection and CSV (13.2, 13.17)', () => {
  it('selects rows for a bulk action and clears them', () => {
    const act1 = vi.fn();
    renderTable({ bulkActions: (sel) => <Button onClick={() => act1(sel.map((r) => r.id))}>Sell selected</Button> });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row lot_000002' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row lot_000010' }));
    const bar = document.querySelector('[data-bulk-bar]') as HTMLElement;
    expect(bar.textContent).toContain('2 selected');
    fireEvent.click(within(bar).getByRole('button', { name: 'Sell selected' }));
    expect(act1).toHaveBeenCalledWith(['lot_000002', 'lot_000010']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows in view' }));
    expect(document.querySelector('[data-bulk-bar]')?.textContent).toContain('4 selected');
    fireEvent.click(
      within(document.querySelector('[data-bulk-bar]') as HTMLElement).getByRole('button', { name: 'Clear selection' }),
    );
    expect(document.querySelector('[data-bulk-bar]')).toBeNull();
  });

  it('exports the current view, and says EXPORT_EMPTY for an empty one', () => {
    const r = renderTable({ csv: { reportId: 'gold-lots', period: 'All' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Claim' }), { target: { value: 'caribou' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(r.harness.downloads).toHaveLength(1);
    const file = r.harness.downloads[0];
    expect(file?.fileName).toBe('gmt_ruby-creek-placers_gold-lots_all.csv');
    const rows = parseCsv(new TextDecoder().decode(file?.bytes));
    expect(rows[0]).toEqual(['# Company: Ruby Creek Placers']);
    expect(rows[4]).toEqual(['Lot', 'Claim', 'Status', 'Raw gold (raw oz)', 'Cleanup week']);
    expect(rows.slice(5)).toEqual([
      ['lot_000003', 'Caribou Fork #3', 'Held', '52.901', 'Y1 Wk 21'],
      ['lot_000010', 'Caribou Fork #10', 'Sold', '100.000', 'Y1 Wk 31'],
    ]);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Claim' }), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(r.harness.downloads).toHaveLength(1);
    expect(screen.getByText('There is nothing in this view to export.')).toBeTruthy();
  });
});
