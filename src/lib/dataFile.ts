import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';
import { ICON_KEYS } from './types';
import { useAppStore } from '../store/useAppStore';

/**
 * Export and import of everything the app stores, so moving to a new phone
 * does not need Google's cloud backup (which the Android app switches off).
 *
 * The file is the persisted store as it sits in local storage, wrapped with a
 * marker and the store version. Import writes it back and reloads, so an older
 * file goes through exactly the migration a stored older state would, and a
 * replace really is a replace: nothing of the current state is merged in.
 */

const APP_MARK = 'beer-counter';
/** The wrapper's own format, separate from the store version inside it. */
const FILE_FORMAT = 1;

interface DataFilePlugin {
  save(options: { filename: string; content: string }): Promise<{ saved: boolean }>;
  open(): Promise<{ content?: string }>;
}

const DataFile = registerPlugin<DataFilePlugin>('DataFile');

function storeKey(): string {
  return useAppStore.persist.getOptions().name ?? 'beer-counter-state';
}

function storeVersion(): number {
  return useAppStore.persist.getOptions().version ?? 0;
}

export function exportFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `beer-counter-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function buildExport(): string {
  const raw = localStorage.getItem(storeKey());
  const stored = raw ? (JSON.parse(raw) as { state: unknown; version?: number }) : null;
  return JSON.stringify(
    {
      app: APP_MARK,
      format: FILE_FORMAT,
      exportedAt: new Date().toISOString(),
      appVersion: __APP_VERSION__,
      version: stored?.version ?? storeVersion(),
      state: stored?.state ?? {},
    },
    null,
    1,
  );
}

/** Saves the export where the user chooses. False when they cancelled. */
export async function saveExport(): Promise<boolean> {
  const content = buildExport();
  const filename = exportFilename();

  if (isNativeApp()) {
    return (await DataFile.save({ filename, content })).saved;
  }

  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on the next turn: the click has handed the blob to the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/** The chosen file's text, or null when the user cancelled. */
export async function pickImport(): Promise<string | null> {
  if (isNativeApp()) {
    return (await DataFile.open()).content ?? null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export type ImportCheck =
  | { ok: true; stored: string }
  | { ok: false; reason: 'invalid' | 'newer' };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isTimes = (v: unknown) => Array.isArray(v) && v.every((t) => typeof t === 'number');

/**
 * Checks a file before anything is replaced. Deep enough that a broken or
 * foreign file cannot leave the app unable to start; the store's own
 * migration handles every shape an older version legitimately wrote.
 */
export function checkImport(text: string): ImportCheck {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isObject(file) || file.app !== APP_MARK || typeof file.version !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (file.version > storeVersion()) return { ok: false, reason: 'newer' };

  const state = file.state;
  if (!isObject(state)) return { ok: false, reason: 'invalid' };

  const beverages = state.beverages;
  if (
    beverages !== undefined &&
    !(
      Array.isArray(beverages) &&
      beverages.every(
        (b) =>
          isObject(b) &&
          typeof b.id === 'string' &&
          (ICON_KEYS as readonly unknown[]).includes(b.icon),
      )
    )
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const tallies = state.tallies;
  if (
    tallies !== undefined &&
    !(
      isObject(tallies) &&
      // v1 stored a count and a time instead of a list of times.
      Object.values(tallies).every(
        (t) => isObject(t) && (isTimes(t.times) || typeof t.count === 'number'),
      )
    )
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const history = state.history;
  if (
    history !== undefined &&
    !(
      Array.isArray(history) &&
      history.every(
        (r) =>
          isObject(r) &&
          typeof r.startedAt === 'number' &&
          Array.isArray(r.drinks) &&
          r.drinks.every(
            (d) =>
              isObject(d) &&
              (ICON_KEYS as readonly unknown[]).includes(d.icon) &&
              isTimes(d.times),
          ),
      )
    )
  ) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, stored: JSON.stringify({ state, version: file.version }) };
}

/**
 * Replaces everything with a checked import. A reload rather than an in-place
 * rehydrate: persist would merge the file over the current state, so a field
 * the file lacks — history in a file from before it existed — would survive
 * from this phone instead of starting empty.
 */
export function applyImport(stored: string): void {
  localStorage.setItem(storeKey(), stored);
  location.reload();
}
