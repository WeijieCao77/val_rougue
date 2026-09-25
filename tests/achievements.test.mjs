import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyBook, emptyCareer, normalizeBook, loadBook, saveBook, seedCareer, unlockKeys, newRunMemory, actMemory,
  stepMemory, updateCareer, evaluate, achStep, evaluateCareer, earnedTitles, wornTitle, wearTitle,
  hallHtml, runAchievementsHtml, titleBadgeHtml
} from '../shared/achievements-core.js';
import { NEW_ACHIEVEMENTS, NEW_CATS, newView, newObserve } from '../new-demo/achievements.js';
import { WA_ACHIEVEMENTS, WA_CATS, waView, waObserve } from '../wa-achievements.js';
import { createRun, act as newAct, legalActions as newLegal } from '../new-demo/engine.js';
import { TEAMS, CARDS as NEW_CARDS } from '../new-demo/content.js';
import { createWaSeason } from '../wa-season.js';
import { CARDS as WA_CARDS, REGIONS } from '../content.js';
import { RULES_VERSION } from '../wa-rules.js';

// ---------------------------------------------------------------- fixtures
const fakeStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const card = (o = {}) => ({ uid: 'c' + Math.random(), id: 'X', up: false, cost: 1, type: 'attack', tag: 'basic', basic: true, curse: false, upgradable: true, role: null, ...o });
const baseDeck = () => Array.from({ length: 10 }, (_, i) => card({ id: 'B' + (i % 3), cost: i % 4 === 0 ? 2 : 1 }));
const V = (o = {}) => ({ runId: 'r1', phase: 'map', inCombat: false, result: null, hp: 50, maxHp: 80, money: 100, act: 1, floor: 3, nodeKind: 'battle', team: 'breach', asc: 0, deck: baseDeck(), gear: [], gearMax: 6, supplies: 0, supplyMax: 3, combat: null, ...o });
const FIGHT = (o = {}) => ({ kind: 'battle', bossId: null, encounter: 'E01', enemyIds: ['E01'], act: 1, floor: 3, hpStart: 50, maxHp: 80, hpLost: 5, turn: 3, turns: 3, kills: 1, turnKills: 0, turnDamage: 0, maxTurnKills: 1, maxTurnDamage: 12, maxCardDamage: 8, maxPlays: 3, maxBlock: 6, played: 5, types: {}, flags: {}, warmup: false, partial: false, ...o });
const ENDED = (o = {}) => ({ ...FIGHT(), outcome: 'win', hpEnd: 45, ...o });
function base() {
  return { prev: V(), next: V(), action: null, raw: {}, mem: newRunMemory('r1'), fight: null, ended: null, hit: { damage: 0, kills: 0, card: null }, entered: null, runEnd: null, career: emptyCareer() };
}
const combatView = (o = {}) => ({ turn: 2, plays: 0, block: 0, encounter: 'E01', kind: 'battle', bossId: null, warmup: false, enemies: [], hand: [], ...o });
const winCareer = (team, asc) => ({ ...emptyCareer(), teamWins: { [team]: asc } });

// A passing context for every achievement, keyed by definition key.
const NEW_CASES = {
  first_win: c => { c.ended = ENDED(); c.mem.run.fightsWon = 1; },
  act1_clear: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); },
  run_clear: c => { c.runEnd = 'win'; },
  no_rest_act: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); actMemory(c.mem, 1).shop = 1; },
  unknown5: c => { c.entered = 'event'; actMemory(c.mem, 1).event = 5; },
  elite3_act: c => { c.ended = ENDED({ kind: 'elite' }); actMemory(c.mem, 1).eliteWins = 3; },
  no_elite_clear: c => { c.runEnd = 'win'; c.mem.run.elitesFought = 0; },
  flawless_elite: c => { c.ended = ENDED({ kind: 'elite', hpLost: 0 }); },
  flawless_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B02', hpLost: 0 }); },
  big50: c => { c.hit = { damage: 52, kills: 0, card: card() }; },
  big100: c => { c.hit = { damage: 101, kills: 1, card: card() }; },
  triple: c => { c.fight = FIGHT({ maxTurnKills: 3 }); },
  one_hp: c => { c.ended = ENDED({ hpEnd: 1 }); },
  turn1: c => { c.ended = ENDED({ turns: 1 }); },
  long_fight: c => { c.ended = ENDED({ turns: 12 }); },
  ten_plays: c => { c.next = V({ inCombat: true, combat: combatView({ plays: 10 }) }); },
  block50: c => { c.next = V({ inCombat: true, combat: combatView({ block: 50 }) }); },
  aim_break: c => { c.fight = FIGHT({ flags: { aimBroken: 1 } }); },
  thin_deck: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_B01', act: 2 }); c.next = V({ deck: baseDeck().slice(0, 9) }); },
  light_deck: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); c.next = V({ deck: baseDeck().map(x => ({ ...x, cost: 1 })) }); },
  polished: c => { c.next = V({ deck: Array.from({ length: 15 }, () => card({ up: true })) }); },
  power3: c => { c.fight = FIGHT({ types: { power: 3 } }); },
  same5: c => { c.next = V({ deck: [...baseDeck(), ...Array.from({ length: 5 }, () => card({ id: 'TA30', basic: false, tag: 'damage' }))] }); },
  arch6: c => { c.next = V({ deck: [...baseDeck(), ...Array.from({ length: 6 }, (_, i) => card({ id: 'burn' + i, basic: false, tag: 'burn' }))] }); },
  cursed_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B03' }); c.next = V({ deck: [...baseDeck(), ...Array.from({ length: 3 }, () => card({ curse: true, type: 'status', cost: 0 }))] }); },
  first_elite: c => { c.ended = ENDED({ kind: 'elite' }); },
  elite_early: c => { c.ended = ENDED({ kind: 'elite', floor: 6 }); },
  boss_tempo: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); },
  boss_warden: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B02', flags: { wardenInStance: true } }); },
  boss_toxin: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B03', turns: 4 }); },
  boss_marshal: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_B03' }); },
  boss_blitz: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_B02', turns: 5 }); },
  boss_phase2: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B01' }); },
  boss_oracle: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B02', maxPlays: 5 }); },
  boss_hunter: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B03' }); },
  all_bosses: c => { c.career = { ...emptyCareer(), bossWins: Object.fromEntries(['B01', 'B02', 'B03', 'A2_B01', 'A2_B02', 'A2_B03', 'A3_B01', 'A3_B02', 'A3_B03'].map(id => [id, 1])) }; },
  rich: c => { c.next = V({ money: 400 }); },
  spree: c => { c.mem.shop = { spent: 300 }; },
  broke_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); c.prev = V({ money: 0 }); },
  gear_full: c => { c.next = V({ gear: ['a', 'b', 'c', 'd', 'e', 'f'] }); },
  sell_gear: c => { c.action = { type: 'sellRelic', index: 0 }; },
  supply_full: c => { c.next = V({ supplies: 3, supplyMax: 3 }); },
  no_shop: c => { c.runEnd = 'win'; },
  injector: c => { c.mem.run.flags.injector = true; },
  no_heal_rest: c => { c.action = { type: 'rest', choice: 'upgrade' }; c.prev = V({ hp: 20, maxHp: 80 }); },
  low_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01', hpEnd: 8, maxHp: 80 }); },
  remove5: c => { c.mem.run.removed = 5; },
  asc1: c => { c.career = winCareer('breach', 1); },
  asc5: c => { c.career = winCareer('anchor', 5); },
  asc10: c => { c.career = winCareer('utility', 10); },
  asc3_all: c => { c.career = { ...emptyCareer(), teamWins: { breach: 3, anchor: 4, utility: 3, rotation: 10 } }; },
  win_breach: c => { c.career = winCareer('breach', 0); },
  win_anchor: c => { c.career = winCareer('anchor', 0); },
  win_utility: c => { c.career = winCareer('utility', 0); },
  win_rotation: c => { c.career = winCareer('rotation', 0); },
  trait_breach: c => { c.fight = FIGHT({ flags: { doubledHit: 40 } }); },
  trait_anchor: c => { c.fight = FIGHT({ flags: { fortFull: true } }); },
  trait_utility: c => { c.fight = FIGHT({ flags: { squad_intel: 3 } }); },
  trait_rotation: c => { c.ended = ENDED({ flags: { stance: 8 } }); },
  first_loss: c => { c.runEnd = 'loss'; },
  act1_bosses: c => { c.career = { ...emptyCareer(), bossLosses: { B01: 1, B02: 2, B03: 1 } }; },
  comeback: c => { c.runEnd = 'win'; c.career = { ...emptyCareer(), lastStreakBeforeWin: 3 }; },
  speedrun: c => { c.career = { ...emptyCareer(), fastestWinMs: 40 * 60 * 1000 }; },
  all_teams: c => { c.career = { ...emptyCareer(), teamWins: { breach: 0, anchor: 2, utility: 0, rotation: 1 } }; }
};

// Near misses: the same moment one step short of the condition.
const NEW_MISSES = {
  first_win: c => { c.ended = ENDED(); c.mem.run.fightsWon = 2; },
  act1_clear: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_B01', act: 2 }); },
  no_rest_act: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); actMemory(c.mem, 1).rest = 1; },
  unknown5: c => { c.entered = 'event'; actMemory(c.mem, 1).event = 4; },
  no_elite_clear: c => { c.runEnd = 'win'; c.mem.run.elitesFought = 1; },
  flawless_elite: c => { c.ended = ENDED({ kind: 'elite', hpLost: 1 }); },
  flawless_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B02', hpLost: 0, partial: true }); },
  big50: c => { c.hit = { damage: 49, kills: 0, card: card() }; },
  triple: c => { c.fight = FIGHT({ maxTurnKills: 2 }); },
  one_hp: c => { c.ended = ENDED({ hpEnd: 2 }); },
  turn1: c => { c.ended = ENDED({ turns: 1, warmup: true }); },
  thin_deck: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01', act: 1 }); c.next = V({ deck: baseDeck().slice(0, 9) }); },
  light_deck: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01' }); },
  boss_tempo: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01', flags: { trait_tempo: 1 } }); },
  boss_toxin: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B03', turns: 5 }); },
  boss_marshal: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_B03', flags: { summon: 1 } }); },
  boss_phase2: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B01', flags: { trait_phase2: 1 } }); },
  boss_oracle: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B02', maxPlays: 6 }); },
  boss_hunter: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_B03', flags: { aimedSnipe: 1 } }); },
  all_bosses: c => { c.career = { ...emptyCareer(), bossWins: { B01: 1, B02: 1 } }; },
  no_shop: c => { c.runEnd = 'win'; c.mem.run.shopsVisited = 1; },
  no_heal_rest: c => { c.action = { type: 'rest', choice: 'heal' }; c.prev = V({ hp: 20, maxHp: 80 }); },
  low_boss: c => { c.ended = ENDED({ kind: 'boss', bossId: 'B01', hpEnd: 9, maxHp: 80 }); },
  asc3_all: c => { c.career = { ...emptyCareer(), teamWins: { breach: 3, anchor: 4, utility: 2, rotation: 10 } }; },
  act1_bosses: c => { c.career = { ...emptyCareer(), bossLosses: { B01: 1, B02: 2 } }; },
  comeback: c => { c.runEnd = 'win'; c.career = { ...emptyCareer(), lastStreakBeforeWin: 2 }; },
  speedrun: c => { c.career = { ...emptyCareer(), fastestWinMs: 46 * 60 * 1000 }; }
};

const WA_BOSSES = ['S_B01', 'S_B02', 'S_BG1', 'A2_S_B01', 'A2_S_B02', 'A2_S_B03', 'A3_S_B01', 'A3_S_B02', 'A3_S_BG1'];
const WA_CASES = {
  ...Object.fromEntries(['first_win', 'act1_clear', 'run_clear', 'no_rest_act', 'unknown5', 'elite3_act', 'no_elite_clear', 'flawless_elite', 'flawless_boss', 'triple', 'one_hp', 'turn1', 'long_fight', 'ten_plays', 'aim_break', 'thin_deck', 'light_deck', 'polished', 'power3', 'cursed_boss', 'first_elite', 'elite_early', 'rich', 'spree', 'broke_boss', 'gear_full', 'supply_full', 'no_shop', 'low_boss', 'asc1', 'asc5', 'asc10', 'first_loss', 'act1_bosses', 'comeback', 'speedrun'].map(k => [k, NEW_CASES[k]])),
  act1_bosses: c => { c.career = { ...emptyCareer(), bossLosses: { S_B01: 1, S_B02: 1, S_BG1: 1 } }; },
  big40: c => { c.hit = { damage: 40, kills: 0, card: card() }; },
  big80: c => { c.hit = { damage: 80, kills: 1, card: card() }; },
  block40: c => { c.next = V({ inCombat: true, combat: combatView({ block: 40 }) }); },
  same3: c => { c.next = V({ deck: [...baseDeck(), ...Array.from({ length: 3 }, () => card({ id: 'CN20', basic: false, role: '决斗' }))] }); },
  role10: c => { c.next = V({ deck: Array.from({ length: 10 }, (_, i) => card({ id: 'P' + i, role: '哨位' })) }); },
  boss_tempo: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_B01' }); },
  boss_wall: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_B02', flags: { wallBreak: true } }); },
  boss_sniper: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_BG1' }); },
  boss_blitz: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_S_B02', turns: 4 }); },
  boss_toxin: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A2_S_B03', flags: { cleanKill: true } }); },
  boss_phase2: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_S_B01' }); },
  boss_escort: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_S_BG1', flags: { escortsAlive: true } }); },
  all_bosses: c => { c.career = { ...emptyCareer(), bossWins: Object.fromEntries(WA_BOSSES.map(id => [id, 1])) }; },
  sell_gear: c => { c.action = { type: 'sellGear', index: 0 }; },
  hard_sponsor: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_B01' }); c.mem.run.flags.hpForGear = true; },
  no_heal_rest: c => { c.action = { type: 'activity', choice: 'upgrade' }; c.prev = V({ hp: 20, maxHp: 80 }); },
  remove4: c => { c.mem.run.removed = 4; },
  asc3_all: c => { c.career = { ...emptyCareer(), teamWins: { CN: 3, AM: 3, EMEA: 5, PAC: 3 } }; },
  win_CN: c => { c.career = winCareer('CN', 0); },
  win_AM: c => { c.career = winCareer('AM', 0); },
  win_EMEA: c => { c.career = winCareer('EMEA', 0); },
  win_PAC: c => { c.career = winCareer('PAC', 2); },
  trait_CN: c => { c.next = V({ team: 'CN' }); c.fight = FIGHT({ flags: { cn5: true } }); },
  trait_AM: c => { c.next = V({ team: 'AM' }); c.fight = FIGHT({ maxTurnDamage: 60 }); },
  trait_EMEA: c => { c.next = V({ team: 'EMEA' }); c.fight = FIGHT({ flags: { emea40: true } }); },
  trait_PAC: c => { c.next = V({ team: 'PAC' }); c.ended = ENDED({ flags: { pac10: true } }); },
  all_regions: c => { c.career = { ...emptyCareer(), teamWins: { CN: 0, AM: 0, EMEA: 1, PAC: 0 } }; }
};
const WA_MISSES = {
  boss_sniper: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_BG1', flags: { aimedSnipe: 1 } }); },
  boss_escort: c => { c.ended = ENDED({ kind: 'boss', bossId: 'A3_S_BG1' }); },
  trait_AM: c => { c.next = V({ team: 'CN' }); c.fight = FIGHT({ maxTurnDamage: 80 }); },
  trait_CN: c => { c.next = V({ team: 'AM' }); c.fight = FIGHT({ flags: { cn5: true } }); },
  hard_sponsor: c => { c.ended = ENDED({ kind: 'boss', bossId: 'S_B01' }); },
  no_heal_rest: c => { c.action = { type: 'activity', choice: 'fans' }; c.prev = V({ hp: 20, maxHp: 80 }); },
  all_bosses: c => { c.career = { ...emptyCareer(), bossWins: { S_B01: 1 } }; },
  same3: c => { c.next = V({ deck: [...baseDeck(), ...Array.from({ length: 3 }, () => card({ id: 'CN20', basic: true, role: '决斗' }))] }); }
};

function runCases(label, defs, cases, misses) {
  test(`${label}: every achievement has a unit case that unlocks it`, () => {
    const keys = defs.map(d => d.key);
    assert.equal(new Set(keys).size, keys.length, 'keys are unique');
    assert.deepEqual(keys.filter(k => !cases[k]), [], 'missing a passing case');
    for (const d of defs) {
      const c = base();
      cases[d.key](c);
      assert.equal(!!d.test(c), true, `${d.key} should unlock`);
    }
  });
  test(`${label}: nothing unlocks from a neutral state, and near misses stay locked`, () => {
    for (const d of defs) assert.equal(!!d.test(base()), false, `${d.key} unlocked from nothing`);
    for (const [k, f] of Object.entries(misses)) {
      const d = defs.find(x => x.key === k);
      assert.ok(d, k);
      const c = base();
      f(c);
      assert.equal(!!d.test(c), false, `${k} near miss unlocked`);
    }
  });
}
runCases('new demo', NEW_ACHIEVEMENTS, NEW_CASES, NEW_MISSES);
runCases('wa demo', WA_ACHIEVEMENTS, WA_CASES, WA_MISSES);

test('definitions: 40-65 per demo, grouped by known categories, secrets present, rewards are titles only', () => {
  for (const [defs, cats] of [[NEW_ACHIEVEMENTS, NEW_CATS], [WA_ACHIEVEMENTS, WA_CATS]]) {
    assert.ok(defs.length >= 40 && defs.length <= 65, String(defs.length));
    const catKeys = new Set(cats.map(c => c.key));
    for (const d of defs) {
      assert.ok(catKeys.has(d.cat), d.key);
      assert.ok(d.name && d.desc, d.key);
      if (d.reward) assert.deepEqual(Object.keys(d.reward), ['title'], d.key);
    }
    for (const c of cats) assert.ok(defs.some(d => d.cat === c.key), c.key);
    assert.ok(defs.filter(d => d.secret).length >= 5);
    assert.ok(defs.filter(d => d.reward?.title).length >= 15);
  }
});

test('new demo text stays original: no esports IP, no build guidance', () => {
  const text = [...NEW_ACHIEVEMENTS.flatMap(d => [d.name, d.desc, d.reward?.title || '']), ...NEW_CATS.map(c => c.name)].join('\n');
  assert.doesNotMatch(text, /无畏|VCT|Valorant|瓦罗兰|大师赛|冠军赛|美洲|EMEA|太平洋|中国赛区|特工|选手|建议|推荐/);
  const src = readFileSync(new URL('../new-demo/achievements.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /无畏|VCT|Valorant|大师赛|冠军赛|美洲|太平洋|\/wa\/|\/pvp\//);
  for (const t of Object.values(TEAMS)) assert.ok(!/无畏|VCT/.test(t.name));
});

test('wa demo text never names a real player', () => {
  const text = WA_ACHIEVEMENTS.map(d => `${d.name}${d.desc}${d.reward?.title || ''}`).join('\n');
  const players = Object.values(WA_CARDS).filter(c => c.player).map(c => c.name).filter(n => n && n.length >= 2);
  assert.ok(players.length > 100);
  for (const n of players) assert.ok(!text.includes(n), n);
  assert.doesNotMatch(text, /建议|推荐/);
});

// ---------------------------------------------------------------- storage & dedupe
test('book storage round-trips, survives garbage and keeps demos apart', () => {
  const st = fakeStorage();
  assert.deepEqual(loadBook(st, 'k'), emptyBook());
  st.setItem('k', '{bad json');
  assert.deepEqual(loadBook(st, 'k'), emptyBook());
  st.setItem('k', JSON.stringify({ unlocked: { a: { at: 5, run: 7, label: 'x' }, b: 'bad' }, order: ['zz', 'a'], worn: 3, career: { runs: '2', teamWins: [] } }));
  const b = loadBook(st, 'k');
  assert.deepEqual(Object.keys(b.unlocked), ['a']);
  assert.equal(b.unlocked.a.run, '7');
  assert.deepEqual(b.order, ['a']);
  assert.equal(b.worn, null);
  assert.equal(b.career.runs, 2);
  assert.deepEqual(b.career.teamWins, {});
  b.worn = '猎人';
  assert.ok(saveBook(st, 'k', b));
  assert.deepEqual(loadBook(st, 'k'), normalizeBook(b));
  assert.deepEqual(loadBook(st, 'other'), emptyBook());
  const a1 = readFileSync(new URL('../new-demo/achievements.js', import.meta.url), 'utf8');
  const a2 = readFileSync(new URL('../wa-achievements.js', import.meta.url), 'utf8');
  assert.match(a1, /'new-demo-achievements-v1'/);
  assert.match(a2, /'wa-achievements-v1'/);
});

test('unlocking is deduplicated: a key is recorded once, with its run', () => {
  const defs = [{ key: 'a', cat: 'x', name: 'A', desc: 'a', reward: { title: 'T' }, test: () => true }, { key: 'b', cat: 'x', name: 'B', desc: 'b', test: () => false }];
  const book = emptyBook();
  assert.equal(unlockKeys(book, defs, ['a', 'a', 'nope'], { at: 1, run: 'r1' }).length, 1);
  assert.equal(unlockKeys(book, defs, ['a'], { at: 2, run: 'r2' }).length, 0);
  assert.equal(book.unlocked.a.run, 'r1');
  assert.deepEqual(book.order, ['a']);
  // Repeated steps that keep passing unlock once.
  const book2 = emptyBook();
  let mem = null, total = 0;
  for (let i = 0; i < 5; i++) {
    const r = achStep({ defs, book: book2, mem, prev: V(), next: V(), action: { type: 'noop' } });
    mem = r.mem; total += r.fresh.length;
  }
  assert.equal(total, 1);
  assert.deepEqual(mem.unlocked, ['a']);
  // A definition that throws never unlocks and never breaks the step.
  const bad = [{ key: 'boom', cat: 'x', name: 'x', desc: 'x', test: () => { throw Error('x'); } }];
  assert.equal(evaluate(bad, base(), emptyBook()).length, 0);
});

test('titles: earned in order, newest worn by default, only earned titles can be worn', () => {
  const defs = [{ key: 'a', reward: { title: '一' }, test: () => true }, { key: 'b', reward: { title: '二' }, test: () => true }, { key: 'c', test: () => true }];
  const book = emptyBook();
  assert.equal(wornTitle(defs, book), null);
  assert.equal(titleBadgeHtml(defs, book), '');
  unlockKeys(book, defs, ['a', 'c', 'b']);
  assert.deepEqual(earnedTitles(defs, book), ['一', '二']);
  assert.equal(wornTitle(defs, book), '二');
  assert.equal(wearTitle(defs, book, '三'), false);
  assert.equal(wearTitle(defs, book, '一'), true);
  assert.equal(wornTitle(defs, book), '一');
  assert.match(titleBadgeHtml(defs, book), /一/);
});

test('hall hides secrets until unlocked and shows date and run; results list only this run', () => {
  const defs = [
    { key: 'open', cat: 'c1', name: '公开', desc: '公开描述', test: () => false },
    { key: 'hid', cat: 'c1', secret: true, name: '秘密名', desc: '秘密描述', reward: { title: '秘' }, test: () => false },
    { key: 'got', cat: 'c2', name: '已得', desc: '已得描述', test: () => false }
  ];
  const cats = [{ key: 'c1', name: '甲类' }, { key: 'c2', name: '乙类' }];
  const book = emptyBook();
  unlockKeys(book, defs, ['got'], { at: Date.UTC(2026, 8, 25), run: 'run-9', label: '某队 · 难度 2' });
  const html = hallHtml(defs, cats, book);
  assert.match(html, /？？？/);
  assert.doesNotMatch(html, /秘密名|秘密描述/);
  assert.match(html, /公开描述/);
  assert.match(html, /某队 · 难度 2/);
  assert.match(html, /0 \/ 2/);
  assert.match(html, /1 \/ 1/);
  assert.match(html, /1<\/strong><span>\/ 3/);
  unlockKeys(book, defs, ['hid'], { run: 'run-10' });
  assert.match(hallHtml(defs, cats, book), /秘密名/);
  assert.match(runAchievementsHtml(defs, book, 'run-9'), /已得/);
  assert.doesNotMatch(runAchievementsHtml(defs, book, 'run-9'), /秘密名/);
  assert.equal(runAchievementsHtml(defs, book, 'run-x'), '');
});

// ---------------------------------------------------------------- memory, career
test('step memory: fight start, damage per card, turn kills, fight end and shop spending', () => {
  const enemies = hp => hp.map((h, i) => ({ uid: 'e' + i, id: 'M01', hp: h, maxHp: 30 }));
  const inFight = (hp, o = {}) => V({ phase: 'combat', inCombat: true, hp: o.hp ?? 50, combat: combatView({ turn: o.turn ?? 1, plays: o.plays ?? 0, enemies: enemies(hp), hand: [{ uid: 'h1', id: 'TA01', type: 'attack', cost: 1 }] }) });
  let r = stepMemory(null, V({ phase: 'map' }), inFight([30, 30, 30]), { type: 'enter' });
  assert.ok(r.mem.fight && !r.mem.fight.partial);
  assert.equal(r.entered, 'battle');
  r = stepMemory(r.mem, inFight([30, 30, 30]), inFight([0, 10, 30], { plays: 1 }), { type: 'play', uid: 'h1' });
  assert.equal(r.hit.damage, 50);
  assert.equal(r.hit.kills, 1);
  assert.equal(r.hit.card.id, 'TA01');
  assert.equal(r.mem.fight.maxCardDamage, 50);
  r = stepMemory(r.mem, inFight([0, 10, 30], { plays: 1 }), inFight([0, 0, 0], { plays: 2 }), { type: 'play', uid: 'h1' });
  assert.equal(r.mem.fight.maxTurnKills, 3);
  r = stepMemory(r.mem, inFight([0, 0, 0]), V({ phase: 'reward', hp: 41, combat: combatView({ enemies: enemies([0, 0, 0]) }) }), { type: 'end' });
  assert.equal(r.ended.outcome, 'win');
  assert.equal(r.ended.hpLost, 9);
  assert.equal(r.mem.run.fightsWon, 1);
  assert.equal(r.mem.fight, null);
  // New turn resets the per-turn tally.
  let m = stepMemory(null, V(), inFight([30, 30]), { type: 'enter' }).mem;
  m = stepMemory(m, inFight([30, 30]), inFight([0, 30]), { type: 'play', uid: 'h1' }).mem;
  m = stepMemory(m, inFight([0, 30]), inFight([0, 30], { turn: 2 }), { type: 'end' }).mem;
  assert.equal(m.fight.turnKills, 0);
  assert.equal(m.fight.maxTurnKills, 1);
  // Shop spending is per visit.
  m = stepMemory(null, V({ phase: 'map', money: 400 }), V({ phase: 'shop', nodeKind: 'shop', money: 400 }), { type: 'enter' }).mem;
  m = stepMemory(m, V({ phase: 'shop', money: 400 }), V({ phase: 'shop', money: 250 }), { type: 'buy' }).mem;
  m = stepMemory(m, V({ phase: 'shop', money: 250 }), V({ phase: 'shop', money: 90 }), { type: 'remove' }).mem;
  assert.equal(m.shop.spent, 310);
  assert.equal(m.run.removed, 1);
  assert.equal(m.run.shopsVisited, 1);
  // Abandoning mid-fight is not a win.
  const ab = stepMemory(null, inFight([30]), V({ phase: 'result', result: 'abandon', combat: combatView({ enemies: enemies([30]) }) }), { type: 'abandon' });
  assert.equal(ab.runEnd, 'abandon');
  // A different run starts a fresh memory.
  assert.equal(stepMemory(m, V(), V({ runId: 'r2' }), { type: 'x' }).mem.run.removed, 0);
});

test('career: wins per team keep the best difficulty, boss losses and streaks are recorded, abandon changes nothing', () => {
  let c = emptyCareer();
  const lost = { ...newRunMemory('a'), lastFight: ENDED({ outcome: 'loss', kind: 'boss', bossId: 'B02' }) };
  for (let i = 0; i < 3; i++) c = updateCareer(c, { runEnd: 'loss', next: V(), mem: lost });
  assert.equal(c.lossStreak, 3);
  assert.equal(c.bossLosses.B02, 3);
  assert.deepEqual(updateCareer(c, { runEnd: 'abandon', next: V(), mem: lost }), c);
  c = updateCareer(c, { runEnd: 'win', next: V({ team: 'anchor', asc: 4 }), mem: { ...newRunMemory('b', 1000) }, now: 1000 + 30 * 60 * 1000 });
  assert.equal(c.lastStreakBeforeWin, 3);
  assert.equal(c.lossStreak, 0);
  assert.equal(c.teamWins.anchor, 4);
  assert.equal(c.fastestWinMs, 30 * 60 * 1000);
  c = updateCareer(c, { runEnd: 'win', next: V({ team: 'anchor', asc: 1 }), mem: newRunMemory('c', 0), now: 99 * 60 * 1000 });
  assert.equal(c.teamWins.anchor, 4);
  assert.equal(c.fastestWinMs, 30 * 60 * 1000);
});

test('seedCareer learns from the run history once; career achievements then unlock from the book', () => {
  const hist = [
    { id: '1', outcome: 'loss', teamId: 'breach', ascension: 0, endedAt: 1 },
    { id: '2', outcome: 'win', teamId: 'breach', ascension: 2, endedAt: 2, durationMs: 50 * 60 * 1000 },
    { id: '3', outcome: 'abandon', teamId: 'anchor', ascension: 0, endedAt: 3 }
  ];
  const c = seedCareer(emptyCareer(), hist);
  assert.equal(c.runs, 2);
  assert.equal(c.teamWins.breach, 2);
  assert.ok(c.seeded);
  assert.equal(seedCareer(c, [...hist, { id: '4', outcome: 'win', teamId: 'anchor', ascension: 9, endedAt: 4 }]), c);
  const book = emptyBook();
  book.career = c;
  const fresh = evaluateCareer(NEW_ACHIEVEMENTS, book).map(d => d.key).sort();
  assert.deepEqual(fresh, ['asc1', 'win_breach']);
  assert.equal(book.unlocked.asc1.label, '生涯记录');
});

// ---------------------------------------------------------------- adapters and engine moments
test('new demo view reads a real run; observe turns engine logs into fight flags', () => {
  const s = createRun('ach-view', 'utility', { ascension: 2 });
  const v = newView(s);
  assert.equal(v.runId, 'ach-view');
  assert.equal(v.team, 'utility');
  assert.equal(v.asc, 2);
  assert.equal(v.deck.length, s.deck.length);
  assert.ok(v.deck.every(c => ['attack', 'skill', 'power', 'status'].includes(c.type)));
  assert.equal(v.combat, null);
  // Enter the first fight through the real engine.
  const enter = newLegal(s).find(a => a.type === 'enter');
  const s2 = newAct(s, enter).state;
  const v2 = newView(s2);
  assert.ok(v2.inCombat && v2.combat.enemies.length >= 1 && v2.combat.hand.length > 0);
  const mem = newRunMemory('ach-view');
  const fight = FIGHT();
  newObserve({ prev: V(), next: V(), action: { type: 'play' }, raw: { prev: { logs: [] }, next: { logs: [{ event: 'aim_broken' }, { event: 'trait', data: { id: 'tempo' } }, { event: 'squad', data: { id: 'intel' } }, { event: 'stance_switch' }, { event: 'summon' }, { event: 'relic_trigger', data: { id: 'R34' } }] } }, mem, fight, hit: { damage: 0 } });
  assert.deepEqual(fight.flags, { aimBroken: 1, trait_tempo: 1, squad_intel: 1, stance: 1, summon: 1 });
  assert.equal(mem.run.flags.injector, true);
  // A sniper still aiming at end of turn fires its full shot.
  const f2 = FIGHT();
  newObserve({ prev: V({ combat: combatView({ enemies: [{ uid: 'e0', id: 'A3_B03', hp: 50, aim: true, intent: [{ type: 'snipe', n: 36 }] }] }) }), next: V(), action: { type: 'end' }, raw: {}, mem, fight: f2, hit: { damage: 0 } });
  assert.equal(f2.flags.aimedSnipe, 1);
});

test('new demo end to end: winning the first fight through the engine unlocks 开门红 once', () => {
  let s = createRun('ach-e2e', 'breach', {});
  let mem = null;
  const book = emptyBook();
  const step = a => { const r = newAct(s, a); assert.ok(!r.error, r.error); const out = achStep({ defs: NEW_ACHIEVEMENTS, book, mem, prev: newView(s), next: newView(r.state), action: a, raw: { prev: s, next: r.state }, observe: newObserve }); mem = out.mem; s = r.state; return out.fresh.map(d => d.key); };
  step(newLegal(s).find(a => a.type === 'enter'));
  // Weaken the opponent so any attack finishes it (the test drives the flow, not balance).
  for (const e of s.battle.enemies) e.hp = 1;
  if (s.battle.enemyHp !== undefined) s.battle.enemyHp = 1;
  const got = [];
  for (let i = 0; i < 40 && s.phase === 'combat'; i++) {
    const play = newLegal(s).find(a => a.type === 'play' && NEW_CARDS[s.battle.hand.find(c => c.uid === a.uid)?.id]?.type === 'attack');
    got.push(...step(play || newLegal(s).find(a => a.type === 'end')));
  }
  assert.equal(s.phase, 'reward');
  assert.ok(got.includes('first_win'), got.join());
  assert.equal(Object.keys(book.unlocked).filter(k => k === 'first_win').length, 1);
  assert.equal(book.unlocked.first_win.run, 'ach-e2e');
});

test('wa view reads a real season (server replay untouched); observe reads the text log', () => {
  const s = createWaSeason('ach-wa', false, 'PAC', 'run-ach', { rules: RULES_VERSION, ascension: 1 });
  const before = JSON.stringify(s.actions);
  const v = waView(s);
  assert.equal(v.runId, 'run-ach');
  assert.equal(v.team, 'PAC');
  assert.equal(v.asc, 1);
  assert.ok(v.deck.length > 0 && v.deck.every(c => c.basic));
  assert.equal(JSON.stringify(s.actions), before);
  assert.equal(waView({ mode: 'legacy', deck: [] }), null);
  const fight = FIGHT();
  const mem = newRunMemory('run-ach');
  waObserve({ prev: V(), next: V(), action: { type: 'play' }, raw: { prev: { logs: [] }, next: { logs: [{ text: '控制节奏：对手火力 +2、布防 +6。' }, { text: '对手虚弱 +1 回合。' }, { text: '压制打断了对手的瞄准。' }, { text: '决胜局：对手清除负面状态' }] } }, mem, fight, hit: { damage: 0 } });
  assert.deepEqual(fight.flags, { trait_tempo: 1, aimBroken: 1, trait_phase2: 1 });
  waObserve({ prev: V(), next: V(), action: { type: 'opening', choice: 'hpForGear' }, raw: {}, mem, fight: null, hit: { damage: 0 } });
  assert.equal(mem.run.flags.hpForGear, true);
  // 擒贼先擒王: the commander falls while both guards stand.
  const f3 = FIGHT();
  const foes = hp => hp.map((h, i) => ({ uid: 'f' + i, id: i ? 'A3_S_BM2' : 'A3_S_B03', hp: h, block: 0, weak: 0 }));
  waObserve({ prev: V({ combat: combatView({ enemies: foes([5, 30, 30]) }) }), next: V({ combat: combatView({ enemies: foes([0, 30, 30]) }) }), action: { type: 'play' }, raw: {}, mem, fight: f3, hit: { damage: 5 } });
  assert.equal(f3.flags.escortsAlive, true);
  assert.ok(Object.keys(REGIONS).length === 4);
});
