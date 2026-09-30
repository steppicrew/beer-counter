import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

interface SystemBarsPlugin {
  setStyle(options: { dark: boolean }): Promise<void>;
}

const SystemBars = registerPlugin<SystemBarsPlugin>('SystemBars');

/**
 * Dark or light icons in the Android status and navigation bars, to match the
 * theme on screen. The native theme can only follow the phone's dark mode, so
 * an in-app choice that differs from it — Light on a dark phone — left white
 * icons on the pale page. Nothing to do on the web, where the browser draws
 * its own bars.
 */
export function setSystemBars(dark: boolean): void {
  if (!isNativeApp()) return;
  // An older native shell without the plugin simply keeps the theme's icons.
  SystemBars.setStyle({ dark }).catch(() => {});
}
