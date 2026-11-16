import { registerPlugin } from '@capacitor/core';
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
 * So, in the app, every save also goes to a file outside the WebView, and an
 * empty or unreadable local storage is refilled from it. And nothing is
 * saved before a load has succeeded: state that could not be read is left
 * alone rather than replaced.
 */

interface StateMirrorPlugin {
  write(options: { content: string }): Promise<void>;
  read(): Promise<{ content?: string }>;
  note(options: { message: string }): Promise<void>;
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

/** The store's load is over; `error` is persist's, if it failed. */
export function storeLoaded(error: unknown) {
  if (error === undefined) {
    holding = false;
  } else {
    // Running on in memory loses this session at worst; saving would lose
    // everything before it.
    note(`not loaded, saving off for this session: ${String(error)}`);
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
      ({ content }) => {
        if (!readable(content)) {
          note(`local storage ${lost}, no mirror: starting fresh`);
          return null;
        }
        localStorage.setItem(name, content);
        note(`local storage ${lost}, restored ${content.length} bytes from the mirror`);
        return content;
      },
      () => null,
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
