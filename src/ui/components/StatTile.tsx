// KPI tile (DESIGN §13.3 KPI tiles, §13.20 typography): a label, the value at 24 px semibold in tabular figures
// (compact money on tiles, 13.2), an optional delta coloured by the metric's goodDirection with arrow and sign, a few
// lines of context and an optional chart (a sparkline). Every number is a <Num>, so the tile explains itself (13.13);
// a tile holds numbers, so it never sits on grain (13.20, T28).
import type { ReactNode } from 'react';
import { Num, type NumProps } from '../explain/Num';

export interface StatTileProps {
  /** The tile's name, also its region's accessible name. */
  readonly label: string;
  readonly value: NumProps;
  /** A change (week on week, vs plan); rendered with `fmt.delta` and the arrow (13.2). */
  readonly delta?: NumProps;
  /** Short context lines under the value (`runway ≈ 9 weeks`, `incl. planned cleanups (P50)`). */
  readonly children?: ReactNode;
  /** A small chart beside the value (Sparkline). */
  readonly chart?: ReactNode;
  /** `data-tile` value, for tests and the tutorial's anchors. */
  readonly id?: string;
}

export function StatTile({ label, value, delta, children, chart, id }: StatTileProps) {
  const deltaProps: NumProps | undefined =
    delta === undefined ? undefined : { ...delta, fmt: { ...delta.fmt, delta: true } };
  return (
    <section
      aria-label={label}
      data-tile={id ?? ''}
      className="flex min-w-0 flex-col gap-1 rounded-card border border-hairline bg-surface-1 p-3"
    >
      <h3 className="text-13 font-medium text-ink-2">{label}</h3>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <Num {...value} className="text-24 font-semibold text-ink-1" />
          {deltaProps === undefined ? null : (
            <div className="text-13">
              <Num {...deltaProps} />
            </div>
          )}
        </div>
        {chart === undefined ? null : <div className="shrink-0">{chart}</div>}
      </div>
      {children === undefined ? null : <div className="text-12 text-ink-2">{children}</div>}
    </section>
  );
}
