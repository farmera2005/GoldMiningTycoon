// §7 operations selectors (DESIGN §2.11): pure readers over state, spread into `select` by select/index.ts.
// None reads a hidden field. A name already used by another folder fails the composition test.
export const opsSelectors = {} as const;
