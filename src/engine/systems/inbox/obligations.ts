// §13's view of §6 obligations (DESIGN §13 13.10 obligation ladder, §6 6.9; S12-9, S13-13; P1 contract §4.13).
// `needsAction` is real: an obligation needs the player only when it is statutory (its consequence lands whether or not
// cash arrives) and not on auto-pay, which no P1 obligation is (every P1 obligation is billable). The ladder's severity
// for a due-soon obligation is the inbox package's (capped at info in P1); the Wave-0 stub returns no alert.
import type { TuningResolved } from '../../../data/tuning';
import { settlementClass } from '../permits/obligations';
import type { Obligation } from '../permits/types';
import type { Severity } from './types';

export function needsAction(obl: Pick<Obligation, 'owner' | 'consequence' | 'autoPay'>): boolean {
  return settlementClass(obl) === 'statutory' && !obl.autoPay;
}

/** The `obligation.dueSoon` ladder: null when no alert is due this turn. */
export function obligationAlertSeverity(
  _obl: Obligation,
  _turn: number,
  _tuning: TuningResolved,
): Exclude<Severity, 'blocking'> | null {
  // CONTRACT-STUB(§13) inbox.obligationAlertSeverity
  return null;
}
