// Card text must never leak code values (the Wa card BuZz read "基础伤害 +true").
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, describe, compactLines, cardKeywords } from '../content.js';
import * as ND from '../new-demo/content.js';

const BAD = /true|false|undefined|NaN|null|\[object|\$\{|\+\s*[；。，]|\+\s*$|；；|。。|，，|（\s*）|\+0(?!\d)/;

test('Wa card text (base and trained) has no leaked values', () => {
  const bad = [];
  for (const id of Object.keys(CARDS)) for (const up of [false, true]) {
    if (up && !CARDS[id].upgraded) continue;
    const c = { id, up };
    for (const s of [describe(c), compactLines(c).join(' | '), ...cardKeywords(c).map(([, v]) => v)]) if (BAD.test(s)) bad.push(`${id}${up ? '+' : ''}: ${s}`);
  }
  assert.deepEqual(bad, []);
});

test('Wa conditional bonuses are numbers', () => {
  const bad = [];
  for (const [id, c] of Object.entries(CARDS)) for (const e of [...(c.effects || []), ...(c.upgraded || [])]) for (const k of ['ifWeak', 'ifVuln', 'ifBurn']) if (k in e && typeof e[k] !== 'number') bad.push(`${id} ${k}=${e[k]}`);
  assert.deepEqual(bad, []);
});

test('new demo card text has no leaked values', () => {
  const bad = [];
  for (const id of Object.keys(ND.CARDS)) for (const up of [false, true]) { const s = ND.cardTextFor(id, up); if (BAD.test(s)) bad.push(`${id}${up ? '+' : ''}: ${s}`); }
  assert.deepEqual(bad, []);
});
