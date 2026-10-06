// Emitting an alert signal from a pipeline part (DESIGN §13 13.10; P1 contract §4.13). Every owner reports through
// this one function, so the week's report holds only known kinds that match their taxonomy row (trigger, and severity
// unless the row leaves it to the owner's rule), and a signal built from Immer draft values is copied before the draft
// is finalized (a revoked draft proxy in the report would throw when the UI reads it).
import { cloneJson } from '../../state/immutability';
import type { StepContext } from '../../turn/types';
import { ALERT_TAXONOMY } from './taxonomy';
import { ALERT_KINDS, type AlertSignal } from './types';

export class AlertSignalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlertSignalError';
  }
}

/** Appends a copy of `signal` to the week's report (collated in step 16). Throws on an unknown kind. */
export function emitAlert(ctx: Pick<StepContext, 'report'>, signal: AlertSignal): void {
  if (!(ALERT_KINDS as readonly string[]).includes(signal.kind)) {
    throw new AlertSignalError(`emitAlert: unknown alert kind '${signal.kind}'`);
  }
  if (signal.severity === ('blocking' as AlertSignal['severity'])) {
    throw new AlertSignalError(
      `emitAlert: ${signal.kind} cannot be blocking; a blocking message comes from a decision`,
    );
  }
  const row = ALERT_TAXONOMY[signal.kind];
  if (signal.trigger !== row.trigger) {
    throw new AlertSignalError(`emitAlert: ${signal.kind} is a ${row.trigger} alert, not ${signal.trigger}`);
  }
  if (row.severity !== 'rule' && signal.severity !== row.severity) {
    throw new AlertSignalError(`emitAlert: ${signal.kind} is ${row.severity}, not ${signal.severity}`);
  }
  ctx.report.alerts.push(cloneJson(signal));
}
