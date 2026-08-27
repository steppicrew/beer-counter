import { Sheet } from './Sheet';
import { useI18n } from '../i18n';
import { STORE_URL, STORE_QR_VIEWBOX, STORE_QR_PATHS } from '../generated/storeQr';
import './StoreQrSheet.scss';

export function StoreQrSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  return (
    <Sheet title={t('store.qrTitle')} onClose={onClose}>
      <p className="field__hint">{t('store.qrHint')}</p>

      <div className="store-qr">
        {/* Paths come from qrencode at build time; the markup is ours. */}
        <svg
          viewBox={STORE_QR_VIEWBOX}
          className="store-qr__code"
          role="img"
          aria-label={t('store.qrTitle')}
          dangerouslySetInnerHTML={{ __html: STORE_QR_PATHS }}
        />
      </div>

      <a className="store-qr__link" href={STORE_URL} target="_blank" rel="noopener noreferrer">
        {t('store.open')}
      </a>

      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </Sheet>
  );
}
