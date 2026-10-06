/**
 * Locale table for the build/publish scripts. Mirrors src/i18n/locales.ts —
 * the app bundle is TypeScript and cannot be imported from plain Node scripts,
 * so the mapping to Play Console tags lives here as well. Keep the two in sync;
 * `node scripts/check-locales.mjs` verifies it.
 */
export const LOCALES = [
  { code: 'en', playStore: 'en-US', label: 'English' },
  { code: 'de', playStore: 'de-DE', label: 'Deutsch' },
  { code: 'fr', playStore: 'fr-FR', label: 'Français' },
  { code: 'es', playStore: 'es-ES', label: 'Español' },
  { code: 'it', playStore: 'it-IT', label: 'Italiano' },
  { code: 'nl', playStore: 'nl-NL', label: 'Nederlands' },
  { code: 'pl', playStore: 'pl-PL', label: 'Polski' },
  { code: 'pt', playStore: 'pt-PT', label: 'Português' },
  { code: 'cs', playStore: 'cs-CZ', label: 'Čeština' },
  { code: 'sk', playStore: 'sk', label: 'Slovenčina' },
  { code: 'da', playStore: 'da-DK', label: 'Dansk' },
  { code: 'sv', playStore: 'sv-SE', label: 'Svenska' },
  { code: 'nb', playStore: 'no-NO', label: 'Norsk' },
  { code: 'fi', playStore: 'fi-FI', label: 'Suomi' },
  { code: 'hu', playStore: 'hu-HU', label: 'Magyar' },
  { code: 'ro', playStore: 'ro', label: 'Română' },
  { code: 'hr', playStore: 'hr', label: 'Hrvatski' },
  { code: 'bg', playStore: 'bg', label: 'Български' },
  { code: 'el', playStore: 'el-GR', label: 'Ελληνικά' },
  { code: 'uk', playStore: 'uk', label: 'Українська' },
  { code: 'tr', playStore: 'tr-TR', label: 'Türkçe' },
  { code: 'ru', playStore: 'ru-RU', label: 'Русский' },
  { code: 'ja', playStore: 'ja-JP', label: '日本語' },
  { code: 'zh', playStore: 'zh-CN', label: '中文' },
];
