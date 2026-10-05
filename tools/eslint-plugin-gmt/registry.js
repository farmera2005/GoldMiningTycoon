// Loads the engine's registries for the gmt rule options (DESIGN §2.3 stream registry, §2.4 id registry, §2.10 hook
// registry). The registries are TypeScript modules, so they are evaluated through tsx rather than parsed as text: the
// lint rules then see exactly the names the engine sees, however a registry file is laid out (spreads, helper consts,
// imports from other data files). tests/architecture/eslint-config.test.ts checks the loaded lists against direct
// imports of the same modules.
import { tsImport } from 'tsx/esm/api';

const ROOT = new URL('../../', import.meta.url);

const SOURCES = {
  streams: 'src/engine/core/streams.ts',
  idPrefixes: 'src/engine/core/ids.ts',
  hookKeys: 'src/data/events/hooks.ts',
};

async function load(relPath) {
  const url = new URL(relPath, ROOT).href;
  try {
    return await tsImport(url, import.meta.url);
  } catch (err) {
    // Fail loudly: silently empty lists would switch the registration and hook checks off.
    throw new Error(`eslint-plugin-gmt: cannot load ${relPath} for the registry rule options: ${String(err)}`, {
      cause: err,
    });
  }
}

function sortedUnique(names) {
  return [...new Set(names)].sort();
}

/**
 * The registered RNG stream names, id prefixes and effect-hook keys, each sorted.
 * @returns {Promise<{ streams: string[]; idPrefixes: string[]; hookKeys: string[] }>}
 */
export async function loadRegistries() {
  const [streams, ids, hooks] = await Promise.all([
    load(SOURCES.streams),
    load(SOURCES.idPrefixes),
    load(SOURCES.hookKeys),
  ]);
  if (typeof streams.STREAMS !== 'object' || streams.STREAMS === null) {
    throw new Error(`eslint-plugin-gmt: ${SOURCES.streams} must export STREAMS`);
  }
  if (typeof ids.ID_PREFIXES !== 'object' || ids.ID_PREFIXES === null) {
    throw new Error(`eslint-plugin-gmt: ${SOURCES.idPrefixes} must export ID_PREFIXES`);
  }
  if (!Array.isArray(hooks.hookRegistry)) {
    throw new Error(`eslint-plugin-gmt: ${SOURCES.hookKeys} must export the hookRegistry array`);
  }
  return {
    streams: sortedUnique(Object.keys(streams.STREAMS)),
    idPrefixes: sortedUnique(Object.keys(ids.ID_PREFIXES)),
    hookKeys: sortedUnique(hooks.hookRegistry.map((hook) => hook.key)),
  };
}

export const REGISTRY_SOURCES = SOURCES;
