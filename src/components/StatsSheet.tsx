import { useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { ConfirmSheet } from './ConfirmSheet';
import { BeverageIcon } from './BeverageIcon';
import { UiIcon } from './UiIcon';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { archiveRound, nightsOf, othersIn, periodStart, summarize } from '../lib/stats';
import type { Night, StatsDrink, StatsName, StatsWho } from '../lib/stats';
import { useSwipe } from '../lib/useSwipe';
import { personColourVar, personName } from '../lib/people';
import type { CSSProperties } from 'react';
import { ME } from '../lib/types';
import { formatMoney, defaultCurrencyFor } from '../lib/money';
import { liquidVar } from '../lib/liquids';
import './StatsSheet.scss';

/** How far the view is zoomed out from a single night. */
type Level = 'night' | 'month' | 'year' | 'all';

/** Broadest last, for telling which of two levels is higher. */
const LEVELS: readonly Level[] = ['night', 'month', 'year', 'all'];
const UP: Record<Level, Level | null> = { night: 'month', month: 'year', year: 'all', all: null };
const DOWN: Record<Level, Level | null> = { all: 'year', year: 'month', month: 'night', night: null };

/** A night, month or year with drinks in it, or everything. */
interface Bucket {
  /** The night's first drink, or the period's first midnight. */
  start: number;
  nights: Night[];
}

/** Oldest first. Months and years without a drink are not buckets at all. */
function bucketsAt(nights: Night[], level: Level): Bucket[] {
  switch (level) {
    case 'night':
      return nights.map((n) => ({ start: n.start, nights: [n] }));
    case 'all': {
      const first = nights[0];
      return first ? [{ start: first.start, nights }] : [];
    }
    default: {
      const buckets: Bucket[] = [];
      for (const n of nights) {
        const start = periodStart(n.start, level);
        const last = buckets.at(-1);
        if (last?.start === start) last.nights.push(n);
        else buckets.push({ start, nights: [n] });
      }
      return buckets;
    }
  }
}

/**
 * Where the view is: a level and a moment inside it. Kept as a moment rather
 * than an index so going up finds the month a night is in, and switching
 * person lands on their night nearest the one shown.
 */
interface Focus {
  level: Level;
  at: number;
}

/** The bucket holding `at`, or the nearest before it; the oldest if none is. */
function indexAt(buckets: Bucket[], at: number): number {
  let index = 0;
  buckets.forEach((b, i) => {
    if (b.start <= at) index = i;
  });
  return index;
}

export function StatsSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const beverages = useAppStore((s) => s.beverages);
  const tallies = useAppStore((s) => s.tallies);
  const people = useAppStore((s) => s.people);
  const activePerson = useAppStore((s) => s.activePerson);
  const history = useAppStore((s) => s.history);
  const historyEnabled = useAppStore((s) => s.historyEnabled);
  const setHistoryEnabled = useAppStore((s) => s.setHistoryEnabled);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const storedCurrency = useAppStore((s) => s.currency);

  // Opens on the latest night: "what did I drink yesterday" is one tap.
  const [focus, setFocus] = useState<Focus>({ level: 'night', at: Infinity });
  // The broadest level reached on this visit. Back climbs up to it and then
  // closes: opened on last night and nothing else, Back simply closes.
  const [highest, setHighest] = useState<Level>('night');
  // Opens on whoever the list was counting for: from Hans's tab, his evening.
  const [who, setWho] = useState<StatsWho>(activePerson);
  const [confirmClear, setConfirmClear] = useState(false);

  const currency = storedCurrency ?? defaultCurrencyFor(locale);

  // The round in progress counts too — otherwise tonight would be missing
  // until the next reset.
  const current = archiveRound(beverages, tallies, people);
  const rounds = current ? [...history, current] : history;

  // A choice of whose stats only once anyone else has ever been counted.
  // Those still known by name each get a chip; a guest from a past night is
  // in "Everyone" only, or the row would grow with every evening out.
  const counted = othersIn(rounds);
  const choices = counted.size > 0 ? people.filter((p) => p.id === ME || counted.has(p.id)) : [];
  // Someone with nothing counted yet has no stats to open on.
  const shown: StatsWho = who === 'table' || choices.some((p) => p.id === who) ? who : ME;

  const nights = nightsOf(rounds, shown);
  const buckets = bucketsAt(nights, focus.level);
  const index = indexAt(buckets, focus.at);
  const bucket = buckets[index];
  const up = UP[focus.level];
  const down = DOWN[focus.level];

  const go = (level: Level, at: number) => {
    if (LEVELS.indexOf(level) > LEVELS.indexOf(highest)) setHighest(level);
    setFocus({ level, at });
  };
  const step = (by: -1 | 1) => {
    const next = buckets[index + by];
    if (next) setFocus({ level: focus.level, at: next.start });
  };
  // Swiping left brings in what comes after, as turning a page does.
  const swipe = useSwipe((direction) => step(direction === -1 ? 1 : -1), true);

  const thisYear = new Date().getFullYear();
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  const dayOf = (at: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(new Date(at).getFullYear() === thisYear ? {} : { year: 'numeric' }),
    }).format(at);
  const labelOf = (level: Level, at: number): string => {
    switch (level) {
      case 'night':
        return dayOf(at);
      case 'month':
        return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(at);
      case 'year':
        return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(at);
      case 'all':
        return t('stats.all');
    }
  };
  // One time for a single drink; the range runs past midnight unremarked,
  // since the night is filed under the day it began.
  const hoursOf = (n: Night) =>
    n.start === n.end ? time.format(n.start) : `${time.format(n.start)}–${time.format(n.end)}`;

  // Everything above the level shown, broadest first.
  const crumbs: Level[] = [];
  for (let l = up; l; l = UP[l]) crumbs.unshift(l);

  const nameOf = (n: Pick<StatsName, 'nameKey' | 'name'>) => (n.nameKey ? t(n.nameKey as MessageKey) : (n.name ?? ''));
  const whoOf = (d: StatsDrink) => {
    const id = d.person ?? ME;
    const person = people.find((p) => p.id === id);
    return {
      name: person ? personName(person, t) : (d.personName ?? ''),
      colour: person ? personColourVar(person.colour) : undefined,
    };
  };

  const drinks = bucket ? bucket.nights.flatMap((n) => n.drinks) : [];
  const summary = summarize(drinks);
  // Bars are relative to the top drink shown, so a quiet night still shows
  // its shape instead of a row of slivers.
  const top = summary.lines[0]?.count ?? 1;
  const children = bucket && down ? bucketsAt(bucket.nights, down).reverse() : [];

  return (
    <Sheet
      title={t('stats.title')}
      onClose={onClose}
      onBack={() => {
        if (!up || !bucket || LEVELS.indexOf(focus.level) >= LEVELS.indexOf(highest)) return false;
        setFocus({ level: up, at: bucket.start });
        return true;
      }}
    >
      {choices.length > 0 && (
        <div className="stats__who" role="group" aria-label={t('people.tabs')}>
          {choices.map((person) => (
            <button
              key={person.id}
              type="button"
              className={clsx('stats__chip', shown === person.id && 'stats__chip--selected')}
              style={{ '--person': personColourVar(person.colour) } as CSSProperties}
              onClick={() => setWho(person.id)}
              aria-pressed={shown === person.id}
            >
              {personName(person, t)}
            </button>
          ))}
          <button
            type="button"
            className={clsx('stats__chip', 'stats__chip--everyone', shown === 'table' && 'stats__chip--selected')}
            onClick={() => setWho('table')}
            aria-pressed={shown === 'table'}
          >
            {t('stats.everyone')}
          </button>
        </div>
      )}

      {!bucket && <p className="field__hint">{t('stats.empty')}</p>}

      {bucket && (
        <section className="stats__period" {...swipe}>
          {crumbs.length > 0 && (
            <nav className="stats__crumbs">
              {crumbs.map((level) => (
                <button
                  key={level}
                  type="button"
                  className="stats__crumb"
                  onClick={() => go(level, bucket.start)}
                >
                  {labelOf(level, bucket.start)}
                </button>
              ))}
            </nav>
          )}

          <header className="stats__head">
            <button
              type="button"
              className="stats__step"
              onClick={() => step(-1)}
              disabled={index === 0}
              aria-label={t('stats.earlier')}
            >
              <UiIcon name="earlier" />
            </button>
            <div className="stats__title">
              <h3 className="stats__label">{labelOf(focus.level, bucket.start)}</h3>
              <span className="stats__sum">
                {focus.level === 'night' && bucket.nights[0] && `${hoursOf(bucket.nights[0])} · `}
                {focus.level === 'all' &&
                  `${t('stats.since', {
                    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(bucket.start),
                  })} · `}
                {/* "Total 5" rather than "5 drinks": the catalogues carry only
                    one/other plurals, which reads wrong in ru, pl and cs. */}
                {t('total.label')} {summary.drinks}
                {summary.anyPriced && (
                  <>
                    {' · '}
                    {summary.complete
                      ? formatMoney(summary.cents, currency, locale)
                      : t('total.partial', {
                          price: formatMoney(summary.cents, currency, locale),
                        })}
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              className="stats__step"
              onClick={() => step(1)}
              disabled={index === buckets.length - 1}
              aria-label={t('stats.later')}
            >
              <UiIcon name="later" />
            </button>
          </header>

          <ul className="stats__lines">
            {summary.lines.map((line) => (
              <li key={line.icon} className="stats__line">
                <BeverageIcon icon={line.icon} className="stats__icon" />
                <span className="stats__names">
                  {line.names.length === 1
                    ? nameOf(line.names[0]!)
                    : line.names.map((n) => `${nameOf(n)} ${n.count}`).join(' · ')}
                </span>
                <span className="stats__count">{line.count}</span>
                <span
                  className="stats__bar"
                  style={{
                    width: `${(line.count / top) * 100}%`,
                    background: liquidVar(line.icon),
                  }}
                />
              </li>
            ))}
          </ul>

          {focus.level === 'night' && (
            // The night itself: every drink at the time it was counted.
            <ol className="stats__drinks">
              {drinks.map((d, i) => {
                const person = shown === 'table' && choices.length > 0 ? whoOf(d) : null;
                return (
                  <li key={i} className="stats__drink">
                    <span className="stats__time">{time.format(d.at)}</span>
                    <BeverageIcon icon={d.icon} className="stats__drink-icon" />
                    <span className="stats__names">{nameOf(d)}</span>
                    {person && (
                      <span
                        className="stats__drinker"
                        style={person.colour ? ({ '--person': person.colour } as CSSProperties) : undefined}
                      >
                        {person.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {down && (
            <ul className="stats__children">
              {children.map((child) => {
                const total = child.nights.reduce((sum, n) => sum + n.drinks.length, 0);
                const night = down === 'night' ? child.nights[0] : undefined;
                return (
                  <li key={child.start}>
                    <button
                      type="button"
                      className="stats__child"
                      onClick={() => go(down, child.start)}
                    >
                      <span className="stats__child-label">{labelOf(down, child.start)}</span>
                      {night && <span className="stats__child-hours">{hoursOf(night)}</span>}
                      <span className="stats__count">{total}</span>
                      <span className="stats__child-go" aria-hidden="true">
                        ➔
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="field">
        <span className="field__label">{t('stats.keep')}</span>
        <div className="segmented">
          {([true, false] as const).map((on) => (
            <button
              key={String(on)}
              type="button"
              className={clsx(
                'segmented__option',
                historyEnabled === on && 'segmented__option--selected',
              )}
              onClick={() => setHistoryEnabled(on)}
              aria-pressed={historyEnabled === on}
            >
              {t(on ? 'stats.keepOn' : 'stats.keepOff')}
            </button>
          ))}
        </div>
        <span className="field__hint">{t('stats.keepHint')}</span>
      </div>

      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setConfirmClear(true)}
          disabled={history.length === 0}
        >
          {t('stats.clear')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>

      {confirmClear && (
        <ConfirmSheet
          title={t('stats.clearTitle')}
          body={t('stats.clearBody')}
          confirmLabel={t('stats.clear')}
          onConfirm={clearHistory}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </Sheet>
  );
}
