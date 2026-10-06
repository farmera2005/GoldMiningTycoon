// Line icons at a 1.5 px stroke (DESIGN §13.20 ornament rules). Decorative: every icon sits next to a text label or
// carries an accessible name on its control, so they are hidden from assistive technology. Status icons follow 13.2:
// check (good), triangle (warning), diamond (serious), octagon (critical), so status never rests on color alone.
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

export function InboxIcon() {
  return (
    <LineIcon>
      <path d="M4 13l2.5-7h11L20 13v6H4z" />
      <path d="M4 13h5l1 2h4l1-2h5" />
    </LineIcon>
  );
}

export function CalendarIcon() {
  return (
    <LineIcon>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </LineIcon>
  );
}

/** Claims: a staked parcel (corner posts and a boundary). */
export function ClaimsIcon() {
  return (
    <LineIcon>
      <path d="M5 6l14-1v13l-14 1z" />
      <path d="M5 6v-2M19 5v-2M5 19v2M19 18v2" />
    </LineIcon>
  );
}

export function MapIcon() {
  return (
    <LineIcon>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </LineIcon>
  );
}

/** Prospecting: a gold pan seen from the side. */
export function ProspectingIcon() {
  return (
    <LineIcon>
      <path d="M3 11h18l-3 6H6z" />
      <path d="M8 11l2-3h4l2 3" />
    </LineIcon>
  );
}

/** Operations: a sluice box under a feed hopper. */
export function OpsIcon() {
  return (
    <LineIcon>
      <path d="M4 8h7l-2 4H4z" />
      <path d="M9 12l11 5M9 15l11 5" />
    </LineIcon>
  );
}

/** Equipment: an excavator arm. */
export function EquipmentIcon() {
  return (
    <LineIcon>
      <rect x="3" y="14" width="10" height="5" rx="1" />
      <path d="M8 14v-3l6-5 5 4-2 3" />
    </LineIcon>
  );
}

export function StaffIcon() {
  return (
    <LineIcon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M16 5.5a3 3 0 010 5M18 14c2 .8 3 3 3 6" />
    </LineIcon>
  );
}

export function BankIcon() {
  return (
    <LineIcon>
      <path d="M3 9l9-5 9 5z" />
      <path d="M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18" />
    </LineIcon>
  );
}

/** Gold sales: a stack of two bars. */
export function GoldIcon() {
  return (
    <LineIcon>
      <path d="M4 18l2-4h6l2 4z" />
      <path d="M10 14l2-4h6l2 4h-6" />
    </LineIcon>
  );
}

export function ReportsIcon() {
  return (
    <LineIcon>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 17v-3M12 17v-6M15 17v-4" />
    </LineIcon>
  );
}

export function CompanyIcon() {
  return (
    <LineIcon>
      <path d="M4 20V8l8-4 8 4v12" />
      <path d="M9 20v-6h6v6M3 20h18" />
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

export function HelpIcon() {
  return (
    <LineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.01" />
    </LineIcon>
  );
}

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
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

/** Good: a check (13.2). */
export function GoodIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </LineIcon>
  );
}

/** Warning: a triangle (13.2). */
export function WarningIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.01" />
    </LineIcon>
  );
}

/** Serious: a diamond (13.2). */
export function SeriousIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M12 3l9 9-9 9-9-9z" />
      <path d="M12 8.5v4M12 15.5v.01" />
    </LineIcon>
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

/** Info (the inbox's fourth severity): a circled i; info is never a status color (13.2). */
export function InfoIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </LineIcon>
  );
}

/** Blocking: a stop hand on an octagon would read as critical; a padlock says "Advance is locked" (13.10). */
export function BlockingIcon({ size = 14 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <rect x="5" y="11" width="14" height="10" rx="1" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </LineIcon>
  );
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <LineIcon size={size}>
      <path d="M6 6l12 12M18 6L6 18" />
    </LineIcon>
  );
}

export function SortIcon({ direction, size = 12 }: { direction: 'asc' | 'desc' | false; size?: number }) {
  return (
    <LineIcon size={size}>
      {direction === 'asc' ? <path d="M7 14l5-5 5 5" /> : null}
      {direction === 'desc' ? <path d="M7 10l5 5 5-5" /> : null}
      {direction === false ? <path d="M8 9l4-4 4 4M8 15l4 4 4-4" /> : null}
    </LineIcon>
  );
}
