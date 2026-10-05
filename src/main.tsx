// Browser entry point. The UI shell (src/ui) mounts here.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <main>Gold Mining Tycoon</main>
    </StrictMode>,
  );
}
