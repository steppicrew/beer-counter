import { useEffect, useRef } from 'react';
import './Sheet.scss';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Close on a tap outside the panel. Off for forms, where a stray tap past
   * the edge would throw away what was typed.
   */
  dismissible?: boolean;
}

/** Bottom sheet built on <dialog> so Esc, focus trapping and the top layer
 *  come from the platform rather than hand-rolled key handling. */
export function Sheet({ title, onClose, children, dismissible = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Where the press began. A click that starts inside the panel and ends on
  // the backdrop — a text selection or a scroll drag that overshoots — is
  // reported on the dialog too, and must not count as a tap outside.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // <dialog>'s cancel/close events bubble, so a nested sheet's Esc would also
  // reach the sheet underneath and tear both down — losing unsaved edits.
  // Each sheet handles only its own.
  const handle = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    if (event.target !== ref.current) return;
    event.stopPropagation();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={handle}
      onClose={handle}
      // The panel fills the dialog's own box, so an event whose target is the
      // dialog itself landed on the ::backdrop. A nested sheet has its own
      // dialog and backdrop, so a tap outside it closes only that one.
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === ref.current;
      }}
      onClick={(event) => {
        if (dismissible && pressedOnBackdrop.current && event.target === ref.current) {
          event.stopPropagation();
          onClose();
        }
        pressedOnBackdrop.current = false;
      }}
    >
      <div className="sheet__panel">
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
