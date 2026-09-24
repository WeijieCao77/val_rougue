import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SFX_NAMES, SFX_STORAGE_KEY, SFX_DEFAULT_VOLUME, clampVolume, loadAudioPrefs, saveAudioPrefs,
  soundForCard, soundsForEvents, soundForAction, playSfx,
} from '../shared/sfx.js';
import { diffCombat, snapshotNew, snapshotWa, shakeLevel, numberText, BIG_HIT, playFeedback } from '../shared/juice.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('audio prefs default to a moderate volume and survive a round trip', () => {
  const store = memoryStorage();
  assert.deepEqual(loadAudioPrefs(store), { volume: SFX_DEFAULT_VOLUME, muted: false });
  assert.ok(SFX_DEFAULT_VOLUME > 0.2 && SFX_DEFAULT_VOLUME < 0.8);
  saveAudioPrefs(store, { volume: 0.35, muted: true });
  assert.deepEqual(JSON.parse(store.data[SFX_STORAGE_KEY]), { volume: 0.35, muted: true });
  assert.deepEqual(loadAudioPrefs(store), { volume: 0.35, muted: true });
});

test('audio prefs tolerate corrupt, out-of-range and missing storage', () => {
  assert.deepEqual(loadAudioPrefs(memoryStorage({ [SFX_STORAGE_KEY]: '{oops' })), { volume: SFX_DEFAULT_VOLUME, muted: false });
  assert.equal(loadAudioPrefs(memoryStorage({ [SFX_STORAGE_KEY]: '{"volume":7}' })).volume, 1);
  assert.equal(loadAudioPrefs(memoryStorage({ [SFX_STORAGE_KEY]: '{"volume":-2,"muted":"yes"}' })).muted, false);
  assert.equal(clampVolume('abc'), SFX_DEFAULT_VOLUME);
  assert.equal(clampVolume(0.333), 0.33);
  const throwing = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(loadAudioPrefs(throwing), { volume: SFX_DEFAULT_VOLUME, muted: false });
  assert.doesNotThrow(() => saveAudioPrefs(throwing, { volume: 0.2 }));
  assert.deepEqual(loadAudioPrefs(null), { volume: SFX_DEFAULT_VOLUME, muted: false });
});

test('playing without a browser never throws and reports nothing played', () => {
  assert.equal(playSfx('hit'), false);
  assert.equal(playSfx('no-such-sound'), false);
});

test('card and action sounds map to known names', () => {
  assert.equal(soundForCard('attack'), 'cardAttack');
  assert.equal(soundForCard('power'), 'cardPower');
  assert.equal(soundForCard('skill'), 'cardSkill');
  assert.equal(soundForCard(undefined), 'cardSkill');
  const cases = [
    [{ type: 'end' }, { prevPhase: 'combat', nextPhase: 'combat' }, 'turnEnd'],
    [{ type: 'play' }, { prevPhase: 'combat', nextPhase: 'reward', hp: 30 }, 'victory'],
    [{ type: 'end' }, { prevPhase: 'combat', nextPhase: 'result', outcome: 'loss', hp: 0 }, 'defeat'],
    [{ type: 'play' }, { prevPhase: 'combat', nextPhase: 'result', outcome: 'win', hp: 5 }, 'victory'],
    [{ type: 'reward', id: 'X1' }, { prevPhase: 'reward', nextPhase: 'map' }, 'reward'],
    [{ type: 'recruit', id: null }, { prevPhase: 'reward', nextPhase: 'map' }, 'click'],
    [{ type: 'buy', index: 0 }, { prevPhase: 'shop', nextPhase: 'shop' }, 'coin'],
    [{ type: 'rest', choice: 'heal' }, { prevPhase: 'rest', nextPhase: 'map' }, 'heal'],
    [{ type: 'enter', key: 'a' }, { prevPhase: 'map', nextPhase: 'combat' }, 'shuffle'],
    [{ type: 'play' }, { prevPhase: 'combat', nextPhase: 'combat' }, null],
  ];
  for (const [action, info, expected] of cases) assert.equal(soundForAction(action, info), expected, JSON.stringify([action, info]));
  for (const [action, info] of cases) {
    const name = soundForAction(action, info);
    if (name) assert.ok(SFX_NAMES.includes(name), name);
  }
});

const newState = (hp, block, enemies, phase = 'combat') => ({
  hp, phase,
  battle: { playerBlock: block, statuses: { player: {} }, enemies: enemies.map(([uid, ehp, st = {}]) => ({ uid, hp: ehp, statuses: st })) },
});

test('diffCombat reports per-enemy hits, kills and big hits in the new demo', () => {
  const prev = snapshotNew(newState(40, 0, [['e0', 30], ['e1', 20], ['e2', 12]]));
  const next = snapshotNew(newState(40, 5, [['e0', 24], ['e1', 0], ['e2', 12, { weak: 1 }]]));
  const events = diffCombat(prev, next);
  assert.deepEqual(events.filter(e => e.kind === 'damage'), [
    { kind: 'damage', target: 'enemy', id: 'e0', amount: 6, killed: false, big: false },
    { kind: 'damage', target: 'enemy', id: 'e1', amount: 20, killed: true, big: true },
  ]);
  assert.ok(events.some(e => e.kind === 'block' && e.target === 'player' && e.amount === 5));
  assert.ok(events.some(e => e.kind === 'debuff' && e.id === 'e2'));
  assert.equal(shakeLevel(events), 2);
  assert.deepEqual(soundsForEvents(events), ['multiHit', 'enemyDeath', 'block', 'debuff']);
});

test('diffCombat: player hurt, heal and the big-hit threshold', () => {
  const hurt = diffCombat(snapshotNew(newState(40, 0, [['e0', 30]])), snapshotNew(newState(40 - BIG_HIT, 0, [['e0', 30]])));
  assert.deepEqual(hurt, [{ kind: 'hurt', target: 'player', amount: BIG_HIT, big: true }]);
  assert.equal(shakeLevel(hurt), 1);
  assert.deepEqual(soundsForEvents(hurt), ['hurt']);
  const small = diffCombat(snapshotNew(newState(40, 0, [['e0', 30]])), snapshotNew(newState(40, 0, [['e0', 30 - (BIG_HIT - 1)]])));
  assert.equal(small[0].big, false);
  assert.equal(shakeLevel(small), 0);
  assert.deepEqual(soundsForEvents(small), ['hit']);
  const heal = diffCombat(snapshotNew(newState(30, 0, [['e0', 30]])), snapshotNew(newState(34, 0, [['e0', 30]])));
  assert.deepEqual(heal, [{ kind: 'heal', target: 'player', amount: 4 }]);
  assert.equal(numberText(heal[0]), '+4');
  assert.equal(numberText({ kind: 'damage', amount: 9 }), '-9');
});

test('diffCombat treats a finished Wa match as a kill and ignores non-combat states', () => {
  const before = { hp: 50, phase: 'combat', battle: { block: 0, enemyHp: 8, enemyBlock: 0, weak: 0, vulnerable: 0, enemyWeak: 0, enemyVulnerable: 0 } };
  const after = { hp: 50, phase: 'reward', battle: null };
  const events = diffCombat(snapshotWa(before), snapshotWa(after));
  assert.deepEqual(events, [{ kind: 'damage', target: 'enemy', id: 'enemy', amount: 8, killed: true, big: true }]);
  assert.deepEqual(diffCombat(snapshotWa({ hp: 50, phase: 'map', battle: null }), snapshotWa(after)), []);
  assert.deepEqual(diffCombat(null, null), []);
  assert.doesNotThrow(() => playFeedback(events, () => null));
});

test('new sound/feedback files are served and bundled', async () => {
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  for (const path of ['/shared/sfx.js', '/shared/juice.js', '/shared/juice.css', '/new/juice-hooks.js']) assert.ok(server.includes(`'${path}'`), path);
  const build = await readFile(new URL('../tools/build-browser.mjs', import.meta.url), 'utf8');
  for (const file of ['shared/sfx.js', 'shared/juice.js', 'wa-juice.js', 'shared/juice.css']) assert.ok(build.includes(file), file);
  const html = await readFile(new URL('../new-demo/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('/shared/juice.css'));
  const sources = [await readFile(new URL('../shared/sfx.js', import.meta.url), 'utf8'), await readFile(new URL('../shared/juice.js', import.meta.url), 'utf8')];
  for (const src of sources) assert.ok(!/\.(mp3|ogg|wav|m4a)\b/.test(src), 'no audio files referenced');
});
