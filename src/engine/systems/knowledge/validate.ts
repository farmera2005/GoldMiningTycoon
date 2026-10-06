// §4 knowledge slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every
// top-level `…Ids` array of the slice against its Record (samples, records, programs, reports, engagements,
// contractors), then calls this for the slice's own invariants: every P1 store is present, each assay counter (it keys
// the assay draw) is a non-negative integer, and a sample's stored id is its key. Returns the first problem as text
// (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const RECORD_STORES = [
  'samples',
  'drawIndex',
  'records',
  'priorStatus',
  'programs',
  'reports',
  'engagements',
  'contractors',
  'sellerChecks',
  'planning',
  'decisionContext',
  'sampleConc',
  'assays',
  'assayCount',
  'history',
  'lastClass',
  'anchors',
  'familyRecords',
] as const;

export function knowledgeSliceProblem(slice: Readonly<Rec>): string | null {
  for (const key of RECORD_STORES) if (!isRec(slice[key])) return `knowledge.${key}`;
  const samples = slice['samples'] as Rec;
  for (const id of sortedKeysByCodeUnit(samples)) {
    const s = samples[id];
    if (!isRec(s) || s['id'] !== id) return `knowledge.samples.${id}`;
  }
  const counts = slice['assayCount'] as Rec;
  for (const claimId of sortedKeysByCodeUnit(counts)) {
    const n = counts[claimId];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) return `knowledge.assayCount.${claimId}`;
  }
  return null;
}
