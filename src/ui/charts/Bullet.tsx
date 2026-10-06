// Bullet charts (DESIGN §13.3 "Production vs plan bullets per claim"; 13.18: Recharts `BarChart`, `layout="vertical"`):
// one row per claim, the actual as a bar in the claim's series slot and the plan as a target tick. Whether a row is on
// track is a status read from the variance thresholds (ui.planVarianceWarnPct / BadPct) and shown as an icon and a word
// in the twin, never by the bar's color (13.2: status is not a series).
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { uiConfig } from '../../data/tuning/ui';
import type { ExplainRef, Unit } from '../../engine';
import type { Status } from '../components/StatusChip';
import { ChartFigure } from './ChartFigure';
import { ChartTooltip } from './ChartTooltip';
import { CHART_COLORS, seriesColor, shouldAnimate, tickText, useReducedMotion } from './theme';

export interface BulletRow {
  readonly key: string;
  readonly label: string;
  readonly actual: number;
  readonly target: number;
  readonly explainActual: ExplainRef;
  readonly explainTarget: ExplainRef;
  /** The row's series slot (a claim keeps its slot, 13.2). */
  readonly slot: number;
}

export interface BulletProps {
  readonly title: string;
  readonly rows: readonly BulletRow[];
  readonly unit: Unit;
  readonly height?: number;
  readonly id?: string;
}

/** 13.3 production vs plan: on track above −warn, behind to −bad, well behind below it. */
export function planStatus(
  actual: number,
  target: number,
): { readonly variance: number | null; readonly status: Status } {
  if (!(target > 0)) return { variance: null, status: 'good' };
  const variance = actual / target - 1;
  if (variance < -uiConfig['ui.planVarianceBadPct']) return { variance, status: 'critical' };
  if (variance < -uiConfig['ui.planVarianceWarnPct']) return { variance, status: 'warning' };
  return { variance, status: 'good' };
}

const STATUS_TEXT: Readonly<Record<Status, string>> = {
  good: 'on track',
  warning: 'behind plan',
  serious: 'behind plan',
  critical: 'well behind plan',
};

/** The plan tick: a 2 px ink line across the row at the target. */
function TargetTick(props: { x?: number; y?: number; width?: number; height?: number }) {
  const { x = 0, y = 0, width = 0, height = 0 } = props;
  const at = x + width;
  return <line x1={at} x2={at} y1={y - 3} y2={y + height + 3} stroke={CHART_COLORS.ink} strokeWidth={2} />;
}

export function Bullet({ title, rows, unit, height, id }: BulletProps) {
  const reduced = useReducedMotion();
  const h = height ?? Math.max(80, rows.length * 36 + 40);
  const behind = rows.filter((r) => planStatus(r.actual, r.target).status !== 'good').length;
  const summary =
    rows.length === 0
      ? 'No plan to compare with yet.'
      : behind === 0
        ? `All ${rows.length} on track against plan.`
        : `${behind} of ${rows.length} behind plan.`;
  return (
    <ChartFigure
      title={title}
      summary={summary}
      id={id ?? 'bullet'}
      twin={{
        caption: title,
        columns: ['', 'Actual', 'Plan', 'Variance', 'Status'],
        rows: rows.map((r) => {
          const s = planStatus(r.actual, r.target);
          return {
            key: r.key,
            label: r.label,
            cells: [
              { value: r.actual, unit, explain: r.explainActual, label: `${r.label}, actual` },
              { value: r.target, unit, explain: r.explainTarget, label: `${r.label}, plan` },
              s.variance === null
                ? null
                : {
                    value: s.variance,
                    unit: 'pct',
                    fmt: { delta: true },
                    explain: r.explainActual,
                    label: `${r.label}, variance`,
                  },
              STATUS_TEXT[s.status],
            ],
          };
        }),
      }}
    >
      <ResponsiveContainer width="100%" height={h} initialDimension={{ width: 640, height: h }}>
        <BarChart
          data={[...rows]}
          layout="vertical"
          accessibilityLayer={false}
          title={summary}
          barGap={-14}
          barSize={14}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => tickText(v, unit)}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
          />
          <Bar dataKey="actual" isAnimationActive={shouldAnimate(reduced, rows.length)}>
            {rows.map((r) => (
              <Cell key={r.key} fill={seriesColor(r.slot)} />
            ))}
          </Bar>
          <Bar dataKey="target" fill="transparent" shape={<TargetTick />} isAnimationActive={false} />
          <Tooltip
            cursor={false}
            content={
              <ChartTooltip<BulletRow>
                heading={(r) => r.label}
                rows={(r) => [
                  { label: 'Actual', value: { value: r.actual, unit, explain: r.explainActual } },
                  { label: 'Plan', value: { value: r.target, unit, explain: r.explainTarget } },
                ]}
              />
            }
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
