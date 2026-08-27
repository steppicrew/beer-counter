import { Sheet } from './Sheet';
import { useI18n } from '../i18n';

interface Props {
  onConfirm: () => void;
  onClose: () => void;
}

export function ResetSheet({ onConfirm, onClose }: Props) {
  const { t } = useI18n();

  return (
    <Sheet title={t('reset.title')} onClose={onClose}>
      <p className="field__hint">{t('reset.body')}</p>
      {/* No spacer: with two buttons it would claim a half-row of its own and
          force them onto separate lines. Cancel leads, as in ConfirmSheet. */}
      <div className="sheet-actions">
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
          {t('reset.confirm')}
        </button>
      </div>
    </Sheet>
  );
}
