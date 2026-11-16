import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { ConfirmSheet } from './ConfirmSheet';
import { useI18n } from '../i18n';
import { applyImport, checkStored, summarizeStored } from '../lib/dataFile';
import { listSnapshots, restoreSnapshot } from '../store/storage';
import './RestoreSheet.scss';

interface Day {
  name: string;
  keptAt: number;
  stored: string;
  drinks: number;
  lastAt: number | null;
}

interface Props {
  onClose: () => void;
  onFailed: () => void;
}

/** The app's daily snapshots, to go back to one. Only the Android app has them. */
export function RestoreSheet({ onClose, onFailed }: Props) {
  const { t, locale } = useI18n();
  const [days, setDays] = useState<Day[] | null>(null);
  const [chosen, setChosen] = useState<Day | null>(null);

  useEffect(() => {
    let live = true;
    listSnapshots().then(
      (snapshots) => {
        if (!live) return;
        // A snapshot that would not pass as an import is never offered.
        const readable = snapshots.flatMap(({ name, keptAt, content }) => {
          const check = checkStored(content);
          return check.ok ? [{ name, keptAt, stored: check.stored, ...summarizeStored(content) }] : [];
        });
        setDays(readable);
      },
      () => live && setDays([]),
    );
    return () => {
      live = false;
    };
  }, []);

  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const restore = async (day: Day) => {
    try {
      await restoreSnapshot(day.name, day.stored);
      applyImport(day.stored);
    } catch {
      onFailed();
      onClose();
    }
  };

  return (
    <Sheet title={t('data.restoreTitle')} onClose={onClose}>
      <p className="field__hint">{t('data.restoreHint')}</p>

      {days?.length === 0 && <p className="field__hint">{t('data.restoreNone')}</p>}

      {days && days.length > 0 && (
        <ul className="restore-days">
          {days.map((day) => (
            <li key={day.name}>
              <button type="button" className="restore-days__day" onClick={() => setChosen(day)}>
                <span className="restore-days__kept">
                  {t('data.restoreKept', { when: format.format(day.keptAt) })}
                </span>
                <span className="restore-days__detail">
                  {day.lastAt !== null && (
                    <>{t('data.restoreLast', { when: format.format(day.lastAt) })} · </>
                  )}
                  {t('data.restoreCount', { count: day.drinks })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <ConfirmSheet
          title={t('data.restoreConfirmTitle')}
          body={t('data.restoreConfirmBody')}
          confirmLabel={t('data.restoreConfirm')}
          onConfirm={() => void restore(chosen)}
          onClose={() => setChosen(null)}
        />
      )}
    </Sheet>
  );
}
