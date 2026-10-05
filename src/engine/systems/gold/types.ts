// §10 gold market and sales slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type GoldSlice = { readonly placeholder?: never };

export function emptyGoldSlice(): GoldSlice {
  return {};
}
