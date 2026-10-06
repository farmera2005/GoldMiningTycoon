// A game's identity on the UI side (DESIGN §13.16 autosave retention). Autosaves rotate and year-start snapshots are
// kept per game, so the slot store needs to know which game a save belongs to. Neither the seed nor the setup can tell
// two games apart (13.14 offers "New game with same seed"), and GameState may not grow a UI field, so the id is minted
// when a game starts and travels in `UiPersisted.gameId`, inside every SaveFile.ui: it survives save, load, export and
// import, and it is never hashed (D-13.3).
import type { GameState } from '../../engine';

/** Ids are used inside slot ids and storage keys. */
export const GAME_ID_PATTERN = /^[0-9A-Za-z_-]{1,64}$/;

/** Random bytes from the browser's CSPRNG; the UI may use ambient entropy, the engine never does (§2.3). */
export type RandomBytes = (n: number) => Uint8Array;

const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Crockford base32, lower case (as D-13.76's seeds, so an id read off a slot listing survives retyping). */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** A fresh id for a new game: `g` and 16 base32 characters (80 random bits). */
export function newGameId(bytes: RandomBytes = cryptoBytes): string {
  // 256 is a multiple of 32, so the low five bits of each byte are uniform.
  return `g${Array.from(bytes(16), (b) => ALPHABET[b & 31] ?? '0').join('')}`;
}

/** 32-bit FNV-1a over UTF-16 code units, from a given offset basis. */
function fnv1a(text: string, basis: number): number {
  let h = basis >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * The id of a save that carries none (a SaveFile.ui from before game ids, or none at all): derived from the seed and
 * the company name, so loading the same old save twice gives the same game. Two old games that share both share an
 * id; any game started in this build has a minted one instead.
 */
export function legacyGameId(state: GameState): string {
  const key = `${state.meta.seed}\u0000${state.company.name}`;
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  return `l${hex(fnv1a(key, 0x811c9dc5))}${hex(fnv1a(key, 0x01000193))}`;
}
