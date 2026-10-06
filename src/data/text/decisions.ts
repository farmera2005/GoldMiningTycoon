// Decision text (DESIGN §13.4 decision cards, §13.10 "Decisions and messages", D-13.86; S13-14). A `PendingDecision`
// carries `context.templateKey` (its kind), and each option a `labelKey` and a `consequenceKey`; the keys resolve here:
//   context.templateKey  `<kind>`                       → DECISION_TEMPLATES[`decision.<kind>`] (title, body)
//   option.labelKey      `decision.<kind>.<optionId>`             → the option's label
//   option.consequenceKey `decision.<kind>.<optionId>.consequence` → its consequence line
// Placeholders follow data/text/alerts.ts. Also here: the one-line consequence of each §11 payment category going
// unpaid, which the pre-advance sheet shows for `fundingPreview(...).firstShort.consequenceKey` (`funding.<category>`).

export interface DecisionOptionText {
  readonly label: string;
  /** One line on what choosing it does, shown under the option on its card. */
  readonly consequence: string;
}

export interface DecisionTemplate {
  readonly title: string;
  readonly body: string;
  readonly params: readonly string[];
  /** Every option the owner offers, by option id. */
  readonly options: Readonly<Record<string, DecisionOptionText>>;
}

/** The decisions P1 creates (P1 contract §5.2): all non-blocking, each with a default option. */
export const DECISION_TEMPLATES = {
  // §5 5.5: a non-blocking decision 13 weeks before a lease expires; the default is to renew (D-5.30).
  'decision.land.leaseRenewal': {
    title: 'Renew the lease on {claim}?',
    body: 'The lease on {claim} ends {expiryTurn:turn}. Renewing keeps the ground for another term at a royalty of {renewalRate:pct}, one point more than now.',
    params: ['claim', 'claimId', 'tenureId', 'expiryTurn', 'renewalRate'],
    options: {
      renew: {
        label: 'Renew',
        consequence: 'The lease runs another term and the royalty rises one point.',
      },
      letExpire: {
        label: 'Let it expire',
        consequence: 'The lease ends at its term and the ground goes back to the lessor.',
      },
    },
  },
  // §8 D-8.62: raised at the revealed freeze-up (northern districts); default `layoffDefault`.
  'decision.staff.layoffDecision': {
    title: 'Lay off the seasonal crew in {district}?',
    body: 'Freeze-up has come. Laying off the hourly field crew stops their wages until breakup; most of them come back when recalled.',
    params: ['district', 'districtId', 'count'],
    options: {
      layoffDefault: {
        label: 'Lay off the field crew',
        consequence: 'Hourly field hands go on the recall list; salaried staff and shop mechanics stay on.',
      },
      keepAll: {
        label: 'Keep everyone on',
        consequence: 'Everyone stays on the payroll through the winter.',
      },
    },
  },
  // §8 D-8.62: raised at forecast breakup − 6 weeks; default `recallAll`.
  'decision.staff.recallDecision': {
    title: 'Recall the crew for {district}?',
    body: 'Breakup is forecast for about {breakupTurn:turn}. Recalled hands start about a week before it, so they are on site when the ground opens.',
    params: ['district', 'districtId', 'breakupTurn', 'count'],
    options: {
      recallAll: {
        label: 'Recall the crew',
        consequence: 'Laid-off hands are asked back; most return, some will have found other work.',
      },
      recallNone: {
        label: 'Do not recall',
        consequence: 'They stay laid off; you can hire again when you need a crew.',
      },
    },
  },
} as const satisfies Readonly<Record<string, DecisionTemplate>>;

export type DecisionTemplateKey = keyof typeof DECISION_TEMPLATES;

/**
 * What happens when a payment category goes unpaid (§11 11.4 table, "If unpaid at due"), keyed `funding.<category>`:
 * the pre-advance sheet's first-short line (S13-2, D-11.97).
 */
export const FUNDING_CONSEQUENCE_TEXT = {
  'funding.autoDebit': 'Automatic debits are taken before anything else.',
  'funding.payroll.net':
    'Missed payroll: crew morale falls, some may stop work until paid, and your reputation suffers.',
  'funding.payroll.taxDeposit':
    'Penalties on the shortfall; unpaid withheld taxes become your personal debt if they stay unpaid.',
  'funding.margin': 'Positions are closed out with a penalty.',
  'funding.regulatory.critical': 'Claims can be forfeited and permits suspended.',
  'funding.debt.secured': 'A late fee, then default and repossession of the collateral.',
  'funding.insurance': 'The policy is cancelled after four weeks unpaid.',
  'funding.vendor.critical': 'A finance charge; fuel and parts stop after four weeks.',
  'funding.royalty.cash': 'The lessor can serve a default notice.',
  'funding.tax': 'Interest and penalties; a tax lien after 26 weeks.',
  'funding.debt.unsecured': 'A late fee and damage to your credit.',
  'funding.vendor.other': 'A finance charge; the vendor stops work after four weeks.',
  'funding.owner': 'Deferred without penalty.',
} as const satisfies Readonly<Record<string, string>>;
