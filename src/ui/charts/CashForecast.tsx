// The cash line (DESIGN §13.3 "13-week cash line with zero line, cleanup-inflow chips and large payment chips", 13.11
// 13-week report, D-13.48): actual weeks solid, §11's forecast weeks dashed, one series and one y-axis, a labelled zero
// line, and chips on the weeks with a planned cleanup inflow or a large payment. The forecast's label (`incl. planned
// cleanups (P50)`) is the caller's legend, since the series is §11's.
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReactNode } from 'react';
import type { ExplainRef } from '../../engine';
import { formatValue } from '../format';
import { ChartFigure } from './ChartFigure';
import { ChartTooltip } from './ChartTooltip';
import { CHART_COLORS, MARKS, seriesColor, shouldAnimate, tickText, useReducedMotion } from './theme';
import { useWeekLabel } from './weekLabel';

export interface CashPoint {
  readonly turn: number;
  readonly cents: number;
  readonly explain: ExplainRef;
}

export interface CashChip {
  readonly turn: number;
  readonly label: string;
  readonly kind: 'cleanup' | 'payment';
}

export interface CashForecastProps {
  readonly title: string;
  readonly actual: readonly CashPoint[];
  readonly forecast: readonly CashPoint[];
  readonly chips?: readonly CashChip[];
  /** The forecast's label, shown as the legend (13.3: `incl. planned cleanups (P50)`). */
  readonly legend?: ReactNode;
  readonly height?: number;
  readonly id?: string;
}

interface Row {
  readonly turn: number;
  readonly actual?: number;
  readonly forecast?: number;
  readonly point: CashPoint;
  readonly isForecast: boolean;
}

/** One row per week; the last actual week also starts the forecast so the two lines join. */
export function cashRows(actual: readonly CashPoint[], forecast: readonly CashPoint[]): Row[] {
  const rows: Row[] = actual.map((p) => ({ turn: p.turn, actual: p.cents, point: p, isForecast: false }));
  const last = rows[rows.length - 1];
  if (last !== undefined && last.actual !== undefined && forecast.length > 0) {
    rows[rows.length - 1] = { ...last, forecast: last.actual };
  }
  for (const p of forecast) rows.push({ turn: p.turn, forecast: p.cents, point: p, isForecast: true });
  return rows;
}

/** The first forecast week whose ending cash is below zero, or null. */
export function firstNegativeWeek(forecast: readonly CashPoint[]): number | null {
  return forecast.find((p) => p.cents < 0)?.turn ?? null;
}

export function CashForecast({ title, actual, forecast, chips = [], legend, height = 240, id }: CashForecastProps) {
  const reduced = useReducedMotion();
  const week = useWeekLabel();
  const rows = cashRows(actual, forecast);
  const animate = shouldAnimate(reduced, rows.length);
  const color = seriesColor(0);
  const negative = firstNegativeWeek(forecast);
  const end = forecast[forecast.length - 1] ?? actual[actual.length - 1];
  const summary =
    end === undefined
      ? 'No cash history yet.'
      : `Cash ends ${week(end.turn)} at ${formatValue(end.cents, 'cents')}; ${negative === null ? 'it stays above zero.' : `it goes below zero in ${week(negative)}.`}`;
  return (
    <ChartFigure
      title={title}
      summary={summary}
      legend={legend}
      id={id ?? 'cash-forecast'}
      twin={{
        caption: title,
        columns: ['Week', 'Cash', 'Kind', 'Events'],
        rows: rows.map((r) => ({
          key: `${r.turn}-${r.isForecast ? 'f' : 'a'}`,
          label: week(r.turn),
          cells: [
            { value: r.point.cents, unit: 'cents', explain: r.point.explain, label: `Cash, ${week(r.turn)}` },
            r.isForecast ? 'Forecast' : 'Actual',
            chips
              .filter((c) => c.turn === r.turn)
              .map((c) => c.label)
              .join('; ') || null,
          ],
        })),
      }}
    >
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
        <LineChart data={rows} accessibilityLayer={false} title={summary}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="turn"
            tickFormatter={week}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v: number) => tickText(v, 'cents')}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
            width={72}
          />
          <ReferenceLine
            y={0}
            stroke={CHART_COLORS.axis}
            strokeWidth={1.5}
            label={{ value: '$0', fill: CHART_COLORS.label, fontSize: 12, position: 'insideLeft' }}
          />
          {chips.map((c) => (
            <ReferenceLine
              key={`${c.turn}-${c.label}`}
              x={c.turn}
              stroke={CHART_COLORS.axis}
              strokeDasharray={c.kind === 'payment' ? '2 3' : undefined}
              label={{ value: c.label, fill: CHART_COLORS.label, fontSize: 12, position: 'top' }}
            />
          ))}
          <Line
            dataKey="actual"
            stroke={color}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            isAnimationActive={animate}
            connectNulls={false}
          />
          <Line
            dataKey="forecast"
            stroke={color}
            strokeWidth={MARKS.lineWidth}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={animate}
            connectNulls={false}
          />
          <Tooltip
            content={
              <ChartTooltip<Row>
                heading={(r) => `${week(r.turn)}${r.isForecast ? ' (forecast)' : ''}`}
                rows={(r) => [
                  { label: 'Cash', value: { value: r.point.cents, unit: 'cents', explain: r.point.explain } },
                ]}
              />
            }
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
