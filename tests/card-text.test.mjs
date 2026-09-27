// Card text must never leak code values (the Wa card BuZz read "基础伤害 +true"),
// must use each demo's own words, and must show the numbers the effects use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, describe, compactLines, cardKeywords, TACTICS } from '../content.js';
import * as ND from '../new-demo/content.js';

const BAD = /true|false|undefined|NaN|null|\[object|\$\{|\+\s*[；。，]|\+\s*$|；；|。。|，，|；。|。；|（\s*）|\+0(?!\d)|\btoken\b|／|\s[；。，]|^[；。，]/;
// Build guidance and fantasy words are never card text in either demo.
const GUIDE = /流派|推荐|适合.{0,6}(流派|构筑|打法)|构筑(核心|方向|思路)|诅咒|药水|遗物|法术|魔法|咒语/;

const waTexts = (id, up) => { const c = { id, up }; return [describe(c), compactLines(c).join(' | '), ...cardKeywords(c).map(([k, v]) => `${k}：${v}`)]; };
const waIds = up => Object.keys(CARDS).filter(id => !up || CARDS[id].upgraded);

test('Wa card text (base and trained) has no leaked values', () => {
  const bad = [];
  for (const up of [false, true]) for (const id of waIds(up)) for (const s of waTexts(id, up)) if (BAD.test(s)) bad.push(`${id}${up ? '+' : ''}: ${s}`);
  assert.deepEqual(bad, []);
});

test('Wa conditional bonuses are numbers', () => {
  const bad = [];
  for (const [id, c] of Object.entries(CARDS)) for (const e of [...(c.effects || []), ...(c.upgraded || [])]) for (const k of ['ifWeak', 'ifVuln', 'ifBurn']) if (k in e && typeof e[k] !== 'number') bad.push(`${id} ${k}=${e[k]}`);
  assert.deepEqual(bad, []);
});

test('Wa card text uses the Wa words (布防/压制/行动点/声望) and no build guidance', () => {
  const bad = [];
  for (const up of [false, true]) for (const id of waIds(up)) {
    const t = TACTICS[id] || {};
    for (const s of [...waTexts(id, up), t.scene || '', t.title || '']) {
      if (/格挡|虚弱|护甲|能量|生命|诅咒/.test(s.replace(CARDS[id].name, ''))) bad.push(`${id}: ${s}`);
      if (GUIDE.test(s)) bad.push(`${id} guide: ${s}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('Wa text shows every number the effects use', () => {
  const bad = [];
  const nums = e => e.type === 'combo' ? nums(e.effect) : [e.n, e.times > 1 ? e.times : null, e.ifWeak, e.ifVuln, e.ifBurn, e.grow, e.per, e.turns, e.xPlus].filter(v => typeof v === 'number');
  for (const up of [false, true]) for (const id of waIds(up)) {
    const text = describe({ id, up });
    for (const e of (up ? CARDS[id].upgraded : CARDS[id].effects) || []) for (const n of nums(e)) if (!new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(text)) bad.push(`${id}${up ? '+' : ''} ${e.type} ${n}: ${text}`);
  }
  assert.deepEqual(bad, []);
});

test('Wa token cards are explained by their own name and value', () => {
  for (const id of Object.keys(CARDS)) for (const up of [false, true]) {
    const list = ((up ? CARDS[id].upgraded : CARDS[id].effects) || []).flatMap(e => e.type === 'combo' ? [e.effect] : [e]);
    for (const e of list.filter(e => e.type === 'token')) {
      const kw = cardKeywords({ id, up }).find(([k]) => k === CARDS[e.id].name);
      assert.ok(kw, `${id} explains ${e.id}`);
      const [eff] = CARDS[e.id].effects;
      assert.match(kw[1], new RegExp(`${eff.n} ${eff.type === 'hit' ? '伤害' : '布防'}`), `${id} ${kw[1]}`);
    }
  }
});

test('Wa power cards say which part is immediate and which part lasts', () => {
  for (const id of Object.keys(CARDS)) if (CARDS[id].zone === 'power') for (const up of [false, true]) {
    if (up && !CARDS[id].upgraded) continue;
    const text = describe({ id, up });
    assert.match(text, /能力：/, id);
    assert.match(text, /本场持续生效，不再洗回。$/, id);
    // Immediate effects (damage, 布防, draws) come before "能力：".
    const [now] = text.split('能力：');
    const immediate = (up ? CARDS[id].upgraded : CARDS[id].effects).filter(e => e.type !== 'power').length;
    assert.equal(!!now, !!immediate, `${id}: ${text}`);
  }
});

const ndText = (id, up) => ND.cardTextFor(id, up);
const ndAll = () => [...Object.keys(ND.CARDS), ...Object.keys(ND.STATUS_CARDS)];

test('new demo card text has no leaked values', () => {
  const bad = [];
  for (const id of ndAll()) for (const up of [false, true]) { const s = ndText(id, up); if (BAD.test(s)) bad.push(`${id}${up ? '+' : ''}: ${s}`); }
  assert.deepEqual(bad, []);
});

// Nothing from the tactical shooter the Wa demo is about, and none of the Wa demo's own words.
const IP = /无畏|瓦洛兰|瓦罗兰|Valorant|VCT|大师赛|冠军赛|选手|特工|赛区|美洲|太平洋|EMEA|中国|捷风|猎枭|贤者|幽影|蝰蛇|铁臂|暮蝶|夜露|雷兹|不死鸟|炼狱|芮娜|盖可|钛狐|奇乐|斯凯|夜枭|黑梦|壹决|海神|冥驹|狂徒|鬼魅|骇灵|判官|奥丁|戍卫|爆能器|绊线|侦察箭|毒幕|减速球|暗魇|Jett|Sova|Sage|Omen|Viper|Breach|Clove|Cypher|Killjoy/;
test('new demo card names and text: no Wa content, own words, no build guidance', () => {
  const bad = [];
  for (const id of ndAll()) {
    const def = ND.CARDS[id] || ND.STATUS_CARDS[id];
    if (IP.test(def.name) || /[A-Za-z+Ⅰ-Ⅻ]/.test(def.name) || /虚弱|脆弱|格挡/.test(def.name)) bad.push(`${id} name ${def.name}`);
    for (const up of [false, true]) {
      const s = ndText(id, up);
      if (IP.test(s) || GUIDE.test(s) || /行动点|声望|虚弱|脆弱|格挡|护甲|\b99\b|[A-WYZa-z]/.test(s)) bad.push(`${id}${up ? '+' : ''}: ${s}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('new demo text shows every number the effects use', () => {
  const bad = [];
  const nums = e => e.effect ? [...nums(e.effect), e.times, e.plus].filter(v => typeof v === 'number' && v > 0) : [e.n, e.times > 1 ? e.times : null, e.turns, e.per > 1 ? e.per : null, e.base, e.cap, e.mult > 1 ? e.mult : null].filter(v => typeof v === 'number' && v < 99);
  for (const [id, c] of Object.entries(ND.CARDS)) {
    if (c.type === 'power') continue;
    for (const up of [false, true]) {
      const list = up && c.upgradeEffects?.length ? c.upgradeEffects : c.effects;
      const text = ndText(id, up);
      // Back-to-back heals are summed in the text, so check their total.
      const heal = list.filter(e => e.type === 'heal').reduce((n, e) => n + e.n, 0);
      for (const e of list) for (const n of e.type === 'heal' ? [heal] : nums(e)) if (!new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(text)) bad.push(`${id}${up ? '+' : ''} ${e.type} ${n}: ${text}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('new demo conditional clauses end before the next unconditional effect', () => {
  const bad = [];
  for (const [id, c] of Object.entries(ND.CARDS)) for (const up of [false, true]) {
    const list = up && c.upgradeEffects?.length ? c.upgradeEffects : c.effects || [];
    const i = list.findIndex(e => e.type === 'conditional');
    if (i >= 0 && i < list.length - 1 && !ndText(id, up).includes('；')) bad.push(`${id}: ${ndText(id, up)}`);
  }
  assert.deepEqual(bad, []);
});

test('new demo power cards: text matches the power, upgrades that change the power say so', () => {
  for (const [id, c] of Object.entries(ND.CARDS)) if (c.type === 'power') {
    assert.ok(c.text.length > '能力：'.length, `${id} has power text`);
    if (['inflame', 'footwork'].includes(c.power)) {
      assert.match(c.text, /\+2/, id);
      assert.match(ND.cardTextFor(id, true), /\+3/, id);
    }
  }
});

test('new demo: no two different cards share a name inside one team reward pool', () => {
  for (const region of Object.keys(ND.REGION_CARD_IDS)) {
    const seen = new Map();
    for (const id of [...ND.SHARED_CARD_IDS, ...ND.REGION_CARD_IDS[region]]) {
      const name = ND.CARDS[id].name;
      assert.ok(!seen.has(name), `${region}: ${name} is both ${seen.get(name)} and ${id}`);
      seen.set(name, id);
    }
  }
});

test('new demo card type strip labels describe effects, not deck-building roles', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../new-demo/ui.js', import.meta.url), 'utf8');
  const line = src.split('\n').find(l => l.startsWith('const tagMap'));
  assert.ok(line);
  assert.doesNotMatch(line, /构筑|流派|混搭|推荐/);
  assert.doesNotMatch(src, /'诅咒'/);
});
