// Global keyboard shortcuts (DESIGN §13.15). P0 has `Ctrl+Enter` Advance week (deliberately not a bare key, so a
// week is never skipped by accident), `Ctrl+S` quick save to the current slot, `Ctrl+Z` undo and `g d` Dashboard;
// `Esc` is the explain layer's. Shortcuts are off while focus is in a text field.
import { useEffect } from 'react';
import type { EngineClient } from '../engine/engineClient';
import { navigate } from './router';

/** True for an element that takes typed text, where single keys and Ctrl chords belong to the field. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'].includes(target.type);
  }
  return false;
}

/** How long the second key of a `g` sequence may wait. */
const SEQUENCE_MS = 1_500;

export interface ShortcutHandlers {
  readonly client: EngineClient;
  /** Ctrl+S with nowhere to save (no game, no current slot, Ironman): the Saves screen. */
  readonly onQuickSaveWithoutSlot: () => void;
}

export function useGlobalShortcuts({ client, onQuickSaveWithoutSlot }: ShortcutHandlers): void {
  useEffect(() => {
    let gAt = Number.NEGATIVE_INFINITY;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || isTextEntry(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      // Advance and quick save ignore key auto-repeat: one week (or one save) per deliberate press, so holding the
      // chord a moment too long cannot skip weeks and roll every autosave past the mistake (13.15).
      if (mod && !e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) client.advance();
        return;
      }
      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (e.repeat) return;
        // A failed write has already raised the critical toast (with Export now); only "nowhere to save" opens Saves.
        void client.quickSave().then((outcome) => {
          if (outcome.kind !== 'saved' && outcome.kind !== 'failed') onQuickSaveWithoutSlot();
        });
        return;
      }
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        client.undo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'g') {
        gAt = e.timeStamp;
        return;
      }
      if (e.key === 'd' && e.timeStamp - gAt <= SEQUENCE_MS) {
        gAt = Number.NEGATIVE_INFINITY;
        navigate({ name: 'dashboard' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [client, onQuickSaveWithoutSlot]);
}
