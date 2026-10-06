// Bedrock types (DESIGN §3.5.3 `BEDROCK` table): cleanup depth B0 and the share of the column's gold held in the
// cleanup zone s0. Fractured, foliated bedrock traps gold deeper (R3).
import type { BedrockType } from '../../engine/systems/world/types';

export interface BedrockDef {
  readonly cleanupFt: number;
  readonly goldShare: number;
  readonly note: string;
}

export const bedrockTable = {
  schist: { cleanupFt: 1.5, goldShare: 0.2, note: 'foliated and fractured; gold 1–3 ft into cracks' },
  slatePhyllite: { cleanupFt: 2.5, goldShare: 0.3, note: 'steep cleavage acts as natural riffles' },
  granite: { cleanupFt: 1.0, goldShare: 0.1, note: 'weathers to grus; gold stays near the top' },
  basaltVolcanic: { cleanupFt: 0.7, goldShare: 0.08, note: 'smooth, poor trap' },
  clayFalse: { cleanupFt: 0.3, goldShare: 0.12, note: 'gold sits on the clay, partway up the column' },
  karstLimestone: { cleanupFt: 3.0, goldShare: 0.35, note: 'deep natural riffles (P6)' },
} as const satisfies Record<BedrockType, BedrockDef>;
