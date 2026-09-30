import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  ArchivedDrink,
  Beverage,
  CurrencyCode,
  IconKey,
  Round,
  Tally,
  ThemeMode,
} from '../lib/types';
import { DEFAULT_BEVERAGES } from '../lib/defaults';

interface AppState {
  beverages: Beverage[];
  tallies: Record<string, Tally>;
  sessionStartedAt: number;
  /** Finished rounds, oldest first. Only ever written by resetSession. */
  history: Round[];
  /** Off means a reset discards the round, as it did before history existed. */
  historyEnabled: boolean;

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

  /**
   * Archives the round into the history, then zeroes every count and drops
   * session-only drinks. Defaults survive.
   */
  resetSession: () => void;
  setHistoryEnabled: (enabled: boolean) => void;
  clearHistory: () => void;

  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: string | null) => void;
  setCurrency: (currency: CurrencyCode) => void;

  totalDrinks: () => number;
}

const emptyTally: Tally = { times: [] };

/** The round as it stands, or null when nothing was counted. */
function archiveRound(beverages: Beverage[], tallies: Record<string, Tally>): Round | null {
  const drinks: ArchivedDrink[] = [];
  for (const b of beverages) {
    const times = tallies[b.id]?.times ?? [];
    if (times.length === 0) continue;
    drinks.push({
      ...(b.nameKey === undefined ? {} : { nameKey: b.nameKey }),
      ...(b.name === undefined ? {} : { name: b.name }),
      icon: b.icon,
      ...(b.priceCents === undefined ? {} : { priceCents: b.priceCents }),
      times,
    });
  }
  if (drinks.length === 0) return null;
  const all = drinks.flatMap((d) => d.times);
  return { startedAt: Math.min(...all), endedAt: Math.max(...all), drinks };
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        beverages: DEFAULT_BEVERAGES,
        tallies: {},
        sessionStartedAt: Date.now(),
        history: [],
        historyEnabled: true,
        theme: 'system',
        locale: null,
        currency: null,

        increment: (id) =>
          set((state) => {
            const current = state.tallies[id] ?? emptyTally;
            return {
              tallies: {
                ...state.tallies,
                [id]: { times: [...current.times, Date.now()] },
              },
            };
          }),

        decrement: (id) =>
          set((state) => {
            const current = state.tallies[id] ?? emptyTally;
            if (current.times.length === 0) return state;
            return {
              tallies: {
                ...state.tallies,
                // Popping the newest entry uncovers the one before it, so an
                // accidental tap-then-undo restores the previous drink's time
                // rather than losing it.
                [id]: { times: current.times.slice(0, -1) },
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
          set((state) => {
            const round = state.historyEnabled
              ? archiveRound(state.beverages, state.tallies)
              : null;
            return {
              beverages: state.beverages.filter((b) => b.scope === 'default'),
              tallies: {},
              sessionStartedAt: Date.now(),
              history: round ? [...state.history, round] : state.history,
            };
          }),

        setHistoryEnabled: (historyEnabled) => set({ historyEnabled }),
        clearHistory: () => set({ history: [] }),

        setTheme: (theme) => set({ theme }),
        setLocale: (locale) => set({ locale }),
        setCurrency: (currency) => set({ currency }),

        totalDrinks: () =>
          Object.values(get().tallies).reduce((sum, t) => sum + t.times.length, 0),
      }),
      {
        name: 'beer-counter-state',
        storage: createJSONStorage(() => localStorage),
        version: 3,
        /**
         * v1 stored `{ count, lastAt }`. Only the newest drink had a time, so
         * the older entries are unknowable — they are seeded to that same
         * timestamp, which keeps counts and the displayed "last drink" exact
         * and only affects undo history the user never had anyway.
         */
        migrate: (persisted, version) => {
          // v3 only added the history. persist's merge fills the missing
          // fields from the initial state, so it starts empty and the round in
          // progress becomes its first entry.
          if (version >= 2) return persisted as AppState;
          const state = persisted as { tallies?: Record<string, unknown> };
          const tallies: Record<string, Tally> = {};
          for (const [id, value] of Object.entries(state.tallies ?? {})) {
            const old = value as { count?: number; lastAt?: number | null; times?: number[] };
            if (Array.isArray(old.times)) {
              tallies[id] = { times: old.times };
              continue;
            }
            const count = Math.max(0, old.count ?? 0);
            const at = old.lastAt ?? Date.now();
            tallies[id] = { times: Array.from({ length: count }, () => at) };
          }
          return { ...(persisted as object), tallies } as AppState;
        },
        // Actions are recreated on load; only data is persisted.
        partialize: (state) => ({
          beverages: state.beverages,
          tallies: state.tallies,
          sessionStartedAt: state.sessionStartedAt,
          history: state.history,
          historyEnabled: state.historyEnabled,
          theme: state.theme,
          locale: state.locale,
          currency: state.currency,
        }),
      },
    ),
  ),
);
