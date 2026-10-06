// §4 knowledge's scrambler (DESIGN §2.14 "Bots", D-2.58; S13-12, P1 contract §11 item 4). The hidden fields it covers arrive
// with §4's P1 package, which fills this scrambler in the same change; until then it is the identity.
import { identityScrambler, type ScramblerDef } from './types';

// CONTRACT-STUB(§4)
export const s04: ScramblerDef = identityScrambler('s04', 4, [
  'sample concentrate truth (sampleConc[*].hidden)',
  'assay truth of unassayed samples',
]);
