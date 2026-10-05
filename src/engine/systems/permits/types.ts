// §6 permits and compliance slice of GameState (DESIGN §2.5). Placeholder until its phase: P2.
// The owning system replaces this with its full shape; nothing else may write it.
export type PermitSlice = { readonly placeholder?: never };

export function emptyPermitSlice(): PermitSlice {
  return {};
}
