/**
 * Supported locales. `code` is the BCP-47 tag used in the UI and by
 * `Intl`; `playStore` is the tag Play Console expects in release notes
 * and store-listing directories.
 */
export interface LocaleMeta {
  code: string;
  playStore: string;
  label: string;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', playStore: 'en-US', label: 'English' },
  { code: 'de', playStore: 'de-DE', label: 'Deutsch' },
  { code: 'fr', playStore: 'fr-FR', label: 'Français' },
  { code: 'es', playStore: 'es-ES', label: 'Español' },
  { code: 'it', playStore: 'it-IT', label: 'Italiano' },
  { code: 'nl', playStore: 'nl-NL', label: 'Nederlands' },
  { code: 'pl', playStore: 'pl-PL', label: 'Polski' },
  { code: 'pt', playStore: 'pt-PT', label: 'Português' },
  { code: 'cs', playStore: 'cs-CZ', label: 'Čeština' },
  { code: 'da', playStore: 'da-DK', label: 'Dansk' },
  { code: 'sv', playStore: 'sv-SE', label: 'Svenska' },
  { code: 'tr', playStore: 'tr-TR', label: 'Türkçe' },
  { code: 'ru', playStore: 'ru-RU', label: 'Русский' },
  { code: 'ja', playStore: 'ja-JP', label: '日本語' },
  { code: 'zh', playStore: 'zh-CN', label: '中文' },
];

export const DEFAULT_LOCALE = 'en';

export const LOCALE_CODES = LOCALES.map((l) => l.code);
