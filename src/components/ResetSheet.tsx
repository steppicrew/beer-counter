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
      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
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
