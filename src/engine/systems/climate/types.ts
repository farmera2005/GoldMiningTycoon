// §1 climate (seasons, forecasts, weather) slice of GameState (DESIGN §2.5). Placeholder until its phase: P1.
// The owning system replaces this with its full shape; nothing else may write it.
export type ClimateSlice = { readonly placeholder?: never };

export function emptyClimateSlice(): ClimateSlice {
  return {};
}
