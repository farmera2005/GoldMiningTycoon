// §14 hard-rock track slice of GameState (DESIGN §2.5). Placeholder until its phase: P6 optional.
// The owning system replaces this with its full shape; nothing else may write it.
export type HardRockSlice = { readonly placeholder?: never };

export function emptyHardRockSlice(): HardRockSlice {
  return {};
}
