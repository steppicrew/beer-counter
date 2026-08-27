#!/usr/bin/env node
/**
 * Renders privacy/POLICY.json into public/privacy/ as a single self-contained
 * page: one HTML file per language plus an index that redirects to the
 * visitor's own language.
 *
 * Play Console requires a publicly reachable privacy policy URL. The page is
 * emitted into public/ so `yarn build` copies it into dist/ and the normal
 * rsync deploy publishes it alongside the app.
 *
 *   yarn node scripts/gen-privacy.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const policy = JSON.parse(readFileSync(resolve(root, 'privacy/POLICY.json'), 'utf8'));
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);

const outDir = resolve(root, 'public/privacy');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Same palette as the app, and the same light/dark handling.
const STYLE = `
:root{--bg:#fff6e0;--card:#fff;--text:#23180a;--muted:#7d6a4f;--accent:#d98c00;--border:#efe3c6;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#12100e;--card:#1e1b17;--text:#f4ece0;--muted:#a2957f;--accent:#f0a500;--border:#332e27;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 64px;background:var(--bg);color:var(--text);
font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:44rem;margin:0 auto}
header{display:flex;align-items:center;gap:14px;margin-bottom:8px}
header img{width:56px;height:56px;border-radius:12px;flex:none}
h1{font-size:1.6rem;margin:0}
.app-name{color:var(--muted);font-size:.95rem;margin:2px 0 0}
.intro{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--accent);
border-radius:10px;padding:14px 18px;margin:24px 0}
h2{font-size:1.08rem;margin:30px 0 6px}
p{margin:0 0 12px}
.meta{color:var(--muted);font-size:.88rem;border-top:1px solid var(--border);margin-top:36px;padding-top:16px}
a{color:var(--accent)}
nav{margin-top:28px;font-size:.88rem;color:var(--muted);line-height:2.1}
nav a{margin-right:12px;white-space:nowrap}
`.trim();

function render(code) {
  const entry = policy.policies[code] ?? policy.policies.en;
  const appName = listings[code]?.title ?? listings.en.title;
  const meta = LOCALES.find((l) => l.code === code);

  const others = LOCALES.filter((l) => l.code !== code)
    .map((l) => `<a href="./${l.code}.html" hreflang="${l.code}">${escape(l.label)}</a>`)
    .join('');

  const body = entry.sections
    .map(([heading, text]) => `<h2>${escape(heading)}</h2>\n<p>${escape(text)}</p>`)
    .join('\n');

  return `<!doctype html>
<html lang="${code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow">
<title>${escape(entry.title)} — ${escape(appName)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header>
<img src="../icons/icon-192.png" alt="" width="56" height="56">
<div>
<h1>${escape(entry.title)}</h1>
<p class="app-name">${escape(appName)}</p>
</div>
</header>

<p class="intro">${escape(entry.intro)}</p>

${body}

<p class="meta">
${escape(meta?.playStore ?? code)} · ${escape(policy.effectiveDate)}<br>
<a href="mailto:${escape(policy.contactEmail)}">${escape(policy.contactEmail)}</a><br>
<a href="../">${escape(appName)}</a>
</p>

<nav>${others}</nav>
</main>
</body>
</html>
`;
}

for (const locale of LOCALES) {
  writeFileSync(resolve(outDir, `${locale.code}.html`), render(locale.code));
}

// The index picks the visitor's language client-side, so a single URL works
// for every Play Console listing. Without JS it still shows the English text.
const supported = JSON.stringify(LOCALES.map((l) => l.code));
writeFileSync(
  resolve(outDir, 'index.html'),
  render('en').replace(
    '</head>',
    `<script>
(function(){
  var supported = ${supported};
  var langs = navigator.languages || [navigator.language || 'en'];
  for (var i = 0; i < langs.length; i++) {
    var primary = String(langs[i]).toLowerCase().split('-')[0];
    if (primary !== 'en' && supported.indexOf(primary) !== -1) {
      location.replace('./' + primary + '.html');
      return;
    }
  }
})();
</script>
</head>`,
  ),
);

console.log(`${LOCALES.length} privacy pages + index in public/privacy/`);
console.log('URL after deploy: <your site>/privacy/');
