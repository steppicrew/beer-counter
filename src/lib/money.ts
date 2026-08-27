import type { CurrencyCode } from './types';

/**
 * Prices are held as integer minor units so a long round never accumulates
 * float drift. Formatting and parsing both go through Intl so the decimal
 * separator, symbol placement and zero-decimal currencies (JPY) follow the
 * active locale rather than being hard-coded.
 */

/** Minor units per major unit — 100 for EUR/USD, 1 for JPY. */
export function minorUnitFactor(currency: CurrencyCode, locale: string): number {
  const digits =
    new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return 10 ** digits;
}

export function formatMoney(
  cents: number,
  currency: CurrencyCode,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    cents / minorUnitFactor(currency, locale),
  );
}

/**
 * Parses what someone actually types: "3", "3,50", "3.50", "€3.50".
 * Returns null for anything that is not a non-negative amount.
 */
export function parseMoney(
  input: string,
  currency: CurrencyCode,
  locale: string,
): number | null {
  const cleaned = input.trim().replace(/[^\d.,-]/g, '');
  if (cleaned === '') return null;

  // Whichever separator comes last is the decimal one ("1.234,50" vs "1,234.50").
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);

  const normalised =
    decimalAt === -1
      ? cleaned.replace(/[.,]/g, '')
      : `${cleaned.slice(0, decimalAt).replace(/[.,]/g, '')}.${cleaned.slice(decimalAt + 1)}`;

  const value = Number(normalised);
  if (!Number.isFinite(value) || value < 0) return null;

  return Math.round(value * minorUnitFactor(currency, locale));
}

/** The currency a locale would normally use, as the initial setting. */
export function defaultCurrencyFor(locale: string): CurrencyCode {
  const byLanguage: Record<string, CurrencyCode> = {
    en: 'USD',
    de: 'EUR',
    fr: 'EUR',
    es: 'EUR',
    it: 'EUR',
    nl: 'EUR',
    pt: 'EUR',
    pl: 'PLN',
    cs: 'CZK',
    da: 'DKK',
    sv: 'SEK',
    tr: 'TRY',
    ru: 'RUB',
    ja: 'JPY',
    zh: 'CNY',
  };
  return byLanguage[locale] ?? 'EUR';
}

export const CURRENCIES: CurrencyCode[] = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'PLN',
  'CZK',
  'DKK',
  'SEK',
  'NOK',
  'TRY',
  'RUB',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
];
