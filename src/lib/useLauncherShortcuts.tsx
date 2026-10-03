import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { BeverageIcon } from '../components/BeverageIcon';
import { UiIcon } from '../components/UiIcon';
import { createTranslator } from '../i18n';
import type { MessageKey } from '../i18n';
import { isNativeApp } from './platform';
import { shortcutIcon } from './shortcutIcons';
import type { Beverage } from './types';
import { useAppStore } from '../store/useAppStore';

interface ShortcutItem {
  id: string;
  shortLabel: string;
  longLabel: string;
  url: string;
  /** Base64 PNG, or absent to use the app icon. */
  icon?: string;
}

interface ShortcutsPlugin {
  set(options: { items: ShortcutItem[] }): Promise<void>;
  reportUsed(options: { id: string }): Promise<void>;
}

const Shortcuts = registerPlugin<ShortcutsPlugin>('Shortcuts');

/** Drinks in the menu; the fourth slot is the new round. Launchers show about four. */
const DRINK_SLOTS = 3;

const SCHEME = 'beercounter:';
const countUrl = (id: string) => `beercounter://count/${encodeURIComponent(id)}`;
const RESET_URL = 'beercounter://reset';

/** The drinks tapped most over time, ties in list order — so a new install offers the first three. */
function topDrinks(beverages: Beverage[], usage: Record<string, number>): Beverage[] {
  return beverages
    .map((beverage, index) => ({ beverage, index, taps: usage[beverage.id] ?? 0 }))
    .sort((a, b) => b.taps - a.taps || a.index - b.index)
    .slice(0, DRINK_SLOTS)
    .map(({ beverage }) => beverage);
}

/**
 * The launcher's long-press menu: "+1" for the drinks tapped most, and
 * "Reset", which only opens the "Start a new round?" sheet — a slip of the
 * thumb on the home screen must never wipe a round.
 *
 * Tapping a shortcut opens the app with a beercounter:// link and the drink
 * is counted here, where the counts live; the native side cannot write them
 * without the page. Nothing on the web, whose manifest can only declare
 * fixed shortcuts.
 */
export function useLauncherShortcuts({
  locale,
  onReset,
}: {
  locale: string;
  /** Must be stable: the link listener is registered once. */
  onReset: () => void;
}) {
  const beverages = useAppStore((s) => s.beverages);
  const usage = useAppStore((s) => s.usage);
  const native = isNativeApp();

  // Republish only when what the menu shows changes, not on every count.
  const signature = JSON.stringify([
    locale,
    topDrinks(beverages, usage).map((b) => [b.id, b.nameKey ?? b.name, b.icon]),
  ]);

  useEffect(() => {
    if (!native) return;
    let live = true;
    const t = createTranslator(locale);
    const { beverages: current, usage: taps } = useAppStore.getState();
    void (async () => {
      const shortcuts: ShortcutItem[] = [];
      for (const beverage of topDrinks(current, taps)) {
        const name = beverage.nameKey ? t(beverage.nameKey as MessageKey) : (beverage.name ?? '');
        const icon = await shortcutIcon(<BeverageIcon icon={beverage.icon} />);
        shortcuts.push({
          id: `count-${beverage.id}`,
          shortLabel: `+1 ${name}`,
          longLabel: `+1 ${name}`,
          url: countUrl(beverage.id),
          ...(icon ? { icon } : {}),
        });
      }
      const resetIcon = await shortcutIcon(<UiIcon name="reset" />);
      shortcuts.push({
        id: 'reset',
        shortLabel: t('action.reset'),
        longLabel: t('reset.title'),
        url: RESET_URL,
        ...(resetIcon ? { icon: resetIcon } : {}),
      });
      if (live) await Shortcuts.set({ items: shortcuts }).catch(() => {});
    })();
    return () => {
      live = false;
    };
  }, [native, locale, signature]);

  useEffect(() => {
    if (!native) return;

    const handle = (url: string) => {
      if (!url.startsWith(SCHEME)) return;
      const link = new URL(url);
      const state = useAppStore.getState();
      if (link.host === 'count') {
        const id = decodeURIComponent(link.pathname.slice(1));
        // A pinned shortcut can outlive its drink; then it just opens the app.
        if (!state.beverages.some((b) => b.id === id)) return;
        state.increment(id);
        void Shortcuts.reportUsed({ id: `count-${id}` }).catch(() => {});
      } else if (link.host === 'reset') {
        const anything = state.totalDrinks() > 0 || state.beverages.some((b) => b.scope === 'session');
        if (anything) onReset();
        void Shortcuts.reportUsed({ id: 'reset' }).catch(() => {});
      }
    };

    // Every shortcut tap arrives as appUrlOpen, a cold start included:
    // Capacitor's BridgeActivity passes the launching intent through
    // onNewIntent itself, and the plugin holds the event until this listener
    // exists. getLaunchUrl() would report the same tap a second time — that
    // counted two beers for one — and a reload of the page would replay it.
    const listener = CapacitorApp.addListener('appUrlOpen', ({ url }) => handle(url));
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [native, onReset]);
}
