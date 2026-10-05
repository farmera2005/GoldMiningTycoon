// §4 player knowledge slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type KnowledgeSlice = { readonly placeholder?: never };

export function emptyKnowledgeSlice(): KnowledgeSlice {
  return {};
}
