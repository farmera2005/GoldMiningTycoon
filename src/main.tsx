// Browser entry point. Builds the UI store, the save-slot store (IndexedDB, with the engine's save codec), the engine
// client, and mounts the app. Stored prefs are applied before the first render so the page never flashes the wrong
// theme (DESIGN §13.20).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { uiConfig } from './data/tuning/ui';
import { saveCodec } from './engine';
import { createIdbKv, createMemoryKv, createSaveStore, type KvStore } from './persistence';
import { App } from './ui/app/App';
import { downloadFile } from './ui/app/files';
import { createEngineClient } from './ui/engine/engineClient';
import { applyPrefs, browserPrefsStorage } from './ui/store/prefs';
import { createUiStore } from './ui/store/store';
import './ui/theme/index.css';

function saveKv(): KvStore {
  // Without IndexedDB (some private modes) saves live for the session only; export still works.
  return typeof indexedDB === 'undefined' ? createMemoryKv() : createIdbKv();
}

const store = createUiStore({
  storage: browserPrefsStorage(),
  // Below the design width the nav starts as the icon rail (13.19).
  navCollapsed: window.innerWidth < uiConfig['ui.layout.designWidthPx'],
});
applyPrefs(document.documentElement, store.getState().prefs);

const saves = createSaveStore({ kv: saveKv(), codec: saveCodec });
const client = createEngineClient({ store, saves });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App store={store} services={{ client, saves, download: downloadFile }} />
    </StrictMode>,
  );
}
