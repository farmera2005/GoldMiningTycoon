// Toasts (DESIGN §13.10 toast rules, D-13.22): critical and blocking messages plus action confirmations; critical
// toasts never auto-dismiss. P0 raises one: a failed autosave, with `Export now` so no progress is lost (13.16).
// Toasts sit on a flat surface (never grain, 13.20).
import { CriticalIcon } from '../components/icons';
import { Button } from '../components/primitives';
import { useUi, useUiStore, type Toast } from '../store/store';
import { useServices } from './services';

function StatusChipCritical() {
  return (
    <span
      data-status-chip="critical"
      className="inline-flex items-center gap-1 rounded-control bg-status-critical px-1.5 text-12 font-semibold text-status-critical-on"
    >
      <CriticalIcon size={12} />
      Critical
    </span>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const store = useUiStore();
  const { client, download } = useServices();
  const exportNow = (): void => {
    const file = client.exportCurrent();
    if (file !== null) download(file);
  };
  return (
    <li className="w-96 rounded-card border border-hairline bg-surface-2 p-3 text-13 text-ink-1 shadow-raised">
      <div className="mb-2 flex items-center gap-2">
        {toast.severity === 'critical' ? <StatusChipCritical /> : null}
        <p className="min-w-0 flex-1">{toast.message}</p>
      </div>
      <div className="flex justify-end gap-2">
        {toast.action === 'exportNow' ? (
          <Button variant="primary" onClick={exportNow}>
            Export now
          </Button>
        ) : null}
        <Button onClick={() => store.getState().dismissToast(toast.id)}>Dismiss</Button>
      </div>
    </li>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const critical = toasts.filter((t) => t.severity === 'critical');
  const other = toasts.filter((t) => t.severity !== 'critical');
  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {/* Assertive only for critical problems (13.19). */}
      <ul aria-live="assertive" aria-label="Critical notifications" className="flex flex-col gap-2">
        {critical.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </ul>
      <ul aria-live="polite" aria-label="Notifications" className="flex flex-col gap-2">
        {other.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </ul>
    </div>
  );
}

/** The polite live region for week summaries (13.9, 13.19). */
export function LiveRegion() {
  const text = useUi((s) => s.announcement);
  return (
    <div aria-live="polite" role="status" className="sr-only" data-live-region="">
      {text}
    </div>
  );
}
