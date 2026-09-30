import { useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { ConfirmSheet } from './ConfirmSheet';
import { BeverageIcon } from './BeverageIcon';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { archiveRound, computeStats, firstDayOfWeek } from '../lib/stats';
import type { PeriodStats, StatsName, StatsPeriod } from '../lib/stats';
import { formatMoney, defaultCurrencyFor } from '../lib/money';
import { liquidVar } from '../lib/liquids';
import './StatsSheet.scss';

const PERIODS: { period: StatsPeriod; labelKey: 'stats.week' | 'stats.month' | 'stats.year' }[] = [
  { period: 'week', labelKey: 'stats.week' },
  { period: 'month', labelKey: 'stats.month' },
  { period: 'year', labelKey: 'stats.year' },
];

function periodLabel(stats: PeriodStats, period: StatsPeriod, locale: string): string {
  const thisYear = new Date().getFullYear();
  const sameYear = new Date(stats.start).getFullYear() === thisYear;
  switch (period) {
    case 'year':
      return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(stats.start);
    case 'month':
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(stats.start);
    case 'week':
      // `end` is already the next week's first midnight; one millisecond
      // earlier is the last day. Subtracting a whole day would land on the
      // day before across a spring-forward DST change.
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
      }).formatRange(stats.start, stats.end - 1);
  }
}

export function StatsSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const beverages = useAppStore((s) => s.beverages);
  const tallies = useAppStore((s) => s.tallies);
  const history = useAppStore((s) => s.history);
  const historyEnabled = useAppStore((s) => s.historyEnabled);
  const setHistoryEnabled = useAppStore((s) => s.setHistoryEnabled);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const storedCurrency = useAppStore((s) => s.currency);

  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [confirmClear, setConfirmClear] = useState(false);

  const currency = storedCurrency ?? defaultCurrencyFor(locale);
  const weekStart = firstDayOfWeek(locale, navigator.languages ?? [navigator.language]);

  // The round in progress counts too — otherwise tonight would be missing
  // from this week until the next reset.
  const current = archiveRound(beverages, tallies);
  const stats = computeStats(current ? [...history, current] : history, period, weekStart);

  const nameOf = (n: StatsName) => (n.nameKey ? t(n.nameKey as MessageKey) : (n.name ?? ''));

  return (
    <Sheet title={t('stats.title')} onClose={onClose}>
      <div className="segmented">
        {PERIODS.map(({ period: p, labelKey }) => (
          <button
            key={p}
            type="button"
            className={clsx('segmented__option', period === p && 'segmented__option--selected')}
            onClick={() => setPeriod(p)}
            aria-pressed={period === p}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {stats.length === 0 && <p className="field__hint">{t('stats.empty')}</p>}

      {stats.map((bucket) => {
        // Bars are relative to the period's own top drink, so a quiet week
        // still shows its shape instead of a row of slivers.
        const top = bucket.lines[0]?.count ?? 1;
        return (
          <section key={bucket.start} className="stats__period">
            <header className="stats__head">
              <h3 className="stats__label">{periodLabel(bucket, period, locale)}</h3>
              <span className="stats__sum">
                {/* "Total 5" rather than "5 drinks": the catalogues carry only
                    one/other plurals, which reads wrong in ru, pl and cs. */}
                {t('total.label')} {bucket.drinks}
                {bucket.anyPriced && (
                  <>
                    {' · '}
                    {bucket.complete
                      ? formatMoney(bucket.cents, currency, locale)
                      : t('total.partial', {
                          price: formatMoney(bucket.cents, currency, locale),
                        })}
                  </>
                )}
              </span>
            </header>

            <ul className="stats__lines">
              {bucket.lines.map((line) => (
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
          </section>
        );
      })}

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
