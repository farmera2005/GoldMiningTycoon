// "Compare with last week" (DESIGN §13.13 drawer): for a `report` ref, the same path in the prior week's tree, with
// the children that changed most highlighted with Δ. Both trees are redacted first, so a comparison can never show
// more than either week's explanation does (D-13.9). Children are matched by label (the tree's structure is the
// owner's, stable week to week); a child present in only one week shows `—` on the other side.
import type { ExplainRef, Unit, WeekReport } from '../../engine';
import { redact, type ViewNode } from './redact';
import { reportNode } from './resolve';

export interface ChildChange {
  readonly label: string;
  readonly unit: Unit;
  readonly now: number | null;
  readonly before: number | null;
  /** now − before when both are numbers in the same unit, else null. */
  readonly delta: number | null;
  /** Among the largest changes (13.13: "the children that changed most highlighted"). */
  readonly highlight: boolean;
}

export interface WeekComparison {
  readonly now: ViewNode;
  /** The prior week's node at the same path, or null when that week is not retained or has no such node. */
  readonly before: ViewNode | null;
  readonly delta: number | null;
  readonly children: readonly ChildChange[];
}

/** How many children are highlighted at most. */
export const COMPARE_HIGHLIGHTS = 3;

function diff(a: ViewNode | undefined, b: ViewNode | undefined): number | null {
  if (a === undefined || b === undefined || a.value === null || b.value === null || a.unit !== b.unit) return null;
  return a.value - b.value;
}

/** The comparison of two redacted nodes at the same path. */
export function compareNodes(now: ViewNode, before: ViewNode | null): WeekComparison {
  const prior = new Map<string, ViewNode>();
  for (const c of before?.children ?? []) if (!prior.has(c.label)) prior.set(c.label, c);
  const labels = [
    ...now.children.map((c) => c.label),
    ...[...prior.keys()].filter((l) => !now.children.some((c) => c.label === l)),
  ];
  const rows = labels.map((label) => {
    const a = now.children.find((c) => c.label === label);
    const b = prior.get(label);
    return {
      label,
      unit: (a ?? b)?.unit ?? now.unit,
      now: a?.value ?? null,
      before: b?.value ?? null,
      delta: diff(a, b),
    };
  });
  const ranked = rows
    .filter((r) => r.delta !== null && r.delta !== 0)
    .sort((x, y) => Math.abs(y.delta ?? 0) - Math.abs(x.delta ?? 0))
    .slice(0, COMPARE_HIGHLIGHTS)
    .map((r) => r.label);
  return {
    now,
    before,
    delta: before === null ? null : diff(now, before),
    children: rows.map((r) => ({ ...r, highlight: ranked.includes(r.label) })),
  };
}

/** The comparison for a `report` ref against the retained weeks, or null when `ref` is not a retained report. */
export function compareWithLastWeek(
  ref: ExplainRef,
  calcReports: readonly WeekReport[],
  options: { readonly reveal?: boolean } = {},
): WeekComparison | null {
  if (ref.kind !== 'report') return null;
  const thisWeek = calcReports.find((r) => r.turn === ref.turn);
  const nowNode = thisWeek === undefined ? null : reportNode(thisWeek, ref.path);
  if (nowNode === null) return null;
  const lastWeek = calcReports.find((r) => r.turn === ref.turn - 1);
  const beforeNode = lastWeek === undefined ? null : reportNode(lastWeek, ref.path);
  const reveal = options.reveal === true;
  return compareNodes(redact(nowNode, { reveal }), beforeNode === null ? null : redact(beforeNode, { reveal }));
}
