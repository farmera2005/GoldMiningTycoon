// Tabs across the top of a screen (DESIGN §13.1 "tabs across the top of each screen", 13.19 keyboard rules). Two
// forms: RouteTabs, where every tab is a canonical route (`#/bank/ledger`, so back/forward and deep links work), and
// Tabs, the WAI-ARIA tablist for panels inside one route (arrow keys, Home and End move between tabs; activation
// follows focus).
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface RouteTab {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

const TAB_BASE =
  'inline-flex h-9 items-center border-b-2 px-3 text-14 whitespace-nowrap hover:text-ink-1 focus-visible:outline-offset-[-2px]';

/** Route tabs: a labelled nav of links; the current one carries `aria-current="page"`. */
export function RouteTabs({ label, tabs }: { label: string; tabs: readonly RouteTab[] }) {
  return (
    <nav aria-label={label} className="mb-4 border-b border-hairline">
      <ul className="-mb-px flex flex-wrap gap-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <a
              href={t.href}
              aria-current={t.current ? 'page' : undefined}
              className={`${TAB_BASE} no-underline ${t.current ? 'border-accent font-semibold text-ink-1' : 'border-transparent text-ink-2'}`}
            >
              {t.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
}

export interface TabsProps<T extends string> {
  /** Accessible name of the tablist. */
  readonly label: string;
  readonly tabs: readonly TabItem<T>[];
  readonly selected: T;
  onSelect(id: T): void;
  /** The selected tab's panel. */
  readonly children: ReactNode;
}

/** The ARIA tabs pattern: one tab stop, arrows move and select, the panel is labelled by its tab. */
export function Tabs<T extends string>({ label, tabs, selected, onSelect, children }: TabsProps<T>) {
  const base = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === selected),
  );

  const move = (to: number): void => {
    const n = tabs.length;
    if (n === 0) return;
    const next = tabs[((to % n) + n) % n];
    if (next === undefined) return;
    onSelect(next.id);
    refs.current.get(next.id)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        move(index + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        move(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(tabs.length - 1);
        break;
    }
  };

  const tabId = (id: T): string => `${base}-tab-${id}`;
  const panelId = `${base}-panel`;
  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-1 border-b border-hairline" onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const on = t.id === selected;
          return (
            <button
              key={t.id}
              ref={(el) => {
                if (el === null) refs.current.delete(t.id);
                else refs.current.set(t.id, el);
              }}
              type="button"
              role="tab"
              id={tabId(t.id)}
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              className={`${TAB_BASE} -mb-px cursor-pointer ${on ? 'border-accent font-semibold text-ink-1' : 'border-transparent text-ink-2'}`}
              onClick={() => onSelect(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)}>
        {children}
      </div>
    </div>
  );
}
