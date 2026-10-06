// The P0 new-game wizard stub (DESIGN §13.24 P0: company name + seed; §13.14's eight steps arrive in P1). The name is
// validated by the engine's own `validateSetup` on the setup the stub will start (§1 1.6 codes, D-13.42); the seed is
// a UI string the engine receives as is (D-13.28). Pure, so it is tested without rendering.
import { NAME_MAX_LENGTH, defaultNewGameSetup, validateSetup, type SetupErrorCode } from '../../../engine';
import type { NewGameInput } from '../../engine/engineClient';
import { t } from '../../text';

export type SeedErrorCode = 'SEED_EMPTY' | 'SEED_TOO_LONG';

/** Seeds are free text the player may type or paste; this bound only keeps RNG keys and save summaries tidy. */
export const SEED_MAX_LENGTH = 64;
/** D-13.28: a 26-character base32 seed (130 bits). */
export const SEED_LENGTH = 26;
/** Crockford's base32 alphabet: no I, L, O or U, so a seed read aloud or retyped survives. */
export const SEED_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface NewGameDraft {
  readonly companyName: string;
  readonly seed: string;
}

export interface NewGameErrors {
  readonly companyName?: SetupErrorCode;
  readonly seed?: SeedErrorCode;
}

export type NewGameValidation =
  { readonly ok: true; readonly input: NewGameInput } | { readonly ok: false; readonly errors: NewGameErrors };

export function seedIssue(seed: string): SeedErrorCode | null {
  const s = seed.trim();
  if (s === '') return 'SEED_EMPTY';
  if (s.length > SEED_MAX_LENGTH) return 'SEED_TOO_LONG';
  return null;
}

export function validateNewGame(draft: NewGameDraft): NewGameValidation {
  const companyName = draft.companyName.trim();
  const issue = validateSetup(defaultNewGameSetup({ companyName })).find((i) => i.field === 'companyName');
  const seed = seedIssue(draft.seed);
  const errors: { companyName?: SetupErrorCode; seed?: SeedErrorCode } = {};
  if (issue !== undefined) errors.companyName = issue.code;
  if (seed !== null) errors.seed = seed;
  if (errors.companyName !== undefined || errors.seed !== undefined) return { ok: false, errors };
  return { ok: true, input: { companyName, seed: draft.seed.trim() } };
}

export function fieldErrorText(code: SetupErrorCode | SeedErrorCode): string {
  if (code === 'NAME_TOO_LONG') return t('setup.NAME_TOO_LONG', { max: NAME_MAX_LENGTH });
  if (code === 'SEED_TOO_LONG') return t('setup.SEED_TOO_LONG', { max: SEED_MAX_LENGTH });
  return t(`setup.${code}`);
}

/** Random bytes from the browser's CSPRNG; the UI may use ambient entropy, the engine never does (§2.3). */
export type RandomBytes = (n: number) => Uint8Array;

export const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** A fresh 26-character base32 seed. 256 is a multiple of 32, so the low five bits of each byte are uniform. */
export function randomSeed(bytes: RandomBytes = cryptoBytes): string {
  let out = '';
  for (const b of bytes(SEED_LENGTH)) out += SEED_ALPHABET[b & 31];
  return out;
}
