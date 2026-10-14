import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Beverage,
  CurrencyCode,
  IconKey,
  Person,
  Round,
  Tally,
  ThemeMode,
} from '../lib/types';
import { ME, PERSON_COLOURS } from '../lib/types';
import { DEFAULT_BEVERAGES } from '../lib/defaults';
import { archiveRound } from '../lib/stats';
import type { TipProductId } from '../lib/tips';

/** One person's counts, by drink id. */
export type Tallies = Record<string, Tally>;

interface AppState {
  beverages: Beverage[];
  /**
   * Counts per person, then per drink. The drink list is the table's, shared
   * by everyone; only what each one has had is their own.
   */
  tallies: Record<string, Tallies>;
  /** Me first, then regulars and tonight's guests in the order they came. */
  people: Person[];
  /**
   * Who is at the table tonight, by id; Me always. With nobody else here the
   * app is the single counter it always was — no tabs.
   */
  table: string[];
  /** Whose drinks the list counts. */
  activePerson: string;
  /**
   * Set once a drink has been long-pressed: from then on the table's hint
   * about rounds is no longer needed. Nobody discovers a long-press alone.
   */
  roundHintSeen: boolean;
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
   * When the web tip link was clicked, while the barman has not yet asked
   * whether a tip actually went in; otherwise null. The web cannot see the
   * payment page, so he asks when they come back — after this moment, so
   * never while they are still here. Kept, so a later visit still asks.
   */
  tipAckSince: number | null;
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

  /** `person` defaults to the active one; the launcher always counts for Me. */
  increment: (id: string, person?: string) => void;
  decrement: (id: string) => void;
  /**
   * One of this drink for each of `people`, all at the same moment: the
   * waiter's tray, so it stands on the bar as one round.
   */
  pourRound: (id: string, people: readonly string[]) => void;
  /** Counts one drink at an earlier time — the tap that was forgotten. */
  incrementAt: (id: string, at: number) => void;
  /** Moves one counted drink to another time, e.g. dragged back on the bar. */
  moveDrink: (person: string, id: string, from: number, to: number) => void;

  /** Adds someone and seats them: they are added because they are here. */
  addPerson: (input: { name: string; scope: Person['scope'] }) => void;
  renamePerson: (id: string, name: string) => void;
  /** Forgets a regular for good. Their past rounds stay in the history. */
  removePerson: (id: string) => void;
  /**
   * Seats a regular, or stands them up again. Someone with drinks tonight
   * stays: leaving early just means no more drinks, and the round still
   * has to add up.
   */
  setSeated: (id: string, seated: boolean) => void;
  setActivePerson: (id: string) => void;
  markRoundHintSeen: () => void;

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
   * session-only drinks and guests. Defaults and regulars survive; the table
   * is just Me again.
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
  /** The web tip link was followed: ask about it on return. */
  awaitTipAck: () => void;
  /** Their answer. Yes is taken at their word and drops a coin like a paid tip. */
  ackTip: (tipped: boolean) => void;

  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: string | null) => void;
  setCurrency: (currency: CurrencyCode) => void;

  /** Drinks counted at the whole table. */
  totalDrinks: () => number;
}

const emptyTally: Tally = { times: [] };
const NO_TALLIES: Tallies = {};

export const ME_PERSON: Person = { id: ME, scope: 'default', colour: 0 };

/** One person's counts; a stable empty object for someone with none yet. */
export function talliesOf(state: { tallies: Record<string, Tallies> }, person: string): Tallies {
  return state.tallies[person] ?? NO_TALLIES;
}

export function countOf(tallies: Tallies): number {
  return Object.values(tallies).reduce((sum, t) => sum + t.times.length, 0);
}

/** The first colour nobody here wears yet, so two people never share one. */
function freeColour(people: Person[]): number {
  const used = new Set(people.map((p) => p.colour));
  for (let i = 0; i < PERSON_COLOURS; i++) if (!used.has(i)) return i;
  return people.length % PERSON_COLOURS;
}

/** `tallies` with one person's drink replaced. */
function withTally(
  tallies: Record<string, Tallies>,
  person: string,
  id: string,
  tally: Tally,
): Record<string, Tallies> {
  return { ...tallies, [person]: { ...tallies[person], [id]: tally } };
}

/**
 * Up to v4 the shape of a single person's tallies. v1 stored
 * `{ count, lastAt }`. Only the newest drink had a time, so the older entries
 * are unknowable — they are seeded to that same timestamp, which keeps counts
 * and the displayed "last drink" exact and only affects undo history the user
 * never had anyway.
 */
function migrateToV4(persisted: unknown, version: number): Record<string, unknown> {
  // v4 records each tip's level instead of a count. The count only
  // ever existed in internal test builds; those tips become small ones.
  if (version >= 2) {
    const state = persisted as { tips?: number; tipLog?: TipProductId[] };
    if (version < 4 && typeof state.tips === 'number' && !state.tipLog) {
      const { tips, ...rest } = state;
      return { ...rest, tipLog: Array<TipProductId>(Math.max(0, tips)).fill('tip_small') };
    }
    // v3 only added the history. persist's merge fills the missing
    // fields from the initial state, so it starts empty and the round in
    // progress becomes its first entry.
    return persisted as Record<string, unknown>;
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
  return { ...(persisted as object), tallies };
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        beverages: DEFAULT_BEVERAGES,
        tallies: {},
        people: [ME_PERSON],
        table: [ME],
        activePerson: ME,
        roundHintSeen: false,
        sessionStartedAt: Date.now(),
        history: [],
        historyEnabled: true,
        tipAsked: false,
        tipped: false,
        coinPending: false,
        tipLog: [],
        tipAckSince: null,
        usage: {},
        theme: 'system',
        locale: null,
        currency: null,

        increment: (id, person) =>
          set((state) => {
            const who = person ?? state.activePerson;
            const current = talliesOf(state, who)[id] ?? emptyTally;
            return {
              tallies: withTally(state.tallies, who, id, { times: [...current.times, Date.now()] }),
              // The launcher's menu offers *my* habits; Hans's beers must not
              // push my coffee off it.
              ...(who === ME ? { usage: { ...state.usage, [id]: (state.usage[id] ?? 0) + 1 } } : {}),
            };
          }),

        pourRound: (id, people) =>
          set((state) => {
            const at = Date.now();
            let tallies = state.tallies;
            for (const who of people) {
              if (!state.table.includes(who)) continue;
              const current = talliesOf({ tallies }, who)[id] ?? emptyTally;
              tallies = withTally(tallies, who, id, { times: [...current.times, at] });
            }
            return {
              tallies,
              ...(people.includes(ME) ? { usage: { ...state.usage, [id]: (state.usage[id] ?? 0) + 1 } } : {}),
            };
          }),

        // Times stay sorted oldest-first wherever they come from: the bar, the
        // "last drink" label and the history all read the newest as the last.
        // A back-dated drink is therefore filed in its place, and the minus
        // button removes the most recent drink by time, not the last added.
        incrementAt: (id, at) =>
          set((state) => {
            const who = state.activePerson;
            const current = talliesOf(state, who)[id] ?? emptyTally;
            const when = Math.min(at, Date.now());
            return {
              tallies: withTally(state.tallies, who, id, {
                times: [...current.times, when].sort((a, b) => a - b),
              }),
            };
          }),

        moveDrink: (person, id, from, to) =>
          set((state) => {
            const current = talliesOf(state, person)[id];
            const index = current?.times.indexOf(from) ?? -1;
            if (!current || index === -1) return state;
            const times = [...current.times];
            times[index] = Math.min(to, Date.now());
            times.sort((a, b) => a - b);
            return { tallies: withTally(state.tallies, person, id, { times }) };
          }),

        decrement: (id) =>
          set((state) => {
            const who = state.activePerson;
            const current = talliesOf(state, who)[id] ?? emptyTally;
            if (current.times.length === 0) return state;
            // Popping the newest entry uncovers the one before it, so an
            // accidental tap-then-undo restores the previous drink's time
            // rather than losing it.
            return {
              tallies: withTally(state.tallies, who, id, { times: current.times.slice(0, -1) }),
            };
          }),

        addPerson: ({ name, scope }) =>
          set((state) => {
            const person: Person = {
              id: `${scope}-${crypto.randomUUID()}`,
              name,
              scope,
              colour: freeColour(state.people),
            };
            return {
              people: [...state.people, person],
              table: [...state.table, person.id],
              activePerson: person.id,
            };
          }),

        renamePerson: (id, name) =>
          set((state) => ({
            people: state.people.map((p) => (p.id === id && id !== ME ? { ...p, name } : p)),
          })),

        removePerson: (id) =>
          set((state) => {
            if (id === ME) return state;
            const { [id]: _removed, ...tallies } = state.tallies;
            return {
              people: state.people.filter((p) => p.id !== id),
              table: state.table.filter((p) => p !== id),
              tallies,
              activePerson: state.activePerson === id ? ME : state.activePerson,
            };
          }),

        setSeated: (id, seated) =>
          set((state) => {
            if (id === ME || seated === state.table.includes(id)) return state;
            if (seated) return { table: [...state.table, id] };
            if (countOf(talliesOf(state, id)) > 0) return state;
            return {
              table: state.table.filter((p) => p !== id),
              activePerson: state.activePerson === id ? ME : state.activePerson,
            };
          }),

        markRoundHintSeen: () => set({ roundHintSeen: true }),

        setActivePerson: (id) =>
          set((state) => (state.table.includes(id) ? { activePerson: id } : state)),

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
          set((state) => ({
            beverages: state.beverages.filter((b) => b.id !== id),
            tallies: Object.fromEntries(
              Object.entries(state.tallies).map(([person, own]) => {
                const { [id]: _removed, ...rest } = own;
                return [person, rest];
              }),
            ),
          })),

        resetSession: () =>
          set((state) => {
            const round = state.historyEnabled
              ? archiveRound(state.beverages, state.tallies, state.people)
              : null;
            return {
              beverages: state.beverages.filter((b) => b.scope === 'default'),
              tallies: {},
              people: state.people.filter((p) => p.scope === 'default'),
              table: [ME],
              activePerson: ME,
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
        awaitTipAck: () => set({ tipAckSince: Date.now() }),
        ackTip: (tipped) =>
          set((state) =>
            tipped
              ? {
                  tipAckSince: null,
                  tipAsked: true,
                  tipped: true,
                  coinPending: true,
                  // The web only knows "a tip", not its size: a small one.
                  tipLog: [...state.tipLog, 'tip_small' as const],
                }
              : { tipAckSince: null },
          ),

        setTheme: (theme) => set({ theme }),
        setLocale: (locale) => set({ locale }),
        setCurrency: (currency) => set({ currency }),

        totalDrinks: () =>
          Object.values(get().tallies).reduce((sum, own) => sum + countOf(own), 0),
      }),
      {
        name: 'beer-counter-state',
        storage: createJSONStorage(() => localStorage),
        version: 5,
        migrate: (persisted, version) => {
          const state = migrateToV4(persisted, version);
          // v5 counts per person. Everything counted so far was mine.
          if (version < 5) {
            return { ...state, tallies: { [ME]: state.tallies ?? {} } } as unknown as AppState;
          }
          return state as unknown as AppState;
        },
        // Actions are recreated on load; only data is persisted.
        partialize: (state) => ({
          beverages: state.beverages,
          tallies: state.tallies,
          people: state.people,
          table: state.table,
          activePerson: state.activePerson,
          roundHintSeen: state.roundHintSeen,
          sessionStartedAt: state.sessionStartedAt,
          history: state.history,
          historyEnabled: state.historyEnabled,
          tipAsked: state.tipAsked,
          tipped: state.tipped,
          coinPending: state.coinPending,
          tipLog: state.tipLog,
          tipAckSince: state.tipAckSince,
          usage: state.usage,
          theme: state.theme,
          locale: state.locale,
          currency: state.currency,
        }),
      },
    ),
  ),
);
