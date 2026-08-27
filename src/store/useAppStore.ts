import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Beverage, CurrencyCode, IconKey, Tally, ThemeMode } from '../lib/types';
import { DEFAULT_BEVERAGES } from '../lib/defaults';

interface AppState {
  beverages: Beverage[];
  tallies: Record<string, Tally>;
  sessionStartedAt: number;

  theme: ThemeMode;
  /** null = follow browser/system language. */
  locale: string | null;
  /** null = derive from the active locale on first use. */
  currency: CurrencyCode | null;

  increment: (id: string) => void;
  decrement: (id: string) => void;

  addBeverage: (input: {
    name: string;
    icon: IconKey;
    scope: Beverage['scope'];
    priceCents?: number | undefined;
  }) => void;
  updateBeverage: (
    id: string,
    patch: Partial<Pick<Beverage, 'name' | 'icon'>> & { priceCents?: number | undefined },
  ) => void;
  removeBeverage: (id: string) => void;

  /** Zeroes every count and drops session-only drinks. Defaults survive. */
  resetSession: () => void;

  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: string | null) => void;
  setCurrency: (currency: CurrencyCode) => void;

  totalDrinks: () => number;
}

const emptyTally: Tally = { count: 0, lastAt: null };

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        beverages: DEFAULT_BEVERAGES,
        tallies: {},
        sessionStartedAt: Date.now(),
        theme: 'system',
        locale: null,
        currency: null,

        increment: (id) =>
          set((state) => {
            const current = state.tallies[id] ?? emptyTally;
            return {
              tallies: {
                ...state.tallies,
                [id]: { count: current.count + 1, lastAt: Date.now() },
              },
            };
          }),

        decrement: (id) =>
          set((state) => {
            const current = state.tallies[id] ?? emptyTally;
            if (current.count <= 0) return state;
            const count = current.count - 1;
            return {
              tallies: {
                ...state.tallies,
                // Dropping to zero clears the timer; otherwise the previous
                // timestamp stands (we don't track per-drink history).
                [id]: { count, lastAt: count === 0 ? null : current.lastAt },
              },
            };
          }),

        addBeverage: ({ name, icon, scope, priceCents }) =>
          set((state) => ({
            beverages: [
              ...state.beverages,
              {
                id: `${scope}-${crypto.randomUUID()}`,
                name,
                icon,
                scope,
                ...(priceCents === undefined ? {} : { priceCents }),
              },
            ],
          })),

        updateBeverage: (id, patch) =>
          set((state) => ({
            beverages: state.beverages.map((b) => {
              if (b.id !== id) return b;
              // An explicit user name replaces the i18n key for good — otherwise
              // the next language switch would silently undo the rename.
              const renamed = patch.name !== undefined && patch.name !== '';
              const { nameKey: _dropped, ...rest } = b;
              const base = renamed ? rest : b;

              // An explicit `undefined` price means "clear it", which spreading
              // alone would not do — the key has to go.
              const { priceCents, ...withoutPrice } = patch;
              const next = { ...base, ...withoutPrice };
              if (priceCents === undefined) delete next.priceCents;
              else next.priceCents = priceCents;
              return next;
            }),
          })),

        removeBeverage: (id) =>
          set((state) => {
            const { [id]: _removed, ...rest } = state.tallies;
            return {
              beverages: state.beverages.filter((b) => b.id !== id),
              tallies: rest,
            };
          }),

        resetSession: () =>
          set((state) => ({
            beverages: state.beverages.filter((b) => b.scope === 'default'),
            tallies: {},
            sessionStartedAt: Date.now(),
          })),

        setTheme: (theme) => set({ theme }),
        setLocale: (locale) => set({ locale }),
        setCurrency: (currency) => set({ currency }),

        totalDrinks: () =>
          Object.values(get().tallies).reduce((sum, t) => sum + t.count, 0),
      }),
      {
        name: 'beer-counter-state',
        storage: createJSONStorage(() => localStorage),
        version: 1,
        // Actions are recreated on load; only data is persisted.
        partialize: (state) => ({
          beverages: state.beverages,
          tallies: state.tallies,
          sessionStartedAt: state.sessionStartedAt,
          theme: state.theme,
          locale: state.locale,
          currency: state.currency,
        }),
      },
    ),
  ),
);
