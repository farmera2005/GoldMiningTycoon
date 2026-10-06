// Town services by tier (DESIGN §3.3.2). `laborPoolMult` scales §8's local labor pool; hub cities (or a town next to
// one) also carry equipment dealers (§9 prices freight from the hub).
import type { TownServices, TownTier } from '../../engine/systems/world/types';

export const townServicesByTier = {
  outpost: {
    fuel: true,
    partsCounter: false,
    weldingShop: false,
    goldBuyer: true, // seasonal
    airstrip: true,
    clinic: false,
    motel: false,
    equipmentDealers: false,
    laborPoolMult: 0.3,
  },
  serviceTown: {
    fuel: true,
    partsCounter: true,
    weldingShop: true,
    goldBuyer: true,
    airstrip: true,
    clinic: true,
    motel: true,
    equipmentDealers: false,
    laborPoolMult: 0.7,
  },
  hubCity: {
    fuel: true,
    partsCounter: true,
    weldingShop: true,
    goldBuyer: true,
    airstrip: true,
    clinic: true,
    motel: true,
    equipmentDealers: true,
    laborPoolMult: 1.0,
  },
} as const satisfies Record<TownTier, TownServices>;
