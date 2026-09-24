// One-off content pass: turn 10 bland regional tactic cards per region into
// build-direction (archetype) cards. Re-running is idempotent. Writes
// regional-expansion.js with the same JSON layout it was generated with.
import { readFile, writeFile } from 'node:fs/promises';
import { EXPANSION_ROWS, EXPANSION_TACTICS } from '../regional-expansion.js';

const hit = (n, times = 1, extra = {}) => ({ type: 'hit', n, times, ...extra });
const block = n => ({ type: 'block', n });
const draw = n => ({ type: 'draw', n });
const weak = n => ({ type: 'weak', n });
const vuln = n => ({ type: 'vulnerable', n });
const token = id => ({ type: 'token', id });
const power = (key, n) => ({ type: 'power', key, n });
const burn = n => ({ type: 'burn', n });
const burnMultiply = n => ({ type: 'burnMultiply', n });
const detonate = per => ({ type: 'detonate', per });
const deploy = (kind, n, turns) => ({ type: 'deploy', kind, n, turns });
const fireTurrets = () => ({ type: 'fireTurrets' });
const bodyslam = () => ({ type: 'bodyslam' });
const strength = n => ({ type: 'strength', n });
const overload = n => ({ type: 'overload', n });
const combo = effect => ({ type: 'combo', effect });

// [id, name, cost, effects, upgraded, zone, archetype, title, scene]
const CARDS = [
  // CN · 均衡配合 → 部署 / 布防反击 / 保留
  ['CNT01', '炮台架点', 2, [deploy('turret', 5, 3)], [deploy('turret', 7, 3)], 'discard', 'deploy', '炮台架点', '把自动炮台架在交叉口，每个回合都替你开火。'],
  ['CNT05', '屏障无人机', 1, [deploy('barrier', 5, 2)], [deploy('barrier', 7, 2)], 'discard', 'deploy', '屏障无人机', '无人机悬在身前，回合结束时自动撑起护盾。'],
  ['CNT08', '集火指令', 1, [fireTurrets(), draw(1)], [fireTurrets(), fireTurrets()], 'discard', 'deploy', '集火指令', '一声令下，所有已部署的炮台立即开火。'],
  ['CNT12', '以守代攻', 1, [bodyslam()], [block(3), bodyslam()], 'discard', 'fortify', '以守代攻', '把掩体推到对手脸上：布防越厚，这一击越重。'],
  ['CNT16', '架枪等待', 1, [block(6)], [block(9)], 'retain', 'fortify', '架枪等待', '准星不离拐角，这张牌可以留到对手露头的那一回合。'],
  ['CNT17', '留枪', 1, [hit(8)], [hit(11)], 'retain', 'fortify', '留枪', '子弹留给关键回合；不打出也不会被弃掉。'],
  ['CNT19', '铁壁架点', 2, [block(10), deploy('barrier', 3, 2)], [block(12), deploy('barrier', 4, 2)], 'discard', 'deploy', '铁壁架点', '先砌墙，再放无人机补位。'],
  ['CNT20', '交叉火力网', 3, [deploy('turret', 7, 4)], [deploy('turret', 9, 4)], 'discard', 'deploy', '交叉火力网', '两台炮台交叉覆盖整条通道。'],
  ['CNT22', '稳守反击', 1, [block(5), combo(hit(6))], [block(7), combo(hit(8))], 'discard', 'combo', '稳守反击', '先稳住站位，再趁队友开枪时反打。'],
  ['CNT23', '阵地轮换', 0, [block(3), combo(draw(1))], [block(5), combo(draw(1))], 'discard', 'combo', '阵地轮换', '跟在队友动作后换位，顺势摸到新的信息。'],
  // AM · 多段进攻与易伤 → 连击 / 飞刀 / 易伤处决
  ['AMT02', '飞刀出手', 1, [token('TK03'), token('TK03')], [token('TK03'), token('TK03'), token('TK03')], 'discard', 'combo', '飞刀出手', '一次甩出两把飞刀，留在手里随时补刀。'],
  ['AMT05', '弱点处决', 1, [hit(6, 1, { ifVuln: 6 })], [hit(8, 1, { ifVuln: 8 })], 'discard', 'execute', '弱点处决', '对手露出破绽的瞬间，一枪打满伤害。'],
  ['AMT07', '连续交火', 1, [hit(5), combo(hit(5))], [hit(7), combo(hit(7))], 'discard', 'combo', '连续交火', '跟着上一个动作继续压枪，第二段伤害接上。'],
  ['AMT08', '刀锋风暴', 2, [power('knife', 3)], [power('knife', 4)], 'power', 'combo', '刀锋风暴', '整场比赛，每一把飞刀都更致命。'],
  ['AMT12', '快速转点', 0, [block(3), combo(draw(1))], [block(5), combo(draw(1))], 'discard', 'combo', '快速转点', '接在队友动作后快速转点。'],
  ['AMT13', '标记弱点', 1, [vuln(2), combo(hit(4))], [vuln(3), combo(hit(5))], 'discard', 'execute', '标记弱点', '先标记，再趁着连续动作补一枪。'],
  ['AMT16', '一穿三', 2, [hit(4, 3), combo(hit(3, 3))], [hit(5, 3), combo(hit(4, 3))], 'discard', 'combo', '一穿三', '连续动作打出节奏，三段扫射再来一轮。'],
  ['AMT18', '节奏大师', 2, [power('comboAtk', 3)], [power('comboAtk', 4)], 'power', 'combo', '节奏大师', '每回合第三张起，所有攻击伤害提高。'],
  ['AMT20', '肾上腺素', 1, [strength(1), draw(1)], [strength(2), draw(1)], 'exhaust', 'execute', '肾上腺素', '心跳加速，本场之后每一枪都更重。'],
  ['AMT24', '处决时刻', 2, [hit(9, 1, { ifVuln: 9 })], [hit(12, 1, { ifVuln: 12 })], 'discard', 'execute', '处决时刻', '对手易伤时，这一枪伤害翻倍。'],
  // EMEA · 压制与防守协同 → 燃烧 / 火力
  ['EUT03', '燃烧弹', 1, [burn(4)], [burn(6)], 'discard', 'burn', '燃烧弹', '燃烧弹封住点位，火焰每回合都在烧。'],
  ['EUT05', '火墙封路', 1, [burn(2), block(5)], [burn(3), block(7)], 'discard', 'burn', '火墙封路', '一道火墙既挡住进攻，也烧伤冲过来的人。'],
  ['EUT11', '点燃补枪', 0, [hit(2), burn(2)], [hit(3), burn(3)], 'discard', 'burn', '点燃补枪', '燃烧弹药打出的补枪。'],
  ['EUT12', '助燃剂', 1, [burnMultiply(2)], [burnMultiply(3)], 'exhaust', 'burn', '助燃剂', '往火里再添一把，燃烧层数翻倍。'],
  ['EUT13', '引爆', 2, [detonate(2)], [detonate(3)], 'discard', 'burn', '引爆', '把所有火点一次引爆，燃烧越多伤害越高。'],
  ['EUT16', '纵火专家', 2, [power('burnTick', 3)], [power('burnTick', 4)], 'power', 'burn', '纵火专家', '整场比赛，每回合开始都会补上一把火。'],
  ['EUT17', '焦土防线', 1, [block(6), burn(1)], [block(8), burn(2)], 'discard', 'burn', '焦土防线', '守住点位，把地面烧成禁区。'],
  ['EUT20', '兴奋信标', 1, [strength(1), block(5)], [strength(2), block(6)], 'exhaust', 'execute', '兴奋信标', '信标亮起，本场之后每一枪都更重。'],
  ['EUT21', '灼烧压制', 2, [hit(6), burn(3), weak(1)], [hit(8), burn(4), weak(1)], 'discard', 'burn', '灼烧压制', '火力与火焰一起压住对手。'],
  ['EUT22', '余烬追击', 0, [hit(3, 1, { ifBurn: 4 })], [hit(4, 1, { ifBurn: 6 })], 'discard', 'burn', '余烬追击', '对手身上还在燃烧时，追击伤害更高。'],
  // PAC · 临时行动与循环 → 过载 / 连击 / 飞刀
  ['PAT01', '全火力倾泻', 1, [hit(12), overload(1)], [hit(16), overload(1)], 'discard', 'overload', '全火力倾泻', '把弹匣一次打空，下回合要花时间换弹。'],
  ['PAT03', '超频架点', 0, [block(8), overload(1)], [block(11), overload(1)], 'discard', 'overload', '超频架点', '透支体能硬扛一波，下回合少一步行动。'],
  ['PAT09', '孤注一掷', 2, [hit(24), overload(2)], [hit(30), overload(2)], 'discard', 'overload', '孤注一掷', '全队压上一波，赢下这回合，下回合再说。'],
  ['PAT10', '疾速连段', 1, [hit(4), combo(hit(4)), combo(draw(1))], [hit(5), combo(hit(5)), combo(draw(1))], 'discard', 'combo', '疾速连段', '跟着节奏连续出手，还能顺手摸一张牌。'],
  ['PAT12', '飞刀雨', 1, [token('TK03'), token('TK03')], [token('TK03'), token('TK03'), token('TK03')], 'discard', 'combo', '飞刀雨', '一把一把甩出去的飞刀，全是 0 费补刀。'],
  ['PAT15', '炸药包', 1, [hit(8), draw(1), overload(1)], [hit(11), draw(1), overload(1)], 'discard', 'overload', '炸药包', '炸药包把自己弹进点，下回合落地要缓一步。'],
  ['PAT18', '补位掩护', 0, [block(3), combo(block(3))], [block(4), combo(block(4))], 'discard', 'combo', '补位掩护', '队友出手后立刻补位掩护。'],
  ['PAT19', '节奏抢断', 1, [draw(1), combo(hit(6))], [draw(1), combo(hit(8))], 'discard', 'combo', '节奏抢断', '抢在连续动作里打出一枪。'],
  ['PAT21', '临场超频', 0, [strength(1), draw(1), overload(1)], [strength(2), draw(1), overload(1)], 'exhaust', 'overload', '临场超频', '透支状态换来整场更强的火力。'],
  ['PAT25', '连击终结', 1, [hit(5), combo(hit(8))], [hit(7), combo(hit(10))], 'discard', 'combo', '连击终结', '连续动作的最后一击。']
];

const ARCH = { deploy: '部署', fortify: '布防反击', combo: '连击', execute: '易伤处决', burn: '燃烧', overload: '过载爆发' };
let changed = 0;
for (const [id, name, cost, effects, upgraded, zone, arch, title, scene] of CARDS) {
  const row = EXPANSION_ROWS.find(r => r[0] === id);
  if (!row) throw Error('missing row ' + id);
  row.splice(1, row.length - 1, name, '战术', cost, effects, upgraded, zone);
  EXPANSION_TACTICS[id] = { title, scene, origin: '赛区战术', archetype: arch, note: '赛区战术牌；数值与机制为本作原创设定，不代表任何真实选手或原作技能数据。' };
  changed++;
}
const path = new URL('../regional-expansion.js', import.meta.url);
const original = await readFile(path, 'utf8');
const header = original.slice(0, original.indexOf('export const EXPANSION_ROWS'));
await writeFile(path, `${header}export const EXPANSION_ROWS = ${JSON.stringify(EXPANSION_ROWS, null, 2)};\nexport const EXPANSION_TACTICS = ${JSON.stringify(EXPANSION_TACTICS, null, 2)};\n`);
console.log('updated', changed, 'tactic cards');
