// §5 land and tenure slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type LandSlice = { readonly placeholder?: never };

export function emptyLandSlice(): LandSlice {
  return {};
}
