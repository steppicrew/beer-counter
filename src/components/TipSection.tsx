import { useState } from 'react';
import { BeverageIcon } from './BeverageIcon';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { isNativeApp } from '../lib/platform';
import { TIP_URL, buyTip, useTipOffers } from '../lib/tips';
import type { TipProductId, TipStatus } from '../lib/tips';
import './TipSection.scss';

const LABELS: Record<TipProductId, MessageKey> = {
  tip_small: 'drink.beerSmall',
  tip_large: 'drink.beer',
  tip_round: 'tip.round',
};

const RESULT: Partial<Record<TipStatus, MessageKey>> = {
  purchased: 'tip.thanks',
  pending: 'tip.pending',
  error: 'tip.failed',
};

/** Settings section; renders nothing when there is no way to tip here. */
export function TipSection() {
  const { t } = useI18n();
  const native = isNativeApp();
  const offers = useTipOffers();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TipStatus | null>(null);

  if (native ? offers.length === 0 : TIP_URL === null) return null;

  const message = result ? RESULT[result] : undefined;

  return (
    <div className="field">
      <span className="field__label">{t('tip.title')}</span>
      <span className="field__hint">{t('tip.hint')}</span>
      {native ? (
        <div className="tip-offers">
          {offers.map((offer) => (
            <button
              key={offer.id}
              type="button"
              className="btn btn--ghost tip-offers__btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setResult(null);
                void buyTip(offer.id).then((status) => {
                  setResult(status);
                  setBusy(false);
                });
              }}
            >
              <span>{t(LABELS[offer.id])}</span>
              <span className="tip-offers__price">{offer.price}</span>
            </button>
          ))}
        </div>
      ) : (
        <a className="btn btn--ghost tip-link" href={TIP_URL ?? undefined} target="_blank" rel="noopener">
          <BeverageIcon icon="beer-large" className="tip-link__icon" />
          {t('tip.title')}
        </a>
      )}
      {message && (
        <span className="field__hint" role="status">
          {t(message)}
        </span>
      )}
    </div>
  );
}
