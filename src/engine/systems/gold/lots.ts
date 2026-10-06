// §10 lots, fineness knowledge and sale quotes (DESIGN §10 10.9, 10.10, 10.17; D-10.28, D-10.47; S10-1, S10-3, S10-8,
// S10-17; P1 contract §4.10). `addLot` is the only way gold enters inventory (framework steps 12.1 and 12.2 call it); it
// mints a `lot` id, so until §10's package lands it is a creation stub that throws. The two scoring readers are real
// (P1 has no metal accounts and no forwards).
import { ContractStubError } from '../../core/assert';
import { calcResult, type Calc, type ExplainCtx } from '../../core/calc';
import type { ClaimId, LotId } from '../../core/ids';
import { ZERO_CENTS, type Cents, type MilliOz } from '../../core/money';
import { regionTemplate } from '../../../data/regions';
import { contractTuningNumber } from '../../state/partKit';
import type { GameState } from '../../state/types';
import { spotUsdPerFineOz } from './prices';
import type { ChannelQuote, ClaimFineness } from './types';

export interface NewLotSpec {
  claimId: ClaimId;
  rawMilliOz: MilliOz;
  trueAlloyFineness: number;
  trueDirtFrac: number;
  source: 'cleanup' | 'sample';
}

/** Creates a held lot at the claim's camp (estFineness from `claimFinenessKnowledge`; increments `createdRawMilliOz`). */
export function addLot(_draft: GameState, _spec: NewLotSpec): LotId {
  // CONTRACT-STUB(§10) gold.addLot
  throw new ContractStubError('gold.addLot');
}

/**
 * The player's fineness knowledge for a claim (P1–P4: alloy = §4 `finenessP50`, else the template mean; dirt =
 * `ops.goldRoomDirtFrac.noTable` / `.table` by §9 `siteSupport.hasTable`; S10-1). The Wave-0 stub returns the template
 * mean and the no-table dirt.
 */
export function claimFinenessKnowledge(state: GameState, claimId: ClaimId): ClaimFineness {
  // CONTRACT-STUB(§10) gold.claimFinenessKnowledge
  const claim = state.world.claims[claimId];
  const district = claim === undefined ? undefined : state.world.districts[claim.districtId];
  const template = district === undefined ? undefined : regionTemplate(district.templateId);
  if (template === undefined) throw new ContractStubError('gold.claimFinenessKnowledge (claim or template unknown)');
  return {
    alloy: template.fineness.mean,
    alloyBasis: 'regionPrior',
    dirt: contractTuningNumber(state.meta.tuning, 'ops.goldRoomDirtFrac.noTable'),
    dirtBasis: 'tuning',
  };
}

/** Expected net sale value per fine oz on public terms (D-10.28, S10-3). The stub returns spot. */
export function netSalePerFineOz(state: GameState, _lotId: LotId, _ex?: ExplainCtx): Calc<number> {
  // CONTRACT-STUB(§10) gold.netSalePerFineOz
  return calcResult(spotUsdPerFineOz(state), undefined);
}

/** One local column per district buyer (S10-17). */
export function quoteChannels(_state: GameState, _lotIds: readonly LotId[]): ChannelQuote[] {
  // CONTRACT-STUB(§10) gold.quoteChannels
  return [];
}

/** Metal-account value for scoring net worth (P5; 0 in P1). */
export function metalAccountValueForScoring(_state: GameState): Cents {
  return ZERO_CENTS;
}

/** Forward mark-to-market loss for scoring net worth (P5; 0 in P1). */
export function forwardMtmLossForScoring(_state: GameState): Cents {
  return ZERO_CENTS;
}
