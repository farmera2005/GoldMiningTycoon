// §6 permits slice of GameState: the P1 obligation store (DESIGN §6.9, D-6.38, D-6.59; s05 #1; P1 contract §4.6). Every
// deadline in the game is an `Obligation`, whichever section creates it; §6 owns the store, the reminder metadata and
// the statutory/billable settlement rule, from P1. The P2 permit, bond, application and inspection collections join
// with P2's migration (contract §2 policy exception).
import type {
  ApplicationId,
  BondId,
  ClaimId,
  EmployeeId,
  ObligationId,
  PermitId,
  TxnId,
  ViolationId,
} from '../../core/ids';
import type { Cents } from '../../core/money';
import type { PayCategory } from '../finance/types';

export type ObligationCategory =
  | 'land'
  | 'permit'
  | 'bond'
  | 'safety'
  | 'water'
  | 'reclamation'
  | 'tax'
  | 'finance'
  | 'lease'
  | 'insurance'
  | 'reporting'
  | 'enforcement';

/** P1 kinds (D-6.59); P2 adds §6's own kinds (6.9 table). */
export type ObligationKind =
  | 'leaseAdvanceRoyalty'
  | 'leaseShortfallRoyalty'
  | 'workInLieu'
  | 'leaseCure'
  | 'minimumRoyaltyShortfall'
  | 'loanPayment';

export type ObligationOwner = '§1' | '§5' | '§6' | '§8' | '§11';

export type ObligationConsequenceKind =
  | 'forfeitClaim'
  | 'voidLocation'
  | 'lapsePermit'
  | 'suspendPermit'
  | 'violation'
  | 'withdrawApplication'
  | 'lateFee'
  | 'escalate'
  | 'bondForfeiture'
  | 'gateCloses'
  | 'default';

export type ObligationStatus =
  'upcoming' | 'due' | 'satisfied' | 'missed' | 'waived' | 'cancelled' | 'cured' | 'inPlan';

export type ObligationSatisfiedVia = 'payment' | 'filing' | 'work' | 'autoPay' | 'autoFile';

export interface Obligation {
  id: ObligationId;
  kind: ObligationKind;
  category: ObligationCategory;
  /** Resolver section (§1: investor reports and minimums). */
  owner: ObligationOwner;
  /** Counterparty-paid items are not created as obligations (6.2). */
  payer: 'player';
  /** Optional override of §11 obligationPayCategory(). */
  payCategory?: PayCategory;
  title: string;
  subject: {
    claimIds?: ClaimId[];
    permitId?: PermitId;
    bondId?: BondId;
    appId?: ApplicationId;
    violationId?: ViolationId;
    loanId?: string;
    leaseId?: string;
    employeeId?: EmployeeId;
  };
  createdTurn: number;
  windowOpenTurn: number;
  dueTurn: number;
  /** Estimate; the owner re-prices at payment. */
  amount?: Cents;
  filing?: { formKey: string; prepWeeks: number; requires?: string };
  /** Alerts fire this much earlier than the §13 ladder. */
  prepLeadWeeks: number;
  payableNow: boolean;
  autoPayEligible: boolean;
  autoPay: boolean;
  consequence: { kind: ObligationConsequenceKind; text: string; severity: 'info' | 'warning' | 'critical' };
  /** Weeks after dueTurn before the consequence (0 for statutory deadlines). */
  graceWeeks: number;
  status: ObligationStatus;
  satisfiedTurn?: number;
  satisfiedVia?: ObligationSatisfiedVia;
  ledgerTxnIds?: TxnId[];
  recurrence?:
    | { kind: 'annualWeek'; week: number }
    | { kind: 'everyWeeks'; weeks: number }
    | { kind: 'anniversary'; baseTurn: number };
}

/** What a creator passes to `createObligation`: the store assigns the id and the lifecycle fields. */
export type ObligationSpec = Omit<Obligation, 'id' | 'status' | 'satisfiedTurn' | 'satisfiedVia' | 'ledgerTxnIds'>;

export interface ObligationFilter {
  owner?: ObligationOwner;
  category?: ObligationCategory;
  kinds?: ObligationKind[];
  claimId?: ClaimId;
  statuses?: ObligationStatus[];
}

/** §6 `PermitSlice`, P1 form. */
export interface PermitSlice {
  obligations: Record<ObligationId, Obligation>;
  obligationIds: ObligationId[];
}

export function emptyPermitSlice(): PermitSlice {
  return { obligations: {}, obligationIds: [] };
}

/** §6.7 disturbance types §7 reports and §6 bonds (6.7 RCE). */
export type DisturbanceType =
  'explorationPit' | 'stripped' | 'minedPit' | 'pond' | 'road' | 'campPad' | 'wasteDump' | 'tailings';

/** §6.18 P1 activity kinds `activityAllowed` answers for (every one allowed in P1). */
export type ActivityKind =
  'handSample' | 'handSluice' | 'mechSample' | 'bulkSample' | 'drill' | 'strip' | 'mine' | 'process' | 'reclaim';
