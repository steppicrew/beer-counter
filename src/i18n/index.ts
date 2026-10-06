import { createContext, useContext } from 'react';
import { CATALOGUES } from './strings';
import type { MessageKey, Messages } from './strings';
import { DEFAULT_LOCALE, LOCALE_CODES } from './locales';

export type { MessageKey, Messages };
export { LOCALES, DEFAULT_LOCALE } from './locales';

/**
 * Norwegian reaches us as "nb", the macrolanguage "no", or Nynorsk "nn";
 * the catalogue is Bokmål, which Nynorsk readers read without trouble.
 */
const ALIASES: Record<string, string> = { no: 'nb', nn: 'nb' };

/**
 * Picks the best supported locale for a list of browser/system preferences.
 * `navigator.languages` entries are region-tagged ("de-AT"), so match on the
 * primary subtag.
 */
export function resolveLocale(preferred: readonly string[]): string {
  for (const tag of preferred) {
    const subtag = tag.toLowerCase().split('-')[0];
    const primary = subtag && (ALIASES[subtag] ?? subtag);
    if (primary && LOCALE_CODES.includes(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

export function getMessages(locale: string): Messages {
  return CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE]!;
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function createTranslator(locale: string): Translate {
  const messages = getMessages(locale);
  return (key, vars) => {
    const template = messages[key];
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

export interface I18nValue {
  locale: string;
  t: Translate;
}

export const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
