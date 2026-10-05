// Line icons at a 1.5 px stroke (DESIGN §13.20 ornament rules). Decorative: every icon sits next to a text label or
// carries an accessible name on its control, so they are hidden from assistive technology.
import type { ReactNode } from 'react';

function LineIcon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function MenuIcon() {
  return (
    <LineIcon>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </LineIcon>
  );
}

export function DashboardIcon() {
  return (
    <LineIcon>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </LineIcon>
  );
}

export function SavesIcon() {
  return (
    <LineIcon>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <rect x="8" y="13" width="8" height="5" />
    </LineIcon>
  );
}

export function SettingsIcon() {
  return (
    <LineIcon>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </LineIcon>
  );
}

/** The wordmark: a gold pan with a nugget, drawn in brass on the chrome (brand ornament only, 13.2). */
export function Wordmark() {
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" aria-hidden="true" focusable="false" className="shrink-0">
      <ellipse cx="14" cy="15" rx="11" ry="7" fill="none" stroke="var(--brass-on-chrome)" strokeWidth={1.5} />
      <ellipse cx="14" cy="15" rx="6" ry="3.5" fill="none" stroke="var(--brass-on-chrome)" strokeWidth={1.5} />
      <path d="M12.5 14.2l1.6-1.2 1.6 0.9-0.5 1.6-1.9 0.3z" fill="var(--brass-on-chrome)" />
    </svg>
  );
}

/** The critical status icon: an octagon (13.2: check, triangle, diamond, octagon). */
export function CriticalIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
      <path d="M12 8v5M12 16v.01" />
    </LineIcon>
  );
}
