// Help > Glossary (DESIGN §13.1 Help, §13.14; S13-14): the terms a player meets in P1, in plain English. Each entry
// may point to related entries (`see`, by id). Units follow §2.4 and §13.2: volumes in bank cubic yards, gold in raw
// or fine troy ounces, grade in raw oz per bcy. From P2 the glossary gains an Agencies section (13.8).

export interface GlossaryEntry {
  /** Stable id (camelCase), used by `see` links and Help routes. */
  readonly id: string;
  readonly term: string;
  readonly definition: string;
  readonly see?: readonly string[];
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'advanceMinimumRoyalty',
    term: 'Advance minimum royalty (AMR)',
    definition:
      'A yearly payment a lease requires whether or not you mine. It is usually credited against royalties you owe later on the gold you produce.',
    see: ['royalty', 'lease'],
  },
  {
    id: 'aisc',
    term: 'All-in sustaining cost (AISC)',
    definition:
      'Cash cost per fine ounce plus the spending needed to keep producing at the same rate, such as replacing worn equipment.',
    see: ['cashCostPerOz'],
  },
  {
    id: 'bcy',
    term: 'Bank cubic yard (bcy)',
    definition:
      'A cubic yard of ground as it lies before it is dug. Volumes, rates and grades are measured in bank yards; dug material swells into loose yards (lcy).',
    see: ['lcy', 'grade'],
  },
  {
    id: 'bedrock',
    term: 'Bedrock',
    definition:
      'The solid rock under the gravels. Placer gold is heaviest and richest on and just into the top of bedrock, so the pay column usually ends there.',
    see: ['payGravel'],
  },
  {
    id: 'bottleneck',
    term: 'Bottleneck',
    definition:
      'The stage that limits how much the whole operation washes in a week: stripping, digging, hauling, the plant, water or power. Fixing anything else changes little.',
  },
  {
    id: 'breakup',
    term: 'Breakup',
    definition:
      'The spring thaw in the north, when ice and frozen ground let go. Trails turn soft and close for a while, and the operating season follows.',
    see: ['freezeUp', 'operatingSeason'],
  },
  {
    id: 'cashCostPerOz',
    term: 'Cash cost per ounce',
    definition:
      'Operating cash spent on a claim or the company for a period, divided by the fine ounces it recovered in that period.',
    see: ['aisc', 'fineOz'],
  },
  {
    id: 'cleanup',
    term: 'Cleanup',
    definition:
      'Stopping the plant to recover the concentrate caught in the sluice and weigh the gold. Until a cleanup, gold in the box is only the foreman’s estimate.',
    see: ['sluice', 'lot'],
  },
  {
    id: 'cutoffGrade',
    term: 'Cutoff grade',
    definition:
      'The grade below which a block costs more to mine and wash than its gold is worth, at your planning price and costs.',
    see: ['grade'],
  },
  {
    id: 'dilution',
    term: 'Dilution',
    definition:
      'Barren material mined and washed along with the pay gravel, which lowers the grade the plant actually sees.',
  },
  {
    id: 'dryWasher',
    term: 'Dry washer',
    definition:
      'A plant that separates gold with air and vibration instead of water. It works on dry desert ground but recovers less fine gold than a sluice.',
    see: ['sluice'],
  },
  {
    id: 'estimateRange',
    term: 'P10, P50, P90',
    definition:
      'Your estimate as a range: a 10% chance the truth is below P10, an even chance either side of P50, a 10% chance above P90. Sampling narrows the range.',
  },
  {
    id: 'fineOz',
    term: 'Fine ounce',
    definition:
      'A troy ounce of pure gold. Buyers pay for fine ounces; raw gold contains silver and other metals, so it holds fewer fine ounces than it weighs.',
    see: ['rawOz', 'fineness'],
  },
  {
    id: 'fineness',
    term: 'Fineness',
    definition:
      'The share of a raw ounce that is pure gold, such as 0.840. Until an assay, it is an estimate from the district and your samples.',
    see: ['fineOz', 'rawOz'],
  },
  {
    id: 'foreman',
    term: 'Foreman',
    definition:
      'The person running the crew on a claim. Every active claim needs a hired foreman or you, except a small crew of three hands or fewer on one line and shift.',
    see: ['smallCrew'],
  },
  {
    id: 'freezeUp',
    term: 'Freeze-up',
    definition:
      'The autumn freeze that ends the northern operating season. Sites that will not run through winter must be winterized.',
    see: ['breakup', 'winterize'],
  },
  {
    id: 'grade',
    term: 'Grade',
    definition:
      'Gold per volume of ground, in raw ounces per bank cubic yard (oz/bcy). The tooltip also gives grams per cubic metre.',
    see: ['bcy', 'cutoffGrade'],
  },
  {
    id: 'insolvencyCounter',
    term: 'Arrears and liquidation',
    definition:
      'When a required payment is missed, an arrear opens. If every arrear is not paid within the grace period, the company is liquidated and the run ends.',
  },
  {
    id: 'lcy',
    term: 'Loose cubic yard (lcy)',
    definition:
      'A cubic yard of dug, swollen material, as trucks and dumps hold it. Only haul and dump figures use loose yards.',
    see: ['bcy'],
  },
  {
    id: 'lease',
    term: 'Lease',
    definition:
      'The right to mine someone else’s claim for a term, in exchange for royalties and usually an advance minimum royalty. Cheaper to enter than buying.',
    see: ['advanceMinimumRoyalty', 'royalty'],
  },
  {
    id: 'liquidity',
    term: 'Liquidity',
    definition: 'Cash you can spend now, plus any undrawn credit you can draw at once. In this version it equals cash.',
  },
  {
    id: 'localBuyer',
    term: 'Local buyer',
    definition:
      'A gold buyer in the district town who pays cash for raw gold at a discount to the spot price, using their own guess of its fineness.',
    see: ['spot', 'standingOrder'],
  },
  {
    id: 'lot',
    term: 'Lot',
    definition:
      'A weighed parcel of raw gold from one cleanup or sample, held until you sell it. Lots are what the Gold sales screen lists.',
    see: ['cleanup'],
  },
  {
    id: 'netWorth',
    term: 'Net worth',
    definition:
      'What you and the company own less what you owe, with gold at its expected sale value and machines at resale estimates. The run is scored on it.',
  },
  {
    id: 'operatingSeason',
    term: 'Operating season',
    definition:
      'The weeks between breakup and freeze-up when northern ground and water allow mining. Desert districts work most of the year but face heat, storms and fire.',
    see: ['breakup', 'freezeUp'],
  },
  {
    id: 'overburden',
    term: 'Overburden',
    definition:
      'The barren ground over the pay gravel: soil, muck and gravel that must be stripped away before the pay can be dug.',
    see: ['stripping', 'payGravel'],
  },
  {
    id: 'payGravel',
    term: 'Pay gravel',
    definition:
      'The gold-bearing layer, usually the lowest few feet of gravel and the top of bedrock. It is dug and washed; the rest is stripped as waste.',
    see: ['overburden', 'bedrock'],
  },
  {
    id: 'permafrost',
    term: 'Permafrost',
    definition:
      'Ground frozen year-round. It must thaw before it can be dug, which stripping and exposure to the sun do slowly.',
  },
  {
    id: 'rawOz',
    term: 'Raw ounce',
    definition:
      'A troy ounce of gold as weighed, before refining. Grades and estimates are in raw (metal) ounces; sales are in fine ounces.',
    see: ['fineOz', 'fineness'],
  },
  {
    id: 'recovery',
    term: 'Recovery',
    definition:
      'The share of the gold in washed gravel that the plant actually catches. Fine and flaky gold is easier to lose than coarse gold.',
  },
  {
    id: 'royalty',
    term: 'Royalty',
    definition:
      'A share of production owed to a landholder or investor, taken in gold at each cleanup or paid in cash.',
    see: ['lease', 'advanceMinimumRoyalty'],
  },
  {
    id: 'runway',
    term: 'Runway',
    definition:
      'How many weeks your cash lasts at the current forecast, counting planned cleanups at their middle (P50) estimate.',
  },
  {
    id: 'sluice',
    term: 'Sluice',
    definition:
      'A sloped box with riffles that traps heavy gold as water carries the gravel through. A trommel screens the feed before the sluice.',
    see: ['trommel', 'cleanup'],
  },
  {
    id: 'smallCrew',
    term: 'Small crew',
    definition:
      'Three hands or fewer on one plant line and one shift may work without a foreman, at 92% efficiency and with higher incident odds.',
    see: ['foreman'],
  },
  {
    id: 'spot',
    term: 'Spot price',
    definition: 'The market price of a fine ounce of gold this week. Buyers pay a discount to it.',
  },
  {
    id: 'standingOrder',
    term: 'Standing sale order',
    definition:
      'An instruction to sell gold automatically: everything at each cleanup, or enough to keep cash above a level you set.',
    see: ['localBuyer'],
  },
  {
    id: 'stripRatio',
    term: 'Strip ratio',
    definition:
      'Yards of overburden stripped for each yard of pay gravel mined. High ratios make cheap gold expensive.',
    see: ['stripping'],
  },
  {
    id: 'stripping',
    term: 'Stripping',
    definition:
      'Removing overburden ahead of mining, usually with a dozer. It must stay ahead of the cut, or the plant runs out of exposed pay.',
    see: ['overburden', 'stripRatio'],
  },
  {
    id: 'trommel',
    term: 'Trommel',
    definition:
      'A rotating screen drum that washes and sizes gravel, sending the fines over the sluice and the oversize rock to a pile.',
    see: ['sluice'],
  },
  {
    id: 'unpatentedClaim',
    term: 'Unpatented claim',
    definition:
      'A federal mining claim: the right to mine the minerals on public land, not ownership of the land itself.',
  },
  {
    id: 'winterize',
    term: 'Winterize',
    definition: 'Draining, storing and closing up a site so it survives the winter and can start up again at breakup.',
    see: ['freezeUp'],
  },
];
