// Unlock progression and shop/reward economy pieces of the new demo's UI.
// Progress lives in this demo's own localStorage key (never shared with the Wa demo).
import { INVESTMENTS, SKIP_GOLD, RELIC_UNLOCKS, teamUnlockPlan, rerollPrice, investPrice, econOn } from './engine.js';
import { CARDS, TEAMS, RELICS } from './content.js';
import { UNLOCK_TIERS, tierOfXp, runXp, normalizeProgress, progressTier, progressGearTier, awardRun } from '../shared-unlock.js';
import { statusIcon } from '/shared/status-icons.js';

const KEY = 'new-demo-unlocks-v1';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const teamName = team => (TEAMS[team]?.name || '').split(' · ')[0];

export function loadUnlocks() {
  try { return normalizeProgress(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return normalizeProgress({}); }
}
function saveUnlocks(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

// Options for createRun: the tiers this run is created with stay fixed for the whole run.
export function unlockRunOptions(team) {
  const p = loadUnlocks();
  return { econ: true, unlockTier: progressTier(p, team), gearTier: progressGearTier(p) };
}

export function toggleAllUnlocks() {
  const p = loadUnlocks();
  p.all = !p.all;
  saveUnlocks(p);
  return p.all;
}

function runXpOf(state) {
  const bossDone = ['bossRelic', 'intermission'].includes(state.phase) || state.result === 'win';
  return runXp({ wins: state.fightsWon || 0, bosses: (state.act - 1) + (bossDone ? 1 : 0), cleared: state.result === 'win' });
}

// Called after every saved action: grants the run's new experience when an act
// is cleared or the run ends, and remembers what that unlocked for the screen.
export function recordUnlockProgress(state) {
  if (!econOn(state) || !['intermission', 'result'].includes(state.phase)) return;
  const at = `${state.act}:${state.phase}`;
  if (state.unlockNotice?.at === at) return;
  const r = awardRun(loadUnlocks(), state.team, state.seed, runXpOf(state));
  saveUnlocks(r.progress);
  const plan = teamUnlockPlan(state.team), cards = [], gear = [];
  for (let t = r.fromTier; t < r.toTier; t++) cards.push(...plan.tiers[t]);
  for (let t = r.fromGear; t < r.toGear; t++) gear.push(...RELIC_UNLOCKS[t]);
  state.unlockNotice = { at, gained: r.gained, total: r.progress.awarded[state.seed] ?? r.gained, cards, gear };
}

// An abandoned run (放弃本局 or overwritten by a new run) keeps the experience it earned.
export function recordAbandonedRun(state) {
  if (!state || !econOn(state)) return;
  saveUnlocks(awardRun(loadUnlocks(), state.team, state.seed, runXpOf(state)).progress);
}

export function unlockBarHtml(team) {
  const p = loadUnlocks(), t = tierOfXp(p.xp[team] || 0);
  const pct = p.all ? 100 : t.need ? Math.round((t.into / t.need) * 100) : 100;
  const text = p.all ? '测试模式：全部卡牌与装备已开放' : t.need ? `下一批解锁：${t.into} / ${t.need} 经验` : '全部解锁';
  return `<section class="unlock-bar" aria-label="${esc(teamName(team))}解锁进度">
    <div class="unlock-head"><b>${esc(teamName(team))} · 解锁 ${p.all ? UNLOCK_TIERS : t.tier} / ${UNLOCK_TIERS}</b><small>${esc(text)}</small></div>
    <div class="unlock-track"><i style="width:${pct}%"></i></div>
    <small class="unlock-note">战斗胜利 +1，每击败一幕决战对手 +10，打通三幕再 +10。每级为该队伍加入一批战术卡，并开放一批战术装备。</small>
  </section>`;
}

export function unlockTestHtml() {
  const on = loadUnlocks().all;
  return `<details class="unlock-test"><summary>测试选项</summary><button type="button" class="hero-link" id="btn-unlock-all">${on ? '全部解锁：已开启（点击关闭）' : '全部解锁：已关闭（点击开启）'}</button><small>只影响之后新开的对局。</small></details>`;
}

export function unlockNoticeHtml(state) {
  const n = state.unlockNotice;
  if (!econOn(state) || !n || n.at !== `${state.act}:${state.phase}`) return '';
  const items = [
    ...n.cards.map(id => `<li>${esc(CARDS[id]?.name || id)}<small>战术卡</small></li>`),
    ...n.gear.map(id => `<li>${esc(RELICS[id]?.name || id)}<small>装备</small></li>`)
  ].join('');
  return `<section class="unlock-result"><p class="unlock-gain">本局累计获得 <b>${n.total ?? n.gained}</b> 解锁经验${(n.total ?? n.gained) !== n.gained ? `（本次结算 +${n.gained}）` : ''}</p>${unlockBarHtml(state.team)}${items ? `<div class="unlock-new"><h4>新解锁 · 下一局起出现在奖励与补给站中</h4><ul>${items}</ul></div>` : ''}</section>`;
}

// Reward screen: skipping pays gold or a free reroll of a later shop's card shelf.
export function skipOptionsHtml(state) {
  return `<div class="skip-options" aria-label="跳过的补偿">
    <span class="skip-label">跳过，不加入新牌，选择补偿：</span>
    <button class="btn ops-skip" data-skip-comp="gold">金币 +${SKIP_GOLD}</button>
    <button class="btn ops-skip" data-skip-comp="reroll">免费刷新 1 次补给货架</button>
    <small>免费刷新可留到之后任一补给站使用${state.freeRerolls ? `（当前已有 ${state.freeRerolls} 次）` : ''}。</small>
  </div>`;
}

export function rerollButtonHtml(state) {
  const price = rerollPrice(state);
  const label = price === 0 ? `免费刷新（剩 ${state.freeRerolls} 次）` : `刷新货架 · ${price} 金币`;
  return `<button class="btn reroll-btn" id="btn-reroll" ${state.money >= price ? '' : 'disabled'}>${label}</button>`;
}

export function investOfferHtml(state) {
  const id = state.shop?.invest;
  if (!id) return `<h3 class="shelf-title">战术投资</h3><p class="shelf-empty">${state.invest.length >= Object.keys(INVESTMENTS).length ? '全部投资已完成。' : '本次的投资已买下。'}</p>`;
  const v = INVESTMENTS[id], cost = investPrice(state, id), ok = state.money >= cost;
  return `<h3 class="shelf-title">战术投资 <small>整局生效 · 每项限购一次</small></h3>
    <div class="gear-shelf"><div class="gear-offer invest-offer">
      <div class="invest-tile"><span class="invest-icon">${statusIcon(v.icon)}</span><div><b>${esc(v.name)}</b><p>${esc(v.desc)}</p></div></div>
      <button class="btn" id="btn-invest" ${ok ? '' : 'disabled'}>${cost} 金币${ok ? ' · 投资' : ' · 不足'}</button>
    </div></div>`;
}

// Chip for the run strip: owned investments, with their rules as tooltip.
export function investChipHtml(state) {
  if (!econOn(state)) return '';
  const names = state.invest.map(id => `${INVESTMENTS[id].name}：${INVESTMENTS[id].desc}`).join('\n') || '尚未投资';
  return `<div class="strip-group invest-row" aria-label="战术投资"><button type="button" class="invest-chip" id="btn-invest-list" title="${esc(names)}"><span class="strip-label">投资 ${state.invest.length}</span>${state.freeRerolls ? `<small>免费刷新 ${state.freeRerolls}</small>` : ''}</button></div>`;
}

export function investListHtml(state) {
  const own = state.invest.map(id => `<li><b>${esc(INVESTMENTS[id].name)}</b> ${esc(INVESTMENTS[id].desc)}</li>`).join('');
  return `${own ? `<ul class="invest-list">${own}</ul>` : '<p>尚未投资。补给站每次提供 1 项战术投资，买下后整局生效。</p>'}
    <p class="supply-note">免费刷新补给货架：${state.freeRerolls || 0} 次 · 本局解锁等级：卡牌 ${state.unlockTier}，装备 ${state.gearTier}</p>`;
}
