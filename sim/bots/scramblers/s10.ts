// §10 gold's scrambler (DESIGN §2.14 "Bots", D-2.58; S13-12, P1 contract §11 item 4). The hidden fields it covers arrive
// with §10's P1 package, which fills this scrambler in the same change; until then it is the identity.
import { identityScrambler, type ScramblerDef } from './types';

// CONTRACT-STUB(§10)
export const s10: ScramblerDef = identityScrambler('s10', 10, [
  'lot true fineness and dirt',
  'local-buyer bias (biasMean)',
]);
