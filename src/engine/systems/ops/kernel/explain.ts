// Explanation helpers for the §7 kernel (DESIGN §2.8). Kernel formulas cannot know whether their inputs are hidden truth
// (the weekly flow) or player knowledge (the visible projection), so the caller says so: a `KernelExplainCtx` with
// `hidden: true` tags every node the formula builds from its inputs as hidden, which is "tagged where created" for a
// formula that only ever sees numbers. Tuning constants are public, so tuning leaves are never tagged.
import {
  EXPLAIN_OFF,
  leaf,
  node,
  type CalcExtras,
  type CalcNode,
  type CalcOp,
  type ExplainCtx,
  type Unit,
} from '../../../core/calc';

export interface KernelExplainCtx extends ExplainCtx {
  /** The formula's inputs include hidden truth (true grade, pad gold, true skill …): tag every input-derived node. */
  readonly hidden?: boolean;
}

export const KEX_OFF: KernelExplainCtx = EXPLAIN_OFF;

/** The same explain flag, marking the result as built from hidden truth. */
export function truthCtx(ex: ExplainCtx): KernelExplainCtx {
  return { on: ex.on, hidden: true };
}

function tag(n: CalcNode | undefined, ex: KernelExplainCtx): CalcNode | undefined {
  if (n !== undefined && ex.hidden === true) n.hidden = true;
  return n;
}

/** An input-derived leaf (tagged hidden under a truth context). */
export function kLeaf(
  ex: KernelExplainCtx,
  label: string,
  value: number,
  unit: Unit,
  extras?: CalcExtras,
): CalcNode | undefined {
  return tag(leaf(ex, label, value, unit, extras), ex);
}

/** An input-derived interior node (tagged hidden under a truth context). */
export function kNode(
  ex: KernelExplainCtx,
  label: string,
  op: CalcOp,
  unit: Unit,
  value: number,
  children: readonly (CalcNode | undefined)[],
  extras?: CalcExtras,
): CalcNode | undefined {
  return tag(node(ex, label, op, unit, value, children, extras), ex);
}

/** A tuning constant (public, never tagged hidden). */
export function kTune(ex: ExplainCtx, key: string, value: number, unit: Unit, label: string): CalcNode | undefined {
  return leaf(ex, label, value, unit, { source: { kind: 'tuning', key } });
}

/** Marks a whole tree hidden (for callers that assemble kernel results built from truth). */
export function hideTree(n: CalcNode | undefined, knownAlt?: CalcNode): CalcNode | undefined {
  if (n === undefined) return undefined;
  const walk = (c: CalcNode): void => {
    c.hidden = true;
    if (c.children !== undefined) for (const ch of c.children) walk(ch);
  };
  walk(n);
  if (knownAlt !== undefined) n.knownAlt = knownAlt;
  return n;
}
