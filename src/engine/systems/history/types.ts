// §2 history ring and annual rollups slice of GameState (DESIGN §2.5). Placeholder until its phase: P0 framework.
// The owning system replaces this with its full shape; nothing else may write it.
export type HistorySlice = { readonly placeholder?: never };

export function emptyHistorySlice(): HistorySlice {
  return {};
}
