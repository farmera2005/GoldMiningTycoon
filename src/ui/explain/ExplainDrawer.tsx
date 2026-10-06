// The explain drawer (DESIGN §13.13, 13.1): 440 px on the right, the full redacted tree expanded to
// ui.explainDefaultDepth, source chips that follow links (tuning viewer, ledger view), breadcrumbs over
// `explain.stack`, and `Copy as text`. Esc closes it and returns focus to the number that opened it.
import { useEffect, useId, useRef, useState } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import { DevTruthBanner } from '../app/DevTruth';
import { Button } from '../components/primitives';
import { useUi, useUiStore } from '../store/store';
import { ExplainTree } from './ExplainTree';
import { LedgerView } from './LedgerView';
import { relatedLedger, refKey } from './refs';
import { resolveExplain, type Resolved } from './resolve';
import { treeAsText, valueText } from './textTree';
import { TuningViewer } from './TuningViewer';
import { useExplainContext } from './useExplainContext';

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through: clipboard access refused (permissions, insecure context)
  }
  return false;
}

function Body({ resolved, label }: { resolved: Resolved; label: string }) {
  const ctx = useExplainContext();
  switch (resolved.kind) {
    case 'tree':
      return <ExplainTree root={resolved.root} format={ctx.format} label={label} />;
    case 'ledger':
      return ctx.state === null ? null : (
        <LedgerView state={ctx.state} title={resolved.root.label} query={resolved.query} />
      );
    case 'tuning':
      return <TuningViewer tuningKey={resolved.key} resolved={resolved.resolved} base={resolved.base} />;
    case 'input':
      return (
        <p className="text-13 text-ink-1">
          A value you set. <a href={resolved.route}>Change it</a>
        </p>
      );
    case 'unavailable':
      return <p className="text-13 text-ink-2">{resolved.root.valueText}</p>;
  }
}

export function ExplainDrawer() {
  const stack = useUi((s) => s.explain.stack);
  const returnFocus = useUi((s) => s.explain.drawerReturnFocus);
  const store = useUiStore();
  const ctx = useExplainContext();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // The copy confirmation belongs to the explanation it was given for; following a link clears it.
  const [copied, setCopied] = useState<{ readonly key: string; readonly text: string } | null>(null);
  const top = stack[stack.length - 1];

  useEffect(() => {
    if (top !== undefined) headingRef.current?.focus();
  }, [top]);

  if (top === undefined) return null;
  const resolved = resolveExplain(top, ctx);
  const root = resolved.root;
  const ledger = relatedLedger(top);
  const crumbs = stack.map((ref) => resolveExplain(ref, ctx).root.label);

  const close = (): void => {
    store.getState().closeDrawer();
    returnFocus?.focus();
  };

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      data-explain-drawer=""
      className="fixed right-0 bottom-0 z-40 flex flex-col border-l border-hairline bg-surface-2 text-ink-1 shadow-raised"
      style={{ width: uiConfig['ui.layout.drawerPx'], top: uiConfig['ui.layout.topBarPx'] }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      {import.meta.env.DEV && ctx.reveal ? <DevTruthBanner what="Unredacted tree: hidden nodes shown" /> : null}
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 pt-3 pb-2">
        <div className="min-w-0">
          {stack.length > 1 ? (
            <nav aria-label="Explanation path" className="mb-1">
              <ol className="flex flex-wrap items-center gap-1 text-12 text-ink-2">
                {crumbs.map((c, i) => (
                  <li key={`${i}-${refKey(stack[i] ?? top)}`} className="flex items-center gap-1">
                    {i < crumbs.length - 1 ? (
                      <>
                        <button
                          type="button"
                          className="cursor-pointer text-link underline"
                          onClick={() => store.getState().popExplainTo(i)}
                        >
                          {c}
                        </button>
                        <span aria-hidden="true">›</span>
                      </>
                    ) : (
                      <span aria-current="location">{c}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-16 font-semibold text-ink-1 outline-none">
            {root.label}
          </h2>
          <p className="text-20 font-semibold tabular-nums lining-nums text-ink-1">{valueText(root, ctx.format)}</p>
        </div>
        <Button onClick={close} aria-label="Close explanation">
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
        <Body resolved={resolved} label={root.label} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-4 py-2">
        <Button
          onClick={() =>
            void copyText(treeAsText(root, ctx.format)).then((ok) =>
              setCopied({
                key: refKey(top),
                text: ok ? 'Copied to the clipboard.' : 'This browser blocked the clipboard.',
              }),
            )
          }
        >
          Copy as text
        </Button>
        {ledger === null ? null : <Button onClick={() => store.getState().pushExplain(ledger)}>Open ledger</Button>}
        <span role="status" className="text-12 text-ink-2">
          {copied !== null && copied.key === refKey(top) ? copied.text : ''}
        </span>
      </div>
    </div>
  );
}
