// Random-effect feedback: every effect the player did not pick records exactly
// which card / equipment it touched in state.lastResult, so the UI can say
// "已训练：XXX（伤害 7 → 10）". These tests check the records against the deck.
import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeDiffText, applyOps } from '../shared-event-core.js';
import { resultWorthShowing, resultSummaryHtml } from '../shared/result-summary.js';
import { createRun, act as newStep, legalActions as newLegal } from '../new-demo/engine.js';
import { CARDS as NEW_CARDS, STATUS_CARDS, RELICS, cardTextFor } from '../new-demo/content.js';
import { EVENTS, EVENT_POOLS } from '../new-demo/events.js';
import { createSeason, act as waStep, instance, replay } from '../engine.js';
import { createWaSeason, waAct } from '../wa-season.js';
import { CARDS as WA_CARDS } from '../content.js';
import { WA_EVENTS, WA_EVENT_POOLS } from '../wa-events.js';
import { GEAR, RULES_VERSION, ECON_VERSION } from '../wa-rules.js';

const ok = r => { assert.equal(r.error ?? null, null, r.error); return r.state; };
const RANDOM_OPS = ['upgradeRandom', 'transformRandom', 'card', 'equip', 'gamble'];
const hasRandom = ops => ops.some(o => RANDOM_OPS.some(k => o[k]) || o.curse === true);
const upIds = deck => deck.filter(c => c.up).map(c => c.uid);

// Checks the entries against what actually changed in the deck / equipment.
function checkEntries(before, after, entries, { name, gearNames }) {
  const newlyUp = after.deck.filter(c => c.up && !before.deck.find(x => x.uid === c.uid)?.up && before.deck.some(x => x.uid === c.uid));
  const ups = entries.filter(e => e.kind === 'upgrade');
  assert.equal(ups.length, newlyUp.length, 'one upgrade entry per upgraded card');
  assert.deepEqual(ups.map(e => e.id).sort(), newlyUp.map(c => c.id).sort(), 'upgrade entries name the upgraded cards');
  for (const e of ups) { assert.ok(e.text.includes(name(e.id)), e.text); assert.ok(e.diff && e.diff.length > 0, e.text); }
  const added = after.deck.filter(c => !before.deck.some(x => x.uid === c.uid)).map(c => c.id);
  const removed = before.deck.filter(c => !after.deck.some(x => x.uid === c.uid)).map(c => c.id);
  for (const e of entries.filter(x => ['curse', 'card'].includes(x.kind))) { assert.ok(added.includes(e.id), `${e.id} was added`); assert.ok(e.text.includes(name(e.id)), e.text); }
  for (const e of entries.filter(x => x.kind === 'transform')) {
    assert.ok(added.includes(e.id) && removed.includes(e.from), 'transform names both cards');
    assert.ok(e.text.includes(name(e.from)) && e.text.includes(name(e.id)) && e.text.includes('→'));
  }
  const gained = gearNames(after).filter(n => !gearNames(before).includes(n));
  for (const e of entries.filter(x => x.kind === 'equip')) assert.ok(gained.some(n => e.text.includes(n)), `equipment named: ${e.text}`);
}

test('upgrade diff: numbers show before → after, cost changes and new clauses are listed', () => {
  assert.equal(upgradeDiffText(['伤害 7'], ['伤害 10']), '伤害 7 → 10');
  assert.equal(upgradeDiffText(['造成7点伤害', '抽1张牌'], ['造成10点伤害', '抽1张牌'], 2, 1), '费用 2 → 1，造成 7 → 10 点伤害');
  assert.equal(upgradeDiffText(['本场升级其余全部手牌'], ['本场升级其余全部手牌', '抽1张牌']), '新增「抽1张牌」');
  assert.equal(upgradeDiffText(['a'], ['a']), '效果提升');
});

test('result popup only for random effects; entries render as escaped rows', () => {
  assert.equal(resultWorthShowing(null), false);
  assert.equal(resultWorthShowing({ entries: [{ kind: 'money', text: '+30' }] }), false);
  assert.equal(resultWorthShowing({ entries: [{ kind: 'money', random: true, inline: true, text: '+30' }] }), false, 'crate loot is shown in the room');
  const r = { title: '复盘 · <b>', entries: [{ kind: 'upgrade', random: true, text: '已训练：甲（伤害 7 → 10）' }] };
  assert.equal(resultWorthShowing(r), true);
  const html = resultSummaryHtml(r);
  assert.ok(html.includes('已训练：甲（伤害 7 → 10）') && html.includes('&lt;b&gt;') && html.includes('随机'));
});

// ----------------------------- new demo -----------------------------
const newName = id => NEW_CARDS[id]?.name || STATUS_CARDS[id]?.name || id;
const newGear = s => [...s.relics.map(r => r.name), ...(s.pendingRelics || []).map(id => RELICS[id].name)];

test('new demo: every event option with a random effect records exactly what it did', () => {
  let checked = 0;
  for (const [act, ids] of Object.entries(EVENT_POOLS)) for (const id of ids) for (const opt of EVENTS[id].options) {
    if (!hasRandom(opt.ops) || opt.ops.some(o => o.fight || o.pick)) continue;
    for (const seed of ['a', 'b', 'c']) {
      const start = createRun(`rs-${id}-${opt.id}-${seed}`);
      start.act = Number(act); start.phase = 'event'; start.event = { id, act: Number(act) }; start.money = 500; start.hp = 50;
      const s = ok(newStep(start, { type: 'event', choice: opt.id }));
      assert.ok(s.lastResult, `${id}/${opt.id} has a result`);
      assert.ok(s.lastResult.title.includes(EVENTS[id].title) && s.lastResult.title.includes(opt.title));
      assert.ok(s.lastResult.entries.some(e => e.random), 'random entry present');
      checkEntries(start, s, s.lastResult.entries, { name: newName, gearNames: newGear });
      checked++;
    }
  }
  assert.ok(checked >= 30, `checked ${checked}`);
});

test('new demo: random upgrade entry reads "已升级：名字（数值 前 → 后）"', () => {
  const start = createRun('rs-upgrade');
  const id = Object.keys(EVENTS).find(k => EVENTS[k].options.some(o => o.ops.length === 2 && o.ops.some(x => x.upgradeRandom === 1) && o.ops.some(x => x.money < 0)));
  const opt = EVENTS[id].options.find(o => o.ops.some(x => x.upgradeRandom === 1) && o.ops.some(x => x.money < 0));
  start.phase = 'event'; start.event = { id, act: 1 }; start.money = 500;
  const s = ok(newStep(start, { type: 'event', choice: opt.id }));
  const e = s.lastResult.entries.find(x => x.kind === 'upgrade');
  const card = s.deck.find(c => c.up);
  assert.equal(e.id, card.id);
  assert.match(e.text, new RegExp(`^已升级：${newName(card.id)}（.*→.*）$`));
  assert.notEqual(cardTextFor(card.id, false), cardTextFor(card.id, true));
  // The next action starts with a clean slate.
  const next = ok(newStep(s, newLegal(s)[0]));
  assert.ok(!next.lastResult || next.lastResult !== s.lastResult);
});

test('new demo: opening trades, difficulty 9, rest and pickup equipment record their random results', () => {
  // 赛前准备: random curse + equipment, or two random pieces.
  for (const choice of ['curseForRelic', 'goldForRelics']) {
    const start = createRun(`rs-open-${choice}`, 'breach', { opening: true });
    start.opening.options.push({ id: choice, group: 'trade', text: choice });
    const s = ok(newStep(start, { type: 'opening', choice }));
    assert.equal(s.lastResult.title, '赛前准备');
    checkEntries(start, s, s.lastResult.entries, { name: newName, gearNames: newGear });
    assert.equal(s.lastResult.entries.filter(e => e.kind === 'equip').length, choice === 'goldForRelics' ? 2 : 1);
    if (choice === 'curseForRelic') assert.equal(s.lastResult.entries.filter(e => e.kind === 'curse').length, 1);
  }
  // 难度 9: the starting curse is named.
  const hard = createRun('rs-a9', 'breach', { ascension: 9 });
  const curse = hard.deck.find(c => c.id.startsWith('CU'));
  assert.equal(hard.lastResult.entries[0].id, curse.id);
  // 休整 without a chosen card upgrades a random one and says which.
  const rest = createRun('rs-rest');
  rest.phase = 'rest';
  const r = ok(newStep(rest, { type: 'rest', choice: 'upgrade' }));
  checkEntries(rest, r, r.lastResult.entries, { name: newName, gearNames: newGear });
  assert.equal(r.lastResult.entries.length, 1);
  // 战术复盘系统 (4 random upgrades) and 旧战术笔记 (a random basic card).
  for (const id of ['R50', 'R10']) {
    const s0 = createRun(`rs-${id}`);
    s0.phase = 'bossRelic'; s0.bossRelic = { options: [id] };
    const s = ok(newStep(s0, { type: 'bossRelic', id }));
    assert.equal(s.lastResult.title, RELICS[id].name);
    checkEntries(s0, s, s.lastResult.entries, { name: newName, gearNames: newGear });
    assert.equal(s.lastResult.entries.length, id === 'R50' ? 4 : 1);
  }
});

test('new demo: supply crate loot is recorded (shown in the crate room itself)', () => {
  for (let i = 0; i < 12; i++) {
    const start = createRun(`rs-crate-${i}`);
    start.phase = 'crate'; start.crate = { size: ['small', 'medium', 'large'][i % 3], opened: false, result: null };
    const s = ok(newStep(start, { type: 'crate', choice: 'open' }));
    const money = s.lastResult.entries.find(e => e.kind === 'money');
    assert.ok(money.inline && money.text.includes(String(s.crate.result.money + s.crate.result.bonusMoney)));
    if (s.crate.result.equip) assert.ok(s.lastResult.entries.some(e => e.kind === 'equip' && e.text.includes(s.crate.result.equip)));
  }
});

// ----------------------------- Wa demo -----------------------------
const waName = id => WA_CARDS[id]?.name || id;
const waGear = s => s.skins.map(id => GEAR[id]?.name || id).concat(s.gearOffer ? [GEAR[s.gearOffer].name] : []);
const waRules = seed => createSeason(seed, false, 'CN', { rules: RULES_VERSION, econ: ECON_VERSION });

test('Wa: every event option with a random effect records which card / equipment it touched', () => {
  let checked = 0;
  for (const [act, ids] of Object.entries(WA_EVENT_POOLS)) for (const id of ids) for (const opt of WA_EVENTS[id].options) {
    if (!hasRandom(opt.ops) || opt.ops.some(o => o.fight || o.pick || o.special)) continue;
    for (const seed of ['a', 'b', 'c']) {
      const start = waRules(`rs-${id}-${opt.id}-${seed}`);
      delete start.opening; start.phase = 'event'; start.act = Number(act); start.eventId = id; start.money = 500; start.hp = 50;
      const s = ok(waStep(start, { type: 'seasonEvent', choice: opt.id }));
      assert.ok(s.lastResult.title.includes(WA_EVENTS[id].title));
      checkEntries(start, s, s.lastResult.entries, { name: waName, gearNames: waGear });
      for (const e of s.lastResult.entries.filter(x => x.kind === 'upgrade')) assert.match(e.text, /^已训练：/);
      checked++;
    }
  }
  assert.ok(checked >= 20, `checked ${checked}`);
});

test('Wa: 常规合同 names the randomly trained starter card with its before → after', () => {
  for (let i = 0; i < 8; i++) {
    const start = waRules(`rs-train-${i}`);
    const s = ok(waStep(start, { type: 'opening', choice: 'trainRandom' }));
    const up = s.deck.filter(c => c.up);
    assert.equal(up.length, 1);
    const [e] = s.lastResult.entries;
    assert.equal(s.lastResult.title, '常规合同');
    assert.equal(e.id, up[0].id);
    assert.ok(e.random && e.text.startsWith(`已训练：${waName(up[0].id)}（`) && e.text.includes('→'), e.text);
  }
});

test('Wa: 豪门注资 / 高强度商业赛 / difficulty 9 name the random curse and equipment', () => {
  const start = waRules('rs-trade');
  for (const choice of ['curseForStar', 'hpForGear']) {
    const s0 = structuredClone(start);
    const o = s0.opening.options.find(x => x.id === choice) || (s0.opening.options.push({ id: choice, ...(choice === 'curseForStar' ? { curse: 'CU03', offers: [] } : { gear: Object.keys(GEAR).find(g => GEAR[g].rarity === 'uncommon') }) }), s0.opening.options.at(-1));
    const s = ok(waStep(s0, { type: 'opening', choice: o.id }));
    checkEntries(s0, s, s.lastResult.entries, { name: waName, gearNames: waGear });
    assert.ok(s.lastResult.entries.some(e => e.kind === (choice === 'curseForStar' ? 'curse' : 'equip')));
  }
  const hard = createSeason('rs-wa-a9', false, 'CN', { rules: RULES_VERSION, ascension: 9 });
  const curse = hard.deck.find(c => c.id.startsWith('CU'));
  assert.equal(hard.lastResult.entries[0].id, curse.id);
});

test('Wa: result records change nothing that replay checks (same deck, rng and outcome)', () => {
  let s = createWaSeason('rs-replay', false, 'CN', 'rs', { rules: RULES_VERSION, econ: ECON_VERSION });
  s = ok(waAct(s, { type: 'opening', choice: 'trainRandom' }));
  s = ok(waAct(s, { type: 'chooseNode', key: s.map.starts[0] }));
  const again = replay({ version: 'D0.2.0', seed: s.seed, tutorial: false, region: 'CN', rules: s.rules, ascension: s.ascension, mapVersion: s.mapVersion, econ: s.econ, unlockTier: s.unlockTier, gearTier: s.gearTier, actions: s.actions });
  assert.equal(again.rng, s.rng);
  assert.deepEqual(again.deck, s.deck);
  assert.equal(again.phase, s.phase);
});
