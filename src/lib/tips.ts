import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

/**
 * Tips, two ways. The web build links out to a donation page; the Android app
 * may not — Play's payments policy requires its own billing for money paid
 * inside an app, and a link to an outside payment page counts as steering
 * around it. So the app sells three consumable Play products instead, and
 * `build-android.sh` blanks the URL so the bundle does not even carry it.
 *
 * Neither unlocks anything. A tip is a thank-you; the app is the same app.
 */

/** Only an https page — a typo in .env must not become a javascript: link. */
function tipUrl(): string | null {
  const raw = import.meta.env.VITE_TIP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

export const TIP_URL = tipUrl();

/** Play product ids, created by `scripts/play-products.mjs`. Never rename: Play keeps ids forever. */
export const TIP_PRODUCTS = ['tip_small', 'tip_large', 'tip_round'] as const;
export type TipProductId = (typeof TIP_PRODUCTS)[number];

export type TipStatus = 'purchased' | 'pending' | 'cancelled' | 'error';

interface TipsPlugin {
  /** Play's localised prices; empty when Play is unavailable (sideloaded, no Play Store). */
  products(): Promise<{ products: { id: string; price: string }[] }>;
  buy(options: { id: TipProductId }): Promise<{ status: TipStatus }>;
}

const Tips = registerPlugin<TipsPlugin>('Tips');

export interface TipOffer {
  id: TipProductId;
  price: string;
}

/**
 * The Play offers, in the fixed small → round order, or an empty list when
 * this is not the native app or Play did not answer — the section then hides
 * rather than showing buttons that cannot work.
 */
export function useTipOffers(): TipOffer[] {
  const [offers, setOffers] = useState<TipOffer[]>([]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let live = true;
    Tips.products()
      .then(({ products }) => {
        if (!live) return;
        const byId = new Map(products.map((p) => [p.id, p.price]));
        setOffers(
          TIP_PRODUCTS.flatMap((id) => {
            const price = byId.get(id);
            return price ? [{ id, price }] : [];
          }),
        );
      })
      .catch(() => {
        // No plugin (an old native shell) or no Play: nothing to offer.
      });
    return () => {
      live = false;
    };
  }, []);

  return offers;
}

export async function buyTip(id: TipProductId): Promise<TipStatus> {
  try {
    return (await Tips.buy({ id })).status;
  } catch {
    return 'error';
  }
}
