#!/usr/bin/env node
/**
 * Creates or updates the three tip products in Play Console and activates
 * them. Safe to rerun: each product is patched in place, so changing a price
 * or a text here and running it again is the whole procedure.
 *
 *   yarn play:products --dry-run   # show what would be sent
 *   yarn play:products
 *
 * Prices are the German ones INCLUDING VAT. Play's conversion takes a net
 * price, so each is converted back from that and every other region gets
 * Play's own rounding; Germany itself is pinned so it never drifts by a cent.
 *
 * The ids are permanent — Play never frees a product id — and must match
 * TIP_PRODUCTS in src/lib/tips.ts and PRODUCT_IDS in TipsPlugin.java.
 * Whether a product is consumable is the app's decision (it consumes them),
 * not a product setting.
 *
 * Uses the new one-time-products API; the legacy `inappproducts` endpoint
 * answers "Please migrate to the new publishing API". The API is inconsistent
 * about the path: patching answers only on `onetimeproducts`, reading and
 * activating only on `oneTimeProducts`.
 *
 * Play refuses to create any product ("Can't create product. To fix, request
 * billing permission.") until it holds a bundle that declares
 * com.android.vending.BILLING — so publish such a build to a testing track
 * first, then run this.
 *
 * Auth: the same service account as play:publish (PLAY_SERVICE_ACCOUNT_JSON).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const packageName = JSON.parse(
  readFileSync(resolve(root, 'capacitor.config.json'), 'utf8'),
).appId;

const VAT_DE = 0.19;
const OPTION = 'tip';

/**
 * Per Play language: the three titles (small, large, round — the same words
 * the app's buttons use, from src/i18n/strings.ts) and one description.
 */
const LISTINGS = {
  'en-US': [['Small beer', 'Beer', 'A round'], 'A thank-you for the app. It unlocks nothing — the app stays complete and free.'],
  'de-DE': [['Kleines Bier', 'Bier', 'Eine Runde'], 'Ein Dankeschön für die App. Schaltet nichts frei — die App bleibt vollständig und kostenlos.'],
  'fr-FR': [['Demi', 'Bière', 'Une tournée'], 'Un merci pour l’app. Rien n’est débloqué — l’app reste complète et gratuite.'],
  'es-ES': [['Caña', 'Cerveza', 'Una ronda'], 'Un agradecimiento por la app. No desbloquea nada: la app sigue completa y gratis.'],
  'it-IT': [['Birra piccola', 'Birra', 'Un giro'], 'Un grazie per l’app. Non sblocca nulla: l’app resta completa e gratuita.'],
  'nl-NL': [['Klein bier', 'Bier', 'Een rondje'], 'Een bedankje voor de app. Er wordt niets ontgrendeld — de app blijft compleet en gratis.'],
  'pl-PL': [['Małe piwo', 'Piwo', 'Kolejka dla wszystkich'], 'Podziękowanie za aplikację. Niczego nie odblokowuje — aplikacja pozostaje kompletna i darmowa.'],
  'pt-PT': [['Imperial', 'Cerveja', 'Uma rodada'], 'Um obrigado pela app. Não desbloqueia nada — a app continua completa e gratuita.'],
  'cs-CZ': [['Malé pivo', 'Pivo', 'Runda pro všechny'], 'Poděkování za aplikaci. Nic neodemyká — aplikace zůstává kompletní a zdarma.'],
  'da-DK': [['Lille øl', 'Øl', 'En omgang'], 'Et tak for appen. Den låser intet op — appen forbliver komplet og gratis.'],
  'sv-SE': [['Liten öl', 'Öl', 'En runda'], 'Ett tack för appen. Den låser inte upp något — appen förblir komplett och gratis.'],
  'tr-TR': [['Küçük bira', 'Bira', 'Herkese bir tur'], 'Uygulama için bir teşekkür. Hiçbir şeyin kilidini açmaz — uygulama eksiksiz ve ücretsiz kalır.'],
  'ru-RU': [['Маленькое пиво', 'Пиво', 'Круг на всех'], 'Спасибо за приложение. Ничего не открывает — приложение остаётся полным и бесплатным.'],
  'ja-JP': [['小ジョッキ', 'ビール', 'みんなに一杯'], 'アプリへの感謝の気持ちです。何も解放されません。アプリは無料のまま、すべての機能を使えます。'],
  'zh-CN': [['小杯啤酒', '啤酒', '请大家喝一轮'], '对本应用的一份谢意。不解锁任何内容——应用始终免费且功能完整。'],
};

const PRODUCTS = [
  { id: 'tip_small', priceDe: 3 },
  { id: 'tip_large', priceDe: 5 },
  { id: 'tip_round', priceDe: 10 },
].map((p, i) => ({
  ...p,
  listings: Object.fromEntries(
    Object.entries(LISTINGS).map(([lang, [titles, description]]) => [lang, [titles[i], description]]),
  ),
}));

/** Google's Money: whole units plus nanos. */
function money(currencyCode, amount) {
  const units = Math.trunc(amount);
  return { currencyCode, units: String(units), nanos: Math.round((amount - units) * 1e9) };
}

console.log(`Package  ${packageName}`);
for (const p of PRODUCTS) {
  console.log(`  ${p.id.padEnd(10)} ${p.priceDe.toFixed(2)} EUR (DE, incl. VAT)  ${Object.keys(p.listings).length} languages`);
}
if (dryRun) {
  console.log('\nDry run complete.');
  process.exit(0);
}

const keyFile = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!keyFile) {
  console.error('PLAY_SERVICE_ACCOUNT_JSON is not set — source .env first (see .env.example).');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const client = await auth.getClient();
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}`;

async function api(url, method = 'GET', data) {
  try {
    return (await client.request({ url, method, data })).data;
  } catch (error) {
    const detail = error.response?.data?.error?.message ?? error.message;
    throw new Error(`${method} ${url.replace(base, '')}: ${detail}`);
  }
}

for (const p of PRODUCTS) {
  const net = Math.round((p.priceDe / (1 + VAT_DE)) * 100) / 100;
  const converted = await api(`${base}/pricing:convertRegionPrices`, 'POST', {
    price: money('EUR', net),
  });

  const regions = Object.entries(converted.convertedRegionPrices)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([regionCode, region]) => ({
      regionCode,
      price: regionCode === 'DE' ? money('EUR', p.priceDe) : region.price,
      availability: 'AVAILABLE',
    }));
  const others = converted.convertedOtherRegionsPrice;

  const product = {
    packageName,
    productId: p.id,
    listings: Object.entries(p.listings).map(([languageCode, [title, description]]) => ({
      languageCode,
      title,
      description,
    })),
    purchaseOptions: [
      {
        purchaseOptionId: OPTION,
        // Legacy-compatible so BillingClient's plain one-time flow can buy it.
        buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
        regionalPricingAndAvailabilityConfigs: regions,
        newRegionsConfig: {
          usdPrice: others.usdPrice,
          eurPrice: others.eurPrice,
          availability: 'AVAILABLE',
        },
      },
    ],
  };

  const query = new URLSearchParams({
    allowMissing: 'true',
    updateMask: 'listings,purchaseOptions',
    'regionsVersion.version': converted.regionVersion.version,
  });
  await api(`${base}/onetimeproducts/${p.id}?${query}`, 'PATCH', product);
  await api(`${base}/oneTimeProducts/${p.id}/purchaseOptions:batchUpdateStates`, 'POST', {
    requests: [
      {
        activatePurchaseOptionRequest: {
          packageName,
          productId: p.id,
          purchaseOptionId: OPTION,
        },
      },
    ],
  });

  const state = await api(`${base}/oneTimeProducts/${p.id}`);
  for (const option of state.purchaseOptions ?? []) {
    console.log(
      `  ${p.id}/${option.purchaseOptionId}: ${option.state ?? '?'}, ` +
        `${option.regionalPricingAndAvailabilityConfigs?.length ?? 0} regions, DE ${p.priceDe.toFixed(2)} EUR`,
    );
  }
}
