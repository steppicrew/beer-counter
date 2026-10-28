import { create } from 'zustand';
import { useAppStore } from '../store/useAppStore';
import { NIGHT_GAP } from './stats';

interface Pending {
  /** The latest drink at the table, for the question's wording. */
  lastAt: number;
  beverageId: string;
  count: () => void;
}

/**
 * A drink held back while the "new night?" question is open. Not persisted:
 * a question nobody answered before the app was killed just never counts.
 */
export const useNewNight = create<{ pending: Pending | null }>(() => ({ pending: null }));

/** The latest drink anyone at the table has counted, or null. */
function lastDrinkAt(): number | null {
  let last: number | null = null;
  for (const own of Object.values(useAppStore.getState().tallies)) {
    for (const tally of Object.values(own)) {
      const at = tally.times.at(-1);
      if (at !== undefined && (last === null || at > last)) last = at;
    }
  }
  return last;
}

/**
 * Counts a drink, or first asks whether it starts a new night. Measured
 * against the whole table, since a reset clears everyone, and against the
 * drink's own time: a forgotten one filed back into last night is last
 * night's, however late it is entered.
 *
 * Keeping on counts the drink, which closes the gap, so the next tap does
 * not ask again.
 */
export function countOrAsk(beverageId: string, at: number, count: () => void) {
  const lastAt = lastDrinkAt();
  if (lastAt !== null && at - lastAt >= NIGHT_GAP) {
    useNewNight.setState({ pending: { lastAt, beverageId, count } });
  } else {
    count();
  }
}

/** The answer. Without one — Back, a tap outside — nothing is counted. */
export function answerNewNight(answer: 'reset' | 'keep' | 'cancel') {
  const { pending } = useNewNight.getState();
  useNewNight.setState({ pending: null });
  if (!pending || answer === 'cancel') return;
  const store = useAppStore.getState();
  if (answer === 'reset') store.resetSession(pending.beverageId);
  pending.count();
}
