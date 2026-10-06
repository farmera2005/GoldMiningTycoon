// The report period selector (DESIGN §13.11 Reports, D-13.18): the P1 periods plus Custom (two week pickers over the
// weeks played so far). It reports a PeriodSpec; periods.ts resolves it against the engine's calendar. A period that
// does not exist yet (Last year in year 1, Season to date with no season) is listed but disabled.
import { useId } from 'react';
import { yearWeek } from '../format';
import { PERIOD_OPTIONS, resolvePeriod, type PeriodContext, type PeriodSpec } from './periods';

export interface PeriodPickerProps {
  readonly value: PeriodSpec;
  readonly onChange: (spec: PeriodSpec) => void;
  readonly ctx: PeriodContext;
  readonly label?: string;
}

export function PeriodPicker({ value, onChange, ctx, label = 'Period' }: PeriodPickerProps) {
  const id = useId();
  const resolved = resolvePeriod(value, ctx);
  const weeks = Array.from({ length: ctx.now + 1 }, (_, turn) => {
    const v = ctx.dateView(turn);
    return { turn, label: yearWeek(v.year, v.week) };
  });
  const control = 'h-8 rounded-control border border-border-control bg-surface-2 px-2 text-13 text-ink-1';
  return (
    <div className="flex flex-wrap items-center gap-2 text-13" data-period-picker="">
      <label htmlFor={id} className="text-ink-2">
        {label}
      </label>
      <select
        id={id}
        className={control}
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value as PeriodSpec['kind'];
          onChange(kind === 'custom' ? { kind, fromTurn: resolved?.fromTurn ?? 0, toTurn: ctx.now } : { kind });
        }}
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.kind} value={o.kind} disabled={o.kind !== 'custom' && resolvePeriod({ kind: o.kind }, ctx) === null}>
            {o.label}
          </option>
        ))}
      </select>
      {value.kind === 'custom' ? (
        <>
          <select
            aria-label="From week"
            className={control}
            value={value.fromTurn ?? 0}
            onChange={(e) => onChange({ ...value, fromTurn: Number(e.target.value) })}
          >
            {weeks.map((w) => (
              <option key={w.turn} value={w.turn}>
                {w.label}
              </option>
            ))}
          </select>
          <select
            aria-label="To week"
            className={control}
            value={value.toTurn ?? ctx.now}
            onChange={(e) => onChange({ ...value, toTurn: Number(e.target.value) })}
          >
            {weeks.map((w) => (
              <option key={w.turn} value={w.turn}>
                {w.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <span className="text-ink-2" data-period-range="">
        {resolved === null ? 'No such period yet' : resolved.label}
      </span>
    </div>
  );
}
