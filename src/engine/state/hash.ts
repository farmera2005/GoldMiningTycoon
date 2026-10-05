// The state hash (DESIGN §2.3 item 5): 64-bit FNV-1a over canonical JSON. Golden replays, save round trips and the
// determinism properties compare it.
import { hashValue } from '../core/hash';
import type { GameState } from './types';

export function hashState(state: GameState): string {
  return hashValue(state);
}
