// The season strip (DESIGN §13.3 "Season clock"; 13.18: custom SVG): one 52-week strip per district, segmented by
// phase, with a today marker. A boundary that has happened is a solid tick; one that has not is drawn as its likely
// range (P10–P90 from §1 `seasonForecast`, labelled "likely range") with texture. The caller builds the props from §1
// `seasonView`, which exposes revealed dates and the current forecast only, so the strip can never show a hidden date
// (D-13.38, T23). Arid districts pass overlays (monsoon, fire restrictions) instead of winter phases.
import { useId } from 'react';
import type { SeasonPhase } from '../../engine';
import { CHART_COLORS, rampColor } from './theme';

export interface SeasonSegment {
  readonly fromWeek: number;
  readonly toWeek: number;
  readonly phase: SeasonPhase;
}

export type SeasonBoundary =
  | { readonly kind: 'revealed'; readonly week: number; readonly label: string }
  | {
      readonly kind: 'range';
      readonly p10Week: number;
      readonly p50Week: number;
      readonly p90Week: number;
      readonly label: string;
    };

export interface SeasonOverlay {
  readonly fromWeek: number;
  readonly toWeek: number;
  readonly label: string;
}

export interface SeasonStripProps {
  readonly district: string;
  /** The clock's sentence (`Operating · wk 6 of ~22 · freeze-up likely wk 42 (40–44) · ~16 wks left (14–18)`). */
  readonly summary: string;
  readonly nowWeek: number;
  readonly segments: readonly SeasonSegment[];
  readonly boundaries: readonly SeasonBoundary[];
  readonly overlays?: readonly SeasonOverlay[];
  readonly width?: number;
}

const WEEKS = 52;

/** Phase fills: one slate ramp (13.20: every non-gold magnitude), darker for the closed part of the year. */
export const PHASE_FILL: Readonly<Record<SeasonPhase, string>> = {
  winter: rampColor('slate', 4),
  breakup: rampColor('slate', 2),
  operating: rampColor('slate', 1),
  freezeup: rampColor('slate', 2),
};

/** x of the start of week `week` (1-based) on a strip `width` wide. */
export function weekX(week: number, width: number): number {
  return ((Math.min(WEEKS + 1, Math.max(1, week)) - 1) / WEEKS) * width;
}

export function SeasonStrip({
  district,
  summary,
  nowWeek,
  segments,
  boundaries,
  overlays = [],
  width = 360,
}: SeasonStripProps) {
  const hatchId = useId().replace(/:/g, '');
  const h = 18;
  const top = 6;
  const total = top + h + 16;
  return (
    <figure className="m-0" data-season-strip="">
      <figcaption className="mb-1 text-13">
        <span className="font-semibold text-ink-1">{district}</span>
        <span className="text-ink-2"> · {summary}</span>
      </figcaption>
      <svg width={width} height={total} role="img" aria-label={`${district}: ${summary}`} focusable="false">
        <defs>
          <pattern id={hatchId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} stroke={CHART_COLORS.muted} strokeWidth={1.5} />
          </pattern>
        </defs>
        <rect
          x={0}
          y={top}
          width={width}
          height={h}
          fill={CHART_COLORS.surface}
          stroke={CHART_COLORS.axis}
          strokeWidth={1}
        />
        {segments.map((s) => (
          <rect
            key={`${s.phase}-${s.fromWeek}`}
            x={weekX(s.fromWeek, width)}
            y={top}
            width={Math.max(0, weekX(s.toWeek + 1, width) - weekX(s.fromWeek, width))}
            height={h}
            fill={PHASE_FILL[s.phase]}
            data-phase={s.phase}
          />
        ))}
        {overlays.map((o) => (
          <rect
            key={`${o.label}-${o.fromWeek}`}
            x={weekX(o.fromWeek, width)}
            y={top}
            width={Math.max(0, weekX(o.toWeek + 1, width) - weekX(o.fromWeek, width))}
            height={h / 2}
            fill={`url(#${hatchId})`}
            data-overlay={o.label}
          />
        ))}
        {boundaries.map((b) =>
          b.kind === 'revealed' ? (
            <line
              key={`r-${b.week}-${b.label}`}
              x1={weekX(b.week, width)}
              x2={weekX(b.week, width)}
              y1={top - 4}
              y2={top + h + 4}
              stroke={CHART_COLORS.ink}
              strokeWidth={2}
              data-boundary="revealed"
            />
          ) : (
            <g key={`f-${b.p50Week}-${b.label}`} data-boundary="range">
              <rect
                x={weekX(b.p10Week, width)}
                y={top}
                width={Math.max(2, weekX(b.p90Week + 1, width) - weekX(b.p10Week, width))}
                height={h}
                fill={`url(#${hatchId})`}
              />
              <line
                x1={weekX(b.p50Week, width)}
                x2={weekX(b.p50Week, width)}
                y1={top}
                y2={top + h}
                stroke={CHART_COLORS.ink}
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            </g>
          ),
        )}
        <g data-now-week={nowWeek}>
          <line
            x1={weekX(nowWeek, width)}
            x2={weekX(nowWeek, width)}
            y1={top - 6}
            y2={top + h + 2}
            stroke={CHART_COLORS.ink}
            strokeWidth={2}
          />
          <path
            d={`M${weekX(nowWeek, width) - 4},${top - 6} L${weekX(nowWeek, width) + 4},${top - 6} L${weekX(nowWeek, width)},${top - 1} Z`}
            fill={CHART_COLORS.ink}
          />
        </g>
        <text x={0} y={total - 2} fontSize={12} fill={CHART_COLORS.label}>
          Wk 1
        </text>
        <text x={width} y={total - 2} fontSize={12} fill={CHART_COLORS.label} textAnchor="end">
          Wk 52
        </text>
      </svg>
      {boundaries.some((b) => b.kind === 'range') ? (
        <p className="text-12 text-ink-2">Hatched: likely range (forecast). Solid tick: date already passed.</p>
      ) : null}
    </figure>
  );
}
