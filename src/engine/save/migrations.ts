// Save migrations (DESIGN §2.9, D-2.34): pure `vN → vN+1` functions, applied in order until the save reaches the
// current schema. Every migration has a fixture test. P0 saves are not carried into P1, so the P0 registry is empty;
// the first entry (v1 → v2) arrives with P1's state changes.
import { CURRENT_SCHEMA_VERSION } from '../state/schema';
import type { Migration, MigrationOutcome, VersionedSave } from './types';

export { CURRENT_SCHEMA_VERSION } from '../state/schema';

export const MIGRATIONS: readonly Migration[] = [];

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

/**
 * Migrates `save` forward to `target`. Throws MigrationError when a step is missing or a migration does not produce
 * the next version (a broken chain is a bug, reported to the player as SAVE_CORRUPT).
 */
export function migrateSave(
  save: VersionedSave,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = CURRENT_SCHEMA_VERSION,
): MigrationOutcome {
  if (save.schemaVersion > target) {
    throw new MigrationError(`schema ${save.schemaVersion} is newer than this build's ${target}`);
  }
  let current = save;
  const applied: string[] = [];
  while (current.schemaVersion < target) {
    const from = current.schemaVersion;
    const step = migrations.find((m) => m.from === from);
    if (step === undefined) throw new MigrationError(`no migration from schema ${from}`);
    const next = step.migrate(current);
    if (next.schemaVersion !== from + 1) {
      throw new MigrationError(`migration '${step.name}' produced schema ${next.schemaVersion}, expected ${from + 1}`);
    }
    current = next;
    applied.push(step.name);
  }
  return { save: current, applied };
}
