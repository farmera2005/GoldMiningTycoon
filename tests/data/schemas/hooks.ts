// src/data/events/hooks.ts (DESIGN §2.10, §12 12.3; S12-5, S12-14): one row per hook key, with its ops, scope
// dimensions, base, consumer phase and bounds around the neutral value. tests/data/hooks.test.ts adds the checks that
// need the tuning tables (base keys, owners by namespace).
import { z } from 'zod';
import { num, range } from './common';

export const HOOK_OPS = ['mul', 'add', 'set'] as const;
export const HOOK_SCOPE_DIMS = [
  'company',
  'district',
  'claim',
  'block',
  'machine',
  'model',
  'brand',
  'employee',
  'lender',
  'regime',
] as const;

const contains = (b: readonly [number, number] | undefined, v: number): boolean =>
  b === undefined || (b[0] <= v && v <= b[1]);

const uniqueList = <T extends z.ZodType>(inner: T) =>
  z
    .array(inner)
    .min(1)
    .refine((xs) => new Set(xs).size === xs.length, { message: 'entries repeat' });

const bounds = range().optional();

export const hookDefSchema = z
  .strictObject({
    key: z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/),
    ownerSection: z.number().int().min(1).max(14),
    unit: z.string().min(1),
    neutral: num,
    ops: uniqueList(z.enum(HOOK_OPS)),
    scopeDims: uniqueList(z.enum(HOOK_SCOPE_DIMS)),
    base: z.enum(['neutral', 'tuning']),
    baseKey: z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/).optional(),
    consumerPhase: z.number().int().min(1).max(6),
    mulBounds: bounds,
    addBounds: bounds,
    setBounds: bounds,
  })
  // The product of no muls is 1 and the sum of no adds is 0, so each bound must allow them; a set bound must allow
  // the neutral value (12.3 default bounds: mul [0, 5], add ±10, set [0, 1]).
  .refine((h) => contains(h.mulBounds, 1), { message: 'mulBounds must contain 1' })
  .refine((h) => contains(h.addBounds, 0), { message: 'addBounds must contain 0' })
  .refine((h) => contains(h.setBounds ?? [0, 1], h.neutral) || !h.ops.includes('set'), {
    message: 'set bounds must contain neutral',
  })
  // A bound only for an op the hook takes.
  .refine((h) => h.mulBounds === undefined || h.ops.includes('mul'), { message: 'mulBounds without mul' })
  .refine((h) => h.addBounds === undefined || h.ops.includes('add'), { message: 'addBounds without add' })
  .refine((h) => h.setBounds === undefined || h.ops.includes('set'), { message: 'setBounds without set' })
  .refine((h) => h.baseKey === undefined || h.base === 'tuning', { message: "baseKey needs base 'tuning'" })
  // 12.3: neutral 1 for `*Mult`, 0 for `*Add`, and the op follows the name.
  .refine((h) => !h.key.endsWith('Mult') || (h.neutral === 1 && h.ops.includes('mul')), {
    message: 'a *Mult hook is a mul with neutral 1',
  })
  .refine((h) => !h.key.endsWith('Add') || (h.neutral === 0 && h.ops.length === 1 && h.ops[0] === 'add'), {
    message: 'an *Add hook is an add with neutral 0',
  });

export const hookRegistrySchema = z
  .array(hookDefSchema)
  .refine((hs) => new Set(hs.map((h) => h.key)).size === hs.length, { message: 'hook keys repeat' });
