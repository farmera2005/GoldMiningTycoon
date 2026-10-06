// DataTable: the one table component (DESIGN §13.2 "Tables", D-13.19), built on TanStack Table (columns, visibility,
// order, selection) and TanStack Virtual (rows above ui.virtualizeRowThreshold). The view (filters, search, sort) is
// computed by dataTableModel.ts; this file renders it:
//   - header click sorts, shift-click adds a secondary sort; one filter row above the table (text contains, numeric
//     range, enum multi-select, week range) plus a global search; a column chooser (show, hide, reorder by buttons,
//     default and all-columns sets); sort, filters and columns persist per `tableId` (`ui/setTableLayout`);
//   - 32 / 26 px rows by density, sticky header and first column, numbers right-aligned in tabular figures, a totals
//     footer where a column sums, real <table> semantics with aria-rowcount / aria-rowindex when virtualized;
//   - click (or Space) opens the row's quick view, double-click or Enter its full route, j / k move between rows;
//     checkboxes for bulk actions; Export CSV of the current view (13.17).
// Columns must be player-visible fields only, so no sort can rank by hidden truth (13.2).
import { getCoreRowModel, useReactTable, type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { useVirtualizer, type Rect, type Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import { select } from '../../engine';
import { useOptionalServices } from '../app/services';
import { navigateHref } from '../app/router';
import { exportCsv, type CsvMeta } from '../format/csv';
import { yearWeek } from '../format';
import { useUi, useUiStore } from '../store/store';
import { t } from '../text';
import {
  columnTotal,
  defaultColumnIds,
  filterActive,
  layoutFromView,
  moveColumn,
  viewCsv,
  viewFromLayout,
  viewRows,
  type DataColumn,
  type FilterValue,
  type NumberRange,
  type SortSpec,
  type TableView,
  type WeekRange,
} from './dataTableModel';
import { SortIcon } from './icons';
import { Button } from './primitives';

export type { DataColumn } from './dataTableModel';

export interface DataTableProps<Row> {
  /** Persistence key in `UiPersisted.tableLayouts` (stable, e.g. `bank.ledger`). */
  readonly tableId: string;
  /** The table's accessible name and caption. */
  readonly label: string;
  readonly columns: readonly DataColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowId: (row: Row) => string;
  /** Click or Space: the entity's quick view (13.2). */
  readonly onRowClick?: (row: Row) => void;
  /** Double-click or Enter: the entity's canonical route. */
  readonly rowHref?: (row: Row) => string | null;
  /** Enables checkboxes; renders the bulk actions for the selected rows (13.2). */
  readonly bulkActions?: (selected: readonly Row[]) => ReactNode;
  /** Enables Export CSV (13.17): the report id in the file name and the period label. */
  readonly csv?: { readonly reportId: string; readonly period?: string };
  readonly defaultSort?: readonly SortSpec[];
  /** The scroll viewport's height in px; rows beyond it are virtualized above the threshold. */
  readonly maxHeight?: number;
  readonly emptyText?: string;
  /** Pinned first columns (13.2: sticky first column); default 1. */
  readonly stickyColumns?: number;
}

const DEFAULT_MAX_HEIGHT = 480;

function sortDirection(sort: readonly SortSpec[], id: string): 'asc' | 'desc' | false {
  const s = sort.find((x) => x.id === id);
  return s === undefined ? false : s.desc ? 'desc' : 'asc';
}

/** Header click: toggles this column asc → desc → off; with Shift it adds or toggles it as a further key. */
export function nextSort(sort: readonly SortSpec[], id: string, multi: boolean): SortSpec[] {
  const cur = sort.find((s) => s.id === id);
  const next: SortSpec | null = cur === undefined ? { id, desc: false } : cur.desc ? null : { id, desc: true };
  if (!multi) return next === null ? [] : [next];
  const rest = sort.filter((s) => s.id !== id);
  if (next === null) return rest;
  return cur === undefined ? [...sort, next] : sort.map((s) => (s.id === id ? next : s));
}

/** A row-height-aware rect observer that also works where layout is not measured (jsdom gets the viewport height). */
function observeRect(fallbackHeight: number) {
  return (instance: Virtualizer<HTMLDivElement, Element>, cb: (rect: Rect) => void): (() => void) | undefined => {
    const el = instance.scrollElement;
    if (el === null) return undefined;
    const report = (): void => cb({ width: el.clientWidth, height: el.clientHeight || fallbackHeight });
    report();
    if (typeof ResizeObserver === 'undefined') return () => undefined;
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  };
}

function FilterControl<Row>({
  column,
  value,
  onChange,
  weekOptions,
}: {
  column: DataColumn<Row>;
  value: FilterValue | undefined;
  onChange: (v: FilterValue | undefined) => void;
  weekOptions: readonly { readonly turn: number; readonly label: string }[];
}) {
  const label = `Filter ${column.header}`;
  const input =
    'h-7 w-full min-w-0 rounded-control border border-border-control bg-surface-2 px-1.5 text-12 text-ink-1';
  switch (column.kind) {
    case 'text':
      return (
        <input
          type="search"
          aria-label={label}
          placeholder="contains"
          className={input}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        />
      );
    case 'number': {
      const r = (value ?? {}) as NumberRange;
      const set = (key: 'min' | 'max', text: string): void => {
        const n = text.trim() === '' ? undefined : Number(text);
        const next: NumberRange = { ...r, [key]: n !== undefined && Number.isFinite(n) ? n : undefined };
        onChange(filterActive('number', next) ? next : undefined);
      };
      return (
        <div className="flex gap-1">
          <input
            type="number"
            aria-label={`${label}, minimum`}
            placeholder="min"
            className={input}
            value={r.min ?? ''}
            onChange={(e) => set('min', e.target.value)}
          />
          <input
            type="number"
            aria-label={`${label}, maximum`}
            placeholder="max"
            className={input}
            value={r.max ?? ''}
            onChange={(e) => set('max', e.target.value)}
          />
        </div>
      );
    }
    case 'enum': {
      const chosen = Array.isArray(value) ? (value as readonly string[]) : [];
      return (
        <details className="relative">
          <summary className={`${input} flex cursor-pointer items-center`} aria-label={label}>
            {chosen.length === 0 ? 'All' : `${chosen.length} selected`}
          </summary>
          <fieldset className="absolute z-20 mt-1 min-w-40 rounded-control border border-hairline bg-surface-2 p-2 shadow-raised">
            <legend className="sr-only">{label}</legend>
            {column.options.map((o) => (
              <label key={o.value} className="flex items-center gap-1.5 py-0.5 text-12 text-ink-1">
                <input
                  type="checkbox"
                  checked={chosen.includes(o.value)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value);
                    onChange(next.length === 0 ? undefined : next);
                  }}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        </details>
      );
    }
    case 'week': {
      const r = (value ?? {}) as WeekRange;
      const set = (key: 'from' | 'to', text: string): void => {
        const next: WeekRange = { ...r, [key]: text === '' ? undefined : Number(text) };
        onChange(filterActive('week', next) ? next : undefined);
      };
      return (
        <div className="flex gap-1">
          <select
            aria-label={`${label}, from`}
            className={input}
            value={r.from ?? ''}
            onChange={(e) => set('from', e.target.value)}
          >
            <option value="">from</option>
            {weekOptions.map((w) => (
              <option key={w.turn} value={w.turn}>
                {w.label}
              </option>
            ))}
          </select>
          <select
            aria-label={`${label}, to`}
            className={input}
            value={r.to ?? ''}
            onChange={(e) => set('to', e.target.value)}
          >
            <option value="">to</option>
            {weekOptions.map((w) => (
              <option key={w.turn} value={w.turn}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
  }
}

function ColumnChooser<Row>({
  columns,
  visible,
  onChange,
}: {
  columns: readonly DataColumn<Row>[];
  visible: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  const hidden = columns.filter((c) => !visible.includes(c.id));
  const header = (id: string): string => columns.find((c) => c.id === id)?.header ?? id;
  return (
    <fieldset className="mb-2 rounded-card border border-hairline bg-surface-2 p-3 text-13" data-column-chooser="">
      <legend className="px-1 font-semibold text-ink-1">Columns</legend>
      <ul className="mb-2">
        {visible.map((id, i) => (
          <li key={id} className="flex items-center gap-2 py-0.5">
            <label className="flex flex-1 items-center gap-1.5 text-ink-1">
              <input
                type="checkbox"
                checked
                disabled={visible.length === 1}
                onChange={() => onChange(visible.filter((v) => v !== id))}
              />
              {header(id)}
            </label>
            <Button
              aria-label={`Move ${header(id)} earlier`}
              disabled={i === 0}
              onClick={() => onChange(moveColumn(visible, id, -1))}
            >
              ↑
            </Button>
            <Button
              aria-label={`Move ${header(id)} later`}
              disabled={i === visible.length - 1}
              onClick={() => onChange(moveColumn(visible, id, 1))}
            >
              ↓
            </Button>
          </li>
        ))}
        {hidden.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-0.5">
            <label className="flex flex-1 items-center gap-1.5 text-ink-2">
              <input type="checkbox" checked={false} onChange={() => onChange([...visible, c.id])} />
              {c.header}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button onClick={() => onChange(defaultColumnIds(columns))}>Default columns</Button>
        <Button onClick={() => onChange(columns.map((c) => c.id))}>All columns</Button>
      </div>
    </fieldset>
  );
}

export function DataTable<Row>({
  tableId,
  label,
  columns,
  rows,
  rowId,
  onRowClick,
  rowHref,
  bulkActions,
  csv,
  defaultSort = [],
  maxHeight = DEFAULT_MAX_HEIGHT,
  emptyText = 'Nothing to show.',
  stickyColumns = 1,
}: DataTableProps<Row>) {
  const store = useUiStore();
  const services = useOptionalServices();
  const state = useUi((s) => s.game.state);
  const saved = useUi((s) => s.persisted.tableLayouts[tableId]);
  const density = useUi((s) => s.prefs.density);
  const rowHeight = density === 'compact' ? 26 : 32;
  const captionId = useId();

  const [view, setView] = useState<TableView>(() => viewFromLayout(columns, saved, defaultSort));
  const [search, setSearch] = useState('');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [active, setActive] = useState(0);
  const [exportNote, setExportNote] = useState('');

  // Persist every change of columns, sort or filters (13.21 ui/setTableLayout); the first render only reads.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    store.getState().setTableLayout(tableId, layoutFromView(columns, view));
  }, [view, columns, store, tableId]);

  const shown = useMemo(() => viewRows(rows, columns, view, search), [rows, columns, view, search]);
  const visibleColumns = useMemo(
    () =>
      view.columns.flatMap((id) => {
        const c = columns.find((x) => x.id === id);
        return c === undefined ? [] : [c];
      }),
    [view.columns, columns],
  );

  const weekText = useCallback(
    (turn: number): string => {
      if (state === null) return `turn ${turn}`;
      const v = select.dateView(state, turn);
      return yearWeek(v.year, v.week);
    },
    [state],
  );
  const weekOptions = useMemo(() => {
    const out = new Map<string, { turn: number; label: string }[]>();
    for (const c of columns) {
      if (c.kind !== 'week') continue;
      const turns = [...new Set(rows.map((r) => c.value(r)).filter((v): v is number => typeof v === 'number'))].sort(
        (a, b) => a - b,
      );
      out.set(
        c.id,
        turns.map((turn) => ({ turn, label: weekText(turn) })),
      );
    }
    return out;
  }, [columns, rows, weekText]);

  const defs = useMemo<ColumnDef<Row>[]>(
    () =>
      visibleColumns.map((c) => ({
        id: c.id,
        header: c.header,
        cell: (ctx) => {
          const row = ctx.row.original;
          if (c.cell !== undefined) return c.cell(row);
          const v = c.value(row);
          if (v === null) return '';
          if (c.kind === 'week' && typeof v === 'number') return weekText(v);
          if (c.kind === 'enum') return c.options.find((o) => o.value === v)?.label ?? String(v);
          return String(v);
        },
      })),
    [visibleColumns, weekText],
  );

  // TanStack Table is the table engine D-13.19 names; its instance is not memoizable, so this component is not compiled.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: shown,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => rowId(row),
    manualSorting: true,
    manualFiltering: true,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    enableRowSelection: bulkActions !== undefined,
  });
  const modelRows = table.getRowModel().rows;

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = shown.length > uiConfig['ui.virtualizeRowThreshold'];
  const virtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    observeElementRect: observeRect(maxHeight),
    enabled: virtual,
  });
  const items = virtual ? virtualizer.getVirtualItems() : [];
  const rendered = virtual
    ? items.map((it) => ({ index: it.index, start: it.start }))
    : modelRows.map((_, index) => ({ index, start: 0 }));
  const padTop = virtual && items.length > 0 ? (items[0]?.start ?? 0) : 0;
  const padBottom = virtual && items.length > 0 ? virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0) : 0;

  const selectedRows = useMemo(() => shown.filter((r) => selection[rowId(r)] === true), [shown, selection, rowId]);
  const allSelected = shown.length > 0 && selectedRows.length === shown.length;

  const rowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const focusRow = (index: number): void => {
    const i = Math.max(0, Math.min(shown.length - 1, index));
    setActive(i);
    if (virtual) virtualizer.scrollToIndex(i);
    // The row may render on the next frame when it was outside the virtual window.
    queueMicrotask(() => rowRefs.current.get(i)?.focus());
  };

  const openRow = (row: Row): void => {
    const href = rowHref?.(row) ?? null;
    if (href !== null) navigateHref(href);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, index: number, row: Row): void => {
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        focusRow(index + 1);
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        focusRow(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(0);
        break;
      case 'End':
        e.preventDefault();
        focusRow(shown.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        openRow(row);
        break;
      case ' ':
        e.preventDefault();
        onRowClick?.(row);
        break;
    }
  };

  const doExport = (): void => {
    if (csv === undefined) return;
    const meta: CsvMeta = {
      company: state?.company.name ?? 'Gold Mining Tycoon',
      period: csv.period ?? 'All',
      generated: state === null ? '—' : weekText(state.clock.turn),
      rulesVersion: state?.meta.rulesVersion ?? '—',
    };
    const result = exportCsv(viewCsv(columns, view, shown, meta, weekText), csv.reportId);
    if (!result.ok) {
      setExportNote(t('export.EXPORT_EMPTY'));
      return;
    }
    setExportNote('');
    services?.download(result.file);
  };

  const totals = visibleColumns.map((c) => columnTotal(c, shown));
  const hasTotals = totals.some((x) => x !== null);
  const selectCol = bulkActions !== undefined;
  const colCount = visibleColumns.length + (selectCol ? 1 : 0);
  const stickyCount = Math.min(stickyColumns, visibleColumns.length);
  const stickyLeft = (i: number): number | undefined => {
    if (i >= stickyCount) return undefined;
    let left = selectCol ? 36 : 0;
    for (let k = 0; k < i; k++) left += visibleColumns[k]?.width ?? 160;
    return left;
  };

  const setFilter = (id: string, v: FilterValue | undefined): void => {
    const filters = { ...view.filters };
    if (v === undefined) delete filters[id];
    else filters[id] = v;
    setView({ ...view, filters });
    setActive(0);
  };

  return (
    <div className="rounded-card border border-hairline bg-surface-1" data-table-id={tableId}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
        <input
          type="search"
          aria-label={`Search ${label}`}
          placeholder="Search"
          className="h-8 w-56 rounded-control border border-border-control bg-surface-2 px-2 text-13 text-ink-1"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActive(0);
          }}
        />
        <Button aria-expanded={chooserOpen} onClick={() => setChooserOpen(!chooserOpen)}>
          Columns
        </Button>
        {csv === undefined ? null : (
          <Button aria-disabled={shown.length === 0} onClick={doExport}>
            Export CSV
          </Button>
        )}
        <span role="status" className="text-12 text-ink-2">
          {exportNote}
        </span>
        <span className="ml-auto text-12 text-ink-2" aria-live="polite">
          {shown.length === rows.length ? `${rows.length} rows` : `${shown.length} of ${rows.length} rows`}
        </span>
      </div>
      {chooserOpen ? (
        <div className="px-3 pt-2">
          <ColumnChooser
            columns={columns}
            visible={view.columns}
            onChange={(ids) => setView({ ...view, columns: ids })}
          />
        </div>
      ) : null}
      {selectCol && selectedRows.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-2 px-3 py-2 text-13"
          data-bulk-bar=""
        >
          <span className="text-ink-1">{selectedRows.length} selected</span>
          {bulkActions(selectedRows)}
          <Button onClick={() => setSelection({})}>Clear selection</Button>
        </div>
      ) : null}
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }} data-table-scroll="">
        <table
          className="w-full border-separate border-spacing-0 text-13"
          aria-labelledby={captionId}
          aria-rowcount={virtual ? shown.length + 1 : undefined}
          data-virtualized={virtual ? '' : undefined}
        >
          <caption id={captionId} className="sr-only">
            {label}
          </caption>
          <thead className="sticky top-0 z-10 bg-surface-1">
            <tr aria-rowindex={virtual ? 1 : undefined}>
              {selectCol ? (
                <th scope="col" className="sticky left-0 z-20 w-9 border-b border-hairline bg-surface-1 px-2">
                  <input
                    type="checkbox"
                    aria-label="Select all rows in view"
                    checked={allSelected}
                    onChange={() =>
                      setSelection(allSelected ? {} : Object.fromEntries(shown.map((r) => [rowId(r), true])))
                    }
                  />
                </th>
              ) : null}
              {visibleColumns.map((c, i) => {
                const dir = sortDirection(view.sort, c.id);
                const left = stickyLeft(i);
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
                    className={`border-b border-hairline bg-surface-1 px-2 py-1 font-semibold text-ink-2 ${c.kind === 'number' ? 'text-right' : 'text-left'} ${left === undefined ? '' : 'sticky z-20'}`}
                    style={{ width: c.width, left }}
                  >
                    <button
                      type="button"
                      className={`inline-flex cursor-pointer items-center gap-1 ${c.kind === 'number' ? 'flex-row-reverse' : ''}`}
                      title="Sort (Shift: add as a further sort)"
                      onClick={(e) => setView({ ...view, sort: nextSort(view.sort, c.id, e.shiftKey) })}
                    >
                      {c.header}
                      <SortIcon direction={dir} />
                    </button>
                  </th>
                );
              })}
            </tr>
            <tr data-filter-row="">
              {selectCol ? <td className="sticky left-0 z-20 border-b border-hairline bg-surface-1" /> : null}
              {visibleColumns.map((c, i) => {
                const left = stickyLeft(i);
                return (
                  <td
                    key={c.id}
                    className={`border-b border-hairline bg-surface-1 px-2 pb-1 ${left === undefined ? '' : 'sticky z-20'}`}
                    style={{ left }}
                  >
                    <FilterControl
                      column={c}
                      value={view.filters[c.id]}
                      onChange={(v) => setFilter(c.id, v)}
                      weekOptions={weekOptions.get(c.id) ?? []}
                    />
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-4 text-center text-ink-2">
                  {emptyText}
                </td>
              </tr>
            ) : null}
            {padTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colCount} style={{ height: padTop, padding: 0 }} />
              </tr>
            ) : null}
            {rendered.map(({ index }) => {
              const r = modelRows[index];
              if (r === undefined) return null;
              const row = r.original;
              const selected = selection[r.id] === true;
              return (
                <tr
                  key={r.id}
                  ref={(el) => {
                    if (el === null) rowRefs.current.delete(index);
                    else rowRefs.current.set(index, el);
                  }}
                  aria-rowindex={virtual ? index + 2 : undefined}
                  aria-selected={selectCol ? selected : undefined}
                  tabIndex={index === Math.min(active, shown.length - 1) ? 0 : -1}
                  data-row-id={r.id}
                  className={`group cursor-default outline-offset-[-2px] hover:bg-surface-2 ${selected ? 'bg-surface-2' : ''}`}
                  style={{ height: rowHeight }}
                  onClick={() => {
                    setActive(index);
                    onRowClick?.(row);
                  }}
                  onDoubleClick={() => openRow(row)}
                  onKeyDown={(e) => onRowKeyDown(e, index, row)}
                  onFocus={(e) => {
                    if (e.target === e.currentTarget) setActive(index);
                  }}
                >
                  {selectCol ? (
                    <td className="sticky left-0 border-b border-hairline bg-surface-1 px-2 group-hover:bg-surface-2">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${r.id}`}
                        checked={selected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => setSelection({ ...selection, [r.id]: !selected })}
                      />
                    </td>
                  ) : null}
                  {r.getVisibleCells().map((cell, i) => {
                    const col = visibleColumns[i];
                    const left = stickyLeft(i);
                    const content = cell.column.columnDef.cell;
                    return (
                      <td
                        key={cell.id}
                        className={`border-b border-hairline px-2 whitespace-nowrap ${col?.kind === 'number' ? 'text-right tabular-nums' : 'text-left'} ${left === undefined ? '' : 'sticky bg-surface-1 group-hover:bg-surface-2'}`}
                        style={{ left }}
                      >
                        {typeof content === 'function' ? content(cell.getContext()) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {padBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colCount} style={{ height: padBottom, padding: 0 }} />
              </tr>
            ) : null}
          </tbody>
          {hasTotals ? (
            <tfoot className="sticky bottom-0 bg-surface-1">
              <tr aria-rowindex={virtual ? shown.length + 2 : undefined} data-totals-row="">
                {selectCol ? <td className="border-t border-axis" /> : null}
                {visibleColumns.map((c, i) => {
                  const total = totals[i] ?? null;
                  return i === 0 && total === null ? (
                    <th key={c.id} scope="row" className="border-t border-axis px-2 py-1 text-left font-semibold">
                      Total
                    </th>
                  ) : (
                    <td
                      key={c.id}
                      className={`border-t border-axis px-2 py-1 font-semibold ${c.kind === 'number' ? 'text-right' : ''}`}
                    >
                      {total === null || c.kind !== 'number' ? null : (c.totalCell?.(total) ?? null)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
