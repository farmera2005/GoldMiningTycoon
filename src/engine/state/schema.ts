// Save/state schema version (DESIGN §2.9). Any breaking change to the GameState shape bumps it and adds a pure
// migration in engine/save/migrations.ts with a fixture test; from P1 on, loading the previous version never breaks
// (D-2.34). P0 saves are not carried into P1.
export const CURRENT_SCHEMA_VERSION = 1;
