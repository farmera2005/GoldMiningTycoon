// Sparkline (DESIGN §13.3 KPI tiles, §13.18: Recharts `LineChart`, no axes): a tile's recent series, actual weeks
// solid and forecast weeks dashed (the cash tile's 13 actual + 13 forecast weeks, labelled `incl. planned cleanups
// (P50)`). It is too small for a Table view toggle: its caption summarises the line for assistive technology, the
// tile's own number is the explained value, and the full series with its table twin is the screen's larger chart
// (the dashboard's 13-week cash chart, 13.3), so no value is readable only from the sparkline's tooltip.
import { Line, LineChart, Tooltip } from 'recharts';
import type { ExplainRef, Unit } from '../../engine';
import { formatValue } from '../format';
import { ChartTooltip } from './ChartTooltip';
import { MARKS, seriesColor, shouldAnimate, useReducedMotion } from './theme';
import { useWeekLabel } from './weekLabel';

export interface SparkPoint {
  readonly turn: number;
  readonly value: number;
  readonly explain: ExplainRef;
  /** A forecast point (drawn dashed); actual otherwise. */
  readonly forecast?: boolean;
}

export interface SparklineProps {
  readonly label: string;
  readonly points: readonly SparkPoint[];
  readonly unit: Unit;
  readonly slot?: number;
  readonly width?: number;
  readonly height?: number;
}

interface Row {
  readonly turn: number;
  readonly actual?: number;
  readonly forecast?: number;
  readonly point: SparkPoint;
}

/** Recharts rows: actual and forecast as two keys, the last actual repeated as the forecast's start so they join. */
export function sparkRows(points: readonly SparkPoint[]): Row[] {
  const lastActual = [...points].reverse().find((p) => p.forecast !== true);
  return points.map((p) => {
    if (p.forecast === true) return { turn: p.turn, forecast: p.value, point: p };
    return p === lastActual
      ? { turn: p.turn, actual: p.value, forecast: p.value, point: p }
      : { turn: p.turn, actual: p.value, point: p };
  });
}

export function Sparkline({ label, points, unit, slot = 0, width = 120, height = 32 }: SparklineProps) {
  const reduced = useReducedMotion();
  const week = useWeekLabel();
  const first = points[0];
  const last = points[points.length - 1];
  const summary =
    first === undefined || last === undefined
      ? `${label}: no data yet`
      : `${label}, ${week(first.turn)} to ${week(last.turn)}: from ${formatValue(first.value, unit)} to ${formatValue(last.value, unit)}`;
  const color = seriesColor(slot);
  const animate = shouldAnimate(reduced, points.length);
  return (
    <figure className="m-0" data-chart="sparkline">
      <figcaption className="sr-only">{summary}</figcaption>
      <LineChart width={width} height={height} data={sparkRows(points)} accessibilityLayer={false} title={summary}>
        <Line
          type="linear"
          dataKey="actual"
          stroke={color}
          strokeWidth={MARKS.lineWidth}
          dot={false}
          isAnimationActive={animate}
          connectNulls={false}
        />
        <Line
          type="linear"
          dataKey="forecast"
          stroke={color}
          strokeWidth={MARKS.lineWidth}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={animate}
          connectNulls={false}
        />
        <Tooltip
          cursor={false}
          content={
            <ChartTooltip<Row>
              heading={(r) => `${week(r.turn)}${r.point.forecast === true ? ' (forecast)' : ''}`}
              rows={(r) => [{ label, value: { value: r.point.value, unit, explain: r.point.explain } }]}
            />
          }
        />
      </LineChart>
    </figure>
  );
}
