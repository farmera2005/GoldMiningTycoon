// §3 the Inheritor's family ground (DESIGN §3.6.1, §1 1.8.2; D-1.65; P1 contract §4.3, N4). On the reserved family run
// (three 20-ac valley parcels, so worlds are identical across start types), §3 conditions the run's grades on a
// quality tier drawn from `game.inheritorTierWeights`, plays out the twelve family seasons, adds the depletion and
// pre-strips the two best undug paystreak blocks, using the streams §1 hands it (recentCat is removed from the run's
// kind mix, s03 #3). It returns the family records §4 shows.
import { ContractStubError } from '../../core/assert';
import type { Rng } from '../../core/rng';
import type { GameState } from '../../state/types';
import type { FamilyRecords } from './listingTypes';

/** Creation stub until §3's package lands: only the Inheritor start reaches it. */
export function genInheritedGroup(_draft: GameState, _r: Rng, _rPits: Rng): FamilyRecords {
  // CONTRACT-STUB(§3) world.genInheritedGroup
  throw new ContractStubError('world.genInheritedGroup');
}
