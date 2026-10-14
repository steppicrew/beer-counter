import { useState } from 'react';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { ConfirmSheet } from './ConfirmSheet';
import { UiIcon } from './UiIcon';
import { useI18n } from '../i18n';
import { countOf, talliesOf, useAppStore } from '../store/useAppStore';
import { personColourVar, personName } from '../lib/people';
import type { Person } from '../lib/types';
import { ME, PERSON_COLOURS } from '../lib/types';
import './PeopleSheet.scss';

/**
 * Who is at the table tonight. Regulars are ticked in and out; someone new
 * is added either for tonight or as a regular. Leaving early needs nothing:
 * whoever has drinks stays until the reset, so the round still adds up.
 */
export function PeopleSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const people = useAppStore((s) => s.people);
  const table = useAppStore((s) => s.table);
  const tallies = useAppStore((s) => s.tallies);
  const addPerson = useAppStore((s) => s.addPerson);
  const renamePerson = useAppStore((s) => s.renamePerson);
  const removePerson = useAppStore((s) => s.removePerson);
  const setSeated = useAppStore((s) => s.setSeated);
  const setPersonColour = useAppStore((s) => s.setPersonColour);

  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; colour: number } | null>(null);
  const [forgetting, setForgetting] = useState<Person | null>(null);

  const trimmed = name.trim();
  const add = (scope: Person['scope']) => {
    if (!trimmed) return;
    addPerson({ name: trimmed, scope });
    setName('');
  };

  const saveRename = () => {
    if (!editing) return;
    const next = editing.name.trim();
    if (next && editing.id !== ME) renamePerson(editing.id, next);
    setPersonColour(editing.id, editing.colour);
    setEditing(null);
  };

  return (
    <Sheet title={t('people.title')} onClose={onClose} dismissible={false}>
      <p className="field__hint">{t('people.hint')}</p>

      <ul className="people">
        {people.map((person) => {
          const seated = table.includes(person.id);
          const count = countOf(talliesOf({ tallies }, person.id));
          const isMe = person.id === ME;
          const guest = person.scope === 'session';
          // Drinks tonight keep them at the table until the reset. A guest is
          // only ever here; one added by mistake goes via the pencil.
          const locked = isMe || guest || (seated && count > 0);
          const style = { '--person': personColourVar(person.colour) } as CSSProperties;

          if (editing?.id === person.id) {
            // Colours worn by someone else at the table tonight are not on
            // offer: two coasters of one colour would say nothing.
            const taken = new Set(
              people.filter((p) => p.id !== person.id && table.includes(p.id)).map((p) => p.colour),
            );
            return (
              <li key={person.id} className="people__row" style={style}>
                {!isMe && (
                  <input
                    className="field__input people__rename"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                    aria-label={t('people.namePlaceholder')}
                    maxLength={24}
                    autoFocus
                  />
                )}
                <div className="people__colours" role="radiogroup" aria-label={t('people.colour')}>
                  {Array.from({ length: PERSON_COLOURS }, (_, colour) => (
                    <button
                      key={colour}
                      type="button"
                      role="radio"
                      aria-checked={editing.colour === colour}
                      aria-label={`${t('people.colour')} ${colour + 1}`}
                      className={clsx('people__swatch', editing.colour === colour && 'people__swatch--on')}
                      style={{ '--swatch': personColourVar(colour) } as CSSProperties}
                      disabled={taken.has(colour)}
                      onClick={() => setEditing({ ...editing, colour })}
                    />
                  ))}
                </div>
                <button type="button" className="btn btn--primary people__small" onClick={saveRename}>
                  {t('action.save')}
                </button>
                {/* A regular is asked about — they have a history. A guest
                    without a drink was never really here. */}
                {isMe ? (
                  <button type="button" className="btn btn--ghost people__small" onClick={() => setEditing(null)}>
                    {t('action.cancel')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost people__small"
                    onClick={() => {
                      setEditing(null);
                      if (guest) removePerson(person.id);
                      else setForgetting(person);
                    }}
                    disabled={count > 0}
                  >
                    {t('action.delete')}
                  </button>
                )}
              </li>
            );
          }

          return (
            <li key={person.id} className="people__row" style={style}>
              <button
                type="button"
                className={clsx('people__seat', seated && 'people__seat--seated')}
                onClick={() => setSeated(person.id, !seated)}
                disabled={locked}
                aria-pressed={seated}
              >
                <span className="people__check" aria-hidden="true">
                  {seated ? '✓' : ''}
                </span>
                <span className="people__name">
                  {personName(person, t)}
                  {guest && (
                    <span className="people__scope"> · {t('people.addGuest')}</span>
                  )}
                  {!isMe && count > 0 && <span className="people__locked">{t('people.hasDrinks')}</span>}
                </span>
                {count > 0 && <span className="people__count">{count}</span>}
              </button>
              <button
                type="button"
                className="app__icon-btn"
                onClick={() => setEditing({ id: person.id, name: person.name ?? '', colour: person.colour })}
                aria-label={t('action.edit')}
              >
                <UiIcon name="edit" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="field people__new">
        <span className="field__label">{t('people.add')}</span>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('people.namePlaceholder')}
          maxLength={24}
        />
        <div className="people__add">
          <button type="button" className="btn btn--primary" onClick={() => add('session')} disabled={!trimmed}>
            ＋ {t('people.addGuest')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => add('default')} disabled={!trimmed}>
            ＋ {t('people.addRegular')}
          </button>
        </div>
        <span className="field__hint">{t('people.addHint')}</span>
      </div>

      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>

      {forgetting && (
        <ConfirmSheet
          title={t('people.forgetTitle', { name: personName(forgetting, t) })}
          body={t('people.forgetBody')}
          confirmLabel={t('action.delete')}
          onConfirm={() => removePerson(forgetting.id)}
          onClose={() => setForgetting(null)}
        />
      )}
    </Sheet>
  );
}
