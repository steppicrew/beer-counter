import { useEffect, useRef } from 'react';
import './Sheet.scss';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom sheet built on <dialog> so Esc, focus trapping and the top layer
 *  come from the platform rather than hand-rolled key handling. */
export function Sheet({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={ref} className="sheet" onCancel={onClose} onClose={onClose}>
      <div className="sheet__panel">
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
