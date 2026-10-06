// src/data/difficulty.ts (DESIGN §1 1.11, §2.10): one { mul } or { set } entry per difficulty for each key.
import { z } from 'zod';
import { pos, tuningValue } from './common';

export const diffEntry = z.union([z.strictObject({ mul: pos }), z.strictObject({ set: tuningValue })]);
export const difficultyTableSchema = z.record(
  z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/),
  z.strictObject({ easy: diffEntry, standard: diffEntry, hard: diffEntry }),
);
