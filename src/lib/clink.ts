/**
 * A coin landing in a glass jar, synthesised rather than shipped as a sample:
 * two short metallic pings — the hit and a smaller bounce — each a pair of
 * inharmonic partials with a fast decay, which is what separates "coin on
 * glass" from a UI beep. No file, no decoder, nothing to precache.
 *
 * Quiet on purpose and fire-and-forget: if audio is blocked (no user gesture
 * yet, WebView policy) it simply does not sound.
 */
export function playClink(): void {
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const ping = (at: number, gain: number) => {
      for (const [freq, share] of [
        [2637, 1],
        [3951, 0.55],
        [5920, 0.25],
      ] as const) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = ctx.currentTime + at;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(gain * share, t + 0.004);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(amp).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    };
    ping(0, 0.12);
    ping(0.13, 0.05);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // Sound is decoration; never let it break the bar.
  }
}
