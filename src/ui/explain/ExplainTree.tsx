// The drawer's tree (DESIGN §13.13): every row shows label, value and unit, the op symbol, a source chip and the
// note; the tree opens expanded to ui.explainDefaultDepth. Nested lists with disclosure buttons, so it reads and
// works by keyboard without a custom tree widget.
import { useState } from 'react';
import { uiConfig } from '../../data/tuning/ui';
import type { FormatContext } from '../format';
import { opSymbol } from './formulaText';
import type { ViewNode } from './redact';
import { SourceChip } from './SourceChip';
import { valueText } from './textTree';

function TreeRow({ node, depth, format }: { node: ViewNode; depth: number; format: FormatContext }) {
  const [open, setOpen] = useState(depth < uiConfig['ui.explainDefaultDepth']);
  const hasChildren = node.children.length > 0;
  return (
    <li data-explain-node="" data-depth={depth} className={node.devHidden ? 'dev-truth-row' : undefined}>
      <div className="flex min-h-7 items-baseline gap-2 border-b border-hairline py-1">
        {hasChildren ? (
          <button
            type="button"
            className="w-5 shrink-0 cursor-pointer text-ink-2"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        <span className={`min-w-0 flex-1 ${node.redacted === 'notObservable' ? 'text-ink-3' : 'text-ink-1'}`}>
          {node.label}
          {node.redacted === 'knownAlt' ? <span className="ml-1 text-12 text-ink-3">(your estimate)</span> : null}
        </span>
        <span className="shrink-0 font-medium tabular-nums lining-nums text-ink-1">{valueText(node, format)}</span>
        <span className="w-12 shrink-0 text-right text-12 text-ink-3">
          {node.op === undefined ? '' : opSymbol(node.op)}
        </span>
      </div>
      {node.source === undefined && node.note === undefined ? null : (
        <div className="flex flex-wrap items-center gap-2 py-0.5 pl-7 text-12 text-ink-3">
          {node.source === undefined ? null : <SourceChip source={node.source} />}
          {node.note === undefined ? null : <span>{node.note}</span>}
        </div>
      )}
      {hasChildren && open ? (
        <ul className="pl-4">
          {node.children.map((c, i) => (
            <TreeRow key={`${i}-${c.label}`} node={c} depth={depth + 1} format={format} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ExplainTree({ root, format, label }: { root: ViewNode; format: FormatContext; label: string }) {
  return (
    <ul aria-label={label} className="text-13">
      <TreeRow node={root} depth={0} format={format} />
    </ul>
  );
}
