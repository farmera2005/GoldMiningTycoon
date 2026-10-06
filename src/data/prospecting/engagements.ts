// §4 desk work and people (DESIGN §4.2.A lower rows, §4.13): records reviews, consultant reports and reviews,
// consultant day rates and the staff geologist. Year-1 northern USD before cpiIndex; contractor and consultant rates
// move with gold from P5 (§4.18 ripples).

export const prospectingEngagements = {
  /** Old records review: archives, BLM and state case files, county records, old reports (§4.10.2). */
  recordsReview: {
    feesUsd: 1200,
    travelUsd: 800,
    days: { owner: 3, staffGeologist: 3, consultantBilled: 4 },
    resultLagWeeks: { own: 2, consultant: 3 },
  },
  /** Placer evaluation report: independent for lenders and buyers (D-4.27). */
  consultantPER: {
    baseUsd: 15000,
    perSampledBlockUsd: 300,
    capUsd: 50000,
    minConsultantSiteDays: 2,
    resultLagWeeks: 4,
    notInBreakup: true,
  },
  /** Review of the seller's data package (§4.10.3). */
  geologistReview: { consultantUsd: 6000, ownDays: 2, resultLagWeeks: 2 },
  /** Consultant supervision days by tier (skill 50 / 70 / 85, known). */
  consultantDays: {
    tiers: {
      budget: { usdPerDay: 900, skill: 50 },
      standard: { usdPerDay: 1250, skill: 70 },
      premier: { usdPerDay: 1600, skill: 85 },
    },
    expensesUsdPerDay: 350,
    travelUsdPerTrip: { highway: 500, seasonalRoad: 900, winterTrail: 2000, flyIn: 3500 },
    engagedWeeks: 26,
  },
  /** §8 role; supervises geology.programsPerGeologist programs. */
  staffGeologist: { salaryUsdPerYear: 105000 },
  /** P4 financing report (§4.15). */
  technicalReport: { usd: 120000 },
} as const;
