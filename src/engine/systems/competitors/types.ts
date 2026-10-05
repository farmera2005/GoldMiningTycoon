// §12 competitors slice of GameState (DESIGN §2.5). Placeholder until its phase: P5.
// The owning system replaces this with its full shape; nothing else may write it.
export type CompetitorSlice = { readonly placeholder?: never };

export function emptyCompetitorSlice(): CompetitorSlice {
  return {};
}
