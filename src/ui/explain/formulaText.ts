// The popover's formula line and the drawer's op symbols (DESIGN §13.13): `= Labor + Fuel + Maintenance + Camp`,
// generated from a node's `op` and its children's labels.
import { assertNever } from '../lib/assertNever';
import type { CalcOp, ViewNode } from './redact';

/** Beyond this many terms the line names the first ones and counts the rest. */
export const FORMULA_MAX_TERMS = 6;

/** Σ × ÷ min max lookup draw clamp (13.13 drawer rows). */
export function opSymbol(op: CalcOp): string {
  switch (op) {
    case 'sum':
      return 'Σ';
    case 'product':
      return '×';
    case 'ratio':
      return '÷';
    case 'min':
    case 'max':
    case 'lookup':
    case 'draw':
    case 'clamp':
      return op;
    default:
      return assertNever(op);
  }
}

function terms(labels: readonly string[]): string[] {
  if (labels.length <= FORMULA_MAX_TERMS) return [...labels];
  const shown = labels.slice(0, FORMULA_MAX_TERMS - 1);
  return [...shown, `… ${labels.length - shown.length} more`];
}

/** The formula for a node, or null when it has no op or no children to combine. */
export function formulaText(node: Pick<ViewNode, 'op' | 'children'>): string | null {
  const op = node.op;
  if (op === undefined || node.children.length === 0) return op === 'draw' ? '= random draw' : null;
  const t = terms(node.children.map((c) => c.label));
  switch (op) {
    case 'sum':
      return `= ${t.join(' + ')}`;
    case 'product':
      return `= ${t.join(' × ')}`;
    case 'ratio':
      return `= ${t.join(' ÷ ')}`;
    case 'min':
    case 'max':
    case 'clamp':
      return `= ${op}(${t.join(', ')})`;
    case 'lookup':
      return `= lookup by ${t.join(', ')}`;
    case 'draw':
      return `= random draw from ${t.join(', ')}`;
    default:
      return assertNever(op);
  }
}
