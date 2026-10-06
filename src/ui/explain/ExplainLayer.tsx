// Mount point for the explain surfaces (DESIGN §13.13): the popover and the drawer, plus `Esc` from anywhere on the
// page (13.15: Esc closes the popover, then the drawer).
import { useEffect } from 'react';
import { useUiStore } from '../store/store';
import { ExplainDrawer } from './ExplainDrawer';
import { ExplainPopover } from './ExplainPopover';

export function ExplainLayer() {
  const store = useUiStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const { explain, closePopover, closeDrawer } = store.getState();
      if (explain.popover !== null) {
        closePopover();
        explain.popover.anchor?.focus();
      } else if (explain.stack.length > 0) {
        closeDrawer();
        explain.drawerReturnFocus?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [store]);
  return (
    <>
      <ExplainDrawer />
      <ExplainPopover />
    </>
  );
}
