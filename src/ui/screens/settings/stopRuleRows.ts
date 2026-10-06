// The read-only Stop rules list (DESIGN §13.9 table; editing arrives with P1's Run and P2's custom rules): one row
// per persisted rule, plus the two stops that are not rules because they can never be turned off.
import type { StopRule } from '../../../engine';
import { assertNever } from '../../lib/assertNever';

export interface StopRuleRow {
  readonly label: string;
  readonly state: string;
  /** A numeric parameter the player sets (shown as a `<Num>` with an `input` ref). */
  readonly param?: {
    readonly value: number;
    readonly unit: 'cents' | 'pct' | 'weeks' | 'turn';
    readonly label: string;
  };
}

export const FIXED_STOPS: readonly StopRuleRow[] = [
  { label: 'A blocking decision is created', state: 'Always stops' },
  { label: 'A critical alert', state: 'Always stops' },
];

const onOff = (enabled: boolean): string => (enabled ? 'On' : 'Off');

export function stopRuleRow(rule: StopRule): StopRuleRow {
  switch (rule.kind) {
    case 'warningKinds':
      return {
        label: 'A warning alert',
        state: rule.muted.length === 0 ? 'Stops; no kinds muted' : `Stops; muted: ${rule.muted.join(', ')}`,
      };
    case 'seasonPhase':
      return {
        label: rule.scope === 'held' ? 'Season phase change where you hold ground' : 'Season phase change anywhere',
        state: onOff(rule.enabled),
      };
    case 'deadlineWithin':
      return {
        label: 'A deadline within',
        state: onOff(rule.enabled),
        param: { value: rule.weeks, unit: 'weeks', label: 'Deadline notice' },
      };
    case 'everyCleanup':
      return {
        label: rule.claimIds === 'all' ? 'Every cleanup, any claim' : `Every cleanup on ${rule.claimIds.length} claims`,
        state: onOff(rule.enabled),
      };
    case 'goldMove':
      return {
        label: 'Gold moves from the run start by',
        state: onOff(rule.enabled),
        param: { value: rule.pct, unit: 'pct', label: 'Gold move' },
      };
    case 'cashBelow':
      return {
        label: 'Cash falls below',
        state: onOff(rule.enabled),
        param: { value: rule.cents, unit: 'cents', label: 'Cash threshold' },
      };
    case 'machineFailure':
      return { label: 'Any machine failure', state: onOff(rule.enabled) };
    case 'listingMatch':
      return { label: 'A new listing matches a saved search', state: onOff(rule.enabled) };
    case 'monthStart':
      return { label: 'The start of each month', state: onOff(rule.enabled) };
    case 'atTurn':
      return { label: 'A specific week', state: 'On', param: { value: rule.turn, unit: 'turn', label: 'Stop week' } };
    default:
      return assertNever(rule);
  }
}
