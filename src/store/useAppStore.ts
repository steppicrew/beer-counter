import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Beverage,
  CurrencyCode,
  IconKey,
  Round,
  Tally,
  ThemeMode,
} from '../lib/types';
import { DEFAULT_BEVERAGES } from '../lib/defaults';
import { archiveRound } from '../lib/stats';
import type { TipProductId } from '../lib/tips';

interface AppState {
  beverages: Beverage[];
  tallies: Record<string, Tally>;
  sessionStartedAt: number;
  /** Finished rounds, oldest first. Only ever written by resetSession. */
  history: Round[];
  /** Off means a reset discards the round, as it did before history existed. */
  historyEnabled: boolean;
  /**
   * Set once the barkeeper has pointed at the tip jar, or the user has
   * tipped. He asks once ever — a bar that keeps asking is a nag.
   */
  tipAsked: boolean;
  /** Takes the tip jar off the bar for good. */
  tipped: boolean;
  /** A paid tip not yet thanked for: its coin drops when nothing covers the bar. */
  coinPending: boolean;
  /**
   * Tips Play confirmed as paid, oldest first, by level: what is in the jar
   * — coins for a small beer, a note for the larger ones.
   */
  tipLog: TipProductId[];
  /**
   * Taps per drink id, across every round: which drinks the launcher's
   * long-press menu offers. Only the "+" counts — a back-dated drink or one
   * moved on the bar is a correction, not a habit.
   */
  usage: Record<string, number>;

  theme: ThemeMode;
  /** null = follow browser/system language. */
  locale: string | null;
  /** null = derive from the active locale on first use. */
  currency: CurrencyCode | null;

  increment: (id: string) => void;
  decrement: (id: string) => void;
  /** Counts one drink at an earlier time — the tap that was forgotten. */
  incrementAt: (id: string, at: number) => void;
  /** Moves one counted drink to another time, e.g. dragged back on the bar. */
  moveDrink: (id: string, from: number, to: number) => void;

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
  markTipAsked: () => void;
  /**
   * `paid` is true only when Play confirmed the money; a pending payment or a
   * click on the web link still retires the jar, but earns no coin.
   */
  recordTip: (paid: boolean, level?: TipProductId) => void;
  clearCoin: () => void;

  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: string | null) => void;
  setCurrency: (currency: CurrencyCode) => void;

  totalDrinks: () => number;
}

const emptyTally: Tally = { times: [] };

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        beverages: DEFAULT_BEVERAGES,
        tallies: {},
        sessionStartedAt: Date.now(),
        history: [],
        historyEnabled: true,
        tipAsked: false,
        tipped: false,
        coinPending: false,
        tipLog: [],
        usage: {},
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
              usage: { ...state.usage, [id]: (state.usage[id] ?? 0) + 1 },
            };
          }),

        // Times stay sorted oldest-first wherever they come from: the bar, the
        // "last drink" label and the history all read the newest as the last.
        // A back-dated drink is therefore filed in its place, and the minus
        // button removes the most recent drink by time, not the last added.
        incrementAt: (id, at) =>
          set((state) => {
            const current = state.tallies[id] ?? emptyTally;
            const when = Math.min(at, Date.now());
            return {
              tallies: {
                ...state.tallies,
                [id]: { times: [...current.times, when].sort((a, b) => a - b) },
              },
            };
          }),

        moveDrink: (id, from, to) =>
          set((state) => {
            const current = state.tallies[id];
            const index = current?.times.indexOf(from) ?? -1;
            if (!current || index === -1) return state;
            const times = [...current.times];
            times[index] = Math.min(to, Date.now());
            times.sort((a, b) => a - b);
            return { tallies: { ...state.tallies, [id]: { times } } };
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
        markTipAsked: () => set({ tipAsked: true }),
        recordTip: (paid, level = 'tip_small') =>
          set((state) => ({
            tipAsked: true,
            tipped: true,
            coinPending: state.coinPending || paid,
            tipLog: paid ? [...state.tipLog, level] : state.tipLog,
          })),
        clearCoin: () => set({ coinPending: false }),

        setTheme: (theme) => set({ theme }),
        setLocale: (locale) => set({ locale }),
        setCurrency: (currency) => set({ currency }),

        totalDrinks: () =>
          Object.values(get().tallies).reduce((sum, t) => sum + t.times.length, 0),
      }),
      {
        name: 'beer-counter-state',
        storage: createJSONStorage(() => localStorage),
        version: 4,
        /**
         * v1 stored `{ count, lastAt }`. Only the newest drink had a time, so
         * the older entries are unknowable — they are seeded to that same
         * timestamp, which keeps counts and the displayed "last drink" exact
         * and only affects undo history the user never had anyway.
         */
        migrate: (persisted, version) => {
          // v4 records each tip's level instead of a count. The count only
          // ever existed in internal test builds; those tips become small ones.
          if (version >= 2) {
            const state = persisted as { tips?: number; tipLog?: TipProductId[] };
            if (version < 4 && typeof state.tips === 'number' && !state.tipLog) {
              const { tips, ...rest } = state;
              return { ...rest, tipLog: Array<TipProductId>(Math.max(0, tips)).fill('tip_small') } as unknown as AppState;
            }
            // v3 only added the history. persist's merge fills the missing
            // fields from the initial state, so it starts empty and the round in
            // progress becomes its first entry.
            return persisted as AppState;
          }
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
          tipAsked: state.tipAsked,
          tipped: state.tipped,
          coinPending: state.coinPending,
          tipLog: state.tipLog,
          usage: state.usage,
          theme: state.theme,
          locale: state.locale,
          currency: state.currency,
        }),
      },
    ),
  ),
);
