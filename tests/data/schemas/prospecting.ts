// §4 prospecting content: enumerations, method rows (data/prospecting/methods.ts; DESIGN §4.2.A logistics, §4.2.B
// measurement), the small-count table, engagements and ripple rows. Owned by the §4 package after P1 Wave 0.
import { z } from 'zod';
import { keyed, nonNeg, nonNegInt, num, pos, posInt, prob } from './common';
import { ACCESS_CLASSES, sampleMethod } from './world';

export const REGION_TEMPLATE_IDS = [
  'northernFederal',
  'aridFederal',
  'temperateFederal',
  'alaskaState',
  'yukon',
] as const;
/** The old-timer kinds §4 models on worked ground (4.10.2 offset table; hydraulic and recentCat use other rules). */
export const DEPLETION_KINDS = ['drift', 'handCut', 'dredge', 'dryWash'] as const;
export const CONFIDENCE_CLASSES = ['measured', 'indicated', 'inferred'] as const;
export const SEASON_PHASES = ['winter', 'breakup', 'operating', 'freezeup'] as const;
export const METHOD_IDS = [
  'pan',
  'handPit',
  'drywasher',
  'excavatorPit',
  'trench',
  'bulkSample',
  'auger',
  'churn',
  'churnHistoric',
  'sonic',
  'rc',
  'geophysics',
  'production',
] as const;

/** A §10 ripple row (§4.18): elasticity on goldIdxReal, lag, clamp around the neutral 1.0, escalation with CPI. */
export const rippleRow = z
  .strictObject({ elasticity: num, lagWeeks: nonNegInt, clampLo: nonNeg, clampHi: pos, escalate: z.boolean() })
  .refine((r) => r.clampLo <= 1 && 1 <= r.clampHi, { message: 'the clamp must contain the neutral 1.0' });

/** geology.estSmallCountTable (§4.4.4): (N_eff, b, v) rows on a strictly increasing grid of N_eff. */
export const smallCountTableSchema = z
  .array(z.strictObject({ n: pos, b: num, v: nonNeg }))
  .min(2)
  .refine((rows) => rows.every((r, i) => i === 0 || (rows[i - 1] as { n: number }).n < r.n), {
    message: 'the N_eff grid must increase',
  });

/** A §4.2.B draw block: §3's SampleMethodParams with the method's id and whether it reports sieved class masses. */
export const methodDraw = z
  .object({ ...sampleMethod.shape, id: z.enum(METHOD_IDS), reportsClassMasses: z.boolean() })
  .strict()
  .refine((d) => d.positionMode !== 'exposure' || d.exposureDepthFrac !== undefined, {
    message: 'an exposure method needs exposureDepthFrac',
  });

/** §4.2.A sample volume: fixed per unit, per ft of sampled column (drills), a choice (pits) or a range (bulk). */
const sampleBcyRule = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixed'), bcy: pos }),
  z.strictObject({ kind: z.literal('perFtOfColumn'), bcyPerFt: pos }),
  z
    .strictObject({ kind: z.literal('choices'), bcy: z.array(pos).min(1), defaultBcy: pos })
    .refine((r) => r.bcy.includes(r.defaultBcy), { message: 'the default must be one of the choices' }),
  z
    .strictObject({ kind: z.literal('range'), minBcy: pos, maxBcy: pos, defaultBcy: pos })
    .refine((r) => r.minBcy <= r.defaultBcy && r.defaultBcy <= r.maxBcy, { message: 'need min ≤ default ≤ max' }),
  z.strictObject({ kind: z.literal('none') }),
]);

/** A crew by role (or `any`): head counts. */
export const crewCounts = z.record(z.string().min(1), posInt);

const ownDelivery = z.strictObject({
  crew: crewCounts,
  machineClasses: z.array(z.string().min(1)),
  unitsPerPersonDay: pos.optional(),
  unitsPerCrewDay: pos.optional(),
  consumablesUsdPerUnit: nonNeg,
  toolRentUsdPerDay: nonNeg.optional(),
});

const contractorTerms = z
  .strictObject({
    rateUsdPerUnit: nonNeg.optional(),
    rateUsdPerDay: nonNeg.optional(),
    unitsPerDay: pos,
    mobUsd: nonNeg,
    standbyUsdPerDay: nonNeg.optional(),
    minUnits: nonNeg.optional(),
    bouldersSlow: prob.optional(),
  })
  .refine((c) => (c.rateUsdPerUnit === undefined) !== (c.rateUsdPerDay === undefined), {
    message: 'a contractor charges per unit or per day, not both',
  });

/** One §4.2 method row (DESIGN §4.2.A logistics columns, §4.2.B measurement columns). */
export const methodRow = z
  .strictObject({
    id: z.enum(METHOD_IDS),
    family: z.enum(['surface', 'handPit', 'pit', 'trench', 'bulk', 'drill', 'geophysics', 'production']),
    unit: z.enum(['station', 'sample', 'pit', 'section', 'payBcy', 'ft', 'lineKm', 'cleanup']),
    activity: z.enum(['handSample', 'handSluice', 'mechSample', 'bulkSample', 'drill']).nullable(),
    draw: methodDraw.nullable(),
    depthLimit: z.enum(['row', 'machineReach']),
    sampleBcy: sampleBcyRule,
    reportsClassMasses: z.boolean(),
    informsSizeMix: z.boolean(),
    falseBedrockP: prob,
    requiresGeologist: z.boolean(),
    credited: z.boolean(),
    seasonMult: keyed(SEASON_PHASES, prob), // 0 = not allowed in the phase (§4.2.A)
    own: ownDelivery.optional(),
    contractor: contractorTerms.optional(),
    disturbanceAcPerUnit: nonNeg,
    backfilled: z.boolean(),
    resultLagWeeks: nonNegInt,
    labUsdPerPayInterval: nonNeg.optional(),
    labUsdPerBarrenInterval: nonNeg.optional(),
  })
  .superRefine((m, ctx) => {
    const bad = (message: string, path: string): void => {
      ctx.addIssue({ code: 'custom', message, path: [path] });
    };
    if (m.draw !== null && m.draw.id !== m.id) bad(`draw.id ${m.draw.id} is not the row id`, 'draw');
    if (m.draw !== null && m.draw.reportsClassMasses !== m.reportsClassMasses) bad('class-mass flags disagree', 'draw');
    // A drill's sample volume is its core per ft of column, the same number the draw uses (§4.2.B).
    if (m.sampleBcy.kind === 'perFtOfColumn' && m.draw?.bcyPerFt !== m.sampleBcy.bcyPerFt)
      bad('sampleBcy.bcyPerFt differs from draw.bcyPerFt', 'sampleBcy');
    // Pits and trenches dig to the machine's reach, so their row leaves maxDepthFt open (§4.2.B "reach").
    if (m.depthLimit === 'machineReach' && m.draw?.maxDepthFt !== null)
      bad('a reach-limited row sets maxDepthFt', 'draw');
    if (m.family === 'drill' && m.activity !== null && m.labUsdPerPayInterval === undefined)
      bad('a contract drill needs lab fees', 'labUsdPerPayInterval');
    if (m.draw === null && !['geophysics', 'production'].includes(m.family))
      bad('only geophysics and production rows have no draw', 'draw');
  });

export const prospectingMethodsSchema = z
  .record(z.enum(METHOD_IDS), methodRow)
  .refine((rows) => METHOD_IDS.every((id) => rows[id]?.id === id), {
    message: 'every MethodId has a row keyed by its own id',
  });

export const geophysicsDepthCvSchema = z
  .strictObject({ seismic: nonNeg, gprGood: nonNeg, gprPoor: nonNeg, gprGoodMaxDepthFt: pos, maxDepthFt: pos })
  .refine((g) => g.gprGood <= g.gprPoor && g.gprGoodMaxDepthFt <= g.maxDepthFt, {
    message: 'GPR in good conditions is no worse than in poor, within the tool depth',
  });

const consultantTier = z.strictObject({ usdPerDay: pos, skill: z.number().int().min(0).max(100) });

/** src/data/prospecting/engagements.ts (DESIGN §4.2.A lower rows, §4.13). */
export const prospectingEngagementsSchema = z.strictObject({
  recordsReview: z.strictObject({
    feesUsd: nonNeg,
    travelUsd: nonNeg,
    days: keyed(['owner', 'staffGeologist', 'consultantBilled'], posInt),
    resultLagWeeks: keyed(['own', 'consultant'], nonNegInt),
  }),
  consultantPER: z
    .strictObject({
      baseUsd: nonNeg,
      perSampledBlockUsd: nonNeg,
      capUsd: pos,
      minConsultantSiteDays: nonNegInt,
      resultLagWeeks: nonNegInt,
      notInBreakup: z.boolean(),
    })
    .refine((p) => p.baseUsd <= p.capUsd, { message: 'the base fee exceeds the cap' }),
  geologistReview: z.strictObject({ consultantUsd: nonNeg, ownDays: posInt, resultLagWeeks: nonNegInt }),
  consultantDays: z.strictObject({
    tiers: z
      .strictObject({ budget: consultantTier, standard: consultantTier, premier: consultantTier })
      .refine((t) => t.budget.skill < t.standard.skill && t.standard.skill < t.premier.skill, {
        message: 'tiers must rise in skill',
      }),
    expensesUsdPerDay: nonNeg,
    travelUsdPerTrip: keyed(ACCESS_CLASSES, nonNeg),
    engagedWeeks: posInt,
  }),
  staffGeologist: z.strictObject({ salaryUsdPerYear: pos }),
  technicalReport: z.strictObject({ usd: pos }),
});
