// Regenerates src/engine/save/fixtures/save-v1.json, the committed v1 save that src/engine/save/save.test.ts loads:
// a P0 Bootstrapper game on seed 'fixture-v1', advanced three weeks through the public engine API. Run it with
// `npx tsx tests/fixtures/make-save-v1.ts` only when the v1 state shape itself changes before P1 (from P1 on, an old
// fixture must keep loading and a new version gets its own fixture and migration, DESIGN §2.9).
import { writeFileSync } from 'node:fs';
import { advanceWeek, defaultNewGameSetup, newGame, toSaveFile, type GameState } from '../../src/engine';

const setup = defaultNewGameSetup({ companyName: 'Fixture Placers LLC', ownerName: 'Ada Lindqvist' });
let state: GameState = newGame(setup, 'fixture-v1');
for (let week = 0; week < 3; week++) state = advanceWeek(state).state;

const save = toSaveFile(state, {
  slotName: 'Fixture Placers LLC',
  savedAt: '2026-10-05T18:00:00.000Z',
  ui: { uiVersion: 1, ironman: false, stopRules: [{ kind: 'monthStart', enabled: true }], inbox: {} },
});
const out = new URL('../../src/engine/save/fixtures/save-v1.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(save, null, 2)}\n`);
console.log(`save-v1.json: turn ${state.clock.turn}, ${(JSON.stringify(save).length / 1024).toFixed(0)} kB compact`);
