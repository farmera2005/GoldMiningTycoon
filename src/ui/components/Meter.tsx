// A meter: a value against a limit (DESIGN §13.18 custom SVG meters; 13.7 stripping coverage, water, camp capacity;
// 13.8 permit condition meters from P2). The fill is a picture; the numbers are <Num>s and the state reads as an
// icon and a word (13.2: status never by color alone). Status thresholds are fractions of the limit: at or above
// `warnFrac` (default ui.condMeterWarnFrac) → warning, at or above 1 → critical, unless `higherIsBetter` turns the
// scale around (coverage: below 1 is the problem).
import { uiConfig } from '../../data/tuning/ui';
import type { ExplainRef, Unit } from '../../engine';
import { Num } from '../explain/Num';
import { StatusText, type Status } from './StatusChip';

export interface MeterProps {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly unit: Unit;
  readonly explain: ExplainRef;
  /** Explanation of the limit, when it has its own (a tuning key, a permit condition). */
  readonly maxExplain?: ExplainRef;
  readonly warnFrac?: number;
  /** For coverage-like meters: falling short of the limit is the problem. */
  readonly higherIsBetter?: boolean;
  readonly width?: number;
}

/** The meter's status from value/max (see the file comment), or null while it is comfortably inside. */
export function meterStatus(
  value: number,
  max: number,
  options: { readonly warnFrac?: number; readonly higherIsBetter?: boolean } = {},
): Status | null {
  if (!(max > 0)) return null;
  const frac = value / max;
  const warn = options.warnFrac ?? uiConfig['ui.condMeterWarnFrac'];
  if (options.higherIsBetter === true) {
    if (frac < warn) return 'critical';
    if (frac < 1) return 'warning';
    return null;
  }
  if (frac >= 1) return 'critical';
  if (frac >= warn) return 'warning';
  return null;
}

const STATUS_WORD: Readonly<Record<Status, string>> = {
  good: 'within limit',
  warning: 'near limit',
  serious: 'at risk',
  critical: 'over limit',
};

export function Meter({ label, value, max, unit, explain, maxExplain, warnFrac, higherIsBetter, width = 160 }: MeterProps) {
  const options = {
    ...(warnFrac === undefined ? {} : { warnFrac }),
    ...(higherIsBetter === undefined ? {} : { higherIsBetter }),
  };
  const status = meterStatus(value, max, options);
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fill = status === null ? 'var(--seq-slate-500)' : `var(--status-${status})`;
  const word =
    status === null ? null : higherIsBetter === true ? (status === 'critical' ? 'short' : 'below target') : STATUS_WORD[status];
  return (
    <div className="flex flex-wrap items-center gap-2 text-13" data-meter="">
      <span className="text-ink-2">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="relative h-2.5 shrink-0 overflow-hidden rounded-control bg-surface-2 outline outline-1 outline-border-control"
        style={{ width }}
      >
        <div className="h-full" style={{ width: `${frac * 100}%`, background: fill }} />
      </div>
      <span>
        <Num value={value} unit={unit} explain={explain} label={label} /> of{' '}
        <Num value={max} unit={unit} explain={maxExplain ?? explain} label={`${label} limit`} />
      </span>
      {status === null ? null : <StatusText status={status}>{word}</StatusText>}
    </div>
  );
}
