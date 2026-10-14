import type { Person } from './types';
import { ME, PERSON_COLOURS } from './types';
import type { Translate } from '../i18n';

/**
 * A person's colour as a CSS value. The colours live in `styles/theme.scss`
 * as `--person-*` tokens, like the drinks' liquids, so both themes keep them.
 */
export function personColourVar(colour: number): string {
  return `var(--person-${colour % PERSON_COLOURS})`;
}

/** Me's name follows the language; everyone else is called what they were named. */
export function personName(person: Pick<Person, 'id' | 'name'>, t: Translate): string {
  return person.id === ME ? t('people.me') : (person.name ?? '');
}

/**
 * The last tab at a table: everyone's totals instead of one person's drinks.
 * Never a person's id — those are "me" or carry a scope prefix.
 */
export const TABLE_VIEW = 'table';
