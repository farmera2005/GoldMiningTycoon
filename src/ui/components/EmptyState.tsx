// Empty states (DESIGN §13.20: one of the few places grain may appear). The grained band holds only the title (the
// display face, ≥ 16 px) and its text; any action sits below it on the flat card surface, because grain never sits
// behind a control, a number, a table or a chip (T28).
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  readonly title: string;
  /** One or two sentences: what is missing and how to get it. Plain text only (no numbers or controls). */
  readonly children?: ReactNode;
  /** Buttons or links, rendered outside the grained band. */
  readonly actions?: ReactNode;
  /** `data-empty-state` value, for tests and the tutorial's anchors. */
  readonly id?: string;
}

export function EmptyState({ title, children, actions, id }: EmptyStateProps) {
  return (
    <section className="rounded-card border border-hairline bg-surface-1" data-empty-state={id ?? ''}>
      <div className="grain rounded-t-card px-6 pt-6 pb-4" data-grain-zone="empty-state">
        <h2 className="display-panel mb-2 text-ink-1">{title}</h2>
        {children === undefined ? null : <div className="text-14 text-ink-2">{children}</div>}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap gap-2 px-6 pt-2 pb-6">{actions}</div>}
    </section>
  );
}
