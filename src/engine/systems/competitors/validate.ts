// §12 competitors slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks
// every top-level `…Ids` array of the slice against its Record, then calls this for the slice's own invariants.
// Returns the first problem as text (reported as SAVE_CORRUPT), or null.
export function competitorsSliceProblem(_slice: Readonly<Record<string, unknown>>): string | null {
  return null;
}
