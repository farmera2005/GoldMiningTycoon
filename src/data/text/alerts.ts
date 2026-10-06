// Inbox message templates (DESIGN §13.10 "Templates and the machine-readable taxonomy", D-13.90; S13-14). An emitter's
// `AlertSignal.templateKey` is its kind, or the kind plus a variant (`season.phaseChange.breakup`); the UI looks up
// `alert.<templateKey>` and falls back to `alert.<kind>` when a variant has no template of its own. Every P1 kind of the
// taxonomy has a template here; T21 checks kinds, taxonomy rows and templates against each other.
//
// Placeholders: `{name}` prints the param as given (names the emitter already holds, such as a claim or district
// name, or an obligation's title); `{name:<unit>}` formats a number with ui/format by its §2.8 Unit (`{askCents:cents}`,
// `{dueTurn:turn}`, `{idlePct:pct}`); `{name:code}` prints the reason text of an action or warning code (data/text/
// ui.ts); `{name:<labelSet>}` prints an enumeration label (`{cause:idleCause}`). `params` lists every param the
// emitter sends; each placeholder names one of them. An emitting package that needs other params or wording sends the
// text in its report (P1 contract §0.3).
export interface AlertTemplate {
  /** One line: the inbox list row and the toast. */
  readonly title: string;
  /** One to three sentences: what happened, what it means, what to look at. */
  readonly body: string;
  /** The title when collation groups several signals into one message (obligations: `{count}`, `{totalUsd}`). */
  readonly groupTitle?: string;
  /** Params the emitter sends. */
  readonly params: readonly string[];
}

/** The alert kinds of P1 (P1 contract §6), the ones these templates cover. */
export const P1_ALERT_KINDS = [
  'season.phaseChange',
  'season.forecastUpdate',
  'weather.severe',
  'listing.new',
  'listing.priceChanged',
  'siteVisit.report',
  'prospect.resultsReady',
  'prospect.classChanged',
  'prospect.programPaused',
  'prospect.sellerContradicted',
  'lease.anniversarySoon',
  'lease.defaultNotice',
  'lease.terminated',
  'lease.ended',
  'land.quickSaleClosed',
  'land.interestChanged',
  'obligation.dueSoon',
  'obligation.missed',
  'ops.plantIdleHigh',
  'ops.stripCoverageLow',
  'ops.waterLimited',
  'ops.cleanupOverdue',
  'ops.padFull',
  'ops.freezeUpNotWinterized',
  'ops.cleanupDone',
  'crew.noForeman',
  'employee.quit',
  'crew.moraleLow',
  'crew.leadHand',
  'staff.layoffDecision',
  'staff.recallDecision',
  'delivery.arrived',
  'transport.stalled',
  'transport.windowClosing',
  'cash.projectedNegative',
  'payroll.missed',
  'loan.paymentMissed',
  'distress.stage',
] as const;

export type P1AlertKind = (typeof P1_ALERT_KINDS)[number];

export const ALERT_TEMPLATES = {
  // §1 season and weather -------------------------------------------------------------------------------------------
  'alert.season.phaseChange': {
    title: '{district}: {phase:seasonPhase}',
    body: 'The season in {district} has moved to {phase:seasonPhase}. Check access windows and plans for the claims there.',
    params: ['district', 'districtId', 'phase'],
  },
  'alert.season.phaseChange.breakup': {
    title: '{district}: breakup has begun',
    body: 'The thaw has started in {district}. Trails soften and some access closes until the ground dries; the operating season follows.',
    params: ['district', 'districtId', 'phase'],
  },
  'alert.season.phaseChange.operating': {
    title: '{district}: operating season',
    body: 'Ground in {district} is open for work. Sites that wintered can start up; crews recalled for the season can begin.',
    params: ['district', 'districtId', 'phase'],
  },
  'alert.season.phaseChange.freezeup': {
    title: '{district}: freeze-up has begun',
    body: 'Freeze-up has started in {district}. Water and ground are freezing; winterize the sites that will not run through winter.',
    params: ['district', 'districtId', 'phase'],
  },
  'alert.season.phaseChange.winter': {
    title: '{district}: winter',
    body: 'Winter has set in across {district}. Ground stays frozen until breakup; plan the next season while the north is shut.',
    params: ['district', 'districtId', 'phase'],
  },
  'alert.season.forecastUpdate': {
    title: '{district}: season forecast updated',
    body: 'The forecast for {district} now puts {event:seasonPhase} between {p10Turn:turn} and {p90Turn:turn}, most likely {p50Turn:turn}.',
    params: ['district', 'districtId', 'event', 'p10Turn', 'p50Turn', 'p90Turn'],
  },
  'alert.weather.severe': {
    title: '{district}: severe weather',
    body: 'Severe weather in {district} this week costs outdoor hours.',
    params: ['district', 'districtId', 'kind'],
  },
  'alert.weather.severe.fire': {
    title: '{district}: fire restrictions, Stage {fireLevel}',
    body: 'Fire danger in {district} reached Stage {fireLevel}. Restrictions limit hot work and some equipment hours until it eases.',
    params: ['district', 'districtId', 'kind', 'fireLevel'],
  },
  'alert.weather.severe.storm': {
    title: '{district}: storm week',
    body: 'A storm is crossing {district} this week. Seasonal roads may close and outdoor work loses hours.',
    params: ['district', 'districtId', 'kind'],
  },
  'alert.weather.severe.heat': {
    title: '{district}: heat limits the day shift',
    body: 'Heat in {district} cuts the day shift to {hoursFactor:pct} of its normal productive hours. A night shift keeps its hours.',
    params: ['district', 'districtId', 'kind', 'hoursFactor'],
  },

  // §3 listings and site visits ---------------------------------------------------------------------------------------
  'alert.listing.new': {
    title: 'New listing: {claim}',
    body: '{claim} in {district} is listed {structure:dealStructure}, asking {askCents:cents}. The seller’s figures are unverified until you test them.',
    params: ['claim', 'claimId', 'listingId', 'district', 'structure', 'askCents'],
  },
  'alert.listing.priceChanged': {
    title: '{claim}: asking price changed',
    body: 'The seller of {claim} changed the ask from {oldAskCents:cents} to {askCents:cents}.',
    params: ['claim', 'claimId', 'listingId', 'oldAskCents', 'askCents'],
  },
  'alert.siteVisit.report': {
    title: 'Site visit report: {claim}',
    body: 'Your visit to {claim} is written up: ground, water, access, and what the seller’s people said and did.',
    params: ['claim', 'claimId'],
  },

  // §4 prospecting ----------------------------------------------------------------------------------------------------
  'alert.prospect.resultsReady': {
    title: 'Results ready: {claim}',
    body: '{program} on {claim} has released results, and your estimate is updated. Read the report, then the Estimate tab.',
    params: ['claim', 'claimId', 'program', 'programId'],
  },
  'alert.prospect.classChanged': {
    title: '{claim}: estimate now class {toClass}',
    body: 'New evidence moved the estimate for {claim} from class {fromClass} to class {toClass}.',
    params: ['claim', 'claimId', 'fromClass', 'toClass'],
  },
  'alert.prospect.programPaused': {
    title: 'Program paused: {program}',
    body: '{program} on {claim} has paused. {reason:code}',
    params: ['claim', 'claimId', 'program', 'programId', 'reason'],
  },
  'alert.prospect.sellerContradicted': {
    title: '{claim}: seller’s figures contradicted',
    body: 'Your own evidence on {claim} contradicts what the seller claimed. Weigh the rest of the seller’s data with care.',
    params: ['claim', 'claimId'],
  },

  // §5 land -----------------------------------------------------------------------------------------------------------
  'alert.lease.anniversarySoon': {
    title: 'Lease anniversary {dueTurn:turn}: {claim}',
    body: 'The lease on {claim} reaches its anniversary {dueTurn:turn}, when {amountCents:cents} of advance minimum royalty falls due.',
    params: ['claim', 'claimId', 'tenureId', 'dueTurn', 'amountCents'],
  },
  'alert.lease.defaultNotice': {
    title: 'Default notice: {claim}',
    body: 'The lessor of {claim} has served a default notice over {what}. Cure it by {cureTurn:turn} or the lease can be terminated.',
    params: ['claim', 'claimId', 'tenureId', 'what', 'cureTurn'],
  },
  'alert.lease.terminated': {
    title: 'Lease terminated: {claim}',
    body: 'The lessor has terminated your lease on {claim}. The ground goes back to them; your lots from it stay yours to sell.',
    params: ['claim', 'claimId', 'tenureId'],
  },
  'alert.lease.ended': {
    title: 'Lease ended: {claim}',
    body: 'Your lease on {claim} has ended.',
    params: ['claim', 'claimId', 'tenureId', 'how'],
  },
  'alert.lease.ended.surrendered': {
    title: 'Lease surrendered: {claim}',
    body: 'You surrendered the lease on {claim}. No further payments fall due on it.',
    params: ['claim', 'claimId', 'tenureId', 'how'],
  },
  'alert.lease.ended.expired': {
    title: 'Lease expired: {claim}',
    body: 'The lease on {claim} reached the end of its term without renewal.',
    params: ['claim', 'claimId', 'tenureId', 'how'],
  },
  'alert.land.quickSaleClosed': {
    title: 'Quick sale closed: {claim}',
    body: '{claim} has sold. Net proceeds of {netCents:cents} are in the bank.',
    params: ['claim', 'claimId', 'netCents'],
  },
  'alert.land.interestChanged': {
    title: '{holder}’s interest in {claim} changed',
    body: 'At this settlement, {holder}’s production interest in {claim} changed.',
    params: ['claim', 'claimId', 'holder', 'interestId', 'how'],
  },
  'alert.land.interestChanged.stepDown': {
    title: '{holder}’s royalty on {claim} stepped down',
    body: 'At this settlement, {holder}’s royalty on {claim} stepped down to {rate:pct}.',
    params: ['claim', 'claimId', 'holder', 'interestId', 'how', 'rate'],
  },
  'alert.land.interestChanged.capReached': {
    title: '{holder}’s interest in {claim} has paid out',
    body: '{holder}’s production interest in {claim} reached its cap at this settlement and ends.',
    params: ['claim', 'claimId', 'holder', 'interestId', 'how'],
  },

  // §6 obligations (collation groups them by category and due week, 13.10) -------------------------------------------
  'alert.obligation.dueSoon': {
    title: '{title} due {dueTurn:turn}',
    body: '{amountCents:cents} is due {dueTurn:turn}. {consequence}',
    groupTitle: '{count} {category:obligationCategoryPlural} due {dueTurn:turn} · {totalUsd:usd}',
    params: ['title', 'obligationId', 'category', 'dueTurn', 'amountCents', 'consequence', 'count', 'totalUsd'],
  },
  'alert.obligation.missed': {
    title: 'Missed: {title}',
    body: '{title}, due {dueTurn:turn}, was not met. {consequence}',
    groupTitle: '{count} {category:obligationCategoryPlural} missed · {totalUsd:usd}',
    params: ['title', 'obligationId', 'category', 'dueTurn', 'consequence', 'count', 'totalUsd'],
  },

  // §7 operations (dedupe per line where the kind is per line) --------------------------------------------------------
  'alert.ops.plantIdleHigh': {
    title: '{claim} {lineId}: plant idle {idlePct:pct}',
    body: 'The plant on {claim} stood idle {idlePct:pct} of its scheduled hours last week; the largest cause was {cause:idleCause} (root: {root:stage}). The Flow tab shows the chain.',
    params: ['claim', 'claimId', 'lineId', 'idlePct', 'cause', 'root'],
  },
  'alert.ops.stripCoverageLow': {
    title: '{claim}: stripping falling behind',
    body: 'Stripped ground ahead of the cut on {claim} covers {coverageWeeks:weeks} of mining. Add stripping hours or a dozer before the plant runs out of exposed pay.',
    params: ['claim', 'claimId', 'coverageWeeks'],
  },
  'alert.ops.waterLimited': {
    title: '{claim}: plant short of water',
    body: 'Water limited the plant on {claim} for {limitedPct:pct} of its hours last week. More pumping, recirculation or a lower feed rate would help.',
    params: ['claim', 'claimId', 'lineId', 'limitedPct'],
  },
  'alert.ops.cleanupOverdue': {
    title: '{claim}: cleanup overdue',
    body: 'The sluice on {claim} has run {weeksSince:weeks} since its last cleanup. Gold builds up in the box until you clean up.',
    params: ['claim', 'claimId', 'lineId', 'weeksSince'],
  },
  'alert.ops.padFull': {
    title: '{claim}: feed pad full',
    body: 'The feed pad on {claim} is full, so digging is held back by the plant. Raise the feed rate or slow the digging.',
    params: ['claim', 'claimId', 'lineId'],
  },
  'alert.ops.freezeUpNotWinterized': {
    title: '{claim}: freeze-up near, site not winterized',
    body: 'Freeze-up is expected within {weeks:weeks} at {claim} and the site is not winterized. It will be winterized automatically at freeze-up unless you do it first.',
    params: ['claim', 'claimId', 'weeks'],
  },
  'alert.ops.cleanupDone': {
    title: 'Cleanup on {claim} {lineId}: {rawOz:rawOz}',
    body: 'The cleanup on {claim} weighed {rawOz:rawOz} after {bcyWashed:bcy} washed. The lot is in Gold sales.',
    params: ['claim', 'claimId', 'lineId', 'rawOz', 'bcyWashed', 'lotId'],
  },

  // §8 staff ----------------------------------------------------------------------------------------------------------
  'alert.crew.noForeman': {
    title: '{claim}: no foreman, plan stood down',
    body: 'Mining on {claim} stood down: no foreman covers it. Hire or assign a foreman, take the job yourself, or keep the crew small.',
    params: ['claim', 'claimId', 'lines', 'reason'],
  },
  'alert.crew.noForeman.reassigned': {
    title: '{claim}: foreman reassigned, plan stood down',
    body: 'Mining on {claim} stood down because its foreman was assigned elsewhere. Assign a foreman, or take the job yourself.',
    params: ['claim', 'claimId', 'lines', 'reason'],
  },
  'alert.crew.noForeman.leadHandExhausted': {
    title: '{claim}: lead-hand cover used up',
    body: 'The lead hand on {claim} has covered for the foreman as long as allowed, so mining stood down. A foreman is needed.',
    params: ['claim', 'claimId', 'lines', 'reason'],
  },
  'alert.crew.noForeman.smallCrewExceeded': {
    title: '{claim}: too big to run without a foreman',
    body: 'The crew on {claim} is more than a small crew can be (a fourth hand, a second shift or a second line), so mining stood down until it has a foreman.',
    params: ['claim', 'claimId', 'lines', 'reason'],
  },
  'alert.employee.quit': {
    title: '{employee} quit',
    body: '{employee}, your {role:role}, has quit. Their last week is paid; the Candidates tab lists who you could hire.',
    params: ['employee', 'employeeId', 'role'],
  },
  'alert.crew.moraleLow': {
    title: 'Crew morale is low',
    body: 'Crew morale averages {avgMorale:score}; low morale means slower work and more quits. Pay, hours, bonuses and paying on time all help.',
    params: ['avgMorale', 'lowestEmployee', 'lowestMorale'],
  },
  'alert.crew.leadHand': {
    title: '{claim}: {employee} is lead hand',
    body: '{employee} is running {claim} while its foreman is away, for up to {weeksLeft:weeks} more.',
    params: ['claim', 'claimId', 'lineId', 'employee', 'employeeId', 'weeksLeft'],
  },
  'alert.staff.layoffDecision': {
    title: 'Freeze-up: lay off the seasonal crew?',
    body: 'Freeze-up has come to {district}. Laying off the hourly field crew saves wages until breakup; most come back when recalled.',
    params: ['district', 'districtId', 'count'],
  },
  'alert.staff.recallDecision': {
    title: 'Breakup is coming: recall the crew?',
    body: 'Breakup in {district} is forecast for about {breakupTurn:turn}. Recall the laid-off crew so they are on site when the ground opens.',
    params: ['district', 'districtId', 'breakupTurn', 'count'],
  },

  // §9 fleet ----------------------------------------------------------------------------------------------------------
  'alert.delivery.arrived': {
    title: 'Delivered: {machine}',
    body: '{machine} has arrived at {claim} and is ready to assign in a mine plan.',
    params: ['machine', 'machineId', 'claim', 'claimId'],
  },
  'alert.transport.stalled': {
    title: 'Move stalled: {machine}',
    body: 'The move of {machine} to {claim} cannot go on: the way in is closed. It waits and resumes when access opens.',
    params: ['machine', 'machineId', 'claim', 'claimId'],
  },
  'alert.transport.windowClosing': {
    title: 'Access window closing: {claim}',
    body: 'The route to {claim} may close before {machine} arrives ({arrivalTurn:turn}). Move it sooner or plan for the delay.',
    params: ['machine', 'machineId', 'claim', 'claimId', 'arrivalTurn'],
  },

  // §11 finance -------------------------------------------------------------------------------------------------------
  'alert.cash.projectedNegative': {
    title: 'Cash runs short {shortTurn:turn}',
    body: 'The 13-week forecast, including planned cleanups, goes below zero {shortTurn:turn}. Sell gold, cut costs, or bring in cash before then.',
    params: ['shortTurn', 'lowCents'],
  },
  'alert.payroll.missed': {
    title: 'Payroll missed',
    body: 'Payroll came up {shortCents:cents} short this week. The crew notices: morale falls and some may stop work until they are paid.',
    params: ['shortCents'],
  },
  'alert.loan.paymentMissed': {
    title: 'Loan payment missed: {lender}',
    body: 'The payment of {amountCents:cents} to {lender} was not made. Late fees apply and the lender will not wait long.',
    params: ['lender', 'loanId', 'amountCents'],
  },
  'alert.distress.stage': {
    title: 'Financial distress: {stage}',
    body: 'Unpaid arrears of {arrearsCents:cents} since {sinceTurn:turn}. If every arrear is not paid by {deadlineTurn:turn}, the company is liquidated.',
    params: ['stage', 'arrearsCents', 'sinceTurn', 'deadlineTurn'],
  },
} as const satisfies Readonly<Record<string, AlertTemplate>>;

export type AlertTemplateKey = keyof typeof ALERT_TEMPLATES;
