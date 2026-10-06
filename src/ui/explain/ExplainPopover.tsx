// The explain popover (DESIGN §13.13): 320 px, label and value, the formula line, up to ui.explainPopoverChildren
// children with values, the note, and `Open breakdown`. A non-modal dialog (13.19): it takes focus when it opens and
// gives it back to the number on Esc; a click elsewhere closes it.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import { Button } from '../components/primitives';
import { useUi, useUiStore } from '../store/store';
import { formulaText } from './formulaText';
import { resolveExplain } from './resolve';
import { valueText } from './textTree';
import { useExplainContext } from './useExplainContext';

const POPOVER_PX = 320;
const GAP_PX = 6;
const EDGE_PX = 8;

/** Fixed-position placement under the anchor (above it when there is no room), kept inside the viewport. */
export function placePopover(
  anchor: { readonly left: number; readonly top: number; readonly bottom: number },
  height: number,
  viewport: { readonly width: number; readonly height: number },
): { left: number; top: number } {
  const left = Math.min(Math.max(EDGE_PX, anchor.left), Math.max(EDGE_PX, viewport.width - POPOVER_PX - EDGE_PX));
  const below = anchor.bottom + GAP_PX;
  const top = below + height > viewport.height - EDGE_PX ? Math.max(EDGE_PX, anchor.top - GAP_PX - height) : below;
  return { left, top };
}

export function ExplainPopover() {
  const popover = useUi((s) => s.explain.popover);
  const store = useUiStore();
  const ctx = useExplainContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: EDGE_PX, top: EDGE_PX });

  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (popover === null || el === null) return;
    const rect = popover.anchor?.getBoundingClientRect() ?? { left: EDGE_PX, top: EDGE_PX, bottom: EDGE_PX };
    setPos(placePopover(rect, el.offsetHeight, { width: window.innerWidth, height: window.innerHeight }));
    el.focus();
  }, [popover]);

  useEffect(() => {
    if (popover === null) return;
    const onPointer = (e: MouseEvent): void => {
      const target = e.target as Node | null;
      if (target === null || dialogRef.current?.contains(target) || popover.anchor?.contains(target)) return;
      store.getState().closePopover();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [popover, store]);

  if (popover === null) return null;
  const resolved = resolveExplain(popover.ref, ctx);
  const root = resolved.root;
  const formula = formulaText(root);
  const shown = root.children.slice(0, uiConfig['ui.explainPopoverChildren']);
  const more = root.children.length - shown.length;
  const label = root.label === '' ? (popover.label ?? 'Explanation') : root.label;

  const close = (): void => {
    store.getState().closePopover();
    popover.anchor?.focus();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-explain-popover=""
      className="fixed z-50 rounded-card border border-hairline bg-surface-2 p-3 text-13 text-ink-1 shadow-raised outline-none"
      style={{ width: POPOVER_PX, left: pos.left, top: pos.top }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-14 font-semibold text-ink-1">
          {label}
        </h2>
        <span className="shrink-0 font-semibold tabular-nums lining-nums">{valueText(root, ctx.format)}</span>
      </div>
      {formula === null ? null : <p className="mb-2 text-12 text-ink-2">{formula}</p>}
      {shown.length === 0 ? null : (
        <ul className="mb-2 border-t border-hairline pt-1">
          {shown.map((c, i) => (
            <li key={`${i}-${c.label}`} className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="min-w-0 truncate text-ink-2" title={c.label}>
                {c.label}
              </span>
              <span className="shrink-0 tabular-nums lining-nums">{valueText(c, ctx.format)}</span>
            </li>
          ))}
          {more > 0 ? <li className="py-0.5 text-12 text-ink-3">and {more} more in the breakdown</li> : null}
        </ul>
      )}
      {root.note === undefined ? null : <p className="mb-2 text-12 text-ink-3">{root.note}</p>}
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => store.getState().openDrawer(popover.ref, popover.anchor)}
          disabled={resolved.kind === 'unavailable' && resolved.reason === 'NO_GAME'}
        >
          Open breakdown
        </Button>
        <Button onClick={close}>Close</Button>
      </div>
    </div>
  );
}
