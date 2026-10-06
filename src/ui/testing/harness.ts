// Test harness for UI tests (imported by *.test.ts(x) only; nothing in the app imports it, so it never reaches a
// bundle). It wires the real store, engine client and save store over a memory KV, with an idle scheduler and a
// wall clock the test controls.
import { defaultNewGameSetup, newGame, saveCodec, toSaveFile, type GameState } from '../../engine';
import {
  createMemoryKv,
  createSaveStore,
  type KvStore,
  type MemoryKv,
  type SaveCodec,
  type SaveStore,
} from '../../persistence';
import type { AppServices } from '../app/services';
import type { DownloadableFile } from '../app/files';
import { createEngineClient, type EngineClient } from '../engine/engineClient';
import { createUiStore, type UiStore } from '../store/store';
import type { PrefsStorage } from '../store/prefs';

export function memoryPrefs(initial: Record<string, string> = {}): PrefsStorage & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (k) => (Object.hasOwn(data, k) ? (data[k] ?? null) : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

/** An idle scheduler the test drains by hand (`flush`) or drops (`drop`). */
export interface ManualScheduler {
  readonly schedule: (task: () => void) => void;
  readonly pending: () => number;
  /** Runs every queued task. */
  flush(): void;
  /** Discards every queued task. */
  drop(): void;
}

export function manualScheduler(): ManualScheduler {
  let queue: (() => void)[] = [];
  return {
    schedule: (task) => {
      queue.push(task);
    },
    pending: () => queue.length,
    flush() {
      const tasks = queue;
      queue = [];
      for (const task of tasks) task();
    },
    drop() {
      queue = [];
    },
  };
}

export type KvOperation = 'get' | 'keys' | 'setMany' | 'delMany';

export interface FaultyKv {
  readonly kv: KvStore;
  /** The data underneath, for asserting that a failed operation changed nothing. */
  readonly memory: MemoryKv;
  /** Operations to reject, as IndexedDB does when blocked, evicted, closed or full; switch them on and off live. */
  readonly broken: Record<KvOperation, boolean>;
  /** Breaks (or repairs) every operation at once. */
  breakAll(on?: boolean): void;
}

/** A memory KV whose operations can be made to reject with a browser-like storage error. */
export function faultyKv(message = 'Internal error opening backing store'): FaultyKv {
  const memory = createMemoryKv();
  const broken: Record<KvOperation, boolean> = { get: false, keys: false, setMany: false, delMany: false };
  const refuse = (): Promise<never> => Promise.reject(new DOMException(message, 'UnknownError'));
  return {
    memory,
    broken,
    kv: {
      get: (k) => (broken.get ? refuse() : memory.get(k)),
      keys: () => (broken.keys ? refuse() : memory.keys()),
      setMany: (e) => (broken.setMany ? refuse() : memory.setMany(e)),
      delMany: (k) => (broken.delMany ? refuse() : memory.delMany(k)),
    },
    breakAll(on = true) {
      broken.get = on;
      broken.keys = on;
      broken.setMany = on;
      broken.delMany = on;
    },
  };
}

export interface Harness {
  readonly store: UiStore;
  readonly kv: MemoryKv | KvStore;
  readonly saves: SaveStore;
  readonly client: EngineClient;
  readonly idle: ManualScheduler;
  readonly downloads: DownloadableFile[];
  readonly services: AppServices;
  /** Advances the fake wall clock by `minutes` (savedAt stamps). */
  tick(minutes?: number): void;
}

export interface HarnessOptions {
  readonly kv?: MemoryKv | KvStore;
  readonly codec?: SaveCodec;
  readonly rotatingSlots?: number;
  readonly yearlyKeep?: number;
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const store = createUiStore({ storage: memoryPrefs() });
  const kv = options.kv ?? createMemoryKv();
  let clock = Date.UTC(2026, 9, 6, 12, 0);
  const now = (): string => new Date(clock).toISOString();
  const saves = createSaveStore({
    kv,
    codec: options.codec ?? saveCodec,
    now,
    ...(options.rotatingSlots === undefined ? {} : { rotatingSlots: options.rotatingSlots }),
    ...(options.yearlyKeep === undefined ? {} : { yearlyKeep: options.yearlyKeep }),
  });
  const idle = manualScheduler();
  const client = createEngineClient({ store, saves, now, scheduleIdle: idle.schedule });
  const downloads: DownloadableFile[] = [];
  return {
    store,
    kv,
    saves,
    client,
    idle,
    downloads,
    services: { client, saves, download: (f) => downloads.push(f) },
    tick(minutes = 1) {
      clock += minutes * 60_000;
    },
  };
}

const starts: Record<string, GameState> = {};

/** A new game's turn-0 state, built once per (seed, company) per test file: world generation can be slow (§3). */
export function freshState(seed = 'ui-test', companyName = 'Ruby Creek Placers'): GameState {
  const key = `${seed}|${companyName}`;
  starts[key] ??= newGame(defaultNewGameSetup({ companyName }), seed);
  return starts[key];
}

/** Loads `state` into the client as if from a save (no world generation). */
export function loadState(client: EngineClient, state: GameState = freshState()): void {
  client.load(toSaveFile(state, { slotName: state.company.name, savedAt: '2026-10-06T12:00:00.000Z' }));
}
