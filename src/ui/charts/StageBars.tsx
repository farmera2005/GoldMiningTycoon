// Stage bars, the bottleneck view (DESIGN §13.7 Flow tab, D-13.6; 13.18: custom SVG, since the rows need annotations
// Recharts handles poorly). One row per stage: capacity as a light track, achieved throughput as a dark bar,
// utilization, and a stacked bar of every scheduled hour by §7 IdleCause; the root stage carries a `Bottleneck` chip.
// The rows come from ui-ops' `stageRows` view model; this component only draws them, with the table twin carrying
// every number as a <Num>. Idle causes take series slots in their listed order (categorical), folding past eight.
import type { ExplainRef } from '../../engine';
import { hoursWeekly, pct } from '../format';
import { ChartFigure } from './ChartFigure';
import { CHART_COLORS, MARKS, SERIES_SLOTS, rampColor, seriesColor } from './theme';

export interface StageIdle {
  readonly cause: string;
  readonly label: string;
  readonly hours: number;
}

export interface StageRowView {
  readonly stage: string;
  readonly label: string;
  /** bcy per week. */
  readonly capacity: number;
  readonly throughput: number;
  /** 0..1 of scheduled hours worked. */
  readonly utilization: number;
  readonly scheduledHours: number;
  readonly idle: readonly StageIdle[];
  readonly bottleneck: boolean;
  /** A stage shared across plant lines in a line view (13.7, P3). */
  readonly shared?: boolean;
  readonly explain: ExplainRef;
}

export interface StageBarsProps {
  readonly title: string;
  readonly summary: string;
  readonly rows: readonly StageRowView[];
  readonly width?: number;
  readonly id?: string;
}

/** Idle causes in first-seen order across the rows: their series slots (the legend order). */
export function idleCauseOrder(rows: readonly StageRowView[]): string[] {
  const out: string[] = [];
  for (const r of rows) for (const i of r.idle) if (!out.includes(i.cause)) out.push(i.cause);
  return out;
}

const LABEL_W = 96;
const ROW_H = 34;

export function StageBars({ title, summary, rows, width = 560, id }: StageBarsProps) {
  const causes = idleCauseOrder(rows);
  const slot = (cause: string): number => Math.min(causes.indexOf(cause), SERIES_SLOTS - 1);
  const maxCap = Math.max(1, ...rows.map((r) => Math.max(r.capacity, r.throughput)));
  const barW = width - LABEL_W - 120;
  const x = (v: number): number => (Math.max(0, v) / maxCap) * barW;
  const labels = new Map(rows.flatMap((r) => r.idle.map((i) => [i.cause, i.label] as const)));
  return (
    <ChartFigure
      title={title}
      summary={summary}
      id={id ?? 'stage-bars'}
      legend={
        causes.length === 0 ? undefined : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Idle causes">
            {causes.map((c) => (
              <li key={c} className="inline-flex items-center gap-1">
                <svg width={10} height={10} aria-hidden="true">
                  <rect width={10} height={10} fill={seriesColor(slot(c))} />
                </svg>
                {labels.get(c) ?? c}
              </li>
            ))}
          </ul>
        )
      }
      twin={{
        caption: title,
        columns: ['Stage', 'Capacity (bcy/wk)', 'Throughput (bcy/wk)', 'Utilization', 'Idle hours', 'Bottleneck'],
        rows: rows.map((r) => ({
          key: r.stage,
          label: `${r.label}${r.shared === true ? ' (shared)' : ''}`,
          cells: [
            { value: r.capacity, unit: 'bcy', explain: r.explain, label: `${r.label} capacity` },
            { value: r.throughput, unit: 'bcy', explain: r.explain, label: `${r.label} throughput` },
            { value: r.utilization, unit: 'pct', explain: r.explain, label: `${r.label} utilization` },
            r.idle.length === 0 ? null : r.idle.map((i) => `${i.label} ${hoursWeekly(i.hours)}`).join('; '),
            r.bottleneck ? 'Bottleneck' : null,
          ],
        })),
      }}
    >
      <svg width={width} height={rows.length * ROW_H + 4} role="img" aria-label={summary} focusable="false">
        {rows.map((r, i) => {
          const y = i * ROW_H + 2;
          let idleX = LABEL_W;
          return (
            <g key={r.stage} data-stage={r.stage} data-bottleneck={r.bottleneck ? '' : undefined}>
              <text
                x={0}
                y={y + 12}
                fontSize={12}
                fill={r.bottleneck ? CHART_COLORS.ink : CHART_COLORS.label}
                fontWeight={r.bottleneck ? 600 : 400}
              >
                {r.label}
              </text>
              <rect x={LABEL_W} y={y + 2} width={x(r.capacity)} height={12} fill={rampColor('slate', 2)} />
              <rect x={LABEL_W} y={y + 5} width={x(r.throughput)} height={6} fill={rampColor('slate', 6)} />
              <text x={LABEL_W + barW + 6} y={y + 12} fontSize={12} fill={CHART_COLORS.label}>
                {pct(r.utilization)}
              </text>
              {r.bottleneck ? (
                <text x={LABEL_W + barW + 44} y={y + 12} fontSize={12} fontWeight={600} fill={CHART_COLORS.ink}>
                  Bottleneck
                </text>
              ) : null}
              {r.idle.map((it) => {
                const w = r.scheduledHours > 0 ? (it.hours / r.scheduledHours) * barW : 0;
                const rect = (
                  <rect
                    key={it.cause}
                    x={idleX}
                    y={y + 18}
                    width={Math.max(0, w - MARKS.fillGap)}
                    height={8}
                    fill={seriesColor(slot(it.cause))}
                    data-idle={it.cause}
                  />
                );
                idleX += w;
                return rect;
              })}
            </g>
          );
        })}
      </svg>
    </ChartFigure>
  );
}
