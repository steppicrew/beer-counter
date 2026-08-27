import clsx from 'clsx';
import { Sheet } from './Sheet';
import { useI18n, LOCALES } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import type { ThemeMode } from '../lib/types';
import { CURRENCIES, defaultCurrencyFor } from '../lib/money';

const THEMES: { mode: ThemeMode; labelKey: 'settings.themeSystem' | 'settings.themeLight' | 'settings.themeDark' }[] = [
  { mode: 'system', labelKey: 'settings.themeSystem' },
  { mode: 'light', labelKey: 'settings.themeLight' },
  { mode: 'dark', labelKey: 'settings.themeDark' },
];

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useI18n();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const storedLocale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const storedCurrency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);

  return (
    <Sheet title={t('settings.title')} onClose={onClose}>
      <label className="field">
        <span className="field__label">{t('settings.language')}</span>
        <select
          className="field__select"
          value={storedLocale ?? ''}
          onChange={(e) => setLocale(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">{t('settings.languageSystem')}</option>
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">{t('settings.currency')}</span>
        <select
          className="field__select"
          value={storedCurrency ?? defaultCurrencyFor(locale)}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code} · {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: code,
                maximumFractionDigits: 0,
              })
                .format(0)
                .replace(/\d/g, '')
                .trim()}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field__label">{t('settings.theme')}</span>
        <div className="segmented">
          {THEMES.map(({ mode, labelKey }) => (
            <button
              key={mode}
              type="button"
              className={clsx('segmented__option', theme === mode && 'segmented__option--selected')}
              onClick={() => setTheme(mode)}
              aria-pressed={theme === mode}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <p className="field__hint">
        {t('settings.version', { version: __APP_VERSION__ })} · {t('settings.offline')}
      </p>

      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </Sheet>
  );
}
