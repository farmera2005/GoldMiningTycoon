// §13 inbox slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record, then calls this: the three Record + `…Ids` pairs the frame
// relies on (messages, open decisions, closed decisions) must all be present.
type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const PAIRS: readonly (readonly [string, string])[] = [
  ['messages', 'messageIds'],
  ['decisions', 'decisionIds'],
  ['closedDecisions', 'closedDecisionIds'],
];

export function inboxSliceProblem(slice: Readonly<Rec>): string | null {
  for (const [recKey, idsKey] of PAIRS) {
    const ids = slice[idsKey];
    if (!isRec(slice[recKey]) || !Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
      return `inbox.${recKey}`;
    }
  }
  return null;
}
