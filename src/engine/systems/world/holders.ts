// NPC claim holders (DESIGN §3.10.1). Every NPC-held parcel belongs to a holder; contiguous held runs on a creek are
// grouped under one holder w.p. groupRunP (1–6 parcels). Honesty is the holder's (D-3.13) and the situation tilts it.
// Stream rng(seed,'world','holders',D.id); draw order (fixed, stream rule e): one group u per run in heldRuns order,
// then per held parcel in compareIds order, grouped or not: situation, honesty, first-name and last-name indices. A
// holder takes the draws of its lowest-id parcel; a grouped holder's other parcels take theirs and leave them unused, so
// a groupRunP retune never moves another holder's draws. Seller evidence is written at first listing (P1).
import { holderNames } from '../../../data/regions';
import { compareIds, type ClaimId, type HolderId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import { HOLDER_SITUATIONS, SELLER_HONESTIES } from './enums';
import type { GenClaim } from './genTypes';
import { pickKey } from './random';
import type { GeoGenParams, HolderSituation, SellerHonesty, SellerKnowledge, SellerProfile } from './types';

export function knowledgeOf(s: HolderSituation): SellerKnowledge {
  switch (s) {
    case 'retiringOperator':
    case 'distressedOperator':
      return 'operator';
    case 'prospector':
      return 'prospector';
    case 'estate':
      return 'heirs';
    case 'absentee':
      return 'absentee';
  }
}

/** Honesty weights for a situation: the base mix × the situation's odds tilts (renormalized by the pick). */
export function honestyWeights(situation: HolderSituation, gp: GeoGenParams): Record<SellerHonesty, number> {
  const out = {} as Record<SellerHonesty, number>;
  for (const h of SELLER_HONESTIES) out[h] = gp.seller.honestyMix[h] * (gp.seller.honestyTilts[h][situation] ?? 1);
  return out;
}

type HeldParcel = Pick<GenClaim, 'id' | 'creekIdx' | 'side' | 'rowStart' | 'nAlong'>;

/** Contiguous held runs: same creek and side, touching rows; ordered by their first claim id. */
export function heldRuns(held: readonly HeldParcel[]): HeldParcel[][] {
  const sorted = held
    .slice()
    .sort((a, b) => a.creekIdx - b.creekIdx || a.side - b.side || a.rowStart - b.rowStart || compareIds(a.id, b.id));
  const runs: HeldParcel[][] = [];
  for (const p of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (
      run !== undefined &&
      last !== undefined &&
      last.creekIdx === p.creekIdx &&
      last.side === p.side &&
      last.rowStart + last.nAlong === p.rowStart
    ) {
      run.push(p);
    } else {
      runs.push([p]);
    }
  }
  const first = (run: HeldParcel[]): ClaimId => run.map((p) => p.id).sort(compareIds)[0] as ClaimId;
  return runs.sort((a, b) => compareIds(first(a), first(b)));
}

interface HolderDraws {
  readonly situation: HolderSituation;
  readonly honesty: SellerHonesty;
  readonly displayName: string;
}

/** One parcel's holder draws (situation, honesty, first and last name): 6 u32, always taken. */
function drawHolder(r: Rng, gp: GeoGenParams): HolderDraws {
  const situation = pickKey(r, HOLDER_SITUATIONS, gp.seller.situationMix);
  const honesty = pickKey(r, SELLER_HONESTIES, honestyWeights(situation, gp));
  const first = holderNames.first[r.int(0, holderNames.first.length - 1)] as string;
  const last = holderNames.last[r.int(0, holderNames.last.length - 1)] as string;
  return {
    situation,
    honesty,
    displayName: situation === 'estate' ? `Estate of ${first} ${last}` : `${first} ${last}`,
  };
}

export function assignHolders(
  r: Rng,
  held: readonly HeldParcel[],
  gp: GeoGenParams,
  nextHolderId: () => HolderId,
): SellerProfile[] {
  const runs = heldRuns(held);
  const groupUs = runs.map(() => r.next());
  const parcelIds = held.map((p) => p.id).sort(compareIds);
  const parcelDraws = parcelIds.map(() => drawHolder(r, gp));
  const drawsOf = (id: ClaimId): HolderDraws => parcelDraws[parcelIds.indexOf(id)] as HolderDraws;

  const groups: ClaimId[][] = [];
  runs.forEach((run, k) => {
    const ids = run.map((p) => p.id);
    if ((groupUs[k] as number) < gp.seller.groupRunP) {
      for (let g = 0; g < ids.length; g += gp.seller.maxParcelsPerHolder)
        groups.push(ids.slice(g, g + gp.seller.maxParcelsPerHolder));
    } else {
      for (const id of ids) groups.push([id]);
    }
  });
  return groups.map((group) => {
    const claimIds = group.slice().sort(compareIds);
    const d = drawsOf(claimIds[0] as ClaimId);
    return {
      id: nextHolderId(),
      displayName: d.displayName,
      situation: d.situation,
      honesty: d.honesty,
      knowledge: knowledgeOf(d.situation),
      claimIds,
      evidence: {},
    };
  });
}
