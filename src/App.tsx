import { useEffect, useMemo, useState } from 'react';
import { BeverageRow } from './components/BeverageRow';
import { UiIcon } from './components/UiIcon';
import { BeverageSheet } from './components/BeverageSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { ResetSheet } from './components/ResetSheet';
import { ShareSheet } from './components/ShareSheet';
import { useAppStore } from './store/useAppStore';
import { I18nContext, createTranslator, resolveLocale } from './i18n';
import type { Beverage } from './lib/types';
import { computeTotals } from './lib/totals';
import { useAppUpdate } from './lib/useAppUpdate';
import { isNativeApp } from './lib/platform';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { useViewportInset } from './lib/useViewportInset';
import { formatMoney, defaultCurrencyFor } from './lib/money';
import './App.scss';

const EMPTY_TALLY = { count: 0, lastAt: null } as const;

/** None of the shipped locales are RTL yet; kept so adding ar/he is a one-liner. */
const RTL_LOCALES = new Set<string>();

type Dialog =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'edit'; beverage: Beverage }
  | { kind: 'settings' }
  | { kind: 'reset' }
  | { kind: 'share' };

export function App() {
  const beverages = useAppStore((s) => s.beverages);
  const tallies = useAppStore((s) => s.tallies);
  const theme = useAppStore((s) => s.theme);
  const storedLocale = useAppStore((s) => s.locale);
  const storedCurrency = useAppStore((s) => s.currency);

  const increment = useAppStore((s) => s.increment);
  const decrement = useAppStore((s) => s.decrement);
  const addBeverage = useAppStore((s) => s.addBeverage);
  const updateBeverage = useAppStore((s) => s.updateBeverage);
  const removeBeverage = useAppStore((s) => s.removeBeverage);
  const resetSession = useAppStore((s) => s.resetSession);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });

  // Keeps sheets clear of the on-screen keyboard.
  useViewportInset();

  // Never reload out from under someone mid-round — offer it instead.
  const update = useAppUpdate();
  const install = useInstallPrompt();

  // German hosting law requires an Impressum and a privacy link reachable from
  // the site. The Play listing carries its own, so the packaged app omits them.
  const showLegal = !isNativeApp();

  const locale = storedLocale ?? resolveLocale(navigator.languages ?? [navigator.language]);
  const t = useMemo(() => createTranslator(locale), [locale]);

  // Reflect theme on <html> so the CSS tokens follow the explicit choice.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep the document itself in the active language: `lang` drives the
  // browser's translation prompt, hyphenation and screen-reader voice, and
  // the title/description are what the OS task switcher and PWA install
  // dialog show.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

    document.title = t('app.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('app.tagline'));
  }, [locale, t]);

  const totals = computeTotals(beverages, tallies);
  const total = totals.drinks;
  const currency = storedCurrency ?? defaultCurrencyFor(locale);

  return (
    <I18nContext.Provider value={{ locale, t }}>
      <div className="app">
        <header className="app__header">
          <div className="app__totals">
            <span className="app__total-label">{t('total.label')}</span>
            <span className="app__total-value">{total}</span>
            {totals.anyPriced && (
              <span
                className="app__total-money"
                // An incomplete sum is a floor, not the bill — say so rather
                // than showing a confident number that is quietly too low.
                title={totals.complete ? undefined : t('total.partialHint')}
              >
                {totals.complete
                  ? formatMoney(totals.cents, currency, locale)
                  : t('total.partial', {
                      price: formatMoney(totals.cents, currency, locale),
                    })}
              </span>
            )}
          </div>
          <div className="app__header-actions">
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'share' })}
              aria-label={t('share.action')}
            >
              <UiIcon name="share" />
            </button>
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'settings' })}
              aria-label={t('action.settings')}
            >
              <UiIcon name="settings" />
            </button>
            <button
              type="button"
              className="app__icon-btn app__icon-btn--reset"
              onClick={() => setDialog({ kind: 'reset' })}
              aria-label={t('action.reset')}
              disabled={total === 0 && beverages.every((b) => b.scope === 'default')}
            >
              <UiIcon name="reset" />
            </button>
          </div>
        </header>

        <main className="app__main">
          {total === 0 && (
            <div className="app__empty">
              <p className="app__empty-title">{t('empty.title')}</p>
              <p className="app__empty-body">{t('empty.body')}</p>
            </div>
          )}

          <ul className="app__list">
            {beverages.map((beverage) => (
              <BeverageRow
                key={beverage.id}
                beverage={beverage}
                tally={tallies[beverage.id] ?? EMPTY_TALLY}
                onIncrement={() => increment(beverage.id)}
                onDecrement={() => decrement(beverage.id)}
                onEdit={() => setDialog({ kind: 'edit', beverage })}
              />
            ))}
          </ul>
        </main>

        {install.bannerVisible && (
          <div className="app__install">
            <span className="app__install-text">
              {install.manualOnly ? t('install.ios') : t('install.banner')}
            </span>
            <span className="app__install-actions">
              <button
                type="button"
                className="app__install-dismiss"
                onClick={install.dismissBanner}
              >
                {t('install.dismiss')}
              </button>
              {!install.manualOnly && (
                <button
                  type="button"
                  className="app__install-btn"
                  onClick={() => void install.install()}
                >
                  {t('install.action')}
                </button>
              )}
            </span>
          </div>
        )}

        {update.ready && (
          <div className="app__update" role="status">
            <span>{t('update.ready')}</span>
            <button
              type="button"
              className="app__update-btn"
              onClick={update.apply}
            >
              {t('update.reload')}
            </button>
          </div>
        )}

        <footer className="app__footer">
          <button
            type="button"
            className="btn btn--ghost app__add"
            onClick={() => setDialog({ kind: 'add' })}
          >
            ＋ {t('action.addDrink')}
          </button>

          {showLegal && (
            <nav className="app__legal">
              <button
                type="button"
                className="app__legal-store"
                onClick={() => setDialog({ kind: 'share' })}
              >
                <UiIcon name="android" />
                {t('store.link')}
              </button>
              <span aria-hidden="true">·</span>
              <a href="./privacy/">{t('legal.privacy')}</a>
              <span aria-hidden="true">·</span>
              <a href="./impressum/">{t('legal.imprint')}</a>
            </nav>
          )}
        </footer>

        {dialog.kind === 'add' && (
          <BeverageSheet
            onSave={(data) => addBeverage(data)}
            onClose={() => setDialog({ kind: 'none' })}
          />
        )}

        {dialog.kind === 'edit' && (
          <BeverageSheet
            existing={dialog.beverage}
            onSave={({ name, icon, priceCents }) =>
              updateBeverage(dialog.beverage.id, { name, icon, priceCents })
            }
            onDelete={() => removeBeverage(dialog.beverage.id)}
            onClose={() => setDialog({ kind: 'none' })}
          />
        )}

        {dialog.kind === 'settings' && <SettingsSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'share' && <ShareSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'reset' && (
          <ResetSheet onConfirm={resetSession} onClose={() => setDialog({ kind: 'none' })} />
        )}
      </div>
    </I18nContext.Provider>
  );
}
