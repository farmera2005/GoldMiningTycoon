// §1 owner time (DESIGN §1 1.9, D-1.68; P1 contract §4.2). Desk work is measured in owner desk days: an office week
// has `game.owner.deskDaysOffice` (5), a field assignment `game.owner.deskDaysField` (2.5). A task books what fits at
// once and queues the rest; `ownerTime: 'now'` books it all and takes the excess from field time (§8 cuts the owner's
// availableFraction). Step 7 (part 7.1) applies the pending assignment, resets the used and forced days and walks the
// queue, asking each task's owning section whether it can resolve this week.
import type { EntityRef } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { DeskTask, DeskTaskKind } from './types';

export interface DeskTaskRequest {
  kind: DeskTaskKind;
  ownerSection: DeskTask['ownerSection'];
  ref: EntityRef;
  days: number;
}

export interface DeskBooking {
  bookedDays: number;
  queuedDays: number;
  forcedDays: number;
}

export interface OwnerDeskDays {
  capacity: number;
  used: number;
  /** Σ daysRemaining of the queue. */
  queued: number;
  forcedThisWeek: number;
}

/** Books a desk task (s01 #1 partial booking). */
export function bookDeskTask(_draft: GameState, task: DeskTaskRequest, _ownerTime: 'queue' | 'now'): DeskBooking {
  // CONTRACT-STUB(§1) company.bookDeskTask
  return { bookedDays: 0, queuedDays: task.days, forcedDays: 0 };
}

/** The owner's desk days this week (§13, bots, §8's owner availableFraction). */
export function ownerDeskDays(_state: GameState): OwnerDeskDays {
  // CONTRACT-STUB(§1) company.ownerDeskDays
  return { capacity: 5, used: 0, queued: 0, forcedThisWeek: 0 };
}

/** Whether a queued task may book days this week (dispatches to §3's `canResolveSiteVisit`; the others are true). */
export function canResolveDeskTask(_state: GameState, _task: DeskTask): boolean {
  // CONTRACT-STUB(§1) company.canResolveDeskTask
  return true;
}

/** Part 7.1: pending assignment, desk-day reset, queue walk; publishes `ctx.week.desk.done`. */
export function ownerWeek(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§1) company.ownerWeek
}
