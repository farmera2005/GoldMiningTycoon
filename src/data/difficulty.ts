// Per-difficulty tuning entries (DESIGN §2.10; §1 1.11 is the table). A key maps to one entry per difficulty:
// { mul } scales a numeric base, { set } replaces it with any tuning value.
import type { TuningValue } from './tuning/types';

export type Difficulty = 'easy' | 'standard' | 'hard';
export type DiffEntry = { readonly mul: number } | { readonly set: TuningValue };
export type DifficultyTable = { readonly [key: string]: { readonly [D in Difficulty]: DiffEntry } };

export const difficultyTable = {} as const satisfies DifficultyTable;
