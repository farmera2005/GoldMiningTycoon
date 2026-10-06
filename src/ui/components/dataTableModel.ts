// The pure half of DataTable (DESIGN §13.2 tables, §13.17 CSV, §13.21 `ui/setTableLayout`): column kinds and their
// filters, sorting with empty cells last, the persisted layout (columns, sort, filters per `tableId` in
// `UiPersisted.tableLayouts`), totals over the current view and the view's CSV document. The component renders; this
// module decides, so every rule here has a unit test.
import type { ReactNode } from 'react';
import type { Unit } from '../../engine';
import type { CsvCell, CsvColumn, CsvDocument, CsvMeta } from '../format/csv';
import type { TableLayout } from '../store/persisted';

/** What a column holds, which decides its filter, alignment and sort. */
export type ColumnKind = 'text' | 'number' | 'enum' | 'week';

export type CellValue = string | number | null;

interface ColumnBase<Row> {
  readonly id: string;
  /** The header label; a number column's unit is appended in CSV (`Price (USD)`) and should be in the label. */
  readonly header: string;
  /** The raw value: what sorting, filtering, totals and CSV use (cents for money, turns for weeks). */
  readonly value: (row: Row) => CellValue;
  /** Shown when the layout has no saved columns; default true. */
  readonly defaultVisible?: boolean;
  /** Fixed width in px (sticky first columns need one). */
  readonly width?: number;
}

/** A number column renders through the screen's `<Num>` (13.13: every displayed number explains itself). */
export interface NumberColumn<Row> extends ColumnBase<Row> {
  readonly kind: 'number';
  readonly unit: Unit;
  readonly cell: (row: Row) => ReactNode;
  /** A totals-footer value over the rows in view (13.2: "where a sum means something"). */
  readonly total?: 'sum' | ((rows: readonly Row[]) => number);
  /** How the total renders (a `<Num>` with its own explanation); required with `total`. */
  readonly totalCell?: (total: number) => ReactNode;
}

export interface TextColumn<Row> extends ColumnBase<Row> {
  readonly kind: 'text';
  readonly cell?: (row: Row) => ReactNode;
}

export interface EnumColumn<Row> extends ColumnBase<Row> {
  readonly kind: 'enum';
  /** Value → label, also the filter's options in this order. */
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly cell?: (row: Row) => ReactNode;
}

/** A game week (`turn`), shown as `Y1 Wk 29` and filtered by a week range. */
export interface WeekColumn<Row> extends ColumnBase<Row> {
  readonly kind: 'week';
  readonly cell?: (row: Row) => ReactNode;
}

export type DataColumn<Row> = NumberColumn<Row> | TextColumn<Row> | EnumColumn<Row> | WeekColumn<Row>;

export interface NumberRange {
  readonly min?: number;
  readonly max?: number;
}

export interface WeekRange {
  readonly from?: number;
  readonly to?: number;
}

/** A column filter's value by kind: text contains, numeric range, enum multi-select, week range (13.2). */
export type FilterValue = string | NumberRange | readonly string[] | WeekRange;

function isRange(v: unknown): v is NumberRange & WeekRange {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** True when the filter is set to something that excludes rows. */
export function filterActive(kind: ColumnKind, value: unknown): boolean {
  switch (kind) {
    case 'text':
      return typeof value === 'string' && value.trim() !== '';
    case 'enum':
      return Array.isArray(value) && value.length > 0;
    case 'number':
      return isRange(value) && (finite(value.min) || finite(value.max));
    case 'week':
      return isRange(value) && (finite(value.from) || finite(value.to));
  }
}

/** Does a cell pass its column's filter? An empty cell passes only an inactive filter. */
export function matchesFilter(kind: ColumnKind, cell: CellValue, filter: unknown): boolean {
  if (!filterActive(kind, filter)) return true;
  if (cell === null) return false;
  switch (kind) {
    case 'text':
      return String(cell).toLowerCase().includes(String(filter).trim().toLowerCase());
    case 'enum':
      return (filter as readonly string[]).includes(String(cell));
    case 'number': {
      const r = filter as NumberRange;
      const x = Number(cell);
      return (!finite(r.min) || x >= r.min) && (!finite(r.max) || x <= r.max);
    }
    case 'week': {
      const r = filter as WeekRange;
      const x = Number(cell);
      return (!finite(r.from) || x >= r.from) && (!finite(r.to) || x <= r.to);
    }
  }
}

/** The global search: any visible text, enum label or id column contains every word. */
export function matchesSearch(haystack: readonly string[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return true;
  const text = haystack.join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
}

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });

/** Ascending order with empty cells last (whatever the direction, so blanks never lead a sorted table). */
export function compareCells(a: CellValue, b: CellValue): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

export interface SortSpec {
  readonly id: string;
  readonly desc: boolean;
}

/** Sorts rows by several keys (shift-click adds a secondary sort, 13.2); stable, blanks last in both directions. */
export function sortRows<Row>(
  rows: readonly Row[],
  sort: readonly SortSpec[],
  columns: readonly DataColumn<Row>[],
): Row[] {
  const keys = sort.flatMap((s) => {
    const col = columns.find((c) => c.id === s.id);
    return col === undefined ? [] : [{ col, desc: s.desc }];
  });
  if (keys.length === 0) return [...rows];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const { col, desc } of keys) {
        const a = col.value(x.row);
        const b = col.value(y.row);
        if (a === null || b === null) {
          const c = compareCells(a, b);
          if (c !== 0) return c;
          continue;
        }
        const c = compareCells(a, b);
        if (c !== 0) return desc ? -c : c;
      }
      return x.index - y.index;
    })
    .map((x) => x.row);
}

/** The ids shown by default: every column not marked `defaultVisible: false`, in declaration order. */
export function defaultColumnIds<Row>(columns: readonly DataColumn<Row>[]): string[] {
  return columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
}

/** The visible columns in order from a saved layout, dropping ids the table no longer has; null → the defaults. */
export function visibleColumnIds<Row>(columns: readonly DataColumn<Row>[], layout: TableLayout | undefined): string[] {
  if (layout === undefined || layout.columns.length === 0) return defaultColumnIds(columns);
  const known = new Set(columns.map((c) => c.id));
  const ids = layout.columns.filter((id) => known.has(id));
  return ids.length === 0 ? defaultColumnIds(columns) : ids;
}

/** A saved filter value of the right shape for its column, or undefined (a damaged layout never breaks a table). */
export function sanitizeFilter(kind: ColumnKind, value: unknown): FilterValue | undefined {
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : undefined;
    case 'enum':
      return Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : undefined;
    case 'number':
      if (!isRange(value)) return undefined;
      return {
        ...(finite(value.min) ? { min: value.min } : {}),
        ...(finite(value.max) ? { max: value.max } : {}),
      };
    case 'week':
      if (!isRange(value)) return undefined;
      return {
        ...(finite(value.from) ? { from: value.from } : {}),
        ...(finite(value.to) ? { to: value.to } : {}),
      };
  }
}

export interface TableView {
  readonly columns: readonly string[];
  readonly sort: readonly SortSpec[];
  readonly filters: Readonly<Record<string, FilterValue>>;
}

/** The view a table opens with: its saved layout (sanitized) or its defaults. */
export function viewFromLayout<Row>(
  columns: readonly DataColumn<Row>[],
  layout: TableLayout | undefined,
  defaultSort: readonly SortSpec[] = [],
): TableView {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const filters: Record<string, FilterValue> = {};
  for (const f of layout?.filters ?? []) {
    const col = byId.get(f.id);
    const v = col === undefined ? undefined : sanitizeFilter(col.kind, f.value);
    if (col !== undefined && v !== undefined && filterActive(col.kind, v)) filters[f.id] = v;
  }
  const sort = (layout?.sort ?? defaultSort).filter((s) => byId.has(s.id));
  return { columns: visibleColumnIds(columns, layout), sort, filters };
}

/** The layout persisted for a view (13.21 `ui/setTableLayout`): only active filters, in column order. */
export function layoutFromView<Row>(columns: readonly DataColumn<Row>[], view: TableView): TableLayout {
  const filters = columns.flatMap((c) => {
    const v = view.filters[c.id];
    return v !== undefined && filterActive(c.kind, v) ? [{ id: c.id, value: v as unknown }] : [];
  });
  return { columns: [...view.columns], sort: view.sort.map((s) => ({ id: s.id, desc: s.desc })), filters };
}

/** The rows the view shows: column filters, then the global search, then the sort. */
export function viewRows<Row>(
  rows: readonly Row[],
  columns: readonly DataColumn<Row>[],
  view: TableView,
  search: string,
): Row[] {
  const visible = columns.filter((c) => view.columns.includes(c.id));
  const searchable = visible.filter((c) => c.kind !== 'number' && c.kind !== 'week');
  const filtered = rows.filter((row) => {
    for (const c of columns) if (!matchesFilter(c.kind, c.value(row), view.filters[c.id])) return false;
    return matchesSearch(
      searchable.map((c) => {
        const v = c.value(row);
        if (v === null) return '';
        return c.kind === 'enum' ? (c.options.find((o) => o.value === v)?.label ?? String(v)) : String(v);
      }),
      search,
    );
  });
  return sortRows(filtered, view.sort, columns);
}

/** A number column's total over the rows in view, or null when it has none. */
export function columnTotal<Row>(column: DataColumn<Row>, rows: readonly Row[]): number | null {
  if (column.kind !== 'number' || column.total === undefined) return null;
  if (column.total === 'sum') return rows.reduce((sum, r) => sum + (Number(column.value(r)) || 0), 0);
  return column.total(rows);
}

/** Moves an id one place earlier (−1) or later (+1) in the visible order: the column chooser's reorder (13.2). */
export function moveColumn(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[i], out[j]] = [out[j] as string, out[i] as string];
  return out;
}

/** The CSV of the current view (13.17): visible columns in view order, filtered and sorted rows, raw values. */
export function viewCsv<Row>(
  columns: readonly DataColumn<Row>[],
  view: TableView,
  rows: readonly Row[],
  meta: CsvMeta,
  weekText: (turn: number) => string,
): CsvDocument {
  const visible = view.columns.flatMap((id) => {
    const c = columns.find((x) => x.id === id);
    return c === undefined ? [] : [c];
  });
  const csvColumns: CsvColumn[] = visible.map((c) => ({ header: c.header, unit: c.kind === 'number' ? c.unit : 'text' }));
  const cells = (row: Row): CsvCell[] =>
    visible.map((c) => {
      const v = c.value(row);
      if (v === null) return null;
      if (c.kind === 'week' && typeof v === 'number') return weekText(v);
      if (c.kind === 'enum') return c.options.find((o) => o.value === v)?.label ?? String(v);
      return v;
    });
  return { meta, columns: csvColumns, rows: rows.map(cells) };
}
