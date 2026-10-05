// DESIGN §2.14 "registries": every rng() stream literal and every id prefix in engine/ is registered with one owner,
// streams are drawn on only by their owning section (§2.3 stream rule b) and prefixes are minted only by theirs (§2.4);
// only `lst` is shared, by §5 and §9. The gmt lint rules guarantee the arguments are literals; this test reads them.
import { describe, expect, it } from 'vitest';
import { ID_PREFIXES, isIdPrefix, type IdPrefix } from '../../src/engine/core/ids';
import { STREAMS, isStreamName, type StreamName } from '../../src/engine/core/streams';
import {
  callSites,
  isTestFile,
  listSourceFiles,
  listSubdirs,
  objectLiteralKeys,
  parseFile,
  parseText,
  type CallSite,
} from './sourceScan';

/**
 * Engine folders by owning DESIGN section (CLAUDE.md repository layout). §2's folders are the engine's frame; each
 * system folder belongs to the section that owns it. "Do not add a system folder that no DESIGN section owns."
 */
const SECTION_FOLDERS: Readonly<Record<number, readonly string[]>> = {
  1: ['systems/climate', 'systems/company', 'systems/investors'],
  2: ['core', 'state', 'turn', 'actions', 'explain', 'select', 'save', 'systems/history'],
  3: ['systems/world'],
  4: ['systems/knowledge'],
  5: ['systems/land', 'systems/negotiation'],
  6: ['systems/permits'],
  7: ['systems/ops'],
  8: ['systems/staff'],
  9: ['systems/fleet'],
  10: ['systems/gold'],
  11: ['systems/finance'],
  12: ['systems/events', 'systems/competitors'],
  13: ['systems/inbox'],
  14: ['systems/hardrock'],
};

const SECTIONS = Object.keys(SECTION_FOLDERS).map(Number);

const FOLDER_SECTION: ReadonlyMap<string, number> = new Map(
  Object.entries(SECTION_FOLDERS).flatMap(([section, folders]) => folders.map((f) => [f, Number(section)] as const)),
);

/** The engine folder of a file under src/engine/: 'systems/<name>' for system folders, else the top folder. */
function engineFolder(rel: string): string | null {
  const inner = rel.slice('src/engine/'.length);
  const parts = inner.split('/');
  if (parts.length === 1) return ''; // src/engine/index.ts, the public surface (§2.2)
  if (parts[0] === 'systems') return parts.length > 2 ? `systems/${parts[1]}` : null;
  return parts[0] ?? null;
}

/** The DESIGN section owning a src/engine file, or null when its folder is unmapped. */
function sectionOf(rel: string): number | null {
  const folder = engineFolder(rel);
  if (folder === '') return 2;
  return folder === null ? null : (FOLDER_SECTION.get(folder) ?? null);
}

/**
 * Typed wrappers that mint a shared-counter id (src/engine/core/ids.ts). They count as minting `lst` for the one
 * section whose listing kind they build (§2.4: §5 claim listings, §9 equipment listings; D-2.8).
 */
const LISTING_MINTERS: Readonly<Record<string, number>> = { nextClaimListingId: 5, nextEquipListingId: 9 };

/** The file that defines nextId and the listing wrappers: its own calls are the definitions, not minting. */
const IDS_DEFINITION = 'src/engine/core/ids.ts';
/** The file that defines rng(); the lower-level stream constructors may be used only there. */
const RNG_DEFINITION = 'src/engine/core/rng.ts';

const engineFiles = listSourceFiles('src/engine').filter((f) => !isTestFile(f));
const scan = (names: string[], argIndex: number): CallSite[] =>
  engineFiles.flatMap((f) => callSites(f, parseFile(f), new Set(names), argIndex));
const where = (s: CallSite): string => `${s.file}:${s.line}`;

describe('engine folders (CLAUDE.md layout)', () => {
  it('maps every engine folder to exactly one DESIGN section', () => {
    const seen = new Set<string>();
    for (const folders of Object.values(SECTION_FOLDERS)) {
      for (const f of folders) {
        expect(seen.has(f), `${f} listed twice`).toBe(false);
        seen.add(f);
      }
    }
    const unmapped = [
      ...listSubdirs('src/engine')
        .filter((d) => d !== 'systems')
        .filter((d) => !FOLDER_SECTION.has(d)),
      ...listSubdirs('src/engine/systems')
        .map((d) => `systems/${d}`)
        .filter((d) => !FOLDER_SECTION.has(d)),
    ];
    expect(unmapped, 'engine folders no DESIGN section owns').toEqual([]);
  });

  it('places every engine source file in a mapped folder', () => {
    expect(engineFiles.length).toBeGreaterThan(10);
    expect(engineFiles.filter((f) => sectionOf(f) === null)).toEqual([]);
  });
});

describe('stream registry (DESIGN §2.3)', () => {
  it('gives every stream one owning section that has engine folders', () => {
    for (const [name, def] of Object.entries(STREAMS)) {
      expect(Number.isInteger(def.owner), name).toBe(true);
      expect(SECTIONS, `${name} owner §${def.owner}`).toContain(def.owner);
    }
  });

  it('registers each stream name once in the source (duplicate keys would silently collapse)', () => {
    const keys = objectLiteralKeys(parseFile('src/engine/core/streams.ts'), 'STREAMS');
    expect(keys).not.toBeNull();
    const dupes = (keys ?? []).filter((k, i, all) => all.indexOf(k) !== i);
    expect(dupes).toEqual([]);
    expect([...(keys ?? [])].sort()).toEqual(Object.keys(STREAMS).sort());
  });

  it('keeps each section prefix for its own section (rule a)', () => {
    const prefixOwner: Record<string, number> = {
      'land-': 5,
      'permits-': 6,
      'ops-': 7,
      'staff-': 8,
      'fleet-': 9,
      'gold-': 10,
      'market-': 10,
      'finance-': 11,
      'ai-': 12,
      'hr-': 14,
    };
    for (const [name, def] of Object.entries(STREAMS)) {
      for (const [prefix, owner] of Object.entries(prefixOwner)) {
        if (name.startsWith(prefix)) expect(def.owner, name).toBe(owner);
      }
    }
  });

  it('names a registered literal stream in every rng() call', () => {
    const bad = scan(['rng'], 1)
      .filter((s) => s.literal === null || !isStreamName(s.literal))
      .map((s) => `${where(s)} rng(…, ${s.argText || '<missing>'}, …)`);
    expect(bad).toEqual([]);
  });

  it('draws on each stream only from its owning section (rule b)', () => {
    const bad: string[] = [];
    for (const s of scan(['rng'], 1)) {
      if (s.literal === null || !isStreamName(s.literal)) continue;
      const owner = STREAMS[s.literal as StreamName].owner;
      const section = sectionOf(s.file);
      if (section !== owner) bad.push(`${where(s)} draws '${s.literal}' (owner §${owner}) from §${section}`);
    }
    expect(bad).toEqual([]);
  });

  it('builds streams only through rng() (streamState and rngFromState stay inside core/rng.ts)', () => {
    const bad = scan(['streamState', 'rngFromState'], 0)
      // The HandlerContext rng wrapper (actions/apply.ts) rebuilds the stream the handler named so it can record the draw
      // for undo detection (D-2.22); every handler's ctx.rng(...) call is itself checked for a registered literal.
      .filter((s) => s.file !== RNG_DEFINITION && s.file !== 'src/engine/actions/apply.ts')
      .map((s) => `${where(s)} ${s.callee}()`);
    expect(bad).toEqual([]);
  });
});

describe('id prefix registry (DESIGN §2.4)', () => {
  const entries = Object.entries(ID_PREFIXES) as [IdPrefix, (typeof ID_PREFIXES)[IdPrefix]][];

  it('gives every prefix an owner; only lst is shared, by §5 and §9', () => {
    for (const [prefix, def] of entries) {
      expect(def.owners.length, prefix).toBeGreaterThan(0);
      expect(new Set(def.owners).size, prefix).toBe(def.owners.length);
      for (const owner of def.owners) expect(SECTIONS, `${prefix} owner §${owner}`).toContain(owner);
    }
    const shared = entries.filter(([, def]) => def.owners.length > 1).map(([p, def]) => [p, [...def.owners].sort()]);
    expect(shared).toEqual([['lst', [5, 9]]]);
    // §2.14 names these owners explicitly.
    expect(ID_PREFIXES.reo.owners).toEqual([11]);
    expect(STREAMS['finance-reorg'].owner).toBe(11);
  });

  it('registers each prefix once in the source', () => {
    const keys = objectLiteralKeys(parseFile('src/engine/core/ids.ts'), 'ID_PREFIXES');
    expect(keys).not.toBeNull();
    expect((keys ?? []).filter((k, i, all) => all.indexOf(k) !== i)).toEqual([]);
    expect([...(keys ?? [])].sort()).toEqual(Object.keys(ID_PREFIXES).sort());
  });

  it('names a registered literal prefix in every nextId() call', () => {
    const bad = scan(['nextId'], 1)
      .filter((s) => s.literal === null || !isIdPrefix(s.literal))
      .map((s) => `${where(s)} nextId(…, ${s.argText || '<missing>'})`);
    expect(bad).toEqual([]);
  });

  it('mints each prefix only from its owning sections', () => {
    const bad: string[] = [];
    for (const s of scan(['nextId'], 1)) {
      if (s.file === IDS_DEFINITION || s.literal === null || !isIdPrefix(s.literal)) continue;
      const owners: readonly number[] = ID_PREFIXES[s.literal].owners;
      const section = sectionOf(s.file);
      if (section === null || !owners.includes(section)) {
        bad.push(`${where(s)} mints '${s.literal}' (owners §${owners.join(', §')}) from §${section}`);
      }
    }
    for (const s of scan(Object.keys(LISTING_MINTERS), 0)) {
      if (s.file === IDS_DEFINITION) continue;
      const owner = LISTING_MINTERS[s.callee];
      const section = sectionOf(s.file);
      if (section !== owner) bad.push(`${where(s)} ${s.callee}() (owner §${owner}) from §${section}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('registry scanner', () => {
  it('finds direct, namespaced and aliased calls and reads only plain literals', () => {
    const sf = parseText(
      'x.ts',
      [
        "import { rng as draw } from '../core/rng';",
        "import * as core from '../core';",
        "draw(seed, 'weather', turn);",
        "core.rng(seed, 'world', id);",
        "rng(seed, 'fleet-' + kind);",
        "rng(seed, 'season' as StreamName);",
        'r.next();',
      ].join('\n'),
    );
    expect(callSites('x.ts', sf, new Set(['rng']), 1).map((s) => [s.line, s.callee, s.literal])).toEqual([
      [3, 'rng', 'weather'],
      [4, 'rng', 'world'],
      [5, 'rng', null],
      [6, 'rng', null],
    ]);
  });

  it('maps files to sections by folder', () => {
    expect(sectionOf('src/engine/systems/fleet/fail.ts')).toBe(9);
    expect(sectionOf('src/engine/systems/fleet/sub/deep.ts')).toBe(9);
    expect(sectionOf('src/engine/systems/negotiation/resolveOffer.ts')).toBe(5);
    expect(sectionOf('src/engine/systems/history/ring.ts')).toBe(2);
    expect(sectionOf('src/engine/turn/step03.ts')).toBe(2);
    expect(sectionOf('src/engine/index.ts')).toBe(2);
    expect(sectionOf('src/engine/systems/mystery/x.ts')).toBeNull();
    expect(sectionOf('src/engine/systems/loose.ts')).toBeNull();
  });
});
