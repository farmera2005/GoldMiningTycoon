// Estimate ranges (DESIGN §13.2 "Estimate ranges": P50 in bold, P10–P90 muted; 13.5) and the range bar, a custom SVG
// (13.18: range bars are custom SVG): a track over the scale, the P10–P90 band, a P50 tick and an optional reference
// line (a cutoff grade, an ask). The bar is a picture of the numbers beside it, which are <Num>s, so the SVG is hidden
// from assistive technology and the text carries the values (13.19: charts have text twins).
import type { ExplainRef, Unit } from '../../engine';
import { Num } from '../explain/Num';

export interface EstimateRangeProps {
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly unit: Unit;
  /** Where the estimate's explanation lives (the same tree explains the three quantiles). */
  readonly explain: ExplainRef;
  readonly label?: string;
}

/** `**0.0090** (0.0050–0.0160) oz/bcy` as three explainable numbers. */
export function EstimateRange({ p10, p50, p90, unit, explain, label }: EstimateRangeProps) {
  const name = label ?? 'Estimate';
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1" data-estimate-range="">
      <Num value={p50} unit={unit} explain={explain} label={`${name}, P50`} className="font-semibold text-ink-1" />
      <span className="text-ink-3">
        (<Num value={p10} unit={unit} explain={explain} label={`${name}, P10`} className="text-ink-3" />
        {'–'}
        <Num value={p90} unit={unit} explain={explain} label={`${name}, P90`} className="text-ink-3" />)
      </span>
    </span>
  );
}

export interface RangeBarProps {
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  /** The scale; default a little beyond the range. */
  readonly min?: number;
  readonly max?: number;
  /** A reference value drawn as a line (cutoff, ask, plan). */
  readonly reference?: number;
  readonly width?: number;
  readonly height?: number;
}

/** Position of `v` on [min, max] as a fraction, clamped. */
export function scalePosition(v: number, min: number, max: number): number {
  if (!(max > min)) return 0.5;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

export function RangeBar({ p10, p50, p90, min, max, reference, width = 160, height = 14 }: RangeBarProps) {
  const span = Math.max(p90 - p10, Math.abs(p50) * 0.1, 1e-9);
  const lo = min ?? Math.min(p10, reference ?? p10) - span * 0.15;
  const hi = max ?? Math.max(p90, reference ?? p90) + span * 0.15;
  const x = (v: number): number => scalePosition(v, lo, hi) * width;
  const mid = height / 2;
  return (
    <svg width={width} height={height} aria-hidden="true" focusable="false" data-range-bar="">
      <line x1={0} x2={width} y1={mid} y2={mid} stroke="var(--axis)" strokeWidth={1} />
      <rect x={x(p10)} y={mid - 4} width={Math.max(2, x(p90) - x(p10))} height={8} rx={2} fill="var(--seq-slate-300)" />
      <line x1={x(p50)} x2={x(p50)} y1={1} y2={height - 1} stroke="var(--ink-1)" strokeWidth={2} />
      {reference === undefined ? null : (
        <line
          x1={x(reference)}
          x2={x(reference)}
          y1={0}
          y2={height}
          stroke="var(--ink-2)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}
