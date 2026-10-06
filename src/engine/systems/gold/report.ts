// §10 gold's week scratch and week record (P1 contract §1.3, §4.10, s02 #10). The scratch carries the lots created and
// the sales made in step 12; the record shows the player the week's lots and what was sold (estimated fine oz, net cash).
import type { LotId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GoldSaleRow } from './types';

export type { GoldSaleRow } from './types';

export interface GoldWeekScratch {
  lotsCreated: LotId[];
  sales: GoldSaleRow[];
}

export interface GoldWeekRecord {
  lotsCreated: LotId[];
  soldFineOz: number;
  soldNetCents: Cents;
}

export function emptyGoldWeekScratch(): GoldWeekScratch {
  return { lotsCreated: [], sales: [] };
}

export function emptyGoldWeekRecord(): GoldWeekRecord {
  return { lotsCreated: [], soldFineOz: 0, soldNetCents: ZERO_CENTS };
}
