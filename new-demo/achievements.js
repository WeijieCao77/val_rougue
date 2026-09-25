// new-demo/achievements.js
// Achievements (成就) for the new demo: the state view adapter, the list of
// definitions and the small glue ui.js calls. Storage, evaluation and the
// toast / hall / results rendering live in /shared/achievements-core.js.
// Client-side only: nothing here changes a run.
import {
  achStep, loadBook, saveBook, seedCareer, evaluateCareer, showAchToasts, hallHtml, bindHall,
  runAchievementsHtml, titleBadgeHtml, wonKind, wonBoss, costAtLeast, actMemory
} from '../shared/achievements-core.js';
import { CARDS, STATUS_CARDS, TEAMS, ENEMIES, BOSSES } from './content.js';
import { battleEnemies, supplySlots, RELIC_SLOTS } from './engine.js';

export const ACH_KEY = 'new-demo-achievements-v1';
export const ACH_RUN_KEY = 'new-demo-ach-run-v1';
const HISTORY_KEY = 'new-demo-run-history-v1';

const defOf = id => CARDS[id] || STATUS_CARDS[id] || null;
const nodeOf = s => s?.map?.nodes?.find(n => n.key === s.currentNode) || null;
const FIGHT_KINDS = new Set(['battle', 'elite', 'boss']);

function cardView(c) {
  const d = defOf(c.id) || {};
  const cost = d.x ? 'x' : c.up && d.upgradeCost !== undefined ? d.upgradeCost : d.cost;
  return { uid: c.uid, id: c.id, up: !!c.up, cost: typeof cost === 'number' || cost === 'x' ? cost : null, type: d.type || 'status', tag: d.tag || '', basic: d.tag === 'basic', curse: !!d.curse, upgradable: !!d.upgradeEffects?.length };
}

// Engine state -> the normalized view the shared core reads.
export function newView(s) {
  if (!s || !Array.isArray(s.deck)) return null;
  const node = nodeOf(s);
  const b = s.battle;
  let combat = null;
  if (b) {
    const enemies = battleEnemies(b).map(e => {
      const d = ENEMIES[e.id] || {};
      return { uid: String(e.uid), id: e.id, hp: Math.max(0, e.hp || 0), maxHp: e.maxHp || e.hp || 0, boss: !!d.boss, elite: !!d.elite, aim: (e.statuses?.aim || 0) > 0, block: e.statuses?.block || 0, weak: e.statuses?.weak || 0, trait: e.trait?.id || null, traitState: e.traitState || {}, intent: e.intent || null };
    });
    combat = {
      turn: b.turn || 1, plays: b.playsThisTurn || 0, block: b.playerBlock || 0, encounter: b.encounter || null,
      kind: node && FIGHT_KINDS.has(node.kind) ? node.kind : 'battle', bossId: node?.kind === 'boss' ? node.enemy : null,
      warmup: !!b.warmup, enemies, hand: (b.hand || []).map(cardView)
    };
  }
  return {
    runId: String(s.seed), phase: s.phase, inCombat: s.phase === 'combat' && !!b,
    result: s.phase === 'result' ? (s.result === 'win' ? 'win' : 'loss') : null,
    hp: s.hp, maxHp: s.maxHp, money: s.money || 0, act: s.act || 1, floor: node?.step ?? null, nodeKind: node?.kind || null,
    team: s.team, asc: s.ascension || 0,
    deck: s.deck.map(cardView), gear: (s.relics || []).map(r => r.id), gearMax: RELIC_SLOTS,
    supplies: (s.supplies || []).length, supplyMax: supplySlots(s), combat
  };
}

// Engine-specific moments: read the run log and a few battle fields.
export function newObserve(ctx) {
  const f = ctx.fight;
  const before = ctx.raw?.prev, after = ctx.raw?.next;
  const logs = (after?.logs || []).slice((before?.logs || []).length);
  for (const l of logs) {
    if (l.event === 'relic_trigger' && l.data?.id === 'R34') ctx.mem.run.flags.injector = true;
    if (!f) continue;
    if (l.event === 'aim_broken') f.flags.aimBroken = (f.flags.aimBroken || 0) + 1;
    if (l.event === 'trait' && l.data?.id) f.flags['trait_' + l.data.id] = (f.flags['trait_' + l.data.id] || 0) + 1;
    if (l.event === 'squad' && l.data?.id) f.flags['squad_' + l.data.id] = (f.flags['squad_' + l.data.id] || 0) + 1;
    if (l.event === 'stance_switch') f.flags.stance = (f.flags.stance || 0) + 1;
    if (l.event === 'summon') f.flags.summon = (f.flags.summon || 0) + 1;
  }
  if (!f || !ctx.prev?.combat) return;
  const pc = ctx.prev.combat;
  // A sniper still aiming when the turn ends fires its full shot this enemy turn.
  if (ctx.action?.type === 'end') for (const e of pc.enemies) if (e.hp > 0 && e.aim && (e.intent || []).some(a => a.type === 'snipe')) f.flags.aimedSnipe = (f.flags.aimedSnipe || 0) + 1;
  // 突击势能: an armed charge doubled this attack.
  if (ctx.action?.type === 'play' && ctx.hit.card?.type === 'attack' && before?.battle?.squad?.id === 'momentum' && before.battle.squad.armed) f.flags.doubledHit = Math.max(f.flags.doubledHit || 0, ctx.hit.damage);
  if (after?.battle?.squad?.id === 'fortify' && (after.battle.squad.kept || 0) >= 12) f.flags.fortFull = true;
  // 重装守门人 knocked out while its guard stance (反击) was up.
  const nextById = new Map((ctx.next?.combat?.enemies || []).map(e => [e.uid, e]));
  for (const e of pc.enemies) {
    if (e.id !== 'B02' || !(e.hp > 0) || !(e.traitState?.spikeTurns > 0)) continue;
    const n = nextById.get(e.uid);
    if (!n || n.hp <= 0) f.flags.wardenInStance = true;
  }
}

export const NEW_CATS = [
  { key: 'route', name: '开局与路线' },
  { key: 'fight', name: '交火技巧' },
  { key: 'deck', name: '构筑' },
  { key: 'boss', name: '强敌与决战' },
  { key: 'econ', name: '经济与补给' },
  { key: 'risk', name: '事件与风险' },
  { key: 'asc', name: '难度等级' },
  { key: 'team', name: '队伍专属' },
  { key: 'career', name: '生涯' }
];

const E = ctx => ctx.ended;
const F = ctx => ctx.fight || ctx.ended || null;
const won = ctx => ctx.ended?.outcome === 'win';
const lastBossWin = ctx => wonKind(ctx, 'boss');
const deck = ctx => ctx.next?.deck || [];
const teamWin = team => ctx => (ctx.career?.teamWins?.[team] ?? -1) >= 0;

export const NEW_ACHIEVEMENTS = [
  // ---- 开局与路线
  { key: 'first_win', cat: 'route', name: '开门红', desc: '赢下本局的第一场战斗', test: ctx => won(ctx) && ctx.mem.run.fightsWon === 1 },
  { key: 'act1_clear', cat: 'route', name: '出线', desc: '击败第一幕的幕末决战', reward: { title: '出线者' }, test: ctx => lastBossWin(ctx) && E(ctx).act === 1 },
  { key: 'run_clear', cat: 'route', name: '三幕通关', desc: '打通全部三幕', reward: { title: '总冠军' }, test: ctx => ctx.runEnd === 'win' },
  { key: 'no_rest_act', cat: 'route', name: '不歇脚', desc: '一幕之内没有进入休整点，击败该幕的幕末决战', reward: { title: '铁人' }, test: ctx => lastBossWin(ctx) && !actMemory(ctx.mem, E(ctx).act).rest },
  { key: 'unknown5', cat: 'route', name: '问号成瘾', desc: '同一幕进入 5 个未知节点', test: ctx => ctx.entered === 'event' && actMemory(ctx.mem, ctx.next.act).event >= 5 },
  { key: 'elite3_act', cat: 'route', name: '强敌猎人', desc: '同一幕击败 3 场强敌', reward: { title: '猎人' }, test: ctx => wonKind(ctx, 'elite') && actMemory(ctx.mem, E(ctx).act).eliteWins >= 3 },
  { key: 'no_elite_clear', cat: 'route', secret: true, name: '绕行者', desc: '打通三幕，全程没有进入过强敌节点', reward: { title: '绕行者' }, test: ctx => ctx.runEnd === 'win' && ctx.mem.run.elitesFought === 0 },

  // ---- 交火技巧
  { key: 'flawless_elite', cat: 'fight', name: '滴水不漏', desc: '不失去生命击败一场强敌', test: ctx => wonKind(ctx, 'elite') && !E(ctx).partial && E(ctx).hpLost === 0 },
  { key: 'flawless_boss', cat: 'fight', name: '完美决战', desc: '不失去生命击败一场幕末决战', reward: { title: '无懈可击' }, test: ctx => lastBossWin(ctx) && !E(ctx).partial && E(ctx).hpLost === 0 },
  { key: 'big50', cat: 'fight', name: '一击五十', desc: '一张牌造成 50 点以上伤害', test: ctx => ctx.hit?.card && ctx.hit.damage >= 50 },
  { key: 'big100', cat: 'fight', secret: true, name: '一击过百', desc: '一张牌造成 100 点以上伤害', reward: { title: '爆破手' }, test: ctx => ctx.hit?.card && ctx.hit.damage >= 100 },
  { key: 'triple', cat: 'fight', name: '一回合三杀', desc: '同一回合击倒 3 名对手', reward: { title: '收割者' }, test: ctx => (F(ctx)?.maxTurnKills || 0) >= 3 },
  { key: 'one_hp', cat: 'fight', name: '一滴血', desc: '以恰好 1 点生命赢下一场战斗', reward: { title: '悬崖边' }, test: ctx => won(ctx) && E(ctx).hpEnd === 1 },
  { key: 'turn1', cat: 'fight', name: '开局即终局', desc: '在第 1 回合就赢下一场战斗（热身赛不算）', test: ctx => won(ctx) && E(ctx).turns === 1 && !E(ctx).warmup && !E(ctx).partial },
  { key: 'long_fight', cat: 'fight', name: '持久战', desc: '一场战斗打到第 12 回合并获胜', test: ctx => won(ctx) && E(ctx).turns >= 12 },
  { key: 'ten_plays', cat: 'fight', name: '连珠', desc: '一回合打出 10 张牌', test: ctx => (ctx.next?.combat?.plays || 0) >= 10 },
  { key: 'block50', cat: 'fight', name: '铜墙铁壁', desc: '布防一度达到 50 点', test: ctx => (ctx.next?.combat?.block || 0) >= 50 },
  { key: 'aim_break', cat: 'fight', name: '打断瞄准', desc: '在狙击手开枪前用闪光打断它的瞄准', test: ctx => (F(ctx)?.flags?.aimBroken || 0) > 0 },

  // ---- 构筑
  { key: 'thin_deck', cat: 'deck', name: '精兵简政', desc: '牌组不超过 15 张时击败第二或第三幕的幕末决战', reward: { title: '精兵' }, test: ctx => lastBossWin(ctx) && E(ctx).act >= 2 && deck(ctx).length <= 15 },
  { key: 'light_deck', cat: 'deck', name: '轻装上阵', desc: '击败幕末决战时，牌组里没有费用 2 及以上的牌', reward: { title: '轻骑' }, test: ctx => lastBossWin(ctx) && !deck(ctx).some(c => costAtLeast(c, 2)) },
  { key: 'polished', cat: 'deck', name: '精修', desc: '牌组至少 15 张，且每张能升级的牌都已升级', test: ctx => { const d = deck(ctx); return d.length >= 15 && d.filter(c => c.upgradable).length >= 12 && d.every(c => !c.upgradable || c.up); } },
  { key: 'power3', cat: 'deck', name: '三件套', desc: '一场战斗中打出 3 张能力牌', test: ctx => (F(ctx)?.types?.power || 0) >= 3 },
  { key: 'same5', cat: 'deck', name: '如出一辙', desc: '牌组中同一张非基础牌达到 5 张', test: ctx => { const n = {}; for (const c of deck(ctx)) if (!c.basic && !c.curse && c.type !== 'status') n[c.id] = (n[c.id] || 0) + 1; return Object.values(n).some(v => v >= 5); } },
  { key: 'arch6', cat: 'deck', name: '专精', desc: '牌组中带同一流派标签（燃烧、部署、连击、布防、过载、处决、发现）的牌达到 6 张', test: ctx => { const tags = new Set(['burn', 'deploy', 'combo', 'fortify', 'overload', 'execute', 'discover']); const n = {}; for (const c of deck(ctx)) if (tags.has(c.tag)) n[c.tag] = (n[c.tag] || 0) + 1; return Object.values(n).some(v => v >= 6); } },
  { key: 'cursed_boss', cat: 'deck', secret: true, name: '带病上阵', desc: '牌组里带着 3 张及以上诅咒击败幕末决战', reward: { title: '百毒不侵' }, test: ctx => lastBossWin(ctx) && deck(ctx).filter(c => c.curse).length >= 3 },

  // ---- 强敌与决战
  { key: 'first_elite', cat: 'boss', name: '第一个强敌', desc: '击败一场强敌', test: ctx => wonKind(ctx, 'elite') },
  { key: 'elite_early', cat: 'boss', name: '早早出手', desc: '在一幕的第 6 层或更早击败强敌', test: ctx => wonKind(ctx, 'elite') && E(ctx).floor != null && E(ctx).floor <= 6 },
  { key: 'boss_tempo', cat: 'boss', name: '不给节奏', desc: '击败资格赛冠军卫队，它一次也没有触发「控制节奏」', test: ctx => wonBoss(ctx, 'B01') && !E(ctx).partial && !E(ctx).flags.trait_tempo },
  { key: 'boss_warden', cat: 'boss', name: '顶着反击', desc: '在重装守门人的防御架势中击倒它', test: ctx => wonBoss(ctx, 'B02') && !!E(ctx).flags.wardenInStance },
  { key: 'boss_toxin', cat: 'boss', name: '速战毒雾', desc: '在第 4 回合或更早击败毒雾调度员', test: ctx => wonBoss(ctx, 'B03') && E(ctx).turns <= 4 },
  { key: 'boss_marshal', cat: 'boss', name: '断其援兵', desc: '击败战区统帅，它一次也没能调兵补回护卫', test: ctx => wonBoss(ctx, 'A2_B03') && !E(ctx).partial && !E(ctx).flags.summon },
  { key: 'boss_blitz', cat: 'boss', name: '以快打快', desc: '在第 5 回合或更早击败闪击突击王', test: ctx => wonBoss(ctx, 'A2_B02') && E(ctx).turns <= 5 },
  { key: 'boss_phase2', cat: 'boss', secret: true, name: '一口气', desc: '击败总决赛冠军卫队，没有让它进入决胜局', reward: { title: '一气呵成' }, test: ctx => wonBoss(ctx, 'A3_B01') && !E(ctx).partial && !E(ctx).flags.trait_phase2 },
  { key: 'boss_oracle', cat: 'boss', name: '静默', desc: '击败情报先知，整场没有触发它的监视开火', test: ctx => wonBoss(ctx, 'A3_B02') && !E(ctx).partial && E(ctx).maxPlays <= 5 },
  { key: 'boss_hunter', cat: 'boss', name: '截断猎手', desc: '击败暗影猎手，它一次也没有打出瞄准后的重狙', test: ctx => wonBoss(ctx, 'A3_B03') && !E(ctx).partial && !E(ctx).flags.aimedSnipe },
  { key: 'all_bosses', cat: 'boss', career: true, name: '九场决战', desc: '击败过全部 9 名幕末决战对手', reward: { title: '决战之王' }, test: ctx => Object.keys(BOSSES).every(id => (ctx.career?.bossWins?.[id] || 0) > 0) },

  // ---- 经济与补给
  { key: 'rich', cat: 'econ', name: '小金库', desc: '同时持有 400 金币', test: ctx => (ctx.next?.money || 0) >= 400 },
  { key: 'spree', cat: 'econ', name: '大采购', desc: '在一次商店里花掉 300 金币', test: ctx => (ctx.mem?.shop?.spent || 0) >= 300 },
  { key: 'broke_boss', cat: 'econ', name: '身无分文', desc: '以 0 金币击败幕末决战（结算奖励前）', test: ctx => lastBossWin(ctx) && (ctx.prev?.money ?? 1) === 0 },
  { key: 'gear_full', cat: 'econ', name: '满配', desc: '同时持有 6 件装备', test: ctx => (ctx.next?.gear?.length || 0) >= (ctx.next?.gearMax || 6) },
  { key: 'sell_gear', cat: 'econ', name: '以旧换新', desc: '卖掉一件装备', test: ctx => ctx.action?.type === 'sellRelic' },
  { key: 'supply_full', cat: 'econ', name: '背包满了', desc: '补给栏全部装满', test: ctx => ctx.next && ctx.next.supplyMax > 0 && ctx.next.supplies >= ctx.next.supplyMax },
  { key: 'no_shop', cat: 'econ', secret: true, name: '自给自足', desc: '打通三幕，全程没有进入商店', reward: { title: '自给自足' }, test: ctx => ctx.runEnd === 'win' && ctx.mem.run.shopsVisited === 0 },

  // ---- 事件与风险
  { key: 'injector', cat: 'risk', secret: true, name: '死里逃生', desc: '急救自注射器替你挡下了致命一击', test: ctx => !!ctx.mem?.run.flags.injector },
  { key: 'no_heal_rest', cat: 'risk', name: '不回血', desc: '生命低于三成时，在休整点没有选择回复', test: ctx => ctx.action?.type === 'rest' && ctx.action.choice !== 'heal' && ctx.prev && ctx.prev.hp < ctx.prev.maxHp * 0.3 },
  { key: 'low_boss', cat: 'risk', name: '残血翻盘', desc: '生命不超过上限一成时击败幕末决战', reward: { title: '绝境' }, test: ctx => lastBossWin(ctx) && E(ctx).hpEnd <= Math.floor(E(ctx).maxHp * 0.1) },
  { key: 'remove5', cat: 'risk', name: '断舍离', desc: '一局中移除 5 张牌', test: ctx => (ctx.mem?.run.removed || 0) >= 5 },

  // ---- 难度等级（生涯）
  { key: 'asc1', cat: 'asc', career: true, name: '更进一步', desc: '在难度 1 或更高通关', test: ctx => Object.values(ctx.career?.teamWins || {}).some(v => v >= 1) },
  { key: 'asc5', cat: 'asc', career: true, name: '高压赛程', desc: '在难度 5 或更高通关', reward: { title: '硬骨头' }, test: ctx => Object.values(ctx.career?.teamWins || {}).some(v => v >= 5) },
  { key: 'asc10', cat: 'asc', career: true, name: '极限难度', desc: '在难度 10 通关', reward: { title: '传奇' }, test: ctx => Object.values(ctx.career?.teamWins || {}).some(v => v >= 10) },
  { key: 'asc3_all', cat: 'asc', career: true, name: '四面开花', desc: '每支队伍都在难度 3 或更高通关', reward: { title: '四面开花' }, test: ctx => Object.keys(TEAMS).every(t => (ctx.career?.teamWins?.[t] ?? -1) >= 3) },

  // ---- 队伍专属
  { key: 'win_breach', cat: 'team', career: true, name: '烈锋', desc: `以${TEAMS.breach.name}通关`, reward: { title: '烈锋' }, test: teamWin('breach') },
  { key: 'win_anchor', cat: 'team', career: true, name: '磐石', desc: `以${TEAMS.anchor.name}通关`, reward: { title: '磐石' }, test: teamWin('anchor') },
  { key: 'win_utility', cat: 'team', career: true, name: '雾隐', desc: `以${TEAMS.utility.name}通关`, reward: { title: '雾隐' }, test: teamWin('utility') },
  { key: 'win_rotation', cat: 'team', career: true, name: '疾风', desc: `以${TEAMS.rotation.name}通关`, reward: { title: '疾风' }, test: teamWin('rotation') },
  { key: 'trait_breach', cat: 'team', name: '势如破竹', desc: '一张被「突击势能」翻倍的攻击牌造成 40 点以上伤害', test: ctx => (F(ctx)?.flags?.doubledHit || 0) >= 40 },
  { key: 'trait_anchor', cat: 'team', name: '深沟高垒', desc: '「工事」保留满 12 点', test: ctx => !!F(ctx)?.flags?.fortFull },
  { key: 'trait_utility', cat: 'team', name: '情报网', desc: '一场战斗中触发 3 次「情报」', test: ctx => (F(ctx)?.flags?.squad_intel || 0) >= 3 },
  { key: 'trait_rotation', cat: 'team', name: '行云流水', desc: '一场战斗中切换 8 次姿态', test: ctx => (F(ctx)?.flags?.stance || 0) >= 8 },

  // ---- 生涯
  { key: 'first_loss', cat: 'career', name: '从头再来', desc: '第一次出局', test: ctx => ctx.runEnd === 'loss' },
  { key: 'act1_bosses', cat: 'career', career: true, secret: true, name: '三座大山', desc: '分别输给过第一幕的三名幕末决战对手', reward: { title: '越挫越勇' }, test: ctx => ['B01', 'B02', 'B03'].every(id => (ctx.career?.bossLosses?.[id] || 0) > 0) },
  { key: 'comeback', cat: 'career', secret: true, name: '事不过三', desc: '连续出局 3 局之后，下一局打通三幕', reward: { title: '不屈' }, test: ctx => ctx.runEnd === 'win' && (ctx.career?.lastStreakBeforeWin || 0) >= 3 },
  { key: 'speedrun', cat: 'career', career: true, name: '速通', desc: '在 45 分钟内打通三幕', reward: { title: '速攻' }, test: ctx => ctx.career?.fastestWinMs != null && ctx.career.fastestWinMs <= 45 * 60 * 1000 },
  { key: 'all_teams', cat: 'career', career: true, name: '全能指挥', desc: '四支队伍都通关过', reward: { title: '全能指挥' }, test: ctx => Object.keys(TEAMS).every(t => (ctx.career?.teamWins?.[t] ?? -1) >= 0) }
];

// ---------------------------------------------------------------- glue for ui.js
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
function readMem() { try { const raw = store()?.getItem(ACH_RUN_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeMem(mem) { try { store()?.setItem(ACH_RUN_KEY, JSON.stringify(mem)); } catch {} }
function history() { try { const v = JSON.parse(store()?.getItem(HISTORY_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
export function loadNewBook() {
  const book = loadBook(store(), ACH_KEY);
  if (!book.career.seeded) { book.career = seedCareer(book.career, history()); saveBook(store(), ACH_KEY, book); }
  return book;
}
function runLabel(v) {
  if (!v) return '';
  const team = TEAMS[v.team]?.name?.split(' · ')[0] || '';
  return `${team} · 难度 ${v.asc} · 第 ${v.act} 幕${v.floor != null ? `第 ${v.floor} 层` : ''}`;
}

// Called by ui.js right after the engine accepts an action.
export function achieveNew(prev, next, action, { delay = 0 } = {}) {
  try {
    const pv = newView(prev), nv = newView(next);
    if (!nv) return [];
    const book = loadNewBook();
    const r = achStep({ defs: NEW_ACHIEVEMENTS, book, mem: readMem(), prev: pv, next: nv, action, raw: { prev, next }, observe: newObserve, label: runLabel(nv) });
    writeMem(r.mem);
    if (r.fresh.length) { saveBook(store(), ACH_KEY, r.book); showAchToasts(r.fresh, { delay }); }
    else if (r.ctx.runEnd || r.ctx.ended) saveBook(store(), ACH_KEY, r.book);
    return r.fresh;
  } catch { return []; }
}

// The 成就 page, in the new demo's modal (openModal from run-screens.js).
export function openNewAchievements(openModal, onClose) {
  const book = loadNewBook();
  const fresh = evaluateCareer(NEW_ACHIEVEMENTS, book);
  saveBook(store(), ACH_KEY, book);
  const note = '局内成就在对局中达成时解锁；生涯成就按你的全部对局记录判定。每项只解锁一次，奖励是可佩戴的称号，不影响对局数值。';
  openModal('achievements-overlay', '成就', hallHtml(NEW_ACHIEVEMENTS, NEW_CATS, book, { note }), function bind(root) {
    const body = root.querySelector('.rm-modal-body');
    const wire = () => bindHall(body, NEW_ACHIEVEMENTS, book, b => { saveBook(store(), ACH_KEY, b); body.innerHTML = hallHtml(NEW_ACHIEVEMENTS, NEW_CATS, b, { note }); wire(); onClose?.(); });
    wire();
  });
  if (fresh.length) showAchToasts(fresh, { delay: 300 });
}

export function newAchResultHtml(runId) {
  try { return runAchievementsHtml(NEW_ACHIEVEMENTS, loadNewBook(), runId); } catch { return ''; }
}
export function newTitleHtml(extraClass = '') {
  try { return titleBadgeHtml(NEW_ACHIEVEMENTS, loadNewBook(), extraClass); } catch { return ''; }
}
