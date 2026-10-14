import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { BeverageRow } from './components/BeverageRow';
import { Bartop } from './components/Bartop';
import { UiIcon } from './components/UiIcon';
import { BeverageSheet } from './components/BeverageSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { ResetSheet } from './components/ResetSheet';
import { ShareSheet } from './components/ShareSheet';
import { TipSheet } from './components/TipSheet';
import { StatsSheet } from './components/StatsSheet';
import { PeopleSheet } from './components/PeopleSheet';
import { PeopleTabs } from './components/PeopleTabs';
import { talliesOf, useAppStore } from './store/useAppStore';
import { I18nContext, createTranslator, resolveLocale } from './i18n';
import type { Beverage, Tally } from './lib/types';
import { computeTotals, sumTotals } from './lib/totals';
import { useAppUpdate } from './lib/useAppUpdate';
import { isNativeApp } from './lib/platform';
import { setSystemBars } from './lib/systemBars';
import { REGULAR_AFTER_ROUNDS, TIP_URL, useTipOffers } from './lib/tips';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { useSystemDark } from './lib/useSystemDark';
import { useViewportInset } from './lib/useViewportInset';
import { useLauncherShortcuts } from './lib/useLauncherShortcuts';
import { useBarClock } from './lib/useBarClock';
import { useSwipe } from './lib/useSwipe';
import { personName, TABLE_VIEW } from './lib/people';
import { TableSummary } from './components/TableSummary';
import { formatMoney, defaultCurrencyFor, currencySymbol } from './lib/money';
import './App.scss';

const EMPTY_TALLY: Tally = { times: [] };

/** None of the shipped locales are RTL yet; kept so adding ar/he is a one-liner. */
const RTL_LOCALES = new Set<string>();

type Dialog =
  | { kind: 'none' }
  | { kind: 'add' }
  | { kind: 'edit'; beverage: Beverage }
  | { kind: 'settings' }
  | { kind: 'tip' }
  | { kind: 'reset' }
  | { kind: 'share' }
  | { kind: 'stats' }
  | { kind: 'people' };

// The page backgrounds, mirroring --bg in styles/theme.scss. Duplicated here
// because the system bars need the value as a plain colour before any
// stylesheet has resolved, and a computed style would read the old theme.
const LIGHT_BG = '#fff6e0';
const DARK_BG = '#12100e';

export function App() {
  const beverages = useAppStore((s) => s.beverages);
  // The list counts for one person at a time; the bar shows the whole table.
  const tallies = useAppStore((s) => talliesOf(s, s.activePerson));
  const tableTallies = useAppStore((s) => s.tallies);
  const table = useAppStore((s) => s.table);
  const people = useAppStore((s) => s.people);
  const activePerson = useAppStore((s) => s.activePerson);
  const setActivePerson = useAppStore((s) => s.setActivePerson);
  const tableTotal = useAppStore((s) => s.totalDrinks());
  const theme = useAppStore((s) => s.theme);
  const storedLocale = useAppStore((s) => s.locale);
  const storedCurrency = useAppStore((s) => s.currency);

  const increment = useAppStore((s) => s.increment);
  const decrement = useAppStore((s) => s.decrement);
  const addBeverage = useAppStore((s) => s.addBeverage);
  const updateBeverage = useAppStore((s) => s.updateBeverage);
  const removeBeverage = useAppStore((s) => s.removeBeverage);
  const resetSession = useAppStore((s) => s.resetSession);
  const moveDrink = useAppStore((s) => s.moveDrink);
  const rounds = useAppStore((s) => s.history.length);
  const tipAsked = useAppStore((s) => s.tipAsked);
  const markTipAsked = useAppStore((s) => s.markTipAsked);
  const tipped = useAppStore((s) => s.tipped);
  const tipLog = useAppStore((s) => s.tipLog);
  const coinPending = useAppStore((s) => s.coinPending);
  const tipAckSince = useAppStore((s) => s.tipAckSince);
  const ackTip = useAppStore((s) => s.ackTip);
  const clearCoin = useAppStore((s) => s.clearCoin);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const systemDark = useSystemDark();

  // Keeps sheets clear of the on-screen keyboard, and tells the bartop when
  // to stand down.
  const keyboardUp = useViewportInset();

  // Drives the bartop's "now" marker.
  const now = useBarClock();

  // Never reload out from under someone mid-round — offer it instead.
  const update = useAppUpdate();
  const install = useInstallPrompt();

  // German hosting law requires an Impressum and a privacy link reachable from
  // the site. The Play listing carries its own, so the packaged app omits them.
  const showLegal = !isNativeApp();

  const locale = storedLocale ?? resolveLocale(navigator.languages ?? [navigator.language]);
  const t = useMemo(() => createTranslator(locale), [locale]);

  // "+1" for the favourite drinks in the launcher's long-press menu.
  const askReset = useCallback(() => setDialog({ kind: 'reset' }), []);
  useLauncherShortcuts({ locale, onReset: askReset });

  // Reflect theme on <html> so the CSS tokens follow the explicit choice.
  //
  // The system bars are the reason this does more than set an attribute. The
  // app draws edge-to-edge on Android, so the bars show the page's own
  // background and take their icon colour from `color-scheme` and
  // `theme-color`. The static tags in index.html follow the OS via a media
  // query, which is wrong whenever the in-app setting overrides it — light
  // theme on a dark-mode phone left white icons on the pale background.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);

    const dark = theme === 'dark' || (theme === 'system' && systemDark);

    // Tells the platform which way to shade the bar icons. It has to name the
    // *resolved* scheme, not the setting: leaving it empty on 'system' — the
    // default — let the WebView fall back to its own idea of light, which put
    // dark icons over the dark page and hid the clock.
    root.style.colorScheme = dark ? 'dark' : 'light';

    // …and on Android the bar icons are also set natively, because the native
    // theme's flags follow the phone's dark mode, not this setting.
    setSystemBars(dark);

    // A single un-media'd tag wins over the media-query pair in index.html,
    // so the active colour is whatever this writes.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-dynamic]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.dataset.dynamic = '';
      document.head.appendChild(meta);
    }
    meta.content = dark ? DARK_BG : LIGHT_BG;
  }, [theme, systemDark]);

  // Keep the document itself in the active language: `lang` drives the
  // browser's translation prompt, hyphenation and screen-reader voice, and
  // the title/description are what the OS task switcher and PWA install
  // dialog show.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

    document.title = t('app.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('app.tagline'));
  }, [locale, t]);

  const totals = computeTotals(beverages, tallies);
  const total = totals.drinks;

  // More than one at the table: tabs, a swipe between them, and the header
  // naming whose total it shows. Alone it is the counter it always was.
  const tableMode = table.length > 1;
  const active = people.find((p) => p.id === activePerson);
  // The table's own tab, after everyone's. Not persisted: the app reopens on
  // someone's drinks, which is what it is opened for.
  const [tableShown, setTableShown] = useState(false);
  const showingTable = tableMode && tableShown;
  const current = showingTable ? TABLE_VIEW : activePerson;
  const tabs = [...table, TABLE_VIEW];
  // Which way the list came in, so a swipe reads as moving along the table.
  const [enteredFrom, setEnteredFrom] = useState<-1 | 1 | 0>(0);
  const switchTo = (id: string) => {
    const from = tabs.indexOf(current);
    const to = tabs.indexOf(id);
    if (to === -1 || to === from) return;
    setEnteredFrom(to > from ? 1 : -1);
    setTableShown(id === TABLE_VIEW);
    if (id !== TABLE_VIEW) setActivePerson(id);
  };
  const entered =
    enteredFrom === 1 ? 'app__list--from-right' : enteredFrom === -1 ? 'app__list--from-left' : undefined;
  const swipe = useSwipe((direction) => {
    const next = tabs[tabs.indexOf(current) - direction];
    if (next !== undefined) switchTo(next);
  }, tableMode);

  // On the table's tab the header is the table's bill.
  const shownTotals = showingTable
    ? sumTotals(table.map((id) => computeTotals(beverages, tableTallies[id] ?? {})))
    : totals;
  const currency = storedCurrency ?? defaultCurrencyFor(locale);

  // The barkeeper mentions the tip jar once, to a regular, on an empty bar —
  // and only where there is a jar: Play products in the app, the link on the
  // web. Never tied to how much has been drunk.
  const tipOffers = useTipOffers();
  const canTip = isNativeApp() ? tipOffers.length > 0 : TIP_URL !== null;
  const regular = canTip && rounds >= REGULAR_AFTER_ROUNDS && tableTotal === 0;
  const tipJarAsk = regular && !tipAsked && !tipped;

  // The jar itself is always on the bar wherever a tip is possible — silent,
  // still, at the right end. After a tip the coin drops in once, when no
  // sheet covers it, so the drop is actually seen; from then on it lies there.
  const showJar = canTip;
  const dropping = coinPending && dialog.kind === 'none';
  // The pending tip is only drawn once it can be seen going in.
  const jarTips = coinPending && !dropping ? tipLog.slice(0, -1) : tipLog;
  const openTips = () => {
    markTipAsked();
    setDialog({ kind: 'tip' });
  };

  // After the web tip link the barman asks, on their return, whether a tip
  // went in. "Return" is the page coming back after the click — into view
  // from another tab or the browser, or into focus from another window — or
  // a later visit while the question is still open (the page loaded after
  // the click). Never the moment of the click itself, while they are here.
  const [backAt, setBackAt] = useState(() => Date.now());
  useEffect(() => {
    const onBack = () => {
      if (document.visibilityState === 'visible') setBackAt(Date.now());
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, []);
  const tipQuestion =
    tipAckSince !== null && backAt > tipAckSince && dialog.kind === 'none'
      ? { onYes: () => ackTip(true), onNo: () => ackTip(false) }
      : undefined;

  // Seen and passed over counts as asked: once the round starts, his line is
  // gone and must not come back next time.
  const askedShown = useRef(false);
  useEffect(() => {
    if (tipJarAsk) askedShown.current = true;
    else if (askedShown.current && !tipAsked) markTipAsked();
  }, [tipJarAsk, tipAsked, markTipAsked]);

  // The drop and the barman's thanks last until the next drink is counted;
  // after that the coin simply lies in the jar.
  const totalAtDrop = useRef<number | null>(null);
  useEffect(() => {
    if (dropping && totalAtDrop.current === null) totalAtDrop.current = tableTotal;
    else if (totalAtDrop.current !== null && tableTotal !== totalAtDrop.current) {
      totalAtDrop.current = null;
      clearCoin();
    }
  }, [dropping, tableTotal, clearCoin]);

  return (
    <I18nContext.Provider value={{ locale, t }}>
      <div className="app">
        <header className="app__header">
          <div className="app__totals">
            <span className="app__total-label">
              {showingTable
                ? t('table.tab')
                : tableMode && active
                  ? personName(active, t)
                  : t('total.label')}
            </span>
            <span className="app__total-value">{shownTotals.drinks}</span>
            {shownTotals.anyPriced && (
              <span
                className="app__total-money"
                // An incomplete sum is a floor, not the bill — say so rather
                // than showing a confident number that is quietly too low.
                title={shownTotals.complete ? undefined : t('total.partialHint')}
              >
                {shownTotals.complete
                  ? formatMoney(shownTotals.cents, currency, locale)
                  : t('total.partial', {
                      price: formatMoney(shownTotals.cents, currency, locale),
                    })}
              </span>
            )}
          </div>
          <div className="app__header-actions">
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'share' })}
              aria-label={t('share.action')}
            >
              <UiIcon name="share" />
            </button>
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'stats' })}
              aria-label={t('stats.title')}
            >
              <UiIcon name="stats" />
            </button>
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'settings' })}
              aria-label={t('action.settings')}
            >
              <UiIcon name="settings" />
            </button>
            <button
              type="button"
              className="app__icon-btn app__icon-btn--reset"
              onClick={() => setDialog({ kind: 'reset' })}
              aria-label={t('action.reset')}
              disabled={
                tableTotal === 0 &&
                beverages.every((b) => b.scope === 'default') &&
                people.every((p) => p.scope === 'default') &&
                !tableMode
              }
            >
              <UiIcon name="reset" />
            </button>
          </div>
          {tableMode && <PeopleTabs current={current} onSelect={switchTo} />}
        </header>

        <main className={clsx('app__main', tableMode && 'app__main--table')} {...swipe}>
          {!showingTable && total === 0 && (
            <div className="app__empty">
              <p className="app__empty-title">{t('empty.title')}</p>
              <p className="app__empty-body">{t('empty.body')}</p>
            </div>
          )}

          {showingTable ? (
            <div key={TABLE_VIEW} className={clsx('app__list', entered)}>
              <TableSummary onOpen={switchTo} />
            </div>
          ) : (
          <ul
            // Keyed by person, so the list slides in afresh for each of them.
            key={activePerson}
            className={clsx('app__list', entered)}
          >
            {beverages.map((beverage) => (
              <BeverageRow
                key={beverage.id}
                beverage={beverage}
                tally={tallies[beverage.id] ?? EMPTY_TALLY}
                onIncrement={() => increment(beverage.id)}
                onDecrement={() => decrement(beverage.id)}
                onEdit={() => setDialog({ kind: 'edit', beverage })}
              />
            ))}
          </ul>
          )}
        </main>

        {/* Docked above the add button and always on screen: the drink list
            scrolls underneath it and fades out behind the counter rather than
            pushing it away. The keyboard is the only thing that takes it —
            it and an editing sheet cannot share the bottom of the screen. */}
        <Bartop
          beverages={beverages}
          tallies={tableTallies}
          seats={table}
          colours={
            table.length > 1
              ? Object.fromEntries(people.map((p) => [p.id, p.colour]))
              : undefined
          }
          now={now}
          hidden={keyboardUp}
          onMoveGlass={moveDrink}
          onTipJar={tipJarAsk ? openTips : undefined}
          tipQuestion={tipQuestion}
          tipJar={
            showJar
              ? { tipLog: jarTips, dropping, onOpen: openTips, label: currencySymbol(currency, locale) }
              : undefined
          }
        />

        {install.bannerVisible && (
          <div className="app__install">
            <span className="app__install-text">
              {install.manualOnly ? t('install.ios') : t('install.banner')}
            </span>
            <span className="app__install-actions">
              <button
                type="button"
                className="app__install-dismiss"
                onClick={install.dismissBanner}
              >
                {t('install.dismiss')}
              </button>
              {!install.manualOnly && (
                <button
                  type="button"
                  className="app__install-btn"
                  onClick={() => void install.install()}
                >
                  {t('install.action')}
                </button>
              )}
            </span>
          </div>
        )}

        {update.ready && (
          <div className="app__update" role="status">
            <span>{t('update.ready')}</span>
            <button
              type="button"
              className="app__update-btn"
              onClick={update.apply}
            >
              {t('update.reload')}
            </button>
          </div>
        )}

        <footer className="app__footer">
          <div className="app__footer-actions">
            <button
              type="button"
              className="btn btn--ghost app__add"
              onClick={() => setDialog({ kind: 'add' })}
            >
              ＋ {t('action.addDrink')}
            </button>
            {/* The way into counting for the whole table. Down here rather
                than in the header, which has no room left at 320px. */}
            <button
              type="button"
              className="app__icon-btn"
              onClick={() => setDialog({ kind: 'people' })}
              aria-label={t('people.open')}
            >
              <UiIcon name="people" />
            </button>
          </div>

          {showLegal && (
            <nav className="app__legal">
              <button
                type="button"
                className="app__legal-store"
                onClick={() => setDialog({ kind: 'share' })}
              >
                <UiIcon name="android" />
                {t('store.link')}
              </button>
              <span aria-hidden="true">·</span>
              <a href="./privacy/">{t('legal.privacy')}</a>
              <span aria-hidden="true">·</span>
              <a href="./impressum/">{t('legal.imprint')}</a>
              {TIP_URL && (
                <>
                  <span aria-hidden="true">·</span>
                  <a href={TIP_URL} target="_blank" rel="noopener">
                    {t('tip.title')}
                  </a>
                </>
              )}
            </nav>
          )}
        </footer>

        {dialog.kind === 'add' && (
          <BeverageSheet
            onSave={(data) => addBeverage(data)}
            onClose={() => setDialog({ kind: 'none' })}
          />
        )}

        {dialog.kind === 'edit' && (
          <BeverageSheet
            existing={dialog.beverage}
            onSave={({ name, icon, priceCents }) =>
              updateBeverage(dialog.beverage.id, { name, icon, priceCents })
            }
            onDelete={() => removeBeverage(dialog.beverage.id)}
            onClose={() => setDialog({ kind: 'none' })}
          />
        )}

        {dialog.kind === 'settings' && (
          <SettingsSheet onClose={() => setDialog({ kind: 'none' })} />
        )}

        {dialog.kind === 'tip' && <TipSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'stats' && <StatsSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'share' && <ShareSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'people' && <PeopleSheet onClose={() => setDialog({ kind: 'none' })} />}

        {dialog.kind === 'reset' && (
          <ResetSheet onConfirm={resetSession} onClose={() => setDialog({ kind: 'none' })} />
        )}
      </div>
    </I18nContext.Provider>
  );
}
