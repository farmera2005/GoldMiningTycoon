// The entity quick view (DESIGN §13.1 right drawer "for explain trees and entity quick views", §13.2: clicking a table
// row opens the entity's quick view; double-click or Enter opens its full route). 440 px on the right, on the raised
// surface, under the explain drawer (which can open over it from a number inside). It takes focus when it opens, Esc
// closes it, and focus goes back to the row that opened it (13.19).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import { Button } from './primitives';

export interface QuickViewProps {
  readonly title: string;
  onClose(): void;
  readonly children: ReactNode;
  /** The entity's canonical route, offered as `Open full page`. */
  readonly openHref?: string;
  /** Focus returns here on close (the row); default the element focused when it opened. */
  readonly returnFocus?: HTMLElement | null;
}

export function QuickView({ title, onClose, children, openHref, returnFocus }: QuickViewProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    headingRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener !== null && opener.isConnected) opener.focus();
    };
    // Mount only: the drawer keeps focus where the player moved it while it stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      data-quick-view=""
      className="fixed right-0 bottom-0 z-30 flex flex-col border-l border-hairline bg-surface-2 text-ink-1 shadow-raised"
      style={{ width: uiConfig['ui.layout.drawerPx'], top: uiConfig['ui.layout.topBarPx'] }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 pt-3 pb-2">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-16 font-semibold text-ink-1 outline-none">
          {title}
        </h2>
        <Button onClick={onClose} aria-label="Close quick view">
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-13">{children}</div>
      {openHref === undefined ? null : (
        <div className="border-t border-hairline px-4 py-2">
          <a href={openHref} className="text-13">
            Open full page
          </a>
        </div>
      )}
    </aside>
  );
}
