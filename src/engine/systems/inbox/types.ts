// §13 inbox (messages, §2 PendingDecision records) slice of GameState (DESIGN §2.5). Placeholder until its phase: P0 framework.
// The owning system replaces this with its full shape; nothing else may write it.
export type InboxSlice = { readonly placeholder?: never };

export function emptyInboxSlice(): InboxSlice {
  return {};
}
