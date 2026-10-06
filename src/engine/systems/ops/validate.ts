// §7 operations slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record (`claimIds` ↔ `claims`), then calls this: each ClaimOps is keyed
// by its own claim, `lastWeek` names only operated claims, and every line entry sits under its own line id. Returns the
// first problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

export function opsSliceProblem(slice: Readonly<Rec>): string | null {
  const claims = slice['claims'];
  const lastWeek = slice['lastWeek'];
  if (!isRec(claims) || !isRec(lastWeek)) return 'ops';
  for (const claimId of sortedKeysByCodeUnit(claims)) {
    const c = claims[claimId];
    if (!isRec(c) || c['claimId'] !== claimId) return `ops.claims.${claimId}`;
    const lines = c['lines'];
    if (!isRec(lines)) return `ops.claims.${claimId}.lines`;
    for (const lineId of sortedKeysByCodeUnit(lines)) {
      const line = lines[lineId];
      if (!isRec(line) || line['lineId'] !== lineId) return `ops.claims.${claimId}.lines.${lineId}`;
    }
  }
  for (const claimId of sortedKeysByCodeUnit(lastWeek)) {
    if (!isRec(claims[claimId])) return `ops.lastWeek.${claimId} has no ClaimOps`;
  }
  return null;
}
