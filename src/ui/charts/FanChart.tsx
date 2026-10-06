// Fan chart (DESIGN §13.18: Recharts `ComposedChart`, a stacked `Area` pair for the P10–P90 band on a transparent
// base plus a `Line` for P50; 13.5 the estimate's history with trigger markers and the seller-implied dashed line).
// One y-axis; the band takes one sequential ramp (gold for gold quantities, slate otherwise, 13.20); a reference value
// is a dashed ink line, never a status or brass mark.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExplainRef, Unit } from '../../engine';
import { formatValue } from '../format';
import { ChartFigure } from './ChartFigure';
import { ChartTooltip } from './ChartTooltip';
import { CHART_COLORS, MARKS, rampColor, shouldAnimate, tickText, useReducedMotion, type Ramp } from './theme';
import { useWeekLabel } from './weekLabel';

export interface FanPoint {
  readonly turn: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly explain: ExplainRef;
}

export interface FanChartProps {
  readonly title: string;
  readonly points: readonly FanPoint[];
  readonly unit: Unit;
  readonly ramp?: Ramp;
  /** A reference level (the seller-implied grade, a cutoff), drawn dashed with its label. */
  readonly reference?: { readonly value: number; readonly label: string };
  /** Events on the time axis (a program's results, a cleanup), drawn as thin vertical lines. */
  readonly markers?: readonly { readonly turn: number; readonly label: string }[];
  readonly height?: number;
  readonly id?: string;
}

interface Row {
  readonly turn: number;
  readonly base: number;
  readonly band: number;
  readonly p50: number;
  readonly point: FanPoint;
}

/** The stacked band rows: a transparent base at P10 and the band's height P90 − P10. */
export function fanRows(points: readonly FanPoint[]): Row[] {
  return points.map((p) => ({ turn: p.turn, base: p.p10, band: Math.max(0, p.p90 - p.p10), p50: p.p50, point: p }));
}

export function FanChart({
  title,
  points,
  unit,
  ramp = 'slate',
  reference,
  markers = [],
  height = 220,
  id,
}: FanChartProps) {
  const reduced = useReducedMotion();
  const week = useWeekLabel();
  const animate = shouldAnimate(reduced, points.length);
  const last = points[points.length - 1];
  const summary =
    last === undefined
      ? 'No estimate history yet.'
      : `At ${week(last.turn)} the P50 is ${formatValue(last.p50, unit)}, with P10–P90 from ${formatValue(last.p10, unit)} to ${formatValue(last.p90, unit)}.`;
  return (
    <ChartFigure
      title={title}
      summary={summary}
      id={id ?? 'fan'}
      twin={{
        caption: title,
        columns: ['Week', 'P10', 'P50', 'P90'],
        rows: points.map((p) => ({
          key: String(p.turn),
          label: week(p.turn),
          cells: [
            { value: p.p10, unit, explain: p.explain, label: `${title}, P10` },
            { value: p.p50, unit, explain: p.explain, label: `${title}, P50` },
            { value: p.p90, unit, explain: p.explain, label: `${title}, P90` },
          ],
        })),
      }}
    >
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
        <ComposedChart data={fanRows(points)} accessibilityLayer={false} title={summary}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="turn"
            tickFormatter={week}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v: number) => tickText(v, unit)}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
            width={72}
          />
          <Area dataKey="base" stackId="fan" stroke="none" fill="transparent" isAnimationActive={animate} />
          <Area
            dataKey="band"
            stackId="fan"
            stroke="none"
            fill={rampColor(ramp, 3)}
            fillOpacity={1}
            isAnimationActive={animate}
          />
          <Line
            dataKey="p50"
            stroke={rampColor(ramp, 6)}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            isAnimationActive={animate}
          />
          {reference === undefined ? null : (
            <ReferenceLine
              y={reference.value}
              stroke={CHART_COLORS.ink}
              strokeDasharray="5 4"
              label={{ value: reference.label, fill: CHART_COLORS.label, fontSize: 12, position: 'insideTopRight' }}
            />
          )}
          {markers.map((m) => (
            <ReferenceLine
              key={`${m.turn}-${m.label}`}
              x={m.turn}
              stroke={CHART_COLORS.axis}
              label={{ value: m.label, fill: CHART_COLORS.label, fontSize: 12, position: 'top' }}
            />
          ))}
          <Tooltip
            content={
              <ChartTooltip<Row>
                heading={(r) => week(r.turn)}
                rows={(r) => [
                  { label: 'P90', value: { value: r.point.p90, unit, explain: r.point.explain } },
                  { label: 'P50', value: { value: r.point.p50, unit, explain: r.point.explain } },
                  { label: 'P10', value: { value: r.point.p10, unit, explain: r.point.explain } },
                ]}
              />
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
