// A step list for multi-step flows (DESIGN §13.5 offer / lease stepper, §13.14 setup wizard's left step list): an
// ordered list with the current step marked `aria-current="step"`, completed steps reachable as buttons when the flow
// allows going back, later steps inert. Back / Next belong to the flow, which validates each step before Next.
export interface StepDef {
  readonly id: string;
  readonly label: string;
  /** The step has a problem the player must fix (shown as text, not color). */
  readonly invalid?: boolean;
}

export interface StepperProps {
  readonly label: string;
  readonly steps: readonly StepDef[];
  /** Index of the current step. */
  readonly current: number;
  /** Go to an earlier step; absent → the list is display only. */
  readonly onSelect?: (index: number) => void;
  readonly orientation?: 'horizontal' | 'vertical';
}

export function Stepper({ label, steps, current, onSelect, orientation = 'horizontal' }: StepperProps) {
  return (
    <nav aria-label={label} data-stepper="">
      <ol className={`flex gap-2 text-13 ${orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center'}`}>
        {steps.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const marker = (
            <span
              aria-hidden="true"
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-12 ${state === 'current' ? 'border-accent bg-accent text-on-accent' : state === 'done' ? 'border-accent text-ink-1' : 'border-border-control text-ink-2'}`}
            >
              {state === 'done' ? '✓' : i + 1}
            </span>
          );
          const text = (
            <>
              {marker}
              <span className={state === 'current' ? 'font-semibold text-ink-1' : state === 'done' ? 'text-ink-1' : 'text-ink-2'}>
                {s.label}
              </span>
              {s.invalid === true ? <span className="text-12 text-status-critical-text">(needs attention)</span> : null}
              {state === 'done' ? <span className="sr-only">(done)</span> : null}
            </>
          );
          return (
            <li key={s.id} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-1.5">
              {state === 'done' && onSelect !== undefined ? (
                <button type="button" className="inline-flex cursor-pointer items-center gap-1.5" onClick={() => onSelect(i)}>
                  {text}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5">{text}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
