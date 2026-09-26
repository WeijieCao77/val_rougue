// Every script and stylesheet a page loads (and every module those import) must be
// on server.mjs's static whitelist; a single missing module blanks the whole page
// (the PvP page went blank when wa-keyword-cards.js was not listed under /pvp/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const routes = new Map([...read('server.mjs').matchAll(/\['(\/[^']*)', \['([^']+)'/g)].map(m => [m[1], m[2]]));
const DYNAMIC = new Set(['/runtime-config.js']);

function missingFor(page) {
  const seen = new Set(), missing = [];
  const walk = url => {
    if (seen.has(url) || DYNAMIC.has(url)) return;
    seen.add(url);
    const file = routes.get(url);
    if (!file) { missing.push(url); return; }
    if (!/\.m?js$/.test(file)) return;
    for (const m of read(file).matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) walk(new URL(m[1] || m[2], 'http://x' + url).pathname);
  };
  const html = read(routes.get(page));
  for (const m of html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="stylesheet"[^>]*\shref)="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1]) || m[1].startsWith('data:')) continue;
    walk(new URL(m[1], 'http://x' + page).pathname);
  }
  return missing;
}

for (const page of ['/', '/wa/', '/new/', '/pvp/']) {
  test(`static whitelist covers everything ${page} loads`, () => {
    assert.deepEqual(missingFor(page), []);
  });
}
