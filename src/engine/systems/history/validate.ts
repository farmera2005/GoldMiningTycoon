// §2 history slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record, then calls this: the ring and the rollups are arrays, and
// the ring ascends strictly by turn (step 16 appends one snapshot per week).
type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

export function historySliceProblem(slice: Readonly<Rec>): string | null {
  const weekly = slice['weekly'];
  if (!Array.isArray(weekly) || !Array.isArray(slice['annual'])) return 'history';
  let last = Number.NEGATIVE_INFINITY;
  for (const snap of weekly as unknown[]) {
    if (!isRec(snap) || !isInt(snap['turn']) || !isRec(snap['market'])) return 'history.weekly entry';
    if (snap['turn'] <= last) return 'history.weekly is not ascending';
    last = snap['turn'];
  }
  return null;
}
