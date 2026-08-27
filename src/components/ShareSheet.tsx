import { useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { UiIcon } from './UiIcon';
import { useI18n } from '../i18n';
import { useShare } from '../lib/useShare';
import {
  STORE_URL,
  STORE_QR_VIEWBOX,
  STORE_QR_PATHS,
  APP_URL,
  APP_QR_VIEWBOX,
  APP_QR_PATHS,
} from '../generated/storeQr';
import './ShareSheet.scss';

type Target = 'store' | 'web';

const QR: Record<Target, { url: string; viewBox: string; paths: string }> = {
  store: { url: STORE_URL, viewBox: STORE_QR_VIEWBOX, paths: STORE_QR_PATHS },
  web: { url: APP_URL, viewBox: APP_QR_VIEWBOX, paths: APP_QR_PATHS },
};

/**
 * Hands the app to someone sitting at the same table: a QR big enough to scan
 * across a bar table, with the OS share picker and a copyable link for people
 * who aren't in the room.
 *
 * The Android app leads, since that is the install a friend keeps; the web
 * app is offered alongside it because it needs no store and covers iOS.
 */
export function ShareSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [target, setTarget] = useState<Target>('store');
  const { canShare, canCopy, result, share, copy } = useShare();

  const active = QR[target];

  return (
    <Sheet title={t('share.title')} onClose={onClose}>
      <p className="field__hint">{t('share.hint')}</p>

      <div className="segmented" role="group" aria-label={t('share.title')}>
        <button
          type="button"
          className={clsx('segmented__option', target === 'store' && 'segmented__option--selected')}
          onClick={() => setTarget('store')}
          aria-pressed={target === 'store'}
        >
          {t('share.targetStore')}
        </button>
        <button
          type="button"
          className={clsx('segmented__option', target === 'web' && 'segmented__option--selected')}
          onClick={() => setTarget('web')}
          aria-pressed={target === 'web'}
        >
          {t('share.targetWeb')}
        </button>
      </div>

      <div className="share-qr">
        {/* Paths come from qrencode at build time; the markup is ours. */}
        <svg
          viewBox={active.viewBox}
          className="share-qr__code"
          role="img"
          aria-label={target === 'store' ? t('share.qrStoreAlt') : t('share.qrWebAlt')}
          dangerouslySetInnerHTML={{ __html: active.paths }}
        />
      </div>

      {/* The store URL is long enough to wrap to two ragged lines and says
          nothing the QR and the buttons don't already carry, so label the
          destination instead of printing it. */}
      <a
        className="share-qr__link"
        href={active.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {target === 'store' ? t('share.openStore') : t('share.openWeb')}
      </a>

      <div className="share-actions">
        {canShare && (
          <button
            type="button"
            className="btn btn--primary share-actions__share"
            onClick={() =>
              void share({
                title: t('app.title'),
                text: t('share.message'),
                url: active.url,
              })
            }
          >
            <UiIcon name="share" /> {t('share.action')}
          </button>
        )}

        {canCopy && (
          <button
            type="button"
            className="btn btn--ghost share-actions__copy"
            onClick={() => void copy(active.url)}
          >
            {t('share.copy')}
          </button>
        )}
      </div>

      {/* Confirmation is announced rather than shown as a toast: the sheet is
          already the focused surface, so a live region reaches both eyes and
          screen readers without stealing the tap target. */}
      <p className="share-status" role="status" aria-live="polite">
        {result === 'copied' && t('share.copied')}
        {result === 'shared' && t('share.shared')}
        {result === 'failed' && t('share.failed')}
      </p>

      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </Sheet>
  );
}
