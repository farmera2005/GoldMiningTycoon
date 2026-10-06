// Modal dialogs and confirmations (DESIGN §13.19 focus rules, D-13.84): a control that opens a dialog moves focus
// into it (a confirmation to its safe choice), Tab stays inside while it is open, Esc cancels, and focus returns to
// the control that opened it. Dialogs sit on the raised surface with the one elevation shadow (13.20), never on grain.
import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Button } from './primitives';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The focusable elements inside `root`, in tab order (positive tabindex is not used in this app). */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('inert'));
}

export interface ModalProps {
  readonly title: string;
  /** Called on Esc, on the backdrop and on any close control; the caller unmounts the modal. */
  onClose(): void;
  readonly children: ReactNode;
  /** `alertdialog` for confirmations that interrupt (13.19), `dialog` otherwise. */
  readonly role?: 'dialog' | 'alertdialog';
  /** What takes focus when the dialog opens; default the first focusable element. */
  readonly initialFocus?: RefObject<HTMLElement | null>;
  /** Focus goes back here on close; default the element that had focus when the dialog opened. */
  readonly returnFocus?: HTMLElement | null;
  /** Width in px (default 480). */
  readonly width?: number;
  /** Optional footer (actions), separated from the body. */
  readonly footer?: ReactNode;
  /** A short description, linked as the dialog's accessible description. */
  readonly description?: string;
  /** `data-modal` value for tests. */
  readonly id?: string;
}

export function Modal({
  title,
  onClose,
  children,
  role = 'dialog',
  initialFocus,
  returnFocus,
  width = 480,
  footer,
  description,
  id,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // The opener, captured at mount before focus moves into the dialog; focus goes back to it on close.
  const openerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    openerRef.current = returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const root = dialogRef.current;
    if (root === null) return;
    const target = initialFocus?.current ?? focusableIn(root)[0] ?? root;
    target.focus();
    // Mount only: a later prop change must not steal focus back to the first control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      // Back to the trigger, if it is still in the document (a row that disappeared hands focus to its list).
      const opener = openerRef.current;
      if (opener !== null && opener.isConnected) opener.focus();
    },
    [],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (root === null) return;
    const items = focusableIn(root);
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink-1/30 p-8 pt-24">
      {/* The backdrop closes the dialog on click; it is not a control of its own (Esc is the keyboard path). */}
      <div className="absolute inset-0" aria-hidden="true" onMouseDown={onClose} />
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descId}
        tabIndex={-1}
        data-modal={id ?? ''}
        className="relative max-w-full rounded-card border border-hairline bg-surface-2 text-ink-1 shadow-raised outline-none"
        style={{ width }}
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-hairline px-4 pt-3 pb-2">
          <h2 id={titleId} className="text-16 font-semibold text-ink-1">
            {title}
          </h2>
          {description === undefined ? null : (
            <p id={descId} className="mt-1 text-13 text-ink-2">
              {description}
            </p>
          )}
        </div>
        <div className="px-4 py-3 text-14">{children}</div>
        {footer === undefined ? null : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-hairline px-4 py-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  readonly title: string;
  /** What happens, and what it costs; plain text (13.26: confirmations list their costs). */
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
  readonly returnFocus?: HTMLElement | null;
}

/** A confirmation: focus starts on Cancel, the safe choice; Esc cancels (13.19, D-13.84). */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  returnFocus,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      title={title}
      role="alertdialog"
      onClose={onCancel}
      initialFocus={cancelRef}
      {...(returnFocus === undefined ? {} : { returnFocus })}
      id="confirm"
      footer={
        <>
          <Button ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
