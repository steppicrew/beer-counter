import { registerPlugin } from '@capacitor/core';
import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { isNativeApp } from '../lib/platform';

/**
 * Where the store keeps its state, and why it is more than local storage.
 *
 * persist treats state it cannot read as no state at all: the app starts as
 * a new install, and its first save — any tap — writes that empty state over
 * whatever was there. Local storage can come up empty, too: the WebView
 * deletes a database it finds damaged, and says nothing. Either way one bad
 * start used to cost the whole history, tips and all.
 *
 * So, in the app, every save also goes to a file outside the WebView, beside
 * daily snapshots, and an empty or unreadable local storage is refilled from
 * the newest copy that reads. And nothing is saved before a load has
 * succeeded: state that could not be read is left alone rather than
 * replaced, and copies that exist but could not be read fail the load too.
 *
 * On the web there is no file to keep. The browser is asked instead not to
 * evict the site's storage when space runs low.
 */

interface StateMirrorPlugin {
  write(options: { content: string }): Promise<void>;
  /** Newest first. Rejects when copies exist but none could be read. */
  read(): Promise<{ copies?: string[] }>;
  list(): Promise<{ snapshots?: StoredSnapshot[] }>;
  /** Keeps the current mirror as a snapshot first; rejects if it cannot. */
  restore(options: { content: string }): Promise<void>;
  note(options: { message: string }): Promise<void>;
}

/** A daily snapshot as the app keeps it: when, and the stored state. */
export interface StoredSnapshot {
  name: string;
  keptAt: number;
  content: string;
}

const StateMirror = registerPlugin<StateMirrorPlugin>('StateMirror');
const native = isNativeApp();

/** A line in logcat, so a lost state leaves a trace even in release. */
function note(message: string) {
  if (native) void StateMirror.note({ message: `state: ${message}` }).catch(() => {});
}

function mirror(content: string) {
  if (native) void StateMirror.write({ content }).catch(() => {});
}

// Unasked, a browser may clear local storage under storage pressure; Safari
// does after a week without a visit. Granted silently for installed PWAs.
if (!native) void navigator.storage?.persist?.().catch(() => false);

/** JSON with a state object in it, as persist writes it. */
function readable(raw: string | null | undefined): raw is string {
  if (raw === null || raw === undefined) return false;
  try {
    const stored = JSON.parse(raw) as { state?: unknown } | null;
    return typeof stored?.state === 'object' && stored.state !== null;
  } catch {
    return false;
  }
}

// Held until the store reports a successful load. Also drops the save persist
// makes right after a migration — harmless, the next change saves it.
let holding = true;
let settle: () => void = () => {};

/** Resolves once the store has loaded, or failed to: then the app may start. */
export const storeSettled = new Promise<void>((resolve) => {
  settle = resolve;
});

/** True while saves are off because the load failed: the app says so. */
export const useSavingOff = create<{ off: boolean }>(() => ({ off: false }));

/** The store's load is over; `error` is persist's, if it failed. */
export function storeLoaded(error: unknown) {
  if (error === undefined) {
    holding = false;
  } else {
    // Running on in memory loses this session at worst; saving would lose
    // everything before it.
    note(`not loaded, saving off for this session: ${String(error)}`);
    useSavingOff.setState({ off: true });
  }
  settle();
}

export const guardedStorage: StateStorage = {
  getItem(name) {
    const raw = localStorage.getItem(name);
    if (readable(raw)) {
      note(`${raw.length} bytes in local storage`);
      // Also seeds the mirror on the first start after an update.
      mirror(raw);
      return raw;
    }
    // Set aside, never overwritten: whatever it is, it may be all there was.
    if (raw !== null) localStorage.setItem(`${name}.unreadable`, raw);
    const lost = raw === null ? 'empty' : 'unreadable';
    if (!native) return null;

    return StateMirror.read().then(
      ({ copies = [] }) => {
        const content = copies.find(readable);
        if (content === undefined) {
          // No copy at all is a new install. Copies that all fail to parse
          // are not: the load fails, and nothing overwrites them.
          if (copies.length > 0) throw new Error(`${copies.length} copies, none readable`);
          note(`local storage ${lost}, no mirror: starting fresh`);
          return null;
        }
        localStorage.setItem(name, content);
        const index = copies.indexOf(content);
        const source = index === 0 ? 'the newest copy' : `copy ${index + 1} of ${copies.length}`;
        note(`local storage ${lost}, restored ${content.length} bytes from ${source}`);
        return content;
      },
      (error: unknown) => {
        // Rethrown so the load fails: a read that failed is not an empty one.
        note(`local storage ${lost}, mirror unreadable: ${String(error)}`);
        throw error;
      },
    );
  },

  setItem(name, value) {
    if (holding) return;
    // The mirror first: if local storage refuses (it is full), the copy
    // outside still has the latest.
    mirror(value);
    localStorage.setItem(name, value);
  },

  // Only persist's clearStorage() calls this, and nothing calls that. The
  // mirror would bring the state back on the next start.
  removeItem(name) {
    if (holding) return;
    localStorage.removeItem(name);
  },
};

/** Earlier days to go back to, newest first. Only the app keeps them. */
export async function listSnapshots(): Promise<StoredSnapshot[]> {
  if (!native) return [];
  return (await StateMirror.list()).snapshots ?? [];
}

/**
 * Makes `stored` the mirror, after keeping what was there as a snapshot of
 * its own, so this can be undone. The caller then applies it like an import.
 */
export async function restoreSnapshot(name: string, stored: string): Promise<void> {
  await StateMirror.restore({ content: stored });
  note(`restoring ${name}`);
}
