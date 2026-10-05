// §3 world and geology slice of GameState (DESIGN §2.5). Placeholder until its phase: P0 world generator.
// The owning system replaces this with its full shape; nothing else may write it.
export type WorldSlice = { readonly placeholder?: never };

export function emptyWorldSlice(): WorldSlice {
  return {};
}
