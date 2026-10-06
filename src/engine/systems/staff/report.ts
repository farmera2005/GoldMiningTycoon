// §8 staff's week scratch and week record (P1 contract §1.3, §4.8, s02 #10). The scratch carries each employee's hours
// of the week (gathered in part 10.5 from §7 crew hours, §4 program crew, the shop, office and camp), which §11's
// payroll reads in step 14. The record lists the roster changes the player sees.
import type { EmployeeId } from '../../core/ids';
import type { EmployeeWeekHours } from './types';

export type { EmployeeWeekHours } from './types';

export interface StaffWeekScratch {
  hours: Record<EmployeeId, EmployeeWeekHours>;
}

export interface StaffWeekRecord {
  arrivals: EmployeeId[];
  departures: EmployeeId[];
  absences: EmployeeId[];
  quits: EmployeeId[];
}

export function emptyStaffWeekScratch(): StaffWeekScratch {
  return { hours: {} };
}

export function emptyStaffWeekRecord(): StaffWeekRecord {
  return { arrivals: [], departures: [], absences: [], quits: [] };
}
