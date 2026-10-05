// T11 Saves, file half (DESIGN §13.27; §2.9, §13.16 validation order): export → import is byte-identical, newer
// saves are refused, older ones migrate with a notice, and corrupt input is rejected.
import fc from 'fast-check';
import { gzipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  decodeSaveText,
  exportSave,
  exportSaveText,
  fileStem,
  isGzip,
  readSave,
  serializeSave,
  type Result,
  type SaveEnvelope,
} from './saveFile';
import { fixtureCodec, fixtureSave, fixtureSaveV1 } from './testFixtures';

function expectError<T>(result: Result<T>, code: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

function loaded<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`);
  return result.value;
}

describe('export → import round trip', () => {
  it('gives byte-identical JSON text, gzipped and plain', () => {
    const save = fixtureSave({ turn: 27, withLog: true });
    const text = serializeSave(save);
    for (const gzip of [true, false]) {
      const file = exportSave(save, { gzip });
      expect(isGzip(file.bytes)).toBe(gzip);
      const back = loaded(readSave(file.bytes, fixtureCodec));
      expect(back.text).toBe(text);
      expect(serializeSave(back.save)).toBe(text);
      expect(back.save).toEqual(save);
      expect(back.notices).toEqual([]);
    }
  });

  it('holds for arbitrary JSON state and UI (property)', () => {
    const codec = {
      currentSchemaVersion: 1,
      migrate: () => ({ save: { format: 'gmt-save' as const, schemaVersion: 1 }, applied: [] }),
    };
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue()),
        fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: undefined }),
        fc.boolean(),
        (state, ui, gzip) => {
          const base: SaveEnvelope = { ...fixtureSave(), schemaVersion: 1, state };
          const save: SaveEnvelope = ui === undefined ? base : { ...base, ui };
          const text = serializeSave(save);
          const back = loaded(readSave(exportSave(save, { gzip }).bytes, codec));
          expect(back.text).toBe(text);
          expect(JSON.stringify(back.save.state)).toBe(JSON.stringify(save.state));
          expect(JSON.stringify(back.save.ui)).toBe(JSON.stringify(save.ui));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('exports the same bytes every time (gzip timestamp fixed) and names the file from the slot', () => {
    const save = fixtureSave();
    expect(exportSave(save).bytes).toEqual(exportSave(save).bytes);
    expect(exportSave(save).fileName).toBe('hardrock-gulch-mining-llc.gmt.json.gz');
    expect(exportSave(save, { gzip: false }).fileName).toBe('hardrock-gulch-mining-llc.gmt.json');
    expect(exportSave(save, { gzip: false }).mimeType).toBe('application/json');
    expect(exportSaveText('{}', 'Ruby Creek', {}).mimeType).toBe('application/gzip');
  });

  it('accepts plain JSON with a UTF-8 byte-order mark', () => {
    const save = fixtureSave();
    const back = loaded(readSave(strToU8(`\uFEFF${serializeSave(save)}`), fixtureCodec));
    expect(back.text).toBe(serializeSave(save));
  });

  it('decodes text input unchanged', () => {
    expect(decodeSaveText('{"a":1}')).toEqual({ ok: true, value: '{"a":1}' });
  });
});

describe('validation order: format → schemaVersion → parse → tuningHash', () => {
  it('rejects unreadable bytes as SAVE_CORRUPT', () => {
    expectError(readSave(new Uint8Array([0x00, 0xff, 0x13, 0x37]), fixtureCodec), 'SAVE_CORRUPT');
    expectError(readSave('{"format":"gmt-save",', fixtureCodec), 'SAVE_CORRUPT');
    const gz = exportSave(fixtureSave()).bytes;
    expectError(readSave(gz.slice(0, gz.length - 12), fixtureCodec), 'SAVE_CORRUPT');
    expectError(readSave(gzipSync(strToU8('not json')), fixtureCodec), 'SAVE_CORRUPT');
  });

  it('rejects other JSON as SAVE_FORMAT', () => {
    expectError(readSave('[]', fixtureCodec), 'SAVE_FORMAT');
    expectError(readSave('{"format":"other-game","schemaVersion":1}', fixtureCodec), 'SAVE_FORMAT');
    expectError(readSave('{"format":"gmt-save"}', fixtureCodec), 'SAVE_FORMAT');
    expectError(readSave('{"format":"gmt-save","schemaVersion":"3"}', fixtureCodec), 'SAVE_FORMAT');
    expectError(readSave('{"format":"gmt-save","schemaVersion":0}', fixtureCodec), 'SAVE_FORMAT');
  });

  it('refuses a newer schema with SAVE_TOO_NEW before looking at the rest of the file', () => {
    expectError(readSave(serializeSave({ ...fixtureSave(), schemaVersion: 4 }), fixtureCodec), 'SAVE_TOO_NEW');
    expectError(readSave('{"format":"gmt-save","schemaVersion":99,"state":null}', fixtureCodec), 'SAVE_TOO_NEW');
  });

  it('migrates an older save forward and lists the migrations in a notice', () => {
    const back = loaded(readSave(JSON.stringify(fixtureSaveV1()), fixtureCodec));
    expect(back.save.schemaVersion).toBe(3);
    expect(back.save.state).toEqual({
      meta: { seed: 7, turn: 4, tuningHash: 'tun_a1b2c3', runStatus: 'active' },
      finance: { cashCents: 1_000_00 },
    });
    expect(back.notices).toEqual([
      { code: 'SAVE_MIGRATED', fromVersion: 1, toVersion: 3, migrations: ['v1→v2 finance slice', 'v2→v3 run status'] },
    ]);
    expect(back.text).toBe(serializeSave(back.save));
  });

  it('treats a failed or incomplete migration as SAVE_CORRUPT', () => {
    const throwing = {
      ...fixtureCodec,
      migrate: () => {
        throw new Error('bad shape');
      },
    };
    expectError(readSave(JSON.stringify(fixtureSaveV1()), throwing), 'SAVE_CORRUPT');
    const stuck = {
      ...fixtureCodec,
      migrate: (s: Parameters<typeof fixtureCodec.migrate>[0]) => ({ save: s, applied: [] }),
    };
    expectError(readSave(JSON.stringify(fixtureSaveV1()), stuck), 'SAVE_CORRUPT');
  });

  it('rejects a damaged envelope or state as SAVE_CORRUPT', () => {
    const save = fixtureSave() as unknown as Record<string, unknown>;
    const without = (key: string): string => JSON.stringify({ ...save, [key]: undefined });
    for (const key of ['rulesVersion', 'savedAt', 'slotName', 'summary', 'state']) {
      expectError(readSave(without(key), fixtureCodec), 'SAVE_CORRUPT');
    }
    expectError(
      readSave(
        JSON.stringify({ ...save, summary: { company: 'X', year: 1, week: 1, cash: 1.5, netWorth: 0 } }),
        fixtureCodec,
      ),
      'SAVE_CORRUPT',
    );
    expectError(readSave(JSON.stringify({ ...save, ui: [] }), fixtureCodec), 'SAVE_CORRUPT');
    expectError(readSave(JSON.stringify({ ...save, actionLog: {} }), fixtureCodec), 'SAVE_CORRUPT');
    expectError(readSave(JSON.stringify({ ...save, state: { meta: {} } }), fixtureCodec), 'SAVE_CORRUPT');
  });

  it('notes a different tuning hash without refusing the save', () => {
    const back = loaded(readSave(serializeSave(fixtureSave({ tuningHash: 'tun_other' })), fixtureCodec));
    expect(back.notices).toEqual([{ code: 'TUNING_DIFFERS' }]);
  });
});

describe('fileStem', () => {
  it.each([
    ['Hardrock Gulch Mining LLC', 'hardrock-gulch-mining-llc'],
    ['  Klondike Ćreek / #2  ', 'klondike-creek-2'],
    ['***', 'save'],
    ['a'.repeat(80), 'a'.repeat(60)],
  ])('%s → %s', (name, stem) => {
    expect(fileStem(name)).toBe(stem);
  });
});
