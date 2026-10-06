// Fresh per-week structures (s02 #10; P1 contract §1.3): every advanceWeek builds an empty scratch and empty week
// records from the owners' constructors, so no handoff or record can leak from one week (or one game) into another.
import { emptyClimateWeekRecord } from '../systems/climate/report';
import { emptyDeskWeekScratch } from '../systems/company/report';
import { emptyFinanceWeekRecord, emptyFinanceWeekScratch } from '../systems/finance/report';
import { emptyFleetWeekRecord, emptyFleetWeekScratch } from '../systems/fleet/report';
import { emptyGoldWeekRecord, emptyGoldWeekScratch } from '../systems/gold/report';
import { emptyKnowledgeWeekRecord, emptyKnowledgeWeekScratch } from '../systems/knowledge/report';
import { emptyLandWeekRecord, emptyLandWeekScratch } from '../systems/land/report';
import { emptyOpsWeekScratch } from '../systems/ops/report';
import { emptyStaffWeekRecord, emptyStaffWeekScratch } from '../systems/staff/report';
import type { WeekRecords, WeekScratch } from './types';

export function emptyWeekScratch(): WeekScratch {
  return {
    desk: emptyDeskWeekScratch(),
    land: emptyLandWeekScratch(),
    fleet: emptyFleetWeekScratch(),
    ops: emptyOpsWeekScratch(),
    knowledge: emptyKnowledgeWeekScratch(),
    staff: emptyStaffWeekScratch(),
    cleanup: { results: [] },
    gold: emptyGoldWeekScratch(),
    finance: emptyFinanceWeekScratch(),
  };
}

export function emptyWeekRecords(): WeekRecords {
  return {
    climate: emptyClimateWeekRecord(),
    knowledge: emptyKnowledgeWeekRecord(),
    land: emptyLandWeekRecord(),
    staff: emptyStaffWeekRecord(),
    fleet: emptyFleetWeekRecord(),
    gold: emptyGoldWeekRecord(),
    finance: emptyFinanceWeekRecord(),
  };
}
