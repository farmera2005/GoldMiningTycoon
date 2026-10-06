// Evidence canonicalization (DESIGN §4.1, D-4.24): the content hash that keys the estimate memo. Samples and records
// are taken in ascending id order and assays by value, so acquisition order never changes the hash or the estimate.
import { hashValue } from '../../core/hash';
import { compareIds } from '../../core/ids';
import { createWeakMemo } from '../../core/memo';
import type { ClaimPriors } from '../world/types';
import type { EvidenceSet } from './types';

export function canonicalEvidence(e: EvidenceSet): EvidenceSet {
  return {
    claimId: e.claimId,
    samples: e.samples.slice().sort((a, b) => compareIds(a.id, b.id)),
    records: e.records.slice().sort((a, b) => compareIds(a.id, b.id)),
    blockState: e.blockState,
    assays: e.assays
      .slice()
      .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.value - b.value || a.sd - b.sd)),
    geologistOnClaim: e.geologistOnClaim,
  };
}

export function evidenceHash(e: EvidenceSet): string {
  return hashValue(canonicalEvidence(e));
}

const priorsHashMemo = createWeakMemo<ClaimPriors, { readonly hash: string }>('knowledge.priorsHash');

export function priorsHash(p: ClaimPriors): string {
  return priorsHashMemo.getOrCompute(p, () => ({ hash: hashValue(p) })).hash;
}

export function emptyEvidence(claimId: EvidenceSet['claimId']): EvidenceSet {
  return { claimId, samples: [], records: [], blockState: {}, assays: [], geologistOnClaim: false };
}
