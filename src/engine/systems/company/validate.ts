// §1 company and owner slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record (here `investorIds`), then calls this for the slice's own
// invariants: the owner record, the reputation state and the bounded lists are present. Returns the first problem as
// text (reported as SAVE_CORRUPT), or null.
type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function companySliceProblem(slice: Readonly<Rec>): string | null {
  const owner = slice['owner'];
  if (!isRec(owner) || typeof owner['name'] !== 'string') return 'company.owner';
  if (!isRec(owner['assignment']) || !Array.isArray(owner['deskQueue']) || !Array.isArray(owner['guarantees'])) {
    return 'company.owner fields';
  }
  const rep = slice['reputation'];
  if (!isRec(rep) || !isNum(rep['value']) || !Array.isArray(rep['pending']) || !Array.isArray(rep['log'])) {
    return 'company.reputation';
  }
  if (!isRec(slice['investors']) || !isNum(slice['regulatorStanding']) || !isRec(slice['safetyRecord'])) {
    return 'company records';
  }
  if (!Array.isArray(slice['timeline'])) return 'company.timeline';
  return null;
}
