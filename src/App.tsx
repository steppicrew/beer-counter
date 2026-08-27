import { useEffect, useMemo, useState } from 'react';
import { BeverageRow } from './components/BeverageRow';
import { BeverageSheet } from './components/BeverageSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { ResetSheet } from './components/ResetSheet';
import { useAppStore } from './store/useAppStore';
import { I18nContext, createTranslator, resolveLocale } from './i18n';
import type { Beverage } from './lib/types';
import './App.scss';

const EMPTY_TALLY = { count: 0, lastAt: null } as const;

/** None of the shipped locales are RTL yet; kept so adding ar/he is a one-liner. */
const RTL_LOCALES = new Set<string>();

type Dialog =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'edit'; beverage: Beverage }
  | { kind: 'settings' }
  | { kind: 'reset' };

export function App() {
  const beverages = useAppStore((s) => s.beverages);
  const tallies = useAppStore((s) => s.tallies);
  const theme = useAppStore((s) => s.theme);
  const storedLocale = useAppStore((s) => s.locale);

  const increment = useAppStore((s) => s.increment);
  const decrement = useAppStore((s) => s.decrement);
  const addBeverage = useAppStore((s) => s.addBeverage);
  const updateBeverage = useAppStore((s) => s.updateBeverage);
  const removeBeverage = useAppStore((s) => s.removeBeverage);
  const resetSession = useAppStore((s) => s.resetSession);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });

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

  const total = Object.values(tallies).reduce((sum, entry) => sum + entry.count, 0);

  return (
    <I18nContext.Provider value={{ locale, t }}>
      <div className="app">
        <header className="app__header">
          <div className="app__totals">
            <span className="app__total-label">{t('total.label')}</span>
            <span className="app__total-value">{total}</span>
          </div>
          <div className="app__header-actions">
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'settings' })}
              aria-label={t('action.settings')}
            >
              ⚙
            </button>
            <button
              type="button"
              className="app__icon-btn app__icon-btn--reset"
              onClick={() => setDialog({ kind: 'reset' })}
              aria-label={t('action.reset')}
              disabled={total === 0 && beverages.every((b) => b.scope === 'default')}
            >
              ⟲
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

        <footer className="app__footer">
          <button
            type="button"
            className="btn btn--ghost app__add"
            onClick={() => setDialog({ kind: 'add' })}
          >
            ＋ {t('action.addDrink')}
          </button>
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
            onSave={({ name, icon }) => updateBeverage(dialog.beverage.id, { name, icon })}
            onDelete={() => removeBeverage(dialog.beverage.id)}
            onClose={() => setDialog({ kind: 'none' })}
          />
        )}

        {dialog.kind === 'settings' && <SettingsSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'reset' && (
          <ResetSheet onConfirm={resetSession} onClose={() => setDialog({ kind: 'none' })} />
        )}
      </div>
    </I18nContext.Provider>
  );
}
