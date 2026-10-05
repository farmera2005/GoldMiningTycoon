// Type declarations for registry.js.

export interface Registries {
  /** Registered RNG stream names (engine/core/streams.ts STREAMS keys), sorted. */
  streams: string[];
  /** Registered id prefixes (engine/core/ids.ts ID_PREFIXES keys), sorted. */
  idPrefixes: string[];
  /** Registered effect-hook keys (data/events/hooks.ts hookRegistry), sorted. */
  hookKeys: string[];
}

export function loadRegistries(): Promise<Registries>;

export const REGISTRY_SOURCES: { readonly streams: string; readonly idPrefixes: string; readonly hookKeys: string };
