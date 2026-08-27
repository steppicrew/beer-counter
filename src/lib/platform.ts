/**
 * True when running as the packaged Android app rather than in a browser.
 *
 * Capacitor serves the identical `dist/` bundle from a local origin, so the
 * legal footer — required for a German-hosted website, but not inside the app,
 * where Play Console carries its own privacy-policy link — has to be hidden at
 * runtime rather than at build time.
 *
 * Detection is via Capacitor's injected global, not the URL: its Android
 * scheme is `https://localhost`, which is indistinguishable from a local dev
 * server by hostname alone.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  const capacitor = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (capacitor?.isNativePlatform) return capacitor.isNativePlatform();

  // Older/partial injections still expose the platform name.
  const platform = capacitor?.getPlatform?.();
  return platform === 'android' || platform === 'ios';
}
