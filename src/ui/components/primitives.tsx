// Small shared building blocks for the P0 screens. Theme rules (DESIGN §13.20): the display face appears only in
// titles and headers; grain only on the title band, which holds nothing but its heading text (T28).
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { CriticalIcon } from './icons';

/**
 * Screen title band: Besley 24 px over a brass rule, on a grained page band. Also the setup wizard's header
 * (`zone="wizard-header"`). The band holds text only: never a number, control or chip (T28).
 */
export function ScreenTitle({
  title,
  subtitle,
  zone = 'title',
}: {
  title: string;
  subtitle?: string;
  zone?: 'title' | 'wizard-header';
}) {
  return (
    <div className="grain -mx-6 -mt-6 mb-6 px-6 pt-6 pb-4" data-grain-zone={zone}>
      <h1 className="display-title title-rule text-ink-1">{title}</h1>
      {subtitle !== undefined ? <p className="mt-4 text-14 text-ink-2">{subtitle}</p> : null}
    </div>
  );
}

/** A card on the content surface with a display-face panel header. */
export function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  const headingId = id === undefined ? undefined : `${id}-title`;
  return (
    <section className="mb-6 rounded-card border border-hairline bg-surface-1 p-4" aria-labelledby={headingId} id={id}>
      <h2 className="display-panel mb-3 text-ink-1" id={headingId}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// Status colors are reserved for state (13.2), so there is no red "danger" button: destructive actions confirm instead.
type Variant = 'primary' | 'secondary';

const VARIANT_CLASSES: Readonly<Record<Variant, string>> = {
  primary: 'bg-accent text-on-accent border-accent',
  secondary: 'bg-surface-2 text-ink-1 border-border-control',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex h-8 items-center gap-2 rounded-control border px-3 text-13 font-medium disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}

/** Polite notices and assertive errors (13.19: assertive only for problems the player must see). */
export function MessageArea({ errors, notices }: { errors: readonly string[]; notices: readonly string[] }) {
  return (
    <>
      <div
        role="alert"
        className="empty:hidden mb-4 rounded-card border border-status-critical bg-surface-1 p-3 text-14"
      >
        {errors.map((e) => (
          <p key={e} className="flex items-center gap-1.5 text-status-critical-text">
            <CriticalIcon />
            {e}
          </p>
        ))}
      </div>
      <div role="status" className="empty:hidden mb-4 rounded-card border border-hairline bg-surface-1 p-3 text-14">
        {notices.map((n) => (
          <p key={n} className="text-ink-1">
            {n}
          </p>
        ))}
      </div>
    </>
  );
}
