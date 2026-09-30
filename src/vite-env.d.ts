/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected by Vite from package.json at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Donation page for the web build, from .env. Unset hides the link. */
  readonly VITE_TIP_URL?: string;
}
