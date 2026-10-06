// Saves screen (DESIGN §13.16; 13.21 `ui/save`, `ui/load`, `ui/deleteSlot`, `ui/export`, `ui/import`). Slots come
// from the persistence store with the engine's codec; the slot table reads only `SaveFile.summary`. A failed import or
// load shows its typed error and changes nothing.
import { useCallback, useEffect, useId, useState, type DragEvent, type FormEvent } from 'react';
import type { Result, SlotMeta } from '../../../persistence';
import { readFileBytes } from '../../app/files';
import { useServices } from '../../app/services';
import { Button, MessageArea, Panel, ScreenTitle } from '../../components/primitives';
import { Num } from '../../explain/Num';
import { kilobytes, wallClock, yearWeek } from '../../format';
import { useUi } from '../../store/store';
import { errorText, noticeText } from './messages';

interface Feedback {
  readonly errors: readonly string[];
  readonly notices: readonly string[];
}

const NO_FEEDBACK: Feedback = { errors: [], notices: [] };

export function SavesScreen() {
  const { client, saves: store, download } = useServices();
  const hasGame = useUi((s) => s.game.state !== null);
  const ironman = useUi((s) => s.persisted.ironman);
  const companyName = useUi((s) => s.game.state?.company.name ?? '');
  const [slots, setSlots] = useState<readonly SlotMeta[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(NO_FEEDBACK);
  const [busy, setBusy] = useState(false);
  const [gzip, setGzip] = useState(true);

  const refresh = useCallback(async () => {
    const list = await store.list();
    setSlots(list);
  }, [store]);

  useEffect(() => {
    let live = true;
    void store.list().then((list) => {
      if (live) setSlots(list);
    });
    return () => {
      live = false;
    };
  }, [store]);

  /** Runs one store operation: shows its error, or its success notices, then re-reads the slot list. */
  const run = useCallback(
    async <T,>(op: () => Promise<Result<T>>, onOk: (value: T) => readonly string[]): Promise<void> => {
      setBusy(true);
      try {
        const result = await op();
        setFeedback(
          result.ok ? { errors: [], notices: onOk(result.value) } : { errors: [errorText(result.error)], notices: [] },
        );
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh],
  );

  const saveDisabledReason = !hasGame
    ? 'Start or load a game first.'
    : ironman
      ? 'Ironman games have no manual slots.'
      : null;

  const actions: SlotActions = {
    busy,
    saveDisabledReason,
    load: (slot) =>
      run(
        async (): Promise<Result<readonly string[]>> => {
          const loaded = await client.loadSlot(slot);
          return loaded.ok
            ? { ok: true, value: loaded.notices.map(noticeText) }
            : { ok: false, error: { code: 'SAVE_CORRUPT', message: loaded.message } };
        },
        (notices) => [`Loaded “${slot.slotName}”.`, ...notices],
      ),
    saveHere: (slot) =>
      run(
        () => client.saveToSlot({ slotId: slot.slotId }),
        (meta) => [`Saved to “${meta.slotName}”.`],
      ),
    rename: (slot, name) =>
      run(
        () => store.rename(slot.slotId, name),
        (meta) => [`Renamed to “${meta.slotName}”.`],
      ),
    remove: (slot) =>
      run(
        () => store.remove(slot.slotId),
        () => [`Deleted “${slot.slotName}”.`],
      ),
    exportSlot: (slot) =>
      run(
        () => store.exportSlot(slot.slotId, { gzip }),
        (file) => {
          download(file);
          return [`Exported ${file.fileName}.`];
        },
      ),
  };

  const importBytes = (bytes: Uint8Array | null, fileName: string): Promise<void> =>
    run(
      () =>
        bytes === null
          ? Promise.resolve<Result<never>>({
              ok: false,
              error: { code: 'SAVE_CORRUPT', message: 'The file could not be read.' },
            })
          : store.importFile(bytes),
      (imported) => [`Imported ${fileName} as “${imported.meta.slotName}”.`, ...imported.notices.map(noticeText)],
    );

  const importFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    let bytes: Uint8Array | null = null;
    try {
      bytes = await readFileBytes(file);
    } catch {
      bytes = null;
    }
    await importBytes(bytes, file.name);
  };

  const manual = (slots ?? []).filter((s) => s.kind === 'manual');
  const autos = (slots ?? []).filter((s) => s.kind !== 'manual');

  return (
    <div>
      <ScreenTitle title="Saves" />
      <MessageArea errors={feedback.errors} notices={feedback.notices} />

      <Panel title="Save current game" id="save-current">
        <SaveCurrentForm
          disabledReason={saveDisabledReason}
          busy={busy}
          defaultName={companyName}
          onSave={(slotName) => {
            void run(
              () => client.saveToSlot({ slotName }),
              (meta) => [`Saved to “${meta.slotName}”.`],
            );
          }}
        />
      </Panel>

      <Panel title="Saved games" id="slots">
        {slots === null ? (
          <p className="text-14 text-ink-2">Reading saves{'…'}</p>
        ) : manual.length === 0 ? (
          <p className="text-14 text-ink-2">No saved games yet.</p>
        ) : (
          <SlotTable caption="Saved games" slots={manual} actions={actions} manual />
        )}
      </Panel>

      <Panel title="Autosaves" id="autosaves">
        {slots === null ? null : autos.length === 0 ? (
          <p className="text-14 text-ink-2">Autosaves appear after the first week is played.</p>
        ) : (
          <SlotTable caption="Autosaves" slots={autos} actions={actions} manual={false} />
        )}
      </Panel>

      <Panel title="Import and export" id="import-export">
        <ImportControls busy={busy} onFile={(f) => void importFile(f)} />
        <label className="mt-4 flex items-center gap-2 text-14 text-ink-1">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={gzip}
            onChange={(e) => setGzip(e.currentTarget.checked)}
          />
          Compress exports (.gmt.json.gz)
        </label>
      </Panel>
    </div>
  );
}

interface SlotActions {
  readonly busy: boolean;
  readonly saveDisabledReason: string | null;
  load(slot: SlotMeta): Promise<void>;
  saveHere(slot: SlotMeta): Promise<void>;
  rename(slot: SlotMeta, name: string): Promise<void>;
  remove(slot: SlotMeta): Promise<void>;
  exportSlot(slot: SlotMeta): Promise<void>;
}

function kindLabel(slot: SlotMeta): string {
  if (slot.kind === 'yearly') return 'Year start';
  if (slot.kind === 'autosave') return 'Autosave';
  return 'Manual';
}

function SlotTable({
  caption,
  slots,
  actions,
  manual,
}: {
  caption: string;
  slots: readonly SlotMeta[];
  actions: SlotActions;
  manual: boolean;
}) {
  return (
    // Tables scroll inside their card below 1280 px (13.19); a focusable region keeps that scroll keyboard-reachable.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption} table`}>
      <table className="w-full border-collapse text-13">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-hairline text-left text-12 text-ink-2">
            <th scope="col" className="px-2 py-1 font-semibold">
              {manual ? 'Slot' : 'Kind'}
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              Company
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              In-game date
            </th>
            <th scope="col" className="px-2 py-1 text-right font-semibold">
              Cash (USD)
            </th>
            <th scope="col" className="px-2 py-1 text-right font-semibold">
              Net worth (USD)
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              Saved at
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              Rules
            </th>
            <th scope="col" className="px-2 py-1 text-right font-semibold">
              Size
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              Status
            </th>
            <th scope="col" className="px-2 py-1 font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <SlotRow key={slot.slotId} slot={slot} actions={actions} manual={manual} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowMode = { readonly kind: 'idle' } | { readonly kind: 'renaming' } | { readonly kind: 'confirmDelete' };

function SlotRow({ slot, actions, manual }: { slot: SlotMeta; actions: SlotActions; manual: boolean }) {
  const [mode, setMode] = useState<RowMode>({ kind: 'idle' });
  const [name, setName] = useState(slot.slotName);
  const inputId = useId();
  const ended = slot.status === 'ended';
  const saveHereReason = actions.saveDisabledReason ?? (ended ? 'This run has ended; its save is read-only.' : null);

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') return;
    setMode({ kind: 'idle' });
    void actions.rename(slot, trimmed);
  };

  return (
    <tr className="border-b border-hairline align-middle" style={{ height: 'var(--row-h)' }}>
      <th scope="row" className="px-2 py-1 text-left font-medium text-ink-1">
        {manual ? slot.slotName : `${kindLabel(slot)} · ${slot.slotName}`}
      </th>
      <td className="px-2 py-1 text-ink-1">{slot.summary.company}</td>
      <td className="px-2 py-1 text-ink-1">{yearWeek(slot.summary.year, slot.summary.week)}</td>
      <td className="px-2 py-1 text-right text-ink-1">
        <Num value={slot.summary.cash} unit="cents" explain={null} exempt="saveSummary" />
      </td>
      <td className="px-2 py-1 text-right text-ink-1">
        <Num value={slot.summary.netWorth} unit="cents" explain={null} exempt="saveSummary" />
      </td>
      <td className="px-2 py-1 text-ink-2">{wallClock(slot.savedAt)}</td>
      <td className="px-2 py-1 text-ink-2" data-code="">
        {slot.rulesVersion}
      </td>
      <td className="px-2 py-1 text-right text-ink-2">{kilobytes(slot.sizeBytes)}</td>
      <td className="px-2 py-1 text-ink-2">{ended ? 'Ended (read-only)' : 'Active'}</td>
      <td className="px-2 py-1">
        {mode.kind === 'renaming' ? (
          <form className="flex items-center gap-2" onSubmit={submitRename}>
            <label htmlFor={inputId} className="sr-only">
              New name for {slot.slotName}
            </label>
            <input
              id={inputId}
              className="h-8 rounded-control border border-border-control bg-surface-2 px-2 text-13 text-ink-1"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Button type="submit" variant="primary" disabled={actions.busy || name.trim() === ''}>
              Rename
            </Button>
            <Button onClick={() => setMode({ kind: 'idle' })}>Cancel</Button>
          </form>
        ) : mode.kind === 'confirmDelete' ? (
          <div className="flex items-center gap-2">
            <span className="text-13 text-ink-1">
              Delete {'“'}
              {slot.slotName}
              {'”'}?
            </span>
            <Button
              variant="primary"
              disabled={actions.busy}
              onClick={() => {
                setMode({ kind: 'idle' });
                void actions.remove(slot);
              }}
            >
              Delete
            </Button>
            <Button onClick={() => setMode({ kind: 'idle' })}>Cancel</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label={`Load ${slot.slotName}`}
              disabled={actions.busy}
              onClick={() => void actions.load(slot)}
            >
              Load
            </Button>
            {manual ? (
              <>
                <Button
                  aria-label={`Save here: ${slot.slotName}`}
                  disabled={actions.busy || saveHereReason !== null}
                  title={saveHereReason ?? undefined}
                  onClick={() => void actions.saveHere(slot)}
                >
                  Save here
                </Button>
                <Button
                  aria-label={`Rename ${slot.slotName}`}
                  disabled={actions.busy}
                  onClick={() => {
                    setName(slot.slotName);
                    setMode({ kind: 'renaming' });
                  }}
                >
                  Rename
                </Button>
                <Button
                  aria-label={`Delete ${slot.slotName}`}
                  disabled={actions.busy}
                  onClick={() => setMode({ kind: 'confirmDelete' })}
                >
                  Delete
                </Button>
              </>
            ) : null}
            <Button
              aria-label={`Export ${slot.slotName}`}
              disabled={actions.busy}
              onClick={() => void actions.exportSlot(slot)}
            >
              Export
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function SaveCurrentForm({
  disabledReason,
  busy,
  defaultName,
  onSave,
}: {
  disabledReason: string | null;
  busy: boolean;
  defaultName: string;
  onSave: (slotName: string) => void;
}) {
  const [name, setName] = useState('');
  const inputId = useId();
  const reasonId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(name.trim() === '' ? defaultName : name.trim());
    setName('');
  };
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-13 text-ink-2">
          Slot name
        </label>
        <input
          id={inputId}
          className="h-8 w-72 rounded-control border border-border-control bg-surface-2 px-2 text-14 text-ink-1"
          value={name}
          placeholder={defaultName}
          maxLength={80}
          disabled={disabledReason !== null}
          aria-describedby={disabledReason === null ? undefined : reasonId}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </div>
      <Button type="submit" variant="primary" disabled={busy || disabledReason !== null}>
        Save to new slot
      </Button>
      {disabledReason === null ? null : (
        <p id={reasonId} className="w-full text-13 text-ink-2">
          {disabledReason}
        </p>
      )}
    </form>
  );
}

function ImportControls({ busy, onFile }: { busy: boolean; onFile: (file: File | undefined) => void }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  };
  return (
    <div
      className={`rounded-card border border-dashed p-4 ${dragging ? 'border-accent bg-surface-2' : 'border-border-control'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <label htmlFor={inputId} className="block text-14 text-ink-1">
        Import a save file (.gmt.json or .gmt.json.gz), or drop it here
      </label>
      <input
        id={inputId}
        type="file"
        accept=".json,.gz,application/json,application/gzip"
        className="mt-2 text-13 text-ink-1"
        disabled={busy}
        onChange={(e) => {
          onFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
