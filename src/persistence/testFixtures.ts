// Test-only fixtures for persistence (imported by *.test.ts only): a small codec with a two-step migration chain and a save builder. The state is a
// stand-in shaped loosely like GameState (meta + slices); persistence treats it as opaque JSON.
import type { MigrationOutcome, SaveCodec, SaveEnvelope, VersionedSave } from './saveFile';

export const FIXTURE_TUNING_HASH = 'tun_a1b2c3';

interface FixtureState {
  readonly meta: {
    readonly seed: number;
    readonly turn: number;
    readonly tuningHash: string;
    readonly runStatus: string;
  };
  readonly finance: { readonly cashCents: number };
}

/** v1 kept cash at the top level; v2 moved it into `finance`; v3 added `meta.runStatus`. */
function migrateV1toV2(save: VersionedSave): VersionedSave {
  const state = save['state'] as { meta: Record<string, unknown>; cashCents: number };
  const { cashCents, ...rest } = state;
  return { ...save, schemaVersion: 2, state: { ...rest, finance: { cashCents } } };
}

function migrateV2toV3(save: VersionedSave): VersionedSave {
  const state = save['state'] as { meta: Record<string, unknown> };
  return { ...save, schemaVersion: 3, state: { ...state, meta: { ...state.meta, runStatus: 'active' } } };
}

const MIGRATIONS: readonly { name: string; from: number; run: (s: VersionedSave) => VersionedSave }[] = [
  { name: 'v1→v2 finance slice', from: 1, run: migrateV1toV2 },
  { name: 'v2→v3 run status', from: 2, run: migrateV2toV3 },
];

function isFixtureState(v: unknown): v is FixtureState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as { meta?: { tuningHash?: unknown }; finance?: { cashCents?: unknown } };
  return typeof s.meta?.tuningHash === 'string' && typeof s.finance?.cashCents === 'number';
}

export const fixtureCodec: SaveCodec = {
  currentSchemaVersion: 3,
  migrate(save): MigrationOutcome {
    let current = save;
    const applied: string[] = [];
    for (const m of MIGRATIONS) {
      if (current.schemaVersion === m.from) {
        current = m.run(current);
        applied.push(m.name);
      }
    }
    return { save: current, applied };
  },
  checkState: (state) => (isFixtureState(state) ? null : 'missing meta or finance'),
  currentTuningHash: FIXTURE_TUNING_HASH,
  tuningHashOf: (save) => (isFixtureState(save.state) ? save.state.meta.tuningHash : null),
  runStatusOf: (save) => (isFixtureState(save.state) && save.state.meta.runStatus === 'ended' ? 'ended' : 'active'),
};

export function fixtureSave(
  opts: {
    turn?: number;
    company?: string;
    cashCents?: number;
    tuningHash?: string;
    runStatus?: string;
    withLog?: boolean;
  } = {},
): SaveEnvelope {
  const turn = opts.turn ?? 0;
  const cash = opts.cashCents ?? 41_230_000;
  const company = opts.company ?? 'Hardrock Gulch Mining LLC';
  const save: SaveEnvelope = {
    format: 'gmt-save',
    schemaVersion: 3,
    rulesVersion: 'p0',
    savedAt: '2026-10-05T17:00:00.000Z',
    slotName: company,
    summary: { company, year: Math.floor(turn / 52) + 1, week: (turn % 52) + 1, cash, netWorth: cash + 5_000_000 },
    state: {
      meta: {
        seed: 1234,
        turn,
        tuningHash: opts.tuningHash ?? FIXTURE_TUNING_HASH,
        runStatus: opts.runStatus ?? 'active',
      },
      finance: { cashCents: cash },
    },
    ui: { inbox: {}, stopRules: [], uiVersion: 1, ironman: false },
  };
  return opts.withLog ? { ...save, actionLog: [{ turn: 0, actionSeq: 1, action: { type: 'owner/setSalary' } }] } : save;
}

/** A schema-1 save of the same game, as an older build would have written it. */
export function fixtureSaveV1(): Record<string, unknown> {
  return {
    format: 'gmt-save',
    schemaVersion: 1,
    rulesVersion: 'p0',
    savedAt: '2026-01-01T00:00:00.000Z',
    slotName: 'Old camp',
    summary: { company: 'Old Camp Placers', year: 1, week: 5, cash: 1_000_00, netWorth: 1_000_00 },
    state: { meta: { seed: 7, turn: 4, tuningHash: FIXTURE_TUNING_HASH }, cashCents: 1_000_00 },
  };
}
