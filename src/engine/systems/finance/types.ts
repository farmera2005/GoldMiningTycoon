// §11 finance slice of GameState (DESIGN §2.5). Placeholder until its phase: P0 framework may add cash for the top bar; P1 ledger.
// The owning system replaces this with its full shape; nothing else may write it.
export type FinanceSlice = { readonly placeholder?: never };

export function emptyFinanceSlice(): FinanceSlice {
  return {};
}
