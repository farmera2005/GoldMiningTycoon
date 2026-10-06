// Status and severity chips (DESIGN §13.2 color semantics, D-13.31, D-13.61). Status colors are reserved for state
// and always come with an icon and a text label (check, triangle, diamond, octagon), never color alone. Chips are
// filled with the status color and labelled in its fixed `status-*-on` token in both themes. The inbox's four
// severities map onto them: info is not a status (a neutral outlined chip), warning and critical take their status,
// and blocking is critical-filled with a padlock so it reads as "Advance is locked" (13.10).
import type { ReactNode } from 'react';
import type { Severity } from '../../engine';
import { BlockingIcon, CriticalIcon, GoodIcon, InfoIcon, SeriousIcon, WarningIcon } from './icons';

export type Status = 'good' | 'warning' | 'serious' | 'critical';

const STATUS_CLASS: Readonly<Record<Status, string>> = {
  good: 'bg-status-good text-status-good-on',
  warning: 'bg-status-warning text-status-warning-on',
  serious: 'bg-status-serious text-status-serious-on',
  critical: 'bg-status-critical text-status-critical-on',
};

const STATUS_LABEL: Readonly<Record<Status, string>> = {
  good: 'Good',
  warning: 'Warning',
  serious: 'Serious',
  critical: 'Critical',
};

export function StatusIcon({ status, size = 12 }: { status: Status; size?: number }) {
  switch (status) {
    case 'good':
      return <GoodIcon size={size} />;
    case 'warning':
      return <WarningIcon size={size} />;
    case 'serious':
      return <SeriousIcon size={size} />;
    case 'critical':
      return <CriticalIcon size={size} />;
  }
}

const CHIP = 'inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 text-12 font-semibold leading-5';

/** A filled status chip: icon + label (default: the status name). */
export function StatusChip({ status, label, title }: { status: Status; label?: ReactNode; title?: string }) {
  return (
    <span data-status-chip={status} className={`${CHIP} ${STATUS_CLASS[status]}`} title={title}>
      <StatusIcon status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
  blocking: 'Blocking',
};

/** An inbox severity (13.10): info neutral, warning and critical by status, blocking critical with a padlock. */
export function SeverityChip({ severity, label }: { severity: Severity; label?: ReactNode }) {
  const text = label ?? SEVERITY_LABEL[severity];
  switch (severity) {
    case 'info':
      return (
        <span
          data-chip=""
          data-severity="info"
          className={`${CHIP} border border-border-control bg-surface-1 font-medium text-ink-2`}
        >
          <InfoIcon size={12} />
          {text}
        </span>
      );
    case 'warning':
      return (
        <span data-status-chip="warning" data-severity="warning" className={`${CHIP} ${STATUS_CLASS.warning}`}>
          <WarningIcon size={12} />
          {text}
        </span>
      );
    case 'critical':
      return (
        <span data-status-chip="critical" data-severity="critical" className={`${CHIP} ${STATUS_CLASS.critical}`}>
          <CriticalIcon size={12} />
          {text}
        </span>
      );
    case 'blocking':
      return (
        <span data-status-chip="critical" data-severity="blocking" className={`${CHIP} ${STATUS_CLASS.critical}`}>
          <BlockingIcon size={12} />
          {text}
        </span>
      );
  }
}

/** Status shown as bare text (13.2): the `status-*-text` token with its icon, ≥ 4.5:1 on every surface. */
export function StatusText({ status, children }: { status: Status; children: ReactNode }) {
  const tone: Readonly<Record<Status, string>> = {
    good: 'text-status-good-text',
    warning: 'text-status-warning-text',
    serious: 'text-status-serious-text',
    critical: 'text-status-critical-text',
  };
  return (
    <span data-status-text={status} className={`inline-flex items-center gap-1 ${tone[status]}`}>
      <StatusIcon status={status} />
      {children}
    </span>
  );
}
