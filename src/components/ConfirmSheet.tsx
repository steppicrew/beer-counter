import { Sheet } from './Sheet';
import { useI18n } from '../i18n';

interface Props {
  title: string;
  body: string;
  /** Label for the destructive action. */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Asks before something irreversible, in the app's own bottom sheet rather
 * than a native `confirm()` — which cannot be styled or translated, blocks the
 * whole page, and looks like a browser warning rather than part of the app.
 *
 * Nested inside another sheet this stays correct: <dialog> stacks in the top
 * layer, so the newer one renders above and takes the Esc key first.
 */
export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose }: Props) {
  const { t } = useI18n();

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="field__hint">{body}</p>

      <div className="sheet-actions">
        {/* Cancel leads: the safe choice should be the one under the thumb. */}
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
