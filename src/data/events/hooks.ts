// Registry of effect hooks: every value an event may change is read through effective() (DESIGN §2.10, §12 12.3).
// Rows are owned by the reading section and arrive with their systems (P1+). P0 ships the empty registry.
export interface HookDef {
  readonly key: string;
  readonly ownerSection: number;
  readonly neutral: number;
  readonly unit: string;
  readonly mulBounds?: readonly [number, number];
  readonly addBounds?: readonly [number, number];
  readonly setBounds?: readonly [number, number];
}

export const hookRegistry: readonly HookDef[] = [];
