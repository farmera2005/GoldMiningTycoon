// The tooltip every Recharts chart shares (DESIGN §13.18: "every chart has a crosshair or tooltip rendered with <Num>,
// so values in tooltips are explainable"). The chart hands it the hovered datum; the rows it shows are <Num>s with their
// own explanations. It sits on the raised surface with the one elevation shadow, never on grain (13.20).
import type { ReactNode } from 'react';
import { Num, type NumProps } from '../explain/Num';

export interface TooltipRow {
  readonly label: string;
  readonly value: NumProps;
}

export interface ChartTooltipProps<D> {
  /** Supplied by Recharts. */
  readonly active?: boolean;
  /** Supplied by Recharts: the hovered series entries, each with the datum. */
  readonly payload?: readonly { readonly payload?: D }[];
  /** The tooltip's heading for a datum (`Y1 Wk 29`). */
  readonly heading: (datum: D) => ReactNode;
  readonly rows: (datum: D) => readonly TooltipRow[];
}

export function ChartTooltip<D>({ active, payload, heading, rows }: ChartTooltipProps<D>) {
  const datum = payload?.[0]?.payload;
  if (active !== true || datum === undefined) return null;
  return (
    <div
      role="tooltip"
      className="rounded-card border border-hairline bg-surface-2 p-2 text-12 text-ink-1 shadow-raised"
    >
      <div className="mb-1 font-semibold">{heading(datum)}</div>
      <ul>
        {rows(datum).map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="text-ink-2">{r.label}</span>
            <Num {...r.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}
