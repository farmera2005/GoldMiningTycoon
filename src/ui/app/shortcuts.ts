// Keyboard shortcuts (DESIGN §13.15): the registry the `?` sheet and Help > Shortcuts render, and the global handler.
// Advance is deliberately `Ctrl+Enter`, never a bare key, so a week cannot be skipped by accident; Advance and quick
// save ignore key auto-repeat (one week, or one save, per deliberate press); every shortcut is off while focus is in a
// text field (Esc excepted, which the dialog or explain layer handles) and while a shell overlay is open. Shortcuts
// scoped to one widget (tables, the block grid, the map, the assignments board) are handled by that widget; the
// registry lists them so the sheet is complete.
import { useEffect } from 'react';
import type { RulesPhase } from '../../engine';
import type { EngineClient } from '../engine/engineClient';
import { useUiStore } from '../store/store';
import { NAV_MAP, goTargets } from './nav';
import { navigate } from './router';
import { UI_PHASE } from './routes';

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

export type ShortcutScope = 'global' | 'navigation' | 'numbers' | 'lists' | 'editors' | 'map';

export interface ShortcutDef {
  /** Key combinations as shown on the sheet; several entries are alternatives (`Ctrl+K` or `/`). */
  readonly keys: readonly string[];
  readonly action: string;
  readonly scope: ShortcutScope;
  readonly fromPhase: RulesPhase;
}

export const SHORTCUT_SCOPES: readonly { readonly scope: ShortcutScope; readonly label: string }[] = [
  { scope: 'global', label: 'Anywhere' },
  { scope: 'navigation', label: 'Go to' },
  { scope: 'numbers', label: 'Numbers' },
  { scope: 'lists', label: 'Tables and lists' },
  { scope: 'editors', label: 'Plan editor and boards' },
  { scope: 'map', label: 'Map' },
];

const GO_LATER: readonly ShortcutDef[] = [
  { keys: ['g p'], action: 'Permits & compliance', scope: 'navigation', fromPhase: 2 },
  { keys: ['g n'], action: 'News', scope: 'navigation', fromPhase: 5 },
];

/** Every shortcut of 13.15 with the phase it ships in; the sheet shows those of this build. */
export const SHORTCUTS: readonly ShortcutDef[] = [
  { keys: ['Ctrl+Enter'], action: 'Advance week', scope: 'global', fromPhase: 0 },
  { keys: ['Ctrl+Shift+Enter'], action: 'Run to next decision', scope: 'global', fromPhase: 1 },
  { keys: ['Esc'], action: 'Close popover or drawer; stop a run', scope: 'global', fromPhase: 0 },
  { keys: ['?'], action: 'Shortcut sheet', scope: 'global', fromPhase: 1 },
  { keys: ['Ctrl+K', '/'], action: 'Command palette', scope: 'global', fromPhase: 1 },
  { keys: ['Ctrl+S'], action: 'Quick save to the current slot', scope: 'global', fromPhase: 0 },
  { keys: ['Ctrl+Z'], action: 'Undo the last undoable action this week', scope: 'global', fromPhase: 0 },
  ...NAV_MAP.flatMap((g) =>
    g.items.flatMap((i): ShortcutDef[] =>
      i.goKey === undefined
        ? []
        : [{ keys: [`g ${i.goKey}`], action: i.label, scope: 'navigation', fromPhase: i.fromPhase }],
    ),
  ),
  ...GO_LATER,
  { keys: ['E', 'Enter'], action: 'Explain the focused number', scope: 'numbers', fromPhase: 0 },
  { keys: ['j', 'k'], action: 'Next / previous row or message', scope: 'lists', fromPhase: 1 },
  { keys: ['Enter'], action: 'Open the focused row', scope: 'lists', fromPhase: 1 },
  { keys: ['[', ']'], action: 'Previous / next claim (Operations, claim detail)', scope: 'lists', fromPhase: 1 },
  { keys: ['1–9'], action: 'Assign the selected card to a role (assignments board)', scope: 'editors', fromPhase: 1 },
  {
    keys: ['Alt+↑', 'Alt+↓'],
    action: 'Reorder (cut sequence, work orders, payment priority)',
    scope: 'editors',
    fromPhase: 1,
  },
  { keys: ['Arrows', 'Space'], action: 'Block grid: move focus; toggle selection', scope: 'editors', fromPhase: 1 },
  { keys: ['Alt+1–Alt+3'], action: 'Move a line-role card to plant line L1–L3', scope: 'editors', fromPhase: 3 },
  { keys: ['{', '}'], action: 'Previous / next plant line', scope: 'editors', fromPhase: 3 },
  { keys: ['+', '−', '0'], action: 'Map zoom in / out / fit', scope: 'map', fromPhase: 1 },
];

export function shortcutsForPhase(phase: RulesPhase = UI_PHASE): ShortcutDef[] {
  return SHORTCUTS.filter((s) => s.fromPhase <= phase);
}

/** How long the second key of a `g` sequence may wait. */
const SEQUENCE_MS = 1_500;

export interface ShortcutHandlers {
  readonly client: EngineClient;
  /** Ctrl+S with nowhere to save (no game, no current slot, Ironman): the Saves screen. */
  readonly onQuickSaveWithoutSlot: () => void;
  /** Ctrl+Shift+Enter: Run to next decision (13.9); absent until the run worker ships. */
  readonly onRunToNextDecision?: () => void;
}

function focusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function useGlobalShortcuts({ client, onQuickSaveWithoutSlot, onRunToNextDecision }: ShortcutHandlers): void {
  const store = useUiStore();
  useEffect(() => {
    const targets = goTargets();
    let gAt = Number.NEGATIVE_INFINITY;
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || isTextEntry(e.target)) return;
      // An open palette or shortcut sheet owns the keyboard until it closes.
      if (store.getState().overlay !== null) return;
      const mod = e.ctrlKey || e.metaKey;
      // Advance and quick save ignore key auto-repeat: one week (or one save) per deliberate press, so holding the
      // chord a moment too long cannot skip weeks and roll every autosave past the mistake (13.15).
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) onRunToNextDecision?.();
        else client.advance();
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
      if (mod && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        store.getState().openOverlay('palette', focusedElement());
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        store.getState().openOverlay('shortcuts', focusedElement());
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        store.getState().openOverlay('palette', focusedElement());
        return;
      }
      // `g` arms a sequence; the next key picks the screen (`g g` is Gold, so the second g completes, not re-arms).
      if (e.timeStamp - gAt <= SEQUENCE_MS) {
        gAt = Number.NEGATIVE_INFINITY;
        const route = targets.get(e.key);
        if (route !== undefined) {
          e.preventDefault();
          navigate(route);
        }
        return;
      }
      if (e.key === 'g') gAt = e.timeStamp;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [client, onQuickSaveWithoutSlot, onRunToNextDecision, store]);
}
