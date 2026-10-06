// The command palette (DESIGN §13.1, §13.15; `Ctrl+K` or `/`): a modal combobox over screens, verbs and entities
// (palette.ts). Arrow keys move the active option, Enter opens it, Esc closes and returns focus. It navigates only;
// it never dispatches an engine action (D-13.96, T24).
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Modal } from '../components/Modal';
import { SearchIcon } from '../components/icons';
import { useUi, useUiStore } from '../store/store';
import { entityItems, paletteEntities, screenItems, searchPalette, verbItems, type PaletteItem } from './palette';
import { navigate } from './router';

const KIND_LABEL: Readonly<Record<PaletteItem['kind'], string>> = {
  screen: 'Screen',
  verb: 'Action',
  entity: 'Item',
};

export function CommandPalette() {
  const overlay = useUi((s) => s.overlay);
  if (overlay?.kind !== 'palette') return null;
  return <PaletteDialog returnFocus={overlay.returnFocus} />;
}

function PaletteDialog({ returnFocus }: { returnFocus: HTMLElement | null }) {
  const store = useUiStore();
  const state = useUi((s) => s.game.state);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number): string => `${listId}-opt-${i}`;

  const items = useMemo(() => [...screenItems(), ...verbItems(), ...entityItems(paletteEntities(state))], [state]);
  const results = useMemo(() => searchPalette(query, items), [query, items]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const close = (): void => store.getState().closeOverlay();
  const open = (item: PaletteItem): void => {
    close();
    navigate(item.route);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(results.length === 0 ? 0 : (activeIndex + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(results.length === 0 ? 0 : (activeIndex - 1 + results.length) % results.length);
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(Math.max(0, results.length - 1));
        break;
      case 'Enter': {
        // A chord (Ctrl+Enter is Advance elsewhere) does nothing here: the palette never acts on the game.
        if (e.ctrlKey || e.metaKey || e.altKey) {
          e.preventDefault();
          break;
        }
        e.preventDefault();
        const item = results[activeIndex];
        if (item !== undefined) open(item);
        break;
      }
    }
  };

  return (
    <Modal
      title="Command palette"
      onClose={close}
      initialFocus={inputRef}
      returnFocus={returnFocus}
      width={560}
      id="palette"
    >
      <div className="mb-2 flex items-center gap-2 rounded-control border border-border-control bg-surface-1 px-2">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search screens, actions and items"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length === 0 ? undefined : optionId(activeIndex)}
          autoComplete="off"
          spellCheck={false}
          className="h-9 min-w-0 flex-1 bg-transparent text-14 text-ink-1 outline-none"
          placeholder="Go to… (a screen, an action like “Sell gold”, a claim or an id)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[360px] overflow-y-auto">
        {results.map((item, i) => (
          <li
            key={item.key}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-control px-2 py-1.5 text-14 ${i === activeIndex ? 'bg-surface-1 outline outline-1 outline-accent' : ''}`}
            onMouseMove={() => setActive(i)}
            onClick={() => open(item)}
          >
            <span className="min-w-0 truncate text-ink-1">{item.label}</span>
            <span className="shrink-0 text-12 text-ink-3">
              {item.detail} · {KIND_LABEL[item.kind]}
            </span>
          </li>
        ))}
      </ul>
      {results.length === 0 ? (
        <p role="status" className="px-2 py-1.5 text-13 text-ink-2">
          Nothing matches “{query}”.
        </p>
      ) : (
        <p className="sr-only" role="status">
          {results.length} results
        </p>
      )}
    </Modal>
  );
}
