import { useState } from 'react';
import type { ReactNode } from 'react';
import { BeverageIcon } from './BeverageIcon';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { isNativeApp } from '../lib/platform';
import { useAppStore } from '../store/useAppStore';
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

interface Props {
  /** Off where the sheet's own title already says it. */
  titled?: boolean;
  /** A tip was chosen. The purchase carries on without the section. */
  onChosen?: () => void;
  /** Drawn beside the hint: the barman, in the tip sheet. */
  figure?: ReactNode;
}

/**
 * The tip offers, in settings and in the tip sheet; renders nothing when there
 * is no way to tip here.
 */
export function TipSection({ titled = true, onChosen, figure }: Props) {
  const { t } = useI18n();
  const recordTip = useAppStore((s) => s.recordTip);
  const native = isNativeApp();
  const offers = useTipOffers();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TipStatus | null>(null);

  const shown = native ? offers.length > 0 : TIP_URL !== null;

  if (!shown) return null;

  const message = result ? RESULT[result] : undefined;

  // Beside the barman he makes the pitch, in two paragraphs split where the
  // catalogue breaks the line: the joke, then the promise that nothing
  // depends on it. Settings keeps the plain one-liner.
  const hint = (
    <div className="field__hint tip-intro__text">
      {t(figure ? 'tip.pitch' : 'tip.hint').split('\n').map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );

  return (
    <div className="field">
      {titled && <span className="field__label">{t('tip.title')}</span>}
      {figure ? (
        <div className="tip-intro">
          {figure}
          {hint}
        </div>
      ) : (
        hint
      )}
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
                  // Someone who has tipped is never asked again, and the jar
                  // leaves the bar — after a coin, if the money arrived.
                  if (status === 'purchased' || status === 'pending') {
                    recordTip(status === 'purchased', offer.id);
                  }
                  setResult(status);
                  setBusy(false);
                });
                onChosen?.();
              }}
            >
              <span>{t(LABELS[offer.id])}</span>
              <span className="tip-offers__price">{offer.price}</span>
            </button>
          ))}
        </div>
      ) : (
        <a className="btn btn--ghost tip-link" href={TIP_URL ?? undefined}
          target="_blank"
          rel="noopener"
          // Nothing on the web can tell whether they paid; the click is the
          // closest thing to a tip it will ever see.
          onClick={() => {
            recordTip(false);
            onChosen?.();
          }}
        >
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
