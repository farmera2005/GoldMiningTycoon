// Validation for the P0 new-game wizard stub (DESIGN §13.14; the full eight-step wizard and §1's NewGameSetup
// validation codes arrive in P1). Pure, so it is tested without rendering.
import type { NewGameInput } from '../../app/shellModel';
import { assertNever } from '../../lib/assertNever';

export type NewGameFieldError = 'NAME_REQUIRED' | 'NAME_TOO_LONG' | 'SEED_INVALID';

export const COMPANY_NAME_MAX = 60;

export interface NewGameDraft {
  readonly companyName: string;
  readonly seed: string;
}

export type NewGameValidation =
  | { readonly ok: true; readonly input: NewGameInput }
  | { readonly ok: false; readonly errors: Partial<Record<keyof NewGameDraft, NewGameFieldError>> };

/** Seeds are non-negative safe integers: RNG key parts must be strings or safe integers (§2.3). */
export function parseSeed(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,16}$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateNewGame(draft: NewGameDraft): NewGameValidation {
  const name = draft.companyName.trim();
  const seed = parseSeed(draft.seed);
  const errors: Partial<Record<keyof NewGameDraft, NewGameFieldError>> = {};
  if (name === '') errors.companyName = 'NAME_REQUIRED';
  else if (name.length > COMPANY_NAME_MAX) errors.companyName = 'NAME_TOO_LONG';
  if (seed === null) errors.seed = 'SEED_INVALID';
  if (errors.companyName !== undefined || errors.seed !== undefined || seed === null) return { ok: false, errors };
  return { ok: true, input: { companyName: name, seed } };
}

export function fieldErrorText(code: NewGameFieldError): string {
  switch (code) {
    case 'NAME_REQUIRED':
      return 'Enter a company name.';
    case 'NAME_TOO_LONG':
      return `Keep the name to ${COMPANY_NAME_MAX} characters or fewer.`;
    case 'SEED_INVALID':
      return 'The seed must be a whole number from 0 to 9,007,199,254,740,991.';
    default:
      return assertNever(code);
  }
}

/** A fresh seed for the form's default; the UI may use browser randomness (the engine never does). */
export function randomSeed(): number {
  const words = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(words);
  else words[0] = Math.floor(Math.random() * 0x1_0000_0000);
  return words[0] ?? 0;
}
