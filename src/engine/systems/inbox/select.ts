// §13 inbox selectors (DESIGN §2.11, §13 13.10; P1 contract §4.13): pure readers over state, spread into `select` by
// select/index.ts. Messages carry no hidden field. A name already used by another folder fails the composition test.
import type { MsgId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import type { PendingDecision } from '../../actions/types';
import type { GameState } from '../../state/types';
import type { AlertKind, InboxMessage, Severity } from './types';

export interface InboxFilter {
  status?: InboxMessage['status'];
  kind?: AlertKind;
  minSeverity?: Severity;
}

const RANK: Readonly<Record<Severity, number>> = { info: 0, warning: 1, critical: 2, blocking: 3 };

/** Messages in id (creation) order, optionally filtered. */
function inboxMessages(state: GameState, filter: InboxFilter = {}): InboxMessage[] {
  return sortedValues(state.inbox.messages).filter(
    (m) =>
      (filter.status === undefined || m.status === filter.status) &&
      (filter.kind === undefined || m.kind === filter.kind) &&
      (filter.minSeverity === undefined || RANK[m.severity] >= RANK[filter.minSeverity]),
  );
}

/** Each open decision with the message that announces it (S12-2), or null before collation links one. */
function openDecisionsWithMessages(state: GameState): { decision: PendingDecision; message: InboxMessage | null }[] {
  const byDecision: Record<string, InboxMessage> = {};
  for (const m of sortedValues(state.inbox.messages)) if (m.decisionId !== undefined) byDecision[m.decisionId] = m;
  return sortedValues(state.inbox.decisions).map((d) => ({ decision: d, message: byDecision[d.id] ?? null }));
}

/** The obligation messages grouped with `msgId` (13.10 grouping, S13-13). */
function obligationGroupMembers(_state: GameState, _msgId: MsgId): MsgId[] {
  // CONTRACT-STUB(§13) inbox.obligationGroupMembers
  return [];
}

export const inboxSelectors = {
  inboxMessages,
  openDecisionsWithMessages,
  obligationGroupMembers,
} as const;
