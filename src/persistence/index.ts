// Browser persistence (DESIGN §2.9, §13.16): save slots, autosaves, export and import. Browser-only; the engine never
// imports it, and it never imports the engine (the SaveCodec carries the engine's schema version and migrations).
export { createMemoryKv, type KvStore, type MemoryKv } from './kv';
export { createIdbKv, SAVE_DB_NAME, SAVE_STORE_NAME } from './idbKv';
export {
  SAVE_FORMAT,
  decodeSaveText,
  exportSave,
  exportSaveText,
  fileStem,
  isGzip,
  readSave,
  serializeSave,
  type ExportOptions,
  type ExportedFile,
  type LoadedSave,
  type MigrationOutcome,
  type Result,
  type SaveCodec,
  type SaveEnvelope,
  type SaveError,
  type SaveErrorCode,
  type SaveNotice,
  type SaveSummary,
  type VersionedSave,
} from './saveFile';
export {
  autosaveSlotId,
  createSaveStore,
  yearlySlotId,
  type AutosaveTarget,
  type ImportedSlot,
  type RunStatus,
  type SaveStore,
  type SaveStoreOptions,
  type SaveTarget,
  type SlotKind,
  type SlotMeta,
} from './saveStore';
