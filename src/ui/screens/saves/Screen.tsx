// Saves screen (DESIGN §13.16; 13.21 `ui/save`, `ui/load`, `ui/deleteSlot`, `ui/export`, `ui/import`). Slots come
// from the persistence store with the engine's codec; the slot table reads only `SaveFile.summary`. A failed
// operation (a refused file, a missing slot, or browser storage that cannot be read or written) shows its typed error
// and changes nothing; the screen never stays busy after one.
//
// Keyboard focus (13.19) never drops to <body>: while an operation runs the row controls stay focusable but inert
// (`aria-disabled`), Rename and Delete move focus into their input or confirmation and back to their trigger, and
// after a slot is deleted focus moves to the next row (or the list itself when it is empty).
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
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

function unexpected(e: unknown): string {
  return errorText({
    code: 'SAVE_WRITE_FAILED',
    message: `The operation failed (${e instanceof Error ? e.message : String(e)}).`,
  });
}

/** Which slot list a slot appears in. */
type ListKind = 'manual' | 'autos';

const listOf = (slot: SlotMeta): ListKind => (slot.kind === 'manual' ? 'manual' : 'autos');

/**
 * A button that is unavailable while an operation runs but keeps keyboard focus (13.19): `aria-disabled` and an
 * ignored click, not `disabled`, which would drop focus to <body> under the player's fingers.
 */
function BusyButton({ busy, onClick, ...rest }: ComponentPropsWithRef<typeof Button> & { readonly busy: boolean }) {
  return (
    <Button
      {...rest}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (!busy) onClick?.(e);
      }}
    />
  );
}

export function SavesScreen() {
  const { client, saves: store, download } = useServices();
  const hasGame = useUi((s) => s.game.state !== null);
  const ironman = useUi((s) => s.persisted.ironman);
  const companyName = useUi((s) => s.game.state?.company.name ?? '');
  const [slots, setSlots] = useState<readonly SlotMeta[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(NO_FEEDBACK);
  const [pending, setPending] = useState(0);
  const busy = pending > 0;
  const [gzip, setGzip] = useState(true);
  const manualListRef = useRef<HTMLDivElement>(null);
  const autosListRef = useRef<HTMLDivElement>(null);
  /** Where focus goes once a delete has finished and the list has been re-read. */
  const focusAfterDelete = useRef<{ readonly list: ListKind; readonly index: number } | null>(null);

  /** Re-reads the slot list: null on success, or the error to show (the last list stays on screen). */
  const refresh = useCallback(async (): Promise<string | null> => {
    const listed = await store.list();
    if (listed.ok) {
      setSlots(listed.value);
      setListFailed(false);
      return null;
    }
    setSlots((s) => s ?? []);
    setListFailed(true);
    return errorText(listed.error);
  }, [store]);

  useEffect(() => {
    let live = true;
    void store.list().then((listed) => {
      if (!live) return;
      if (listed.ok) {
        setSlots(listed.value);
      } else {
        setSlots([]);
        setListFailed(true);
        setFeedback({ errors: [errorText(listed.error)], notices: [] });
      }
    });
    return () => {
      live = false;
    };
  }, [store]);

  // After a delete, focus the row that took the deleted one's place (or the one before it), else the list itself.
  useEffect(() => {
    const target = focusAfterDelete.current;
    if (busy || target === null) return;
    focusAfterDelete.current = null;
    const container = (target.list === 'manual' ? manualListRef : autosListRef).current;
    const rows = container?.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const row = rows === undefined ? undefined : rows[Math.min(target.index, rows.length - 1)];
    (row?.querySelector<HTMLElement>('button') ?? container)?.focus();
  }, [busy, slots]);

  /**
   * Runs one store operation: shows its error, or its success notices, then re-reads the slot list. Whatever happens
   * (a failed Result, a rejection, a failed re-read) the error is shown and the screen leaves its busy state.
   */
  const run = useCallback(
    async <T,>(op: () => Promise<Result<T>>, onOk: (value: T) => readonly string[]): Promise<void> => {
      setPending((n) => n + 1);
      let next: Feedback;
      try {
        const result = await op();
        next = result.ok
          ? { errors: [], notices: onOk(result.value) }
          : { errors: [errorText(result.error)], notices: [] };
      } catch (e) {
        next = { errors: [unexpected(e)], notices: [] };
      }
      try {
        const listError = await refresh();
        if (listError !== null && !next.errors.includes(listError)) {
          next = { ...next, errors: [...next.errors, listError] };
        }
      } catch (e) {
        next = { ...next, errors: [...next.errors, unexpected(e)] };
      } finally {
        setFeedback(next);
        setPending((n) => n - 1);
      }
    },
    [refresh],
  );

  const saveDisabledReason = !hasGame
    ? 'Start or load a game first.'
    : ironman
      ? 'Ironman games have no manual slots.'
      : null;

  const all = slots ?? [];
  const actions: SlotActions = {
    busy,
    saveDisabledReason,
    load: (slot) =>
      run(
        async (): Promise<Result<readonly string[]>> => {
          const loaded = await client.loadSlot(slot);
          return loaded.ok ? { ok: true, value: loaded.notices.map(noticeText) } : loaded;
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
    remove: (slot) => {
      const list = listOf(slot);
      // The confirmation that had focus is about to go: hold focus on the list until the next row can take it.
      (list === 'manual' ? manualListRef : autosListRef).current?.focus();
      focusAfterDelete.current = { list, index: all.filter((s) => listOf(s) === list).indexOf(slot) };
      return run(
        () => store.remove(slot.slotId),
        () => [`Deleted “${slot.slotName}”.`],
      );
    },
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

  const manual = all.filter((s) => s.kind === 'manual');
  const autos = all.filter((s) => s.kind !== 'manual');

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
        <SlotList listRef={manualListRef} label="Saved games list">
          {slots === null ? (
            <p className="text-14 text-ink-2">Reading saves{'…'}</p>
          ) : manual.length === 0 ? (
            <p className="text-14 text-ink-2">
              {listFailed ? 'Saved games could not be read.' : 'No saved games yet.'}
            </p>
          ) : (
            <SlotTable caption="Saved games" slots={manual} actions={actions} manual />
          )}
        </SlotList>
      </Panel>

      <Panel title="Autosaves" id="autosaves">
        <SlotList listRef={autosListRef} label="Autosaves list">
          {slots === null ? null : autos.length === 0 ? (
            <p className="text-14 text-ink-2">
              {listFailed ? 'Autosaves could not be read.' : 'Autosaves appear after the first week is played.'}
            </p>
          ) : (
            <SlotTable caption="Autosaves" slots={autos} actions={actions} manual={false} />
          )}
        </SlotList>
      </Panel>

      <Panel title="Import and export" id="import-export">
        <ImportControls onFile={(f) => void importFile(f)} />
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

/** The focus target that holds a slot list: focusable by script only, so focus has somewhere to go after a delete. */
function SlotList({
  listRef,
  label,
  children,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div ref={listRef} tabIndex={-1} role="group" aria-label={label} data-slot-list="">
      {children}
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
  const renameRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  /** The trigger that takes focus back when the row returns to idle; null on first render and after a delete. */
  const returnTo = useRef<'rename' | 'delete' | null>(null);
  const { busy } = actions;

  useEffect(() => {
    if (mode.kind === 'renaming') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (mode.kind === 'confirmDelete') {
      // The safe choice of a destructive confirmation takes focus.
      keepRef.current?.focus();
    } else if (returnTo.current !== null) {
      (returnTo.current === 'rename' ? renameRef : deleteRef).current?.focus();
      returnTo.current = null;
    }
  }, [mode.kind]);

  const startRename = (): void => {
    setName(slot.slotName);
    returnTo.current = 'rename';
    setMode({ kind: 'renaming' });
  };
  const startDelete = (): void => {
    returnTo.current = 'delete';
    setMode({ kind: 'confirmDelete' });
  };
  const cancel = (): void => setMode({ kind: 'idle' });
  const cancelOnEscape = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
  };

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '' || busy) return;
    setMode({ kind: 'idle' });
    void actions.rename(slot, trimmed);
  };

  const confirmDelete = (): void => {
    // Focus goes to the list (then the next row), not back to this row's trigger: the row is about to go.
    returnTo.current = null;
    void actions.remove(slot);
    setMode({ kind: 'idle' });
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
          <form className="flex items-center gap-2" onSubmit={submitRename} onKeyDown={cancelOnEscape}>
            <label htmlFor={inputId} className="sr-only">
              New name for {slot.slotName}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              className="h-8 rounded-control border border-border-control bg-surface-2 px-2 text-13 text-ink-1"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Button type="submit" variant="primary" disabled={name.trim() === ''} aria-disabled={busy || undefined}>
              Rename
            </Button>
            <Button onClick={cancel}>Cancel</Button>
          </form>
        ) : mode.kind === 'confirmDelete' ? (
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label={`Delete ${slot.slotName}?`}
            onKeyDown={cancelOnEscape}
          >
            <span className="text-13 text-ink-1">
              Delete {'“'}
              {slot.slotName}
              {'”'}?
            </span>
            <BusyButton variant="primary" busy={busy} onClick={confirmDelete}>
              Delete
            </BusyButton>
            <Button ref={keepRef} onClick={cancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <BusyButton aria-label={`Load ${slot.slotName}`} busy={busy} onClick={() => void actions.load(slot)}>
              Load
            </BusyButton>
            {manual ? (
              <>
                <BusyButton
                  aria-label={`Save here: ${slot.slotName}`}
                  disabled={saveHereReason !== null}
                  title={saveHereReason ?? undefined}
                  busy={busy}
                  onClick={() => void actions.saveHere(slot)}
                >
                  Save here
                </BusyButton>
                <BusyButton ref={renameRef} aria-label={`Rename ${slot.slotName}`} busy={busy} onClick={startRename}>
                  Rename
                </BusyButton>
              </>
            ) : null}
            {/* Autosaves can be deleted too: they are kept per game (13.16), so this is how a player clears a game. */}
            <BusyButton ref={deleteRef} aria-label={`Delete ${slot.slotName}`} busy={busy} onClick={startDelete}>
              Delete
            </BusyButton>
            <BusyButton
              aria-label={`Export ${slot.slotName}`}
              busy={busy}
              onClick={() => void actions.exportSlot(slot)}
            >
              Export
            </BusyButton>
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
    if (busy || disabledReason !== null) return;
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
      <Button type="submit" variant="primary" disabled={disabledReason !== null} aria-disabled={busy || undefined}>
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

function ImportControls({ onFile }: { onFile: (file: File | undefined) => void }) {
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
      {/* Never disabled while another operation runs: imports queue behind it in the store, and the picker keeps focus. */}
      <input
        id={inputId}
        type="file"
        accept=".json,.gz,application/json,application/gzip"
        className="mt-2 text-13 text-ink-1"
        onChange={(e) => {
          onFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
