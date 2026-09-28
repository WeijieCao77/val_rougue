// shared/error-report.js must never throw or recurse, dedupes, caps reports per page
// load and only sends coarse context. shared/feedback.js (信箱) stays import-free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initErrorReport, reportError, recentErrorMessages, gameContext, resetErrorReportForTests } from '../shared/error-report.js';
import { feedbackButtonHtml } from '../shared/feedback.js';

test('does not throw when fetch rejects, throws synchronously or is missing', async () => {
  const realFetch = globalThis.fetch;
  try {
    resetErrorReportForTests();
    initErrorReport({ page: 'wa', version: 'v0.9.7' });
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    assert.equal(reportError(new Error('a')), true);
    globalThis.fetch = () => { throw new Error('sync boom'); };
    assert.doesNotThrow(() => reportError(new Error('b')));
    globalThis.fetch = undefined;
    assert.doesNotThrow(() => reportError(new Error('c')));
    assert.doesNotThrow(() => reportError(null));
    assert.doesNotThrow(() => reportError({ get message() { throw new Error('evil getter'); } }));
    await new Promise(r => setTimeout(r, 10)); // no unhandled rejection
  } finally { globalThis.fetch = realFetch; }
});

test('dedupes the same error for 10 minutes and caps at 10 reports per page load', () => {
  resetErrorReportForTests();
  const sent = [];
  initErrorReport({ page: 'new', version: 'v0.9.7', transport: (url, body) => sent.push(JSON.parse(body)) });
  const err = new Error('same');
  assert.equal(reportError(err), true);
  assert.equal(reportError(err), false);
  assert.equal(sent.length, 1);
  for (let i = 0; i < 20; i++) reportError(new Error('distinct ' + i));
  assert.equal(sent.length, 10);
  assert.deepEqual(recentErrorMessages(3), ['distinct 17', 'distinct 18', 'distinct 19']);
  assert.equal(sent[0].page, 'new');
  assert.equal(sent[0].version, 'v0.9.7');
  assert.equal(sent[0].message, 'same');
});

test('never recurses when the transport itself reports an error', () => {
  resetErrorReportForTests();
  let calls = 0;
  initErrorReport({ page: 'pvp', transport: () => { calls++; reportError(new Error('inner')); throw new Error('transport broke'); } });
  assert.doesNotThrow(() => reportError(new Error('outer')));
  assert.equal(calls, 1);
});

test('context: only flat primitives, identity / secret keys dropped, getContext errors ignored', () => {
  resetErrorReportForTests();
  const sent = [];
  initErrorReport({ page: 'wa', transport: (u, b) => sent.push(JSON.parse(b)), getContext: () => ({ screen: 'map', act: 2, turn: 4, token: 'x', nickname: 'me', deck: [1, 2], long: 'y'.repeat(200) }) });
  reportError(new Error('ctx'), { source: 'manual', authHeader: 'Bearer x' });
  assert.deepEqual(sent[0].context, { screen: 'map', act: 2, turn: 4, long: 'y'.repeat(60), source: 'manual' });
  assert.ok(sent[0].stack.length <= 4096);
  assert.equal(JSON.stringify(sent[0]).includes('localStorage'), false);
  initErrorReport({ getContext: () => { throw new Error('bad ctx'); } });
  assert.doesNotThrow(() => reportError(new Error('ctx2')));
  assert.deepEqual(gameContext(), {});
});

test('信箱 button: envelope icon, [data-feedback], labelled 信箱', () => {
  const html = feedbackButtonHtml('hero-link');
  assert.match(html, /data-feedback/);
  assert.match(html, /<svg/);
  assert.match(html, />信箱<\/button>$/);
});

test('the modules have no imports (bundled into the Wa app.js)', () => {
  for (const f of ['shared/error-report.js', 'shared/feedback.js']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /^\s*import\b/m, f);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /initErrorReport/);
  assert.match(app, /data-feedback/);
});

test('shared 信箱 / error text stays free of Valorant and PvP wording (shown in the new demo too)', () => {
  for (const f of ['shared/feedback.js', 'shared/error-report.js']) {
    const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/fb-pvp/g, ''); // theme class name, not text
    assert.doesNotMatch(src, /无畏契约|Valorant|VCT|PvP|选手|特工|登峰赛季/i, f);
  }
});
