// Stacked cost columns (DESIGN §13.3 "cash in/out by category", 13.7 cost per hour, 13.11 cost reports; 13.18:
// Recharts stacked `BarChart`): one column per period or claim, one stacked part per category in the fixed series
// order, a 2 px surface gap between parts (13.20). Past eight categories the rest fold into `Other`, so no two parts
// share a slot.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExplainRef, Unit } from '../../engine';
import { ChartFigure } from './ChartFigure';
import { ChartTooltip } from './ChartTooltip';
import { CHART_COLORS, MARKS, SERIES_SLOTS, seriesColor, shouldAnimate, tickText, useReducedMotion } from './theme';

export interface CostCategory {
  readonly key: string;
  readonly label: string;
}

export interface CostColumn {
  readonly key: string;
  readonly label: string;
  /** Category key → amount in the chart's unit. */
  readonly values: Readonly<Record<string, number>>;
  /** Category key → its explanation (a ledger or report ref). */
  readonly explain: Readonly<Record<string, ExplainRef>>;
}

export interface StackedCostProps {
  readonly title: string;
  readonly summary: string;
  readonly categories: readonly CostCategory[];
  readonly columns: readonly CostColumn[];
  readonly unit: Unit;
  readonly height?: number;
  readonly id?: string;
}

export const OTHER_KEY = '__other';

/**
 * At most eight categories keep their own slot; the rest are summed into `Other` (13.20), whose explanation is the
 * first folded category's (a twin row lists each folded value separately).
 */
export function foldCategories(categories: readonly CostCategory[]): { kept: CostCategory[]; folded: CostCategory[] } {
  if (categories.length <= SERIES_SLOTS) return { kept: [...categories], folded: [] };
  return {
    kept: [...categories.slice(0, SERIES_SLOTS - 1), { key: OTHER_KEY, label: 'Other' }],
    folded: categories.slice(SERIES_SLOTS - 1),
  };
}

export function StackedCost({ title, summary, categories, columns, unit, height = 240, id }: StackedCostProps) {
  const reduced = useReducedMotion();
  const { kept, folded } = foldCategories(categories);
  const rows = columns.map((c) => {
    const row: Record<string, number | string> = { key: c.key, label: c.label };
    for (const k of kept) {
      row[k.key] =
        k.key === OTHER_KEY ? folded.reduce((s, f) => s + (c.values[f.key] ?? 0), 0) : (c.values[k.key] ?? 0);
    }
    return row;
  });
  const animate = shouldAnimate(reduced, rows.length * kept.length);
  const explainOf = (col: CostColumn, key: string): ExplainRef | undefined =>
    key === OTHER_KEY ? folded.map((f) => col.explain[f.key]).find((e) => e !== undefined) : col.explain[key];
  return (
    <ChartFigure
      title={title}
      summary={summary}
      id={id ?? 'stacked-cost'}
      twin={{
        caption: title,
        columns: ['', ...categories.map((c) => c.label)],
        rows: columns.map((col) => ({
          key: col.key,
          label: col.label,
          cells: categories.map((cat) => {
            const value = col.values[cat.key];
            const explain = col.explain[cat.key];
            return value === undefined || explain === undefined
              ? null
              : { value, unit, explain, label: `${cat.label}, ${col.label}` };
          }),
        })),
      }}
    >
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
        <BarChart data={rows} accessibilityLayer={false} title={summary}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" stroke={CHART_COLORS.axis} tick={{ fill: CHART_COLORS.label, fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => tickText(v, unit)}
            stroke={CHART_COLORS.axis}
            tick={{ fill: CHART_COLORS.label, fontSize: 12 }}
            width={72}
          />
          {kept.map((k, i) => (
            <Bar
              key={k.key}
              dataKey={k.key}
              name={k.label}
              stackId="cost"
              fill={seriesColor(i)}
              stroke={CHART_COLORS.gap}
              strokeWidth={MARKS.fillGap}
              isAnimationActive={animate}
            />
          ))}
          <Tooltip
            content={
              <ChartTooltip<Record<string, number | string>>
                heading={(r) => String(r['label'])}
                rows={(r) => {
                  const col = columns.find((c) => c.key === r['key']);
                  if (col === undefined) return [];
                  return kept.flatMap((k) => {
                    const explain = explainOf(col, k.key);
                    const value = r[k.key];
                    return explain === undefined || typeof value !== 'number'
                      ? []
                      : [{ label: k.label, value: { value, unit, explain } }];
                  });
                }}
              />
            }
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
