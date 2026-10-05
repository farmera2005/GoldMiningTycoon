// §7 operations slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type OpsSlice = { readonly placeholder?: never };

export function emptyOpsSlice(): OpsSlice {
  return {};
}
