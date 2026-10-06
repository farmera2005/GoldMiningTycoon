// The `?` shortcut sheet (DESIGN §13.15): every shortcut this build ships, grouped by where it works. Help >
// Shortcuts renders the same table (ShortcutTable).
import { Modal } from '../components/Modal';
import { Button } from '../components/primitives';
import { useUi, useUiStore } from '../store/store';
import { SHORTCUT_SCOPES, shortcutsForPhase } from './shortcuts';

/** Every shortcut of this build in one table per scope; keys in `<kbd>`, alternatives separated by "or". */
export function ShortcutTable() {
  const all = shortcutsForPhase();
  return (
    <div className="grid gap-4" data-shortcut-table="">
      {SHORTCUT_SCOPES.map(({ scope, label }) => {
        const rows = all.filter((s) => s.scope === scope);
        if (rows.length === 0) return null;
        return (
          <table key={scope} className="w-full border-collapse text-13">
            <caption className="pb-1 text-left text-13 font-semibold text-ink-1">{label}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Keys</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.keys.join('|')}:${s.action}`} className="border-t border-hairline">
                  <td className="w-48 py-1 pr-3 align-top whitespace-nowrap">
                    {s.keys.map((k, i) => (
                      <span key={k}>
                        {i > 0 ? <span className="px-1 text-ink-3">or</span> : null}
                        <kbd className="rounded-control border border-border-control bg-surface-1 px-1 font-sans text-12 text-ink-1">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </td>
                  <td className="py-1 text-ink-1">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

export function ShortcutSheet() {
  const overlay = useUi((s) => s.overlay);
  const store = useUiStore();
  if (overlay?.kind !== 'shortcuts') return null;
  const close = (): void => store.getState().closeOverlay();
  return (
    <Modal
      title="Keyboard shortcuts"
      onClose={close}
      returnFocus={overlay.returnFocus}
      width={640}
      id="shortcuts"
      description="Shortcuts are off while you type in a field, except Esc."
      footer={<Button onClick={close}>Close</Button>}
    >
      {/* Focusable, so the scrolled list can be read by keyboard (WCAG 2.1.1 scrollable regions). */}
      <div className="max-h-[60vh] overflow-y-auto" tabIndex={0} role="region" aria-label="Shortcut list">
        <ShortcutTable />
      </div>
    </Modal>
  );
}
