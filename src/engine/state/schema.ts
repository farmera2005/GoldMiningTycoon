// Save/state schema version (DESIGN §2.9; s02 #7). Any breaking change to the GameState shape bumps it and adds a pure
// migration in engine/save/migrations.ts with a fixture test (D-2.34). Version 2 is the P1 shape: P0 (version 1) saves
// are refused with SAVE_TOO_OLD rather than migrated, and shape changes made inside P1 need no migration because no P1
// save has been released. Version 2 freezes at P1 exit with a committed fixture; from then on loading the previous
// version never breaks.
export const CURRENT_SCHEMA_VERSION = 2;

/** The oldest schema this build loads; anything older is refused with SAVE_TOO_OLD. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 2;
