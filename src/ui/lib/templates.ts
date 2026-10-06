// Filling the text catalogs (DESIGN §13.10 templates, §13.19 t() catalog, D-13.90). Templates live in data/text/; this
// module turns a template key plus an emitter's params into text, formatting numbers through ui/format so an alert
// prints money, ounces and weeks exactly as every screen does (13.2). Placeholders:
//   {name}           the param as given
//   {name:<Unit>}    a number formatted by its §2.8 unit (`{askCents:cents}`, `{dueTurn:turn}`)
//   {name:code}      the reason text of an action error or warning code
//   {name:<set>}     an enumeration label from data/text/ui.ts `enumLabels` (`{cause:idleCause}`)
// A placeholder whose param is missing stays visible as written, so a wrong param name shows in testing rather than
// printing a blank.
import { ALERT_TEMPLATES, type AlertTemplate } from '../../data/text/alerts';
import { DECISION_TEMPLATES, FUNDING_CONSEQUENCE_TEXT, type DecisionTemplate } from '../../data/text/decisions';
import { actionCodeText, enumLabels, warningCodeText, type EnumLabelSet } from '../../data/text/ui';
import { formatValue, type FormatContext } from '../format';
import { isUnit } from '../format/unitList';

export type TemplateParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)(?::([\w.]+))?\}/g;

export interface Placeholder {
  readonly name: string;
  /** The format spec after the colon, or null for a plain `{name}`. */
  readonly spec: string | null;
}

/** Every placeholder in a template string, in order. */
export function placeholders(text: string): Placeholder[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => ({ name: m[1] ?? '', spec: m[2] ?? null }));
}

/** True when `spec` names a format this module knows: a Unit, `code`, or an enum label set. */
export function isKnownSpec(spec: string): boolean {
  return isUnit(spec) || spec === 'code' || Object.hasOwn(enumLabels, spec);
}

function isLabelSet(spec: string): spec is EnumLabelSet {
  return Object.hasOwn(enumLabels, spec);
}

/** The reason text of an action error code, or of a warning code; the code itself when the catalog lacks it. */
export function codeReason(code: string): string {
  if (Object.hasOwn(actionCodeText, code)) return actionCodeText[code as keyof typeof actionCodeText];
  if (Object.hasOwn(warningCodeText, code)) return warningCodeText[code as keyof typeof warningCodeText];
  return code;
}

/** The label of an enumeration value; the value itself when the set lacks it. */
export function enumLabel(set: EnumLabelSet, value: string): string {
  const labels: Readonly<Record<string, string>> = enumLabels[set];
  return Object.hasOwn(labels, value) ? (labels[value] ?? value) : value;
}

function fillOne(value: string | number, spec: string | null, ctx: FormatContext): string {
  if (spec === null) return String(value);
  if (spec === 'code') return codeReason(String(value));
  if (isLabelSet(spec)) return enumLabel(spec, String(value));
  if (isUnit(spec) && typeof value === 'number') return formatValue(value, spec, {}, ctx);
  return String(value);
}

/** Fills a template string's placeholders from `params`. */
export function fillTemplate(text: string, params: TemplateParams, ctx: FormatContext = {}): string {
  return text.replace(PLACEHOLDER, (whole, name: string, spec: string | undefined) =>
    Object.hasOwn(params, name) ? fillOne(params[name] as string | number, spec ?? null, ctx) : whole,
  );
}

const ALERTS: Readonly<Record<string, AlertTemplate>> = ALERT_TEMPLATES;

/**
 * The template for an alert's `templateKey`: `alert.<templateKey>`, else the nearest shorter key down to the kind
 * (`ops.cleanupDone.L2` → `alert.ops.cleanupDone`), or null when there is none.
 */
export function alertTemplate(templateKey: string): AlertTemplate | null {
  const parts = templateKey.split('.');
  for (let n = parts.length; n >= 2; n--) {
    const key = `alert.${parts.slice(0, n).join('.')}`;
    if (Object.hasOwn(ALERTS, key)) return ALERTS[key] ?? null;
  }
  return null;
}

export interface AlertText {
  readonly title: string;
  readonly body: string;
}

/**
 * An inbox message's title and body. A grouped message (collation's `params.count` > 1 for obligations) uses the
 * template's `groupTitle`. A message without a template falls back to its template key, never a blank row.
 */
export function alertText(
  message: { readonly templateKey: string; readonly params: TemplateParams },
  ctx: FormatContext = {},
): AlertText {
  const tpl = alertTemplate(message.templateKey);
  if (tpl === null) return { title: message.templateKey, body: '' };
  const count = message.params['count'];
  const grouped = tpl.groupTitle !== undefined && typeof count === 'number' && count > 1;
  return {
    title: fillTemplate(grouped ? (tpl.groupTitle ?? tpl.title) : tpl.title, message.params, ctx),
    body: fillTemplate(tpl.body, message.params, ctx),
  };
}

const DECISIONS: Readonly<Record<string, DecisionTemplate>> = DECISION_TEMPLATES;

/** The decision template for `context.templateKey` (the decision kind), or null. */
export function decisionTemplate(templateKey: string): DecisionTemplate | null {
  const key = `decision.${templateKey}`;
  return Object.hasOwn(DECISIONS, key) ? (DECISIONS[key] ?? null) : null;
}

/**
 * The text behind an option's `labelKey` (`decision.<kind>.<optionId>`) or `consequenceKey`
 * (`…<optionId>.consequence`), or the key itself when unknown.
 */
export function decisionOptionText(key: string): string {
  const consequence = key.endsWith('.consequence');
  const base = consequence ? key.slice(0, -'.consequence'.length) : key;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return key;
  const tpl = DECISIONS[base.slice(0, dot)];
  const option = tpl === undefined ? undefined : tpl.options[base.slice(dot + 1)];
  if (option === undefined) return key;
  return consequence ? option.consequence : option.label;
}

/** The pre-advance sheet's consequence line for a §11 `consequenceKey` (`funding.<category>`), or the key. */
export function fundingConsequence(key: string): string {
  const text: Readonly<Record<string, string>> = FUNDING_CONSEQUENCE_TEXT;
  return Object.hasOwn(text, key) ? (text[key] ?? key) : key;
}
