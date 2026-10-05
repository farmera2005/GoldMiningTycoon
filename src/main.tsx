// Browser entry point. Mounts the UI shell with the P0 placeholder game (src/ui/app/stubGame.tsx), which the engine
// client replaces once the engine API lands. Stored prefs are applied before the first render so the page never
// flashes the wrong theme (DESIGN §13.20).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createIdbKv, createMemoryKv, createSaveStore, type KvStore } from './persistence';
import { StubGameApp, stubCodec } from './ui/app/stubGame';
import { applyPrefs, browserPrefsStorage } from './ui/store/prefs';
import { createUiStore } from './ui/store/store';
import { uiConfig } from './data/tuning/ui';
import './ui/theme/index.css';

function saveKv(): KvStore {
  // Without IndexedDB (some private modes) saves live for the session only; export still works.
  return typeof indexedDB === 'undefined' ? createMemoryKv() : createIdbKv();
}

const uiStore = createUiStore({
  storage: browserPrefsStorage(),
  // Below the design width the nav starts as the icon rail (13.19).
  navCollapsed: window.innerWidth < uiConfig['ui.layout.designWidthPx'],
});
applyPrefs(document.documentElement, uiStore.getState().prefs);

const saveStore = createSaveStore({ kv: saveKv(), codec: stubCodec });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StubGameApp uiStore={uiStore} saveStore={saveStore} />
    </StrictMode>,
  );
}
