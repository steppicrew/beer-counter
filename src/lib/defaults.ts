import type { Beverage } from './types';

/**
 * Shipped defaults. `nameKey` resolves through i18n so the same drink shows
 * up translated in every locale.
 */
export const DEFAULT_BEVERAGES: Beverage[] = [
  { id: 'beer', nameKey: 'drink.beer', icon: 'beer-large', scope: 'default' },
  { id: 'beer-small', nameKey: 'drink.beerSmall', icon: 'beer-small', scope: 'default' },
  { id: 'wine', nameKey: 'drink.wine', icon: 'wine', scope: 'default' },
  { id: 'schnapps', nameKey: 'drink.schnapps', icon: 'schnapps', scope: 'default' },
];
