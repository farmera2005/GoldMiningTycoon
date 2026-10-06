// Evidence canonicalization (DESIGN §4.1, D-4.24): the content hash that keys the estimate memo. Samples and records
// are taken in ascending id order and assays by value, so acquisition order never changes the hash or the estimate.
import { canonicalJson, fnv1a64Hex, hashValue } from '../../core/hash';
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

// Sample records and record findings are immutable once made (state objects; Immer replaces a changed one), so each
// one's content hash is computed once and the evidence hash combines them: an unchanged sample is not re-serialized
// when the evidence set grows or is rebuilt (the economic-layer rerun and the weekly refresh hash the same records
// again, §2.13). The key is the object and the value depends only on its content, so a cold cache never changes a
// hash. The small parts (block states, assays) are hashed as they are.
const itemHashMemo = createWeakMemo<object, { readonly hash: string }>('knowledge.evidenceItemHash');

/** Content hash of one immutable evidence item (sample or record finding), computed once per object. */
export function itemHash(x: object): string {
  return itemHashMemo.getOrCompute(x, () => ({ hash: hashValue(x) })).hash;
}

/** The items' content hashes in the given order, comma-joined (a memo key part). */
export function hashList(items: readonly object[]): string {
  let out = '';
  for (let i = 0; i < items.length; i++) out += i === 0 ? itemHash(items[i] as object) : `,${itemHash(items[i] as object)}`;
  return out;
}

/**
 * The content hash of an evidence set: claim, samples and records in ascending id order (by their own content hashes),
 * the known block states and the assays by value. Acquisition order never changes it. The `geologistOnClaim` flag is
 * not part of it: the estimator derives the flag from the samples (s04 #10).
 */
export function evidenceHash(e: EvidenceSet): string {
  const c = canonicalEvidence(e);
  return fnv1a64Hex(
    `${c.claimId}#${hashList(c.samples)}#${hashList(c.records)}#${canonicalJson(c.blockState)}#${canonicalJson(c.assays)}`,
  );
}

const priorsHashMemo = createWeakMemo<ClaimPriors, { readonly hash: string }>('knowledge.priorsHash');

export function priorsHash(p: ClaimPriors): string {
  return priorsHashMemo.getOrCompute(p, () => ({ hash: hashValue(p) })).hash;
}

export function emptyEvidence(claimId: EvidenceSet['claimId']): EvidenceSet {
  return { claimId, samples: [], records: [], blockState: {}, assays: [], geologistOnClaim: false };
}
