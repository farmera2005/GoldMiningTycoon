// RNG stream registry (DESIGN §2.3 item 1). Every rng() call names one of these streams; each has exactly one owning
// section. ESLint requires the stream argument to be a registered literal, and a registry test checks owners.
//
// Stream rules (§2.3):
//  (a) Names are lowercase and hyphenated, unique across the registry. A new stream takes its section's prefix
//      (`land-`, `permits-`, `ops-`, `staff-`, `fleet-`, `gold-`/`market-`, `finance-`, `ai-`, `hr-`); the shorter
//      historical names below are registered as they stand.
//  (b) Only the owner draws on a stream. Another section reaches it only through the owner's function (a
//      caller-supplied stream, as with §3 drawSample, or §5 resolveOffer).
//  (c) Weekly draws key on `turn`; generation draws key on entity ids; action-time draws key on the subject plus a
//      per-subject counter stored in state (offerIndex, requestIndex, a stage key), never on `clock.actionSeq`.
//  (d) The `action` stream (`rng(seed, 'action', turn, actionSeq)`) is only for draws with no gameplay consequence
//      (flavor-text variants). Any draw that can change an outcome follows (c).
//  (e) Within a stream the draw order is fixed and documented by the owner, and every documented draw is taken even
//      when unused, so retuning a probability never shifts later draws.
//
// `keyShape` records the key parts after the stream name, as the owning section documents them; it is documentation
// (the engine does not parse it).

export interface StreamDef {
  /** Owning DESIGN section. */
  readonly owner: number;
  readonly keyShape?: string;
}

export const STREAMS = {
  // §1 Company, climate and setup
  season: { owner: 1, keyShape: 'year, districtId' },
  'season-fc': { owner: 1, keyShape: 'year, districtId, kind, issueWeek' },
  weather: { owner: 1, keyShape: 'turn, districtId' },
  'weather-init': { owner: 1, keyShape: 'districtId' },
  setup: { owner: 1, keyShape: "'inheritor' [, 'fleet', i] | §3 'pits' sub-keys" },
  investor: { owner: 1, keyShape: "'approval', agreementId, subject, requestIndex" },
  // §3 World and geology
  world: { owner: 3, keyShape: 'generation sub-keys (district, creek, claim ids)' },
  seller: { owner: 3, keyShape: 'claimId, holderId' },
  'seller-tells': { owner: 3, keyShape: 'listingId, channel' },
  supply: { owner: 3, keyShape: "turn [, claimId | districtId] | 'init'" },
  site: { owner: 3, keyShape: 'turn, claimId' },
  // §4 Knowledge and prospecting
  prospect: { owner: 4, keyShape: '[cmpId,] claimId, blockId, methodId, k' },
  sample: { owner: 4, keyShape: '[cmpId,] claimId, blockId, methodId, k (passed to §3 drawSample)' },
  records: { owner: 4, keyShape: 'claimId, item' },
  contractors: { owner: 4, keyShape: 'turn, regionId' },
  // §5 Land and negotiation
  'land-list': { owner: 5, keyShape: 'listingId' },
  'land-title': { owner: 5, keyShape: 'listingId' },
  'land-market': { owner: 5 },
  'land-buyers': { owner: 5 },
  'land-finding': { owner: 5 },
  'land-auction': { owner: 5, keyShape: 'auctionId' },
  'land-stake': { owner: 5, keyShape: 'stakingId, unit' },
  'land-dispute': { owner: 5 },
  'land-suit': { owner: 5 },
  'land-jv': { owner: 5 },
  negotiation: { owner: 5, keyShape: 'turn, negId (§9 and §11 reach it only through §5 resolveOffer)' },
  // §6 Permits
  'permits-app': { owner: 6, keyShape: 'appId, stageKey, round' },
  'permits-workload': { owner: 6, keyShape: 'year, districtId' },
  'permits-exceed': { owner: 6, keyShape: 'turn, claimId' },
  'permits-inspect': { owner: 6, keyShape: "turn, claimId | 'forced', turn, claimId, agency" },
  'permits-violation': { owner: 6, keyShape: 'violationId' },
  'permits-bond': { owner: 6, keyShape: "claimId, 'forfeit', turn | claimId, 'reveg', year" },
  'permits-filing': { owner: 6, keyShape: 'obligationId' },
  // §7 Operations (lineId is the last key part, D-2.31)
  'ops-grade': { owner: 7, keyShape: 'turn, claimId, blockId' },
  'ops-freeze': { owner: 7, keyShape: 'turn, claimId, lineId' },
  'ops-audit': { owner: 7, keyShape: 'claimId, lineId, auditSeq' },
  'ops-skim': { owner: 7, keyShape: 'turn, claimId, lineId' },
  // §8 Staff
  'staff-cand': { owner: 8, keyShape: 'candId' },
  'staff-market': { owner: 8, keyShape: "turn, districtId | turn, 'ref', empId | turn, 'rcr', orderId" },
  'staff-refs': { owner: 8, keyShape: 'candId' },
  'staff-hire': { owner: 8, keyShape: "'offer', candId, offerIndex | turn, empId" },
  'staff-quit': { owner: 8, keyShape: 'turn, empId' },
  'staff-absence': { owner: 8, keyShape: 'turn, empId' },
  'staff-injury': { owner: 8, keyShape: 'turn, empId' },
  'staff-injury-sev': { owner: 8, keyShape: 'turn, empId' },
  'staff-rehire': { owner: 8, keyShape: 'turn, empId' },
  'staff-delegate': { owner: 8, keyShape: 'turn, claimId' },
  // §9 Fleet
  'fleet-world': { owner: 9, keyShape: 'districtId' },
  'fleet-market': { owner: 9, keyShape: 'turn, districtId' },
  'fleet-listing': { owner: 9, keyShape: 'listingId' },
  'fleet-promo': { owner: 9, keyShape: 'year, quarter, brandId' },
  'fleet-rental': { owner: 9, keyShape: 'turn, districtId' },
  'fleet-auction': { owner: 9, keyShape: 'lotId' },
  'fleet-sale': { owner: 9, keyShape: 'turn, machineId' },
  'fleet-inspect': { owner: 9, keyShape: 'turn, inspectionId' },
  'fleet-fail': { owner: 9, keyShape: 'turn, machineId' },
  'fleet-symptom': { owner: 9, keyShape: 'turn, machineId' },
  'fleet-delivery': { owner: 9, keyShape: 'listingId' },
  'fleet-fs': { owner: 9, keyShape: 'calloutId' },
  // §10 Gold and markets
  macro: { owner: 10, keyShape: 'turn' },
  'gold-regime': { owner: 10, keyShape: 'turn' },
  'gold-price': { owner: 10, keyShape: 'turn' },
  'gold-jump': { owner: 10, keyShape: 'turn' },
  'gold-prehistory': { owner: 10, keyShape: 'k, subsystem' },
  news: { owner: 10, keyShape: 'turn, sourceKey' },
  analyst: { owner: 10, keyShape: 'turn, analystId' },
  buyer: { owner: 10, keyShape: 'buyerId, claimId' },
  assay: { owner: 10, keyShape: 'shipmentId' },
  'market-buyers': { owner: 10, keyShape: "districtId (not §3's world)" },
  // §11 Finance
  'finance-lender': { owner: 11, keyShape: 'turn, applicationId | loanId, purpose' },
  'finance-royaltyco': { owner: 11, keyShape: 'turn, requestId' },
  'finance-equity': { owner: 11, keyShape: 'turn, requestId' },
  'finance-insurance': { owner: 11, keyShape: 'turn, claimId | year, line' },
  'finance-reorg': { owner: 11, keyShape: "turn, caseId, 'vote' (P4, D-2.30)" },
  // §12 Events and competitors
  events: { owner: 12, keyShape: "turn, defId, scopeKey [, 'sub', entityId] | turn, 'resp', evtId" },
  ai: { owner: 12, keyShape: 'turn, cmpId, purpose [, entityId]' },
  'ai-world': { owner: 12, keyShape: "i [, 'claims'] | newCmpId" },
  'ai-seq': { owner: 12, keyShape: 'cmpId, claimId' },
  'ai-val': { owner: 12, keyShape: 'cmpId, claimId' },
  'ai-spawn': { owner: 12, keyShape: 'turn' },
  // §14 Hard-rock track (optional, P6)
  'hr-hint': { owner: 14 },
  'hr-lab': { owner: 14, keyShape: 'labId' },
  'hr-ops': { owner: 14 },
  'hr-blast': { owner: 14, keyShape: 'turn, siteId' },
  'hr-toll': { owner: 14 },
  'hr-capex': { owner: 14, keyShape: "projectId [, 'eac', p]" },
  // §2 (restricted: no gameplay consequence, rule d)
  action: { owner: 2, keyShape: 'turn, actionSeq' },
} as const satisfies Record<string, StreamDef>;

export type StreamName = keyof typeof STREAMS;

export function isStreamName(s: string): s is StreamName {
  return Object.prototype.hasOwnProperty.call(STREAMS, s);
}
