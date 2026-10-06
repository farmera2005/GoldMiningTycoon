// `Copy as text` (DESIGN §13.13): the redacted tree as indented plain text for bug reports. It is built from the same
// view nodes the drawer renders, so it can never contain more than the screen shows.
import { formatValue, type FormatContext } from '../format';
import { opSymbol } from './formulaText';
import type { CalcSource, ViewNode } from './redact';

export function valueText(node: ViewNode, ctx: FormatContext = {}): string {
  if (node.valueText !== undefined) return node.valueText;
  return node.value === null ? '' : formatValue(node.value, node.unit, node.fmt ?? {}, ctx);
}

export function sourceText(source: CalcSource): string {
  switch (source.kind) {
    case 'tuning':
      return `tuning: ${source.key}`;
    case 'entity':
      return source.ref.kind === 'ledgerTxn' ? `ledger: ${source.ref.id}` : `${source.ref.kind}: ${source.ref.id}`;
    case 'rng':
      return `Random draw - stream ${[source.stream, ...source.key.map(String)].join('/')}`;
  }
}

export function treeAsText(root: ViewNode, ctx: FormatContext = {}): string {
  const lines: string[] = [];
  const visit = (node: ViewNode, depth: number): void => {
    const parts = [`${'  '.repeat(depth)}${node.label}`, valueText(node, ctx)];
    if (node.op !== undefined) parts.push(opSymbol(node.op));
    if (node.source !== undefined) parts.push(`[${sourceText(node.source)}]`);
    if (node.note !== undefined) parts.push(`— ${node.note}`);
    lines.push(parts.filter((p) => p !== '').join('  '));
    for (const c of node.children) visit(c, depth + 1);
  };
  visit(root, 0);
  return lines.join('\n');
}
