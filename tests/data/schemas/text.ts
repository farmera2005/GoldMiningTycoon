// zod schemas for the text catalogs in src/data/text (DESIGN §13.10 templates, §13.19 t() catalog, §13.14 tutorial;
// S13-14, D-13.90). Shapes plus the rules a type cannot state: non-empty English, identifier-shaped params, unique
// ids, option sets. Placeholder ↔ param and spec checks need the UI's template parser and run in
// src/data/text/text.test.ts.
import { z } from 'zod';

const sentence = z
  .string()
  .min(1)
  .refine((s) => s.trim() === s, { message: 'leading or trailing space' });
const identifier = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
const params = z.array(identifier).refine((ps) => new Set(ps).size === ps.length, { message: 'params repeat' });

/** `alert.<family>.<name>[.<variant>]`: the kind is the first two segments after `alert.` (13.10). */
export const ALERT_TEMPLATE_KEY = /^alert\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*(\.[A-Za-z0-9]+)?$/;

export const alertTemplateSchema = z.strictObject({
  title: sentence,
  body: sentence,
  groupTitle: sentence.optional(),
  params,
});

export const alertTemplatesSchema = z.record(z.string().regex(ALERT_TEMPLATE_KEY), alertTemplateSchema);

export const decisionTemplatesSchema = z.record(
  z.string().regex(/^decision\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/),
  z.strictObject({
    title: sentence,
    body: sentence,
    params,
    options: z
      .record(identifier, z.strictObject({ label: sentence, consequence: sentence }))
      .refine((o) => Object.keys(o).length >= 2, { message: 'a decision offers at least two options' }),
  }),
);

export const fundingConsequenceSchema = z.record(z.string().regex(/^funding\.[a-zA-Z.]+$/), sentence);

export const glossarySchema = z
  .array(
    z.strictObject({
      id: identifier,
      term: sentence,
      definition: sentence,
      see: z.array(identifier).min(1).optional(),
    }),
  )
  .refine((es) => new Set(es.map((e) => e.id)).size === es.length, { message: 'glossary ids repeat' })
  .refine((es) => new Set(es.map((e) => e.term)).size === es.length, { message: 'glossary terms repeat' })
  .refine(
    (es) => {
      const ids = new Set(es.map((e) => e.id));
      return es.every((e) => (e.see ?? []).every((s) => ids.has(s) && s !== e.id));
    },
    { message: 'a `see` link names no entry, or itself' },
  );

export const tutorialStepsSchema = z
  .array(
    z.strictObject({
      id: identifier,
      order: z.number().int().positive(),
      week: z.number().int().positive(),
      title: sentence,
      body: sentence,
      params,
      showMe: z
        .strictObject({ href: z.string().regex(/^#\//), anchor: z.string().regex(/^[a-z][a-z0-9-]*$/) })
        .optional(),
    }),
  )
  .refine((ss) => new Set(ss.map((s) => s.id)).size === ss.length, { message: 'step ids repeat' })
  .refine((ss) => ss.every((s, i) => s.order === i + 1), { message: 'steps must be numbered 1..n in order' })
  .refine((ss) => ss.every((s, i) => i === 0 || (ss[i - 1]?.week ?? 0) <= s.week), {
    message: 'step weeks must not go backwards',
  });

export const startLettersSchema = z.strictObject({
  bootstrapper: z.strictObject({ title: sentence, body: sentence, params }),
  'backed.equity': z.strictObject({ title: sentence, body: sentence, params }),
  'backed.royalty': z.strictObject({ title: sentence, body: sentence, params }),
  inheritor: z.strictObject({ title: sentence, body: sentence, params }),
});

/** Engine codes (§2.2) are SCREAMING_SNAKE; reason texts are full sentences. */
export const codeTextSchema = z.record(
  z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  sentence.refine((s) => /[.!?]$/.test(s), { message: 'a reason is a full sentence' }),
);

export const enumLabelsSchema = z.record(identifier, z.record(z.string().min(1), sentence));

/**
 * One row of the engine's `ALERT_TAXONOMY` (P1 contract §4.13, S12-12), as T21 reads it once the taxonomy lands.
 */
export const alertTaxonomyRowSchema = z.object({
  owner: z.number().int().min(1).max(14),
  severity: z.enum(['info', 'warning', 'critical', 'rule']),
  trigger: z.enum(['level', 'edge']),
  phase: z.number().int().min(0).max(6),
  thresholdKeys: z.array(z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/)),
});
