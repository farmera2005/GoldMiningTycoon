// The text catalogs (DESIGN §13.10, §13.14, §13.19; S13-14) and T21's template ↔ taxonomy check (§13.27 T21).
//
// T21 runs against the engine's exported kind list (`ALERT_KINDS`) and, once it exists, the machine-readable taxonomy
// `systems/inbox/taxonomy.ts` (`ALERT_TAXONOMY`, P1 contract §4.13). The taxonomy is discovered with a build-time glob,
// so this file passes before it lands and tightens by itself when it does:
//   - without the taxonomy, the P1 kinds are the contract's list (`P1_ALERT_KINDS`), and the contract's new kinds that
//     `ALERT_KINDS` does not list yet are tolerated as template targets;
//   - with it, the P1 kinds are its rows with `phase ≤ 1`, every template must name a registered kind, the two P1 lists
//     must agree, and every row's threshold keys must exist in tuning with no `game.alerts.*` duplicate.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  ALERT_TEMPLATE_KEY,
  alertTaxonomyRowSchema,
  alertTemplatesSchema,
  codeTextSchema,
  decisionTemplatesSchema,
  enumLabelsSchema,
  fundingConsequenceSchema,
  glossarySchema,
  startLettersSchema,
  tutorialStepsSchema,
} from '../../../tests/data/schemas/text';
import { ALERT_KINDS, FRAMEWORK_ERROR_CODES } from '../../engine';
import { isKnownSpec, placeholders } from '../../ui/lib/templates';
import { parseRoute } from '../../ui/app/router';
import { baseTuning } from '../tuning';
import { ALERT_TEMPLATES, P1_ALERT_KINDS } from './alerts';
import { DECISION_TEMPLATES, FUNDING_CONSEQUENCE_TEXT } from './decisions';
import { GLOSSARY } from './glossary';
import { START_LETTERS, TUTORIAL_NOTES, TUTORIAL_STEPS } from './tutorial';
import { actionCodeText, enumLabels, uiText, warningCodeText } from './ui';

function problems(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

/** Placeholder problems of one text: a param it names but does not declare, or a format it does not know. */
function placeholderProblems(where: string, text: string, declared: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of placeholders(text)) {
    if (!declared.includes(p.name)) out.push(`${where}: {${p.name}} is not in params`);
    if (p.spec !== null && !isKnownSpec(p.spec)) out.push(`${where}: unknown format ${p.spec}`);
  }
  // A brace that is not a placeholder is a typo (`{claim name}`, `{claim`).
  const stray = text.replace(/\{\w+(?::[\w.]+)?\}/g, '');
  if (/[{}]/.test(stray)) out.push(`${where}: unbalanced or malformed brace`);
  return out;
}

/** The kind an alert template key belongs to: its first two segments after `alert.`. */
function kindOfTemplateKey(key: string): string {
  return key.split('.').slice(1, 3).join('.');
}

// ------------------------------------------------------------------------------------------------ taxonomy discovery

const taxonomyModules = import.meta.glob<Record<string, unknown>>('../../engine/systems/inbox/taxonomy.ts', {
  eager: true,
});
const taxonomyModule = Object.values(taxonomyModules)[0];
type TaxonomyRow = z.infer<typeof alertTaxonomyRowSchema>;
const taxonomy: Readonly<Record<string, unknown>> | null =
  taxonomyModule === undefined ? null : ((taxonomyModule['ALERT_TAXONOMY'] as Record<string, unknown>) ?? null);

const REGISTERED: ReadonlySet<string> = new Set<string>(ALERT_KINDS);

/** The P1 kinds as the engine defines them: the taxonomy's rows of phase ≤ 1, else the contract's list. */
function p1Kinds(): string[] {
  if (taxonomy === null) return [...P1_ALERT_KINDS];
  return Object.entries(taxonomy)
    .filter(([, row]) => alertTaxonomyRowSchema.safeParse(row).success && (row as TaxonomyRow).phase <= 1)
    .map(([kind]) => kind)
    .sort();
}

/** Kinds a template may target: registered ones, plus (before the taxonomy lands) the contract's new P1 kinds. */
function allowedKinds(): ReadonlySet<string> {
  return taxonomy === null ? new Set([...REGISTERED, ...P1_ALERT_KINDS]) : REGISTERED;
}

describe('alert templates (13.10, D-13.90)', () => {
  it('have valid keys, text and params', () => {
    expect(problems(alertTemplatesSchema, ALERT_TEMPLATES)).toEqual([]);
    for (const key of Object.keys(ALERT_TEMPLATES)) expect(key).toMatch(ALERT_TEMPLATE_KEY);
  });

  it('name only declared params, in known formats, in title, body and group title', () => {
    const issues: string[] = [];
    for (const [key, tpl] of Object.entries(ALERT_TEMPLATES)) {
      const groupTitle: string | undefined = 'groupTitle' in tpl ? tpl.groupTitle : undefined;
      for (const [part, text] of [
        ['title', tpl.title],
        ['body', tpl.body],
        ['groupTitle', groupTitle],
      ] as const) {
        if (text !== undefined) issues.push(...placeholderProblems(`${key}.${part}`, text, tpl.params));
      }
    }
    expect(issues).toEqual([]);
  });

  it('give every variant a base template for its kind', () => {
    for (const key of Object.keys(ALERT_TEMPLATES)) {
      expect(Object.hasOwn(ALERT_TEMPLATES, `alert.${kindOfTemplateKey(key)}`), key).toBe(true);
    }
  });

  it('give grouped kinds (obligations, 13.10) a group title with the count and total', () => {
    for (const kind of ['obligation.dueSoon', 'obligation.missed'] as const) {
      const tpl = ALERT_TEMPLATES[`alert.${kind}`];
      expect(tpl.groupTitle).toContain('{count}');
      expect(tpl.groupTitle).toContain('{totalUsd:usd}');
    }
  });
});

describe('T21: templates ↔ alert kinds ↔ taxonomy (13.27)', () => {
  it('a template exists for every P1 kind', () => {
    const missing = p1Kinds().filter((k) => !Object.hasOwn(ALERT_TEMPLATES, `alert.${k}`));
    expect(missing).toEqual([]);
  });

  it('every template names a registered alert kind', () => {
    const unknown = Object.keys(ALERT_TEMPLATES)
      .map(kindOfTemplateKey)
      .filter((k) => !allowedKinds().has(k));
    expect([...new Set(unknown)]).toEqual([]);
  });

  it('the only P1 kinds the engine does not list yet are the contract additions (until the taxonomy lands)', () => {
    const notRegistered = P1_ALERT_KINDS.filter((k) => !REGISTERED.has(k));
    if (taxonomy === null) {
      // P1 contract §6 "new": §5's lease and land kinds (s05 #20); contracts-engine adds them to ALERT_KINDS.
      expect(
        notRegistered.every((k) =>
          [
            'lease.defaultNotice',
            'lease.terminated',
            'lease.ended',
            'land.quickSaleClosed',
            'land.interestChanged',
          ].includes(k),
        ),
      ).toBe(true);
    } else {
      expect(notRegistered).toEqual([]);
    }
  });

  it('never ships a welcome kind (IR-1, S13-15)', () => {
    expect(Object.keys(ALERT_TEMPLATES).some((k) => k.startsWith('alert.company.welcome'))).toBe(false);
    expect((P1_ALERT_KINDS as readonly string[]).includes('company.welcome')).toBe(false);
  });

  it.runIf(taxonomy !== null)('the taxonomy rows are well formed and agree with the P1 list', () => {
    if (taxonomy === null) return;
    const bad = Object.entries(taxonomy).flatMap(([kind, row]) =>
      problems(alertTaxonomyRowSchema, row).map((p) => `${kind}: ${p}`),
    );
    expect(bad).toEqual([]);
    expect(Object.keys(taxonomy).filter((k) => !REGISTERED.has(k))).toEqual([]);
    expect(p1Kinds()).toEqual([...P1_ALERT_KINDS].sort());
  });

  it.runIf(taxonomy !== null)('threshold keys exist in tuning and no game.alerts.* key duplicates one', () => {
    if (taxonomy === null) return;
    const tuningKeys = new Set(Object.keys(baseTuning));
    const issues: string[] = [];
    for (const [kind, row] of Object.entries(taxonomy)) {
      const parsed = alertTaxonomyRowSchema.safeParse(row);
      if (!parsed.success) continue;
      for (const key of parsed.data.thresholdKeys) {
        if (parsed.data.phase <= 1 && !tuningKeys.has(key)) issues.push(`${kind}: ${key} is not a tuning key`);
        const last = key.split('.').pop() ?? key;
        if (!key.startsWith('game.alerts.') && tuningKeys.has(`game.alerts.${last}`)) {
          issues.push(`${kind}: game.alerts.${last} duplicates ${key}`);
        }
      }
    }
    expect(issues).toEqual([]);
  });
});

describe('decision text (13.4, D-13.86)', () => {
  it('is well formed, and every placeholder is a declared param', () => {
    expect(problems(decisionTemplatesSchema, DECISION_TEMPLATES)).toEqual([]);
    const issues: string[] = [];
    for (const [key, tpl] of Object.entries(DECISION_TEMPLATES)) {
      issues.push(...placeholderProblems(`${key}.title`, tpl.title, tpl.params));
      issues.push(...placeholderProblems(`${key}.body`, tpl.body, tpl.params));
    }
    expect(issues).toEqual([]);
  });

  it('covers the P1 decisions and their options (P1 contract §5.2; §8 D-8.62; §5 D-5.30)', () => {
    expect(Object.keys(DECISION_TEMPLATES).sort()).toEqual([
      'decision.land.leaseRenewal',
      'decision.staff.layoffDecision',
      'decision.staff.recallDecision',
    ]);
    expect(Object.keys(DECISION_TEMPLATES['decision.staff.layoffDecision'].options)).toEqual([
      'layoffDefault',
      'keepAll',
    ]);
    expect(Object.keys(DECISION_TEMPLATES['decision.staff.recallDecision'].options)).toEqual([
      'recallAll',
      'recallNone',
    ]);
    expect(Object.keys(DECISION_TEMPLATES['decision.land.leaseRenewal'].options)).toContain('renew');
  });

  it('has a funding consequence for every §11 payment category', () => {
    expect(problems(fundingConsequenceSchema, FUNDING_CONSEQUENCE_TEXT)).toEqual([]);
    expect(Object.keys(FUNDING_CONSEQUENCE_TEXT).sort()).toEqual(
      Object.keys(enumLabels.payCategory)
        .map((c) => `funding.${c}`)
        .sort(),
    );
  });
});

describe('glossary and tutorial (13.1 Help, 13.14)', () => {
  it('glossary: unique ids and terms, links that resolve', () => {
    expect(problems(glossarySchema, GLOSSARY)).toEqual([]);
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
  });

  it('tutorial: the fourteen 13.14 steps in order, with declared params and routes that exist', () => {
    expect(problems(tutorialStepsSchema, TUTORIAL_STEPS)).toEqual([]);
    expect(TUTORIAL_STEPS).toHaveLength(14);
    const issues: string[] = [];
    for (const step of TUTORIAL_STEPS) {
      issues.push(...placeholderProblems(`${step.id}.title`, step.title, step.params));
      issues.push(...placeholderProblems(`${step.id}.body`, step.body, step.params));
      if (step.showMe !== undefined && parseRoute(step.showMe.href).name === 'notFound') {
        issues.push(`${step.id}: Show me goes nowhere (${step.showMe.href})`);
      }
    }
    expect(issues).toEqual([]);
  });

  it('start letters exist for every start and terms; the week-4 records text follows s04 #17', () => {
    expect(problems(startLettersSchema, START_LETTERS)).toEqual([]);
    for (const [key, letter] of Object.entries(START_LETTERS)) {
      expect(placeholderProblems(key, letter.body, letter.params)).toEqual([]);
    }
    expect(TUTORIAL_NOTES.recordsFindings).toContain('old workings and creek history');
    expect(TUTORIAL_NOTES.smallCrew).toContain('×0.92');
    expect(TUTORIAL_NOTES.smallCrew).toContain('×1.15');
  });
});

// Every error and warning code each folder registers (`<FOLDER>_ERROR_CODES`, `<FOLDER>_WARNING_CODES`), read from the
// engine's composition files at build time, so codes added by the owning packages are covered as they land.
const actionModules = import.meta.glob<Record<string, unknown>>('../../engine/systems/*/actions.ts', { eager: true });

function folderCodes(suffix: '_ERROR_CODES' | '_WARNING_CODES'): string[] {
  const out = new Set<string>();
  for (const mod of Object.values(actionModules)) {
    for (const [name, value] of Object.entries(mod)) {
      if (name.endsWith(suffix) && Array.isArray(value)) for (const c of value) out.add(String(c));
    }
  }
  return [...out].sort();
}

describe('code reason text (T24, 13.19)', () => {
  it('is well formed', () => {
    expect(problems(codeTextSchema, actionCodeText)).toEqual([]);
    expect(problems(codeTextSchema, warningCodeText)).toEqual([]);
    expect(problems(enumLabelsSchema, enumLabels)).toEqual([]);
  });

  it('covers every framework code and every code a folder registers', () => {
    expect(actionModules).not.toEqual({});
    const errors = [...FRAMEWORK_ERROR_CODES, ...folderCodes('_ERROR_CODES')];
    expect(errors.filter((c) => !Object.hasOwn(actionCodeText, c))).toEqual([]);
    expect(folderCodes('_WARNING_CODES').filter((c) => !Object.hasOwn(warningCodeText, c))).toEqual([]);
  });

  it('gives the P1 UI action refusals of 13.21 their text', () => {
    for (const key of [
      'run.NO_RUN',
      'stopRules.RULE_INVALID',
      'inbox.CANNOT_SNOOZE_BLOCKING',
      'baseline.NO_ACTIVE_PLAN',
      'export.EXPORT_EMPTY',
      'explain.EXPLAIN_EXPIRED',
    ] as const) {
      expect(uiText[key].length).toBeGreaterThan(0);
    }
  });
});
