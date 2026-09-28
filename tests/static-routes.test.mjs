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

// /admin/ is served by server.mjs only when ADMIN_TOKEN is set (tests/backup-reports),
// never from the always-on whitelist, and no player page links to it.
test('admin page is not on the static whitelist and not linked from player pages', () => {
  for (const url of routes.keys()) assert.ok(!url.startsWith('/admin'), url);
  assert.ok(![...routes.values()].includes('online/admin.html'));
  assert.equal(routes.get('/shared/error-report.js'), 'shared/error-report.js');
  assert.equal(routes.get('/shared/feedback.js'), 'shared/feedback.js');
  for (const f of ['landing.html', 'index.html', 'new-demo/index.html', 'online/index.html', 'ui-source.js', 'new-demo/ui.js', 'online/client.js', 'shared/feedback.js']) {
    assert.doesNotMatch(read(f), /['"(]\/admin\b/, f);
  }
});
