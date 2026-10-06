// Redaction of hidden truth (DESIGN §13.13, §2.8, D-13.9). Every CalcNode built from a hidden field is tagged
// `hidden: true` by its owner. The renderer never sees such a node: it is replaced by its `knownAlt` (the same
// quantity from the player's knowledge) or by a `Not observable` row, and its subtree, note and source are dropped.
// Only the dev reveal (compiled out of production) asks for the raw tree.
import type { CalcNode, Unit } from '../../engine';

export type CalcOp = NonNullable<CalcNode['op']>;
export type CalcSource = NonNullable<CalcNode['source']>;

export const NOT_OBSERVABLE = 'Not observable';

/** A CalcNode as the explain views render it: redacted, with children always present. */
export interface ViewNode {
  readonly label: string;
  /** null when there is no number to show (`Not observable`, a non-numeric tuning value, a player input). */
  readonly value: number | null;
  /** Text shown instead of the formatted value. */
  readonly valueText?: string;
  readonly unit: Unit;
  readonly op?: CalcOp;
  readonly children: readonly ViewNode[];
  readonly source?: CalcSource;
  readonly note?: string;
  /** How redaction changed the node: replaced by the player's-knowledge alternative, or withheld. */
  readonly redacted?: 'knownAlt' | 'notObservable';
  /** Dev reveal only: the raw node was built from a hidden field. */
  readonly devHidden?: true;
  readonly publicParams?: true;
}

function view(node: CalcNode, reveal: boolean): ViewNode {
  const out: {
    label: string;
    value: number;
    unit: Unit;
    children: ViewNode[];
    op?: CalcOp;
    source?: CalcSource;
    note?: string;
    devHidden?: true;
    publicParams?: true;
  } = {
    label: node.label,
    value: node.value,
    unit: node.unit,
    children: (node.children ?? []).map((c) => redact(c, { reveal })),
  };
  if (node.op !== undefined) out.op = node.op;
  if (node.source !== undefined) out.source = node.source;
  if (node.note !== undefined) out.note = node.note;
  if (node.publicParams === true) out.publicParams = true;
  if (reveal && node.hidden === true) out.devHidden = true;
  return out;
}

/** The node to render for `node`: itself (children redacted), its knownAlt, or `Not observable`. */
export function redact(node: CalcNode, options: { readonly reveal?: boolean } = {}): ViewNode {
  const reveal = options.reveal === true;
  if (reveal || node.hidden !== true) return view(node, reveal);
  if (node.knownAlt !== undefined) return { ...redact(node.knownAlt), redacted: 'knownAlt' };
  return {
    label: node.label,
    value: null,
    valueText: NOT_OBSERVABLE,
    unit: node.unit,
    children: [],
    redacted: 'notObservable',
  };
}

/** Every node of a view tree, depth first (tests and Copy as text). */
export function* walkView(node: ViewNode, depth = 0): Generator<{ node: ViewNode; depth: number }> {
  yield { node, depth };
  for (const c of node.children) yield* walkView(c, depth + 1);
}
