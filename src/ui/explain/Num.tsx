// <Num> (DESIGN §13.13): every displayed game number. It formats through ui/format, sets tabular figures
// (`data-num`, base.css), and opens its explanation on click or on `E` / `Enter` while focused. A number with
// nothing to explain against must say why, from a short allow-list that the coverage crawler accepts (T9).
import type { KeyboardEvent, MouseEvent } from 'react';
import { select, type ExplainRef, type Unit } from '../../engine';
import { formatValue, gradeMetric, type FmtOptions } from '../format';
import { useUi, useUiStore } from '../store/store';

/** Allowed reasons for `explain={null}` (13.13: the exemption must be justified; T9's allow-list). */
export const NUM_EXEMPTIONS = ['saveSummary'] as const;
/** `saveSummary`: a figure from the summary of a save that is not loaded, so there is no game to explain it from. */
export type NumExemption = (typeof NUM_EXEMPTIONS)[number];

interface NumCommon {
  readonly value: number;
  readonly unit: Unit;
  readonly fmt?: FmtOptions;
  /** Colors a delta by whether up is good (13.2); the arrow and sign always show direction too. */
  readonly goodDirection?: 'up' | 'down' | 'none';
  /** What the number is, for the popover when the explanation has no label of its own. */
  readonly label?: string;
  readonly className?: string;
}

export type NumProps = NumCommon &
  (
    | { readonly explain: ExplainRef; readonly exempt?: never }
    | { readonly explain: null; readonly exempt: NumExemption }
  );

type Tone = 'good' | 'bad' | 'neutral';

/** 13.2: a delta's color comes from the metric's goodDirection, not from its sign. */
export function deltaTone(value: number, goodDirection: NumCommon['goodDirection']): Tone {
  if (value === 0 || goodDirection === undefined || goodDirection === 'none') return 'neutral';
  const up = value > 0;
  return (goodDirection === 'up') === up ? 'good' : 'bad';
}

const TONE_CLASS: Readonly<Record<Tone, string>> = {
  good: 'text-status-good-text',
  bad: 'text-status-critical-text',
  neutral: '',
};

export function Num(props: NumProps) {
  const { value, unit, fmt, goodDirection, label, className = '' } = props;
  const state = useUi((s) => s.game.state);
  const store = useUiStore();
  const text = formatValue(value, unit, fmt, state === null ? {} : { dateView: (t) => select.dateView(state, t) });
  const isDelta = fmt?.delta === true;
  const tone = isDelta ? deltaTone(value, goodDirection) : 'neutral';
  const arrow = isDelta && value !== 0 ? (value > 0 ? '▲' : '▼') : null;
  const body = (
    <>
      {arrow === null ? null : (
        <span aria-hidden="true" className="mr-0.5 text-[0.75em]">
          {arrow}
        </span>
      )}
      {text}
    </>
  );
  // 13.2: the grade tooltip adds g/m³.
  const hint = unit === 'ozPerBcy' ? gradeMetric(value) : undefined;

  if (props.explain === null) {
    return (
      <span data-num="" data-num-exempt={props.exempt} title={hint} className={`${TONE_CLASS[tone]} ${className}`}>
        {body}
      </span>
    );
  }

  const ref = props.explain;
  const open = (anchor: HTMLElement): void => {
    store.getState().openPopover(label === undefined ? { ref, anchor } : { ref, anchor, label });
  };
  const onClick = (e: MouseEvent<HTMLButtonElement>): void => open(e.currentTarget);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    // Enter and Space already click a button; `E` is the explain key (13.15).
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      open(e.currentTarget);
    }
  };
  return (
    <button
      type="button"
      data-num=""
      aria-haspopup="dialog"
      title={hint ?? 'Explain (E)'}
      className={`cursor-pointer rounded-[2px] text-left underline decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid ${TONE_CLASS[tone]} ${className}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {body}
    </button>
  );
}
