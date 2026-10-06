// §1 climate's scrambler (DESIGN §2.14 "Bots", D-2.58; S13-12, P1 contract §11 item 4). The hidden fields it covers arrive
// with §1's P1 package, which fills this scrambler in the same change; until then it is the identity.
import { identityScrambler, type ScramblerDef } from './types';

// CONTRACT-STUB(§1)
export const s01: ScramblerDef = identityScrambler('s01', 1, [
  'season drivers (DistrictYearSeason.z) and unrevealed season dates',
  'weather persistence state (WeatherState)',
]);
