import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import clsx from 'clsx';
import { useI18n } from '../i18n';
import { countOf, talliesOf, useAppStore } from '../store/useAppStore';
import { personColourVar, personName, TABLE_VIEW } from '../lib/people';
import './PeopleTabs.scss';

/**
 * Whose drinks the list counts, when more than one person is at the table.
 * Each tab says how many that person has had, so a glance across the strip
 * is also the table's tally. The last tab is the table itself: everyone's
 * totals. Who sits here is changed from the footer.
 */
export function PeopleTabs({
  current,
  onSelect,
}: {
  /** A person's id, or {@link TABLE_VIEW}. */
  current: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  const people = useAppStore((s) => s.people);
  const table = useAppStore((s) => s.table);
  const tallies = useAppStore((s) => s.tallies);

  // A swipe can land on someone scrolled out of the strip; bring them in.
  // By hand: scrollIntoView also scrolls every ancestor, and moved the drink
  // list under the header along with the strip.
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = strip.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const left = tab.offsetLeft - list.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < list.scrollLeft) list.scrollTo({ left, behavior: 'smooth' });
    else if (right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: right - list.clientWidth, behavior: 'smooth' });
    }
  }, [current]);

  const seated = table.flatMap((id) => people.find((p) => p.id === id) ?? []);

  return (
    <div className="people-tabs">
      <div className="people-tabs__list" role="tablist" aria-label={t('people.tabs')} ref={strip}>
        {seated.map((person) => (
          <button
            key={person.id}
            type="button"
            role="tab"
            aria-selected={person.id === current}
            className={clsx('people-tabs__tab', person.id === current && 'people-tabs__tab--active')}
            style={{ '--person': personColourVar(person.colour) } as CSSProperties}
            onClick={() => onSelect(person.id)}
          >
            <span className="people-tabs__name">{personName(person, t)}</span>
            <span className="people-tabs__count">{countOf(talliesOf({ tallies }, person.id))}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={current === TABLE_VIEW}
          className={clsx(
            'people-tabs__tab',
            'people-tabs__tab--table',
            current === TABLE_VIEW && 'people-tabs__tab--active',
          )}
          onClick={() => onSelect(TABLE_VIEW)}
        >
          <span className="people-tabs__name">{t('table.tab')}</span>
          <span className="people-tabs__count">
            {seated.reduce((sum, p) => sum + countOf(talliesOf({ tallies }, p.id)), 0)}
          </span>
        </button>
      </div>
    </div>
  );
}
