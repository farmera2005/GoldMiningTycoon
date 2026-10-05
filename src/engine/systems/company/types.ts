// §1 company and owner slice of GameState (DESIGN §2.5). Placeholder until its phase: P0 framework fills runStatus/companyName.
// The owning system replaces this with its full shape; nothing else may write it.
export type CompanySlice = { readonly placeholder?: never };

export function emptyCompanySlice(): CompanySlice {
  return {};
}
