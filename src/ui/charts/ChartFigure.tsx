// Every chart's frame (DESIGN §13.18 "Recharts usage", §13.19 "Charts have table twins"): a <figure> whose caption
// names the chart and summarises it in a sentence, and a `Table view` toggle that swaps the picture for its table twin,
// where every value is a <Num> (so a value is never readable only from a tooltip). The picture's SVG is named by the
// summary (`<title>`) and takes no focus; its tooltip shows <Num>s on hover, and the twin is the keyboard path.
import { useState, type ReactNode } from 'react';
import { Num, type NumProps } from '../explain/Num';
import { Button } from '../components/primitives';

export type TwinCell = NumProps | string | null;

export interface TwinTableProps {
  readonly caption: string;
  /** Header labels: the first names the row label column. */
  readonly columns: readonly string[];
  readonly rows: readonly { readonly key: string; readonly label: string; readonly cells: readonly TwinCell[] }[];
}

/** A chart's table twin: real table semantics, numbers as <Num>s right-aligned. */
export function TwinTable({ caption, columns, rows }: TwinTableProps) {
  return (
    <table className="w-full border-collapse text-12" data-chart-twin="">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={`border-b border-hairline px-2 py-1 font-semibold text-ink-2 ${i === 0 ? 'text-left' : 'text-right'}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row" className="border-b border-hairline px-2 py-1 text-left font-normal text-ink-1">
              {r.label}
            </th>
            {r.cells.map((cell, i) => (
              <td key={`${r.key}-${i}`} className="border-b border-hairline px-2 py-1 text-right">
                {cell === null ? '—' : typeof cell === 'string' ? cell : <Num {...cell} />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ChartFigureProps {
  readonly title: string;
  /** One sentence on what the chart shows (13.18 `<figure>` caption summary). */
  readonly summary: string;
  readonly twin: TwinTableProps;
  /** The picture (a Recharts chart or custom SVG). */
  readonly children: ReactNode;
  /** A line under the caption: series key or label (`incl. planned cleanups (P50)`). */
  readonly legend?: ReactNode;
  /** `data-chart` value. */
  readonly id?: string;
}

export function ChartFigure({ title, summary, twin, children, legend, id }: ChartFigureProps) {
  const [table, setTable] = useState(false);
  return (
    <figure className="m-0 rounded-card border border-hairline bg-surface-1 p-3" data-chart={id ?? ''}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <span className="block text-14 font-semibold text-ink-1">{title}</span>
          <span className="block text-12 text-ink-2">{summary}</span>
        </span>
        <Button aria-pressed={table} onClick={() => setTable(!table)}>
          Table view
        </Button>
      </figcaption>
      {legend === undefined ? null : <div className="mb-1 text-12 text-ink-2">{legend}</div>}
      {table ? <TwinTable {...twin} /> : <div data-chart-picture="">{children}</div>}
    </figure>
  );
}
