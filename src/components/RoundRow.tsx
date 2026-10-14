import { useState } from 'react';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { personColourVar, personName } from '../lib/people';

/**
 * "A round of these" in a drink's sheet, at a table of more than one: one
 * each for whoever is ticked, counted in a single tap. Everyone starts
 * ticked — the round for the table is the usual case; untick who passed.
 */
export function RoundRow({ beverageId, onPoured }: { beverageId: string; onPoured: () => void }) {
  const { t } = useI18n();
  const people = useAppStore((s) => s.people);
  const table = useAppStore((s) => s.table);
  const pourRound = useAppStore((s) => s.pourRound);

  const [ticked, setTicked] = useState<readonly string[]>(table);
  const seated = table.flatMap((id) => people.find((p) => p.id === id) ?? []);
  const toggle = (id: string) =>
    setTicked((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));

  return (
    <div className="field">
      <span className="field__label">{t('round.title')}</span>
      <div className="round" role="group" aria-label={t('round.title')}>
        {seated.map((person) => {
          const on = ticked.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              className={clsx('round__who', on && 'round__who--on')}
              style={{ '--person': personColourVar(person.colour) } as CSSProperties}
              onClick={() => toggle(person.id)}
              aria-pressed={on}
            >
              {personName(person, t)}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn--primary round__pour"
        disabled={ticked.length === 0}
        onClick={() => {
          pourRound(beverageId, ticked);
          onPoured();
        }}
      >
        {t('round.action', { count: ticked.length })}
      </button>
      <span className="field__hint">{t('round.hint')}</span>
    </div>
  );
}
