// §9 equipment slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type FleetSlice = { readonly placeholder?: never };

export function emptyFleetSlice(): FleetSlice {
  return {};
}
