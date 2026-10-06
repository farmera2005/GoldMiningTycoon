// Shared decision answering (DESIGN §2.12.1, BALANCE §4.0): "a pending decision gets the option the bot's rules pick,
// else its default". One implementation for every bot, so the fallback is identical everywhere.
import type { Action, PendingDecision } from '../../src/engine';

/** A bot's rule for one decision: the option id it picks, or null to take the default. */
export type DecisionPicker = (decision: PendingDecision) => string | null;

/**
 * The option a bot answers with: its rule's pick if that names an option, else the decision's default, else (a
 * blocking decision with no default and no rule) the first option in code-unit order of option ids, the §2.12.1
 * tie-break by id. The last case never arises in P0 (no decisions exist) and marks a missing bot rule from P1.
 */
export function chosenOptionId(decision: PendingDecision, pick: DecisionPicker): string | null {
  const picked = pick(decision);
  const ids = decision.options.map((o) => o.id);
  if (picked !== null && ids.includes(picked)) return picked;
  if (decision.defaultOptionId !== undefined) return decision.defaultOptionId;
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[0] ?? null;
}

/** `decision/answer` actions for every open decision, in ascending decision id order. */
export function answerOpenDecisions(decisions: readonly PendingDecision[], pick: DecisionPicker): Action[] {
  const out: Action[] = [];
  for (const d of decisions) {
    const optionId = chosenOptionId(d, pick);
    if (optionId !== null) out.push({ type: 'decision/answer', decisionId: d.id, optionId });
  }
  return out;
}

/** The picker of a bot with no decision rules: every decision takes its default. */
export const takeDefaults: DecisionPicker = () => null;
