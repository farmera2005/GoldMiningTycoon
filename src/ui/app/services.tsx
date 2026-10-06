// The app's services, shared through context so screens never construct them: the engine client (the only path to
// the engine and the game slice, 13.18), the save-slot store (src/persistence) and the file download (injectable,
// so tests can capture exports).
import { createContext, useContext, type ReactNode } from 'react';
import type { SaveStore } from '../../persistence';
import type { EngineClient } from '../engine/engineClient';
import type { DownloadableFile } from './files';

export interface AppServices {
  readonly client: EngineClient;
  readonly saves: SaveStore;
  /** Hands an export to the browser as a download (13.16). */
  readonly download: (file: DownloadableFile) => void;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
