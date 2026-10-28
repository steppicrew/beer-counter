import clsx from 'clsx';
import { Sheet } from './Sheet';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { answerNewNight, useNewNight } from '../lib/newNight';

/**
 * Asked on the first drink after a long break: start a new round first, or
 * keep counting the old one. Either answer counts the drink that was tapped,
 * so nobody has to tap twice.
 */
export function NewNightSheet() {
  const { t, locale } = useI18n();
  const pending = useNewNight((s) => s.pending);
  const historyEnabled = useAppStore((s) => s.historyEnabled);
  if (!pending) return null;

  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(pending.lastAt);

  return (
    <Sheet title={t('night.title')} onClose={() => answerNewNight('cancel')}>
      <p className="field__hint">
        {t(historyEnabled ? 'night.body' : 'night.bodyNoHistory', { when })}
      </p>
      <div className="sheet-actions">
        <button type="button" className="btn btn--ghost" onClick={() => answerNewNight('keep')}>
          {t('night.keep')}
        </button>
        {/* Without a history the reset throws the round away: then it is a
            destructive choice and looks like one. */}
        <button
          type="button"
          className={clsx('btn', historyEnabled ? 'btn--primary' : 'btn--danger')}
          onClick={() => answerNewNight('reset')}
        >
          {t('night.reset')}
        </button>
      </div>
    </Sheet>
  );
}
