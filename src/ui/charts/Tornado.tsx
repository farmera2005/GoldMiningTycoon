// Tornado chart (DESIGN §13.5 Valuation: §5 `valueSensitivity`; 13.18: Recharts `BarChart`, `layout="vertical"`; 13.20
// diverging only against a reference: slate below the base value, gold above it, a neutral midpoint). One row per input,
// sorted by swing; each row's low and high outcomes are bars from the base, coloured by which side of the base they
// fall, whichever input end produced them.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { CHART_COLORS, shouldAnimate, tickText, useReducedMotion } from './theme';

export interface TornadoRow {
  readonly key: string;
  /** The input (`Grade P10 → P90`, `Gold price ±15%`). */
  readonly label: string;
  /** The outcome at the input's low and high end, in the chart's unit. */
  readonly low: number;
  readonly high: number;
  readonly explainLow: ExplainRef;
  readonly explainHigh: ExplainRef;
}

export interface TornadoProps {
  readonly title: string;
  readonly base: number;
  readonly baseLabel: string;
  readonly baseExplain: ExplainRef;
  readonly rows: readonly TornadoRow[];
  readonly unit: Unit;
  readonly height?: number;
  readonly id?: string;
}

interface Datum {
  readonly key: string;
  readonly label: string;
  readonly lowDelta: number;
  readonly highDelta: number;
  readonly row: TornadoRow;
}

/** Rows as deltas from the base, widest swing first (the tornado's shape). */
export function tornadoData(rows: readonly TornadoRow[], base: number): Datum[] {
  return rows
    .map((r) => ({ key: r.key, label: r.label, lowDelta: r.low - base, highDelta: r.high - base, row: r }))
    .sort((a, b) => Math.abs(b.highDelta - b.lowDelta) - Math.abs(a.highDelta - a.lowDelta));
}

const side = (delta: number): string => (delta < 0 ? CHART_COLORS.divNeg : CHART_COLORS.divPos);

export function Tornado({ title, base, baseLabel, baseExplain, rows, unit, height, id }: TornadoProps) {
  const reduced = useReducedMotion();
  const data = tornadoData(rows, base);
  const h = height ?? Math.max(100, data.length * 32 + 48);
  const top = data[0];
  const summary =
    top === undefined
      ? 'No sensitivities to show.'
      : `${baseLabel} ${formatValue(base, unit)}; the largest swing comes from ${top.label}.`;
  return (
    <ChartFigure
      title={title}
      summary={summary}
      id={id ?? 'tornado'}
      twin={{
        caption: title,
        columns: ['Input', 'Low end', 'High end'],
        rows: [
          {
            key: '__base',
            label: baseLabel,
            cells: [{ value: base, unit, explain: baseExplain, label: baseLabel }, null],
          },
          ...data.map((d) => ({
            key: d.key,
            label: d.label,
            cells: [
              { value: d.row.low, unit, explain: d.row.explainLow, label: `${d.label}, low end` },
              { value: d.row.high, unit, explain: d.row.explainHigh, label: `${d.label}, high end` },
            ],
          })),
        ],
      }}
    >
      <ResponsiveContainer width="100%" height={h} initialDimension={{ width: 640, height: h }}>
        <BarChart data={data} layout="vertical" accessibilityLayer={false} title={summary} barGap={-16} barSize={16}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => tickText(v + base, unit)}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={160}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <ReferenceLine
            x={0}
            stroke={CHART_COLORS.ink}
            strokeWidth={1.5}
            label={{ value: baseLabel, fill: CHART_COLORS.label, fontSize: 12, position: 'top' }}
          />
          <Bar dataKey="lowDelta" isAnimationActive={shouldAnimate(reduced, data.length)}>
            {data.map((d) => (
              <Cell key={d.key} fill={side(d.lowDelta)} />
            ))}
          </Bar>
          <Bar dataKey="highDelta" isAnimationActive={shouldAnimate(reduced, data.length)}>
            {data.map((d) => (
              <Cell key={d.key} fill={side(d.highDelta)} />
            ))}
          </Bar>
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip<Datum>
                heading={(d) => d.label}
                rows={(d) => [
                  { label: 'Low end', value: { value: d.row.low, unit, explain: d.row.explainLow } },
                  { label: 'High end', value: { value: d.row.high, unit, explain: d.row.explainHigh } },
                ]}
              />
            }
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
