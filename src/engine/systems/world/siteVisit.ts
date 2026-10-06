// §3 site visits (DESIGN §3.12, D-3.41, D-3.67; s03 #7, #8, #14; P1 contract §4.3). A visit is paid at action time
// through §11 `pay`, books §1 desk days (2 / 3 / 4 / 4 by access), and is resolved in step 7 (part 7.2) once §1 reports
// its desk task done: a report and tells on `rng(seed,'site',turn,claimId)` with s03 #7's draw order. One pending visit
// per claim (VISIT_ALREADY_BOOKED); reports are kept to the last 3 per claim. §4's pan survey books through the same
// functions.
import type { HandlerContext, ActionError } from '../../actions/types';
import type { ClaimId } from '../../core/ids';
import { ZERO_CENTS } from '../../core/money';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { DeskTask } from '../company/types';
import type { SiteVisitQuote } from './listingTypes';

export type OwnerTime = 'queue' | 'now';

/** The visit's validation (shared by `world/siteVisit` and §4's `prospect/panSurvey`). */
export function siteVisitError(_state: GameState, _claimId: ClaimId, _ownerTime: OwnerTime): ActionError | null {
  // CONTRACT-STUB(§3) world.siteVisitError
  return null;
}

/** Pays and books a visit (handler side). */
export function bookSiteVisit(_draft: GameState, _ctx: HandlerContext, _claimId: ClaimId, _ownerTime: OwnerTime): void {
  // CONTRACT-STUB(§3) world.bookSiteVisit
}

/** §1's desk queue asks whether a visit can book days this week (= the claim's freightOpen). */
export function canResolveSiteVisit(_state: GameState, _task: DeskTask): boolean {
  // CONTRACT-STUB(§3) world.canResolveSiteVisit
  return true;
}

/** §13's quote for a visit (S13-9). */
export function siteVisitQuote(state: GameState, _claimId: ClaimId, _ownerTime?: OwnerTime): SiteVisitQuote {
  // CONTRACT-STUB(§3) world.siteVisitQuote
  return { costCents: ZERO_CENTS, days: 0, fitsThisWeek: false, earliestTurn: state.clock.turn, blockedBy: null };
}

/** Part 7.2: resolves the visits in `ctx.week.desk.done`. */
export function resolveSiteVisits(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§3) world.resolveSiteVisits
}
