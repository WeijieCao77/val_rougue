// PvP battle screen: two players across a tactical table. The opponent sits at the
// top (card-back fan + hero panel), I sit at the bottom (hero panel + hand fan), the
// middle is the play mat where both players' cards are shown and laid down.
// Every action comes from match.history (see online/duel.mjs) and is replayed with
// the same showcase on both screens: the card leaves its owner's fan, lands in the
// centre of the table enlarged, holds, resolves on the target hero, then lies on the
// owner's half of the table until that turn ends.
import { CARDS, cardName, compactLines, describe, TACTICS, REGIONS, effects } from '/pvp/content.js';
import { cardArtwork } from '/pvp/art-ui.js';
import { CARD_RARITY, RARITY_LABELS } from '/pvp/card-rarity.js';
import { statusBadges, highlightKeywords, keywordRules, statusIcon } from '/shared/status-icons.js';
import { playSfx, soundToggleHtml } from '/shared/sfx.js';

const DW = 180, DH = 252; // design size of a card face; everything else scales it
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const TARGET_TYPES = ['hit', 'weak', 'vulnerable', 'burn', 'burnMultiply', 'detonate', 'bodyslam', 'fireTurrets'];
const REGION_SHORT = { CN: '中国', AM: '美洲', EMEA: 'EMEA', PAC: '太平洋' };
const TRAIT_NAMES = { CN: '团队协同', AM: '连续进攻', EMEA: '压制反打', PAC: '临时战术' };

// ---------------------------------------------------------------- card faces
function roleOf(t) { return t.player ? t.role : t.id.startsWith('CU') ? '隐患' : /^(CN|AM|EU|PA)T\d{2}$/.test(t.id) ? '战术' : '行动'; }
function tagOf(c, t) {
  return t.zone === 'exhaust' ? '消耗' : t.zone === 'temporary' ? '临时 · 消耗' : t.zone === 'exhaustEnd' ? '回合末消耗' : t.zone === 'power' ? '持续能力' : t.id.startsWith('CU') ? '跨比赛保留' : c.up ? '已训练' : t.player ? '选手牌' : /^(CN|AM|EU|PA)T\d{2}$/.test(t.id) ? '战术牌' : '辅助牌';
}
// Same face as the Wa demo (photo, name, cost, role, tactic title, effect lines).
export function faceHtml(c, eager = false) {
  const t = CARDS[c?.id];
  if (!t) return '<div class="cf"><span class="cf-title">未知卡牌</span></div>';
  const r = CARD_RARITY[c.id];
  const art = cardArtwork(c.id);
  return `<div class="cf role-${esc(t.player ? t.role : t.id.slice(0, 2))}${c.up ? ' up' : ''}${r ? ' rarity-' + r : ''}">`
    + `<span class="cf-cost">${t.cost === null ? '—' : t.x ? 'X' : t.cost}</span>`
    + (r ? `<span class="cf-rarity" title="出现频率：${esc(RARITY_LABELS[r])}"></span>` : '')
    + `<span class="cf-title">${esc(cardName(c))}</span>`
    + `<span class="cf-portrait">${eager ? art.replace('loading="lazy"', 'loading="eager"') : art}<span class="cf-role">${esc(roleOf(t))}</span></span>`
    + `<b class="cf-tactic">${esc(TACTICS[c.id]?.title || '')}</b>`
    + `<span class="cf-effect">${compactLines(c).map(line => `<span>${highlightKeywords(esc(line).replace(/(\d+)/g, '<strong>$1</strong>'), true)}</span>`).join('')}</span>`
    + `<span class="cf-foot"><b class="${['exhaust', 'temporary', 'exhaustEnd'].includes(t.zone) ? 'ex' : ''}">${esc(tagOf(c, t))}</b></span></div>`;
}
const BACK = '<div class="cback"><i></i><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 3v10M20 27v10M3 20h10M27 20h10" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="2" fill="currentColor"/></svg></div>';
const flipCard = (c, faceDown) => `<div class="flip${faceDown ? ' down' : ''}"><div class="side front">${faceHtml(c, true)}</div><div class="side back">${BACK}</div></div>`;
function miniFace(c, s) { return `<span class="mini" style="width:${DW * s}px;height:${DH * s}px"><span class="mini-in" style="transform:scale(${s})">${faceHtml(c)}</span></span>`; }
const isTargeting = c => (effects(c) || []).some(e => TARGET_TYPES.includes(e.type));
const tf = p => `translate(${(p.x - DW / 2).toFixed(1)}px,${(p.y - DH / 2).toFixed(1)}px) rotate(${(p.r || 0).toFixed(2)}deg) scale(${(p.s || 1).toFixed(4)})`;
const rectC = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// ---------------------------------------------------------------- result text
function resultLines(e, mineSeat) {
  const r = e.results || {}, out = [];
  const who = e.seat === mineSeat ? '你' : '对手', other = e.seat === mineSeat ? '对手' : '你';
  if (e.kind === 'end' && e.auto) out.push(['mut', `超时，自动结束回合${e.afk ? `（连续第 ${e.afk} 次）` : ''}`]);
  if (e.kind === 'play') {
    if (r.damage || r.absorbed) {
      if (r.damage) out.push(['dmg', `造成 ${r.damage} 伤害${r.absorbed ? `（被布防挡 ${r.absorbed}）` : ''}${r.hits > 1 ? ` · ${r.hits} 段` : ''}`]);
      else out.push(['blk', `攻击全部被布防挡下（${r.absorbed}）`]);
    }
  } else if (e.kind === 'end' && (r.damage || r.absorbed)) {
    out.push(['dmg', `哨戒炮开火：造成 ${r.damage || 0} 伤害${r.absorbed ? `（被布防挡 ${r.absorbed}）` : ''}`]);
  }
  if (r.burnDamage) out.push(['dmg', `燃烧：${who}失去 ${r.burnDamage} 声望`]);
  if (r.selfDamage) out.push(['dmg', `舆论压力：${who}失去 ${r.selfDamage} 声望`]);
  if (r.block) out.push(['blk', `${e.kind === 'end' ? '屏障无人机：' : ''}获得 ${r.block} 布防`]);
  if (r.weak) out.push(['sts', `${other}压制 +${r.weak}`]);
  if (r.vulnerable) out.push(['sts', `${other}易伤 +${r.vulnerable}`]);
  if (r.burn) out.push(['sts', `${other}燃烧 +${r.burn}`]);
  if (r.detonated) out.push(['sts', `引爆 ${r.detonated} 层燃烧`]);
  if (r.strength) out.push(['buf', `火力 +${r.strength}`]);
  if (r.overload) out.push(['sts', `下回合过载 ${r.overload}`]);
  if (e.kind !== 'turn' && r.energy) out.push(['buf', `行动点 +${r.energy}`]);
  for (const d of r.deploy || []) out.push(['buf', d.kind === 'turret' ? `部署哨戒炮（每回合 ${d.n}，${d.turns} 回合）` : `部署屏障无人机（每回合 ${d.n} 布防，${d.turns} 回合）`]);
  for (const id of r.tokens || []) out.push(['buf', `生成 ${CARDS[id]?.name || '临时牌'}`]);
  if (r.tokenCount) out.push(['buf', `生成 ${r.tokenCount} 张临时牌`]);
  for (const k of r.traits || []) out.push(['buf', `赛区特质「${TRAIT_NAMES[k] || k}」触发`]);
  if (r.draw) out.push(['buf', e.kind === 'end' ? `摸下回合手牌 ${r.draw} 张` : e.kind === 'deal' ? `起手 ${r.draw} 张` : `抽 ${r.draw} 张牌`]);
  if (r.reshuffle) out.push(['mut', '弃牌堆洗回抽牌堆']);
  if (e.kind === 'end' && r.exhausted) out.push(['mut', `${r.exhausted} 张牌在回合末消耗`]);
  if (e.kind === 'end' && r.kept) out.push(['mut', `保留 ${r.kept} 张手牌`]);
  if (e.kind === 'turn' && r.energy) out.push(['mut', `行动点回满：${r.energy}`]);
  if (e.kind === 'play' && e.zone === 'power') out.push(['mut', '持续能力：本场生效']);
  if (e.kind === 'play' && e.zone === 'exhaust') out.push(['mut', '打出后消耗']);
  return out;
}
const ROPE_MS = 20000; // the fuse appears for the last 20 s of a turn
const TICK_FROM = 5;   // clock ticks in the last 5 s of my turn
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
const REASON = {
  hp: [w => w ? '对手声望归零' : '你的声望归零'],
  concede: [w => w ? '对手认输' : '你已认输'],
  timeout: [w => w ? '对手长时间未操作，超时判负' : '你长时间未操作，超时判负'],
  leave: [w => w ? '对手离开了房间' : '你离开了房间'],
  draw: [() => '达到回合上限，平局']
};

// ---------------------------------------------------------------- battle
export function createBattle(ctx) {
  // ctx: { root, send(command) -> Promise<boolean>, leave(), newRoom(), notice(text), rematch(op, round) -> Promise }
  let el = null, fx = null, room = null, mySeat = 0, code = '', round = 1;
  // Turn timer: server epoch ms of the turn end, corrected by the server/client clock offset.
  let timer = null, skew = 0, clockInt = 0, lastTickSec = -1, ropeOn = false;
  let rematchBusy = false, lastRematchKey = '';
  let target = null, shownView = null, lastN = 0, pumping = false, speed = 1;
  let heroes = [{}, {}], activeShown = null, busy = false;
  let handCards = [], handEls = new Map(), handPos = new Map(), drawing = new Set();
  let selectedUid = null, hoverUid = null, hoverBig = false, hoverTimer = 0, press = null, dragRaf = 0;
  let pendingPlay = null, endPending = false;
  let oppCount = 0, oppEls = [];
  let table = { played: [[], []] };
  let histOpen = false, histDetail = null, resultShown = false, resultDismissed = false;
  const T = ms => ms * (RM() ? 0.3 : 1) * speed;
  const wait = ms => new Promise(r => setTimeout(r, T(ms)));
  const side = seat => seat === mySeat ? 'me' : 'opp';
  const $ = sel => el?.querySelector(sel);

  // ------------------------------------------------ mount / skeleton
  function mount() {
    el = document.createElement('div');
    el.className = 'duel';
    el.innerHTML = `
      <div class="opp-fan" aria-label="对手手牌"><b class="fan-count"></b></div>
      <div class="duel-corner left"><button type="button" class="icon-btn" data-b="menu" aria-label="菜单">☰</button></div>
      <div class="duel-corner right">${soundToggleHtml('icon-btn')}</div>
      <section class="hero hero-opp" data-side="opp"></section>
      <section class="table" aria-label="战场">
        <div class="mat"><i class="mat-grid"></i><i class="mat-edge"></i></div>
        <div class="half half-opp"><div class="persist" data-persist="opp"></div><div class="played" data-played="opp"></div></div>
        <div class="rope" hidden aria-hidden="true"><i class="rope-cord"></i><i class="rope-fire"></i></div>
        <div class="midline"><span class="turn-chip"></span></div>
        <div class="half half-me"><div class="played" data-played="me"></div><div class="persist" data-persist="me"></div></div>
        <span class="held-tag">下回合手牌 · 轮到你时才能打出</span>
        <div class="banner" aria-live="polite"></div>
        <button type="button" class="hist-strip" data-b="hist" aria-label="打开战报"><span class="hs-title">战报</span><span class="hs-tiles"></span></button>
        <button type="button" class="end-turn" data-b="end" data-sfx-quiet></button>
      </section>
      <section class="hero hero-me" data-side="me"></section>
      <div class="hand-zone"></div>
      <div class="hand-actions" hidden></div>
      <div class="hist-backdrop" hidden></div>
      <aside class="hist-panel" hidden aria-label="战报"><header><b>战报</b><small>最新在上 · 点击查看详情</small><button type="button" data-b="hist-close" aria-label="关闭战报">✕</button></header><div class="hist-body"><div class="hist-list"></div><div class="hist-detail" hidden></div></div></aside>
      <div class="menu-pop" hidden><button type="button" data-b="concede">认输</button><button type="button" data-b="leave">退出房间</button></div>
      <div class="result" hidden></div>
      <div class="sheet" hidden></div>`;
    for (const s of ['opp', 'me']) el.querySelector(`.hero-${s}`).innerHTML = heroSkeleton(s);
    fx = document.createElement('div');
    fx.className = 'duel-fx';
    fx.innerHTML = '<svg class="aim"><defs><marker id="aimhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ff5b5b"/></marker></defs><path class="aim-path" marker-end="url(#aimhead)"/></svg>';
    el.appendChild(fx);
    ctx.root.replaceChildren(el);
    document.body.classList.add('in-duel');
    el.addEventListener('click', onClick);
    el.addEventListener('pointerdown', onRootDown, true);
    window.addEventListener('resize', onResize);
    bindPanelSwipe();
    clockInt = setInterval(() => { tickClock(); if (resultShown) tickRematch(); }, 200);
  }
  function heroSkeleton(s) {
    return `<div class="emblem"><span class="emb-txt"></span><span class="shield" hidden>${statusIcon('block')}<b></b></span></div>
      <div class="hero-body"><div class="hero-line"><b class="hero-name"></b><button type="button" class="trait" data-b="trait-${s}"></button></div>
        <div class="hp"><i class="hp-lag"></i><i class="hp-fill"></i><span class="hp-txt"></span></div>
        <div class="hero-status"></div></div>
      <div class="hero-side"><div class="energy" title="行动点"><b class="en-num"></b><span class="en-pips"></span></div>
        <div class="piles"><span class="pile pile-draw" title="抽牌堆"><i></i><b></b></span><span class="pile pile-discard" title="弃牌堆"><i></i><b></b></span></div></div>`;
  }
  function unmount() {
    if (!el) return;
    window.removeEventListener('resize', onResize);
    clearInterval(clockInt); clockInt = 0; timer = null; ropeOn = false; lastTickSec = -1;
    document.body.classList.remove('in-duel');
    el.remove();
    el = null; fx = null; target = null; shownView = null; room = null;
    handEls = new Map(); handCards = []; oppEls = []; pendingPlay = null; press = null;
  }

  // ------------------------------------------------ public: feed room states
  function show(r) {
    if (!r?.match) return;
    // A rematch keeps the room code but starts a new match (round + 1): build a fresh table.
    const fresh = !el || !ctx.root.contains(el) || code !== r.code || round !== (r.round || 1);
    if (Number.isFinite(r.now)) skew = r.now - Date.now();
    if (fresh) {
      const rematched = !!el && code === r.code && round !== (r.round || 1);
      unmount();
      room = r; code = r.code; mySeat = r.seat; target = r; round = r.round || 1;
      timer = r.timer || null;
      resultShown = false; resultDismissed = false; histOpen = false; table = { played: [[], []] }; lastRematchKey = '';
      mount();
      if (rematched) ctx.notice(`再来一局 · 第 ${round} 局开始`);
      const hist = r.match.history || [];
      // A brand-new match plays its opening deal; a reload mid-match starts from now.
      const opening = hist.length && hist.every(e => e.kind === 'deal' || e.kind === 'turn');
      lastN = opening ? 0 : (hist.length ? hist[hist.length - 1].n : 0);
      if (opening) {
        shownView = { ...r.match, you: { ...r.match.you, hand: [], drawCount: r.match.you.drawCount + r.match.you.hand.length }, opponent: { ...r.match.opponent, handCount: 0 } };
        applyStatic(shownView, true);
        pump();
      } else {
        rebuildTable(r.match);
        applyView(r.match);
      }
      return;
    }
    // Ignore responses older than what we already hold (a slow poll after an action).
    if (target?.match && r.match.rev < target.match.rev) return;
    room = r; target = r;
    timer = r.timer || null;
    if (resultShown) renderRematch();
    if (r.match.hasHistory === false) { applyView(r.match); return; }
    pump();
  }
  function hide() { unmount(); }
  function isAnimating() { return pumping || !!pendingPlay; }

  // ------------------------------------------------ view application
  function heroFromView(v, seat) {
    const p = seat === mySeat ? v.you : v.opponent;
    return { hp: p.hp, maxHp: p.maxHp, block: p.block, weak: p.weak, vulnerable: p.vulnerable, burn: p.burn || 0, strength: p.strength || 0, overload: p.overload || 0, energy: p.energy, draw: p.drawCount, discard: p.discard?.length || 0, deployables: p.deployables || [], powers: p.powers || [], trait: p.trait, hand: seat === mySeat ? p.hand.length : p.handCount };
  }
  function applyStatic(v, skipHand = false) {
    heroes = [heroFromView(v, 0), heroFromView(v, 1)];
    activeShown = v.status === 'active' ? v.active : null;
    for (const seat of [0, 1]) renderHero(seat);
    renderPersist();
    renderPlayed();
    if (!skipHand) { oppCount = v.opponent.handCount; layoutOpp(); }
    renderTurn(v);
  }
  function applyView(v) {
    shownView = v;
    applyStatic(v);
    syncHand(v.you.hand, false);
    renderHistory();
    if (v.status === 'finished') showResult(v);
  }
  function applyAfter(e) {
    if (!e.after) return;
    for (const seat of [0, 1]) {
      const a = e.after[seat];
      Object.assign(heroes[seat], { hp: a[0], block: a[1], weak: a[2], vulnerable: a[3], burn: a[4], energy: a[5], draw: a[7], discard: a[8] });
      renderHero(seat);
    }
  }

  // ------------------------------------------------ hero panels
  function memberName(seat) { const n = room?.members?.find(m => m.seat === seat)?.name; return n && n !== '玩家' ? n : (seat === mySeat ? '你' : '对手'); }
  function renderHero(seat) {
    const h = heroes[seat], s = side(seat), box = el?.querySelector(`.hero-${s}`);
    if (!box || h.hp === undefined) return;
    const region = h.trait?.region;
    box.dataset.region = region || '';
    box.classList.toggle('active', activeShown === seat);
    box.querySelector('.emb-txt').textContent = REGION_SHORT[region] || '—';
    box.querySelector('.hero-name').textContent = seat === mySeat ? `你${memberName(seat) !== '你' ? ' · ' + memberName(seat) : ''}` : memberName(seat);
    const tr = box.querySelector('.trait');
    tr.textContent = h.trait ? `${h.trait.name} ${h.trait.counter}` : '';
    tr.hidden = !h.trait;
    const pct = h.maxHp ? clamp(h.hp / h.maxHp * 100, 0, 100) : 0;
    box.querySelector('.hp-fill').style.width = pct + '%';
    box.querySelector('.hp-lag').style.width = pct + '%';
    box.querySelector('.hp-txt').textContent = `${h.hp} / ${h.maxHp}`;
    box.classList.toggle('low', pct <= 30);
    const sh = box.querySelector('.shield');
    sh.hidden = !h.block;
    sh.querySelector('b').textContent = h.block || '';
    box.querySelector('.hero-status').innerHTML = statusBadges([['weak', h.weak], ['vuln', h.vulnerable], ['burn', h.burn], ['strength', h.strength], ['overload', h.overload]])
      + (h.deployables || []).map(d => `<span class="deploy-chip" title="${d.kind === 'turret' ? '哨戒炮：回合结束时开火' : '屏障无人机：回合结束时提供布防'}">${statusIcon(d.kind === 'turret' ? 'sentry' : 'block')}<b>${d.n}</b><small>×${d.turns}</small></span>`).join('');
    box.querySelector('.en-num').textContent = h.energy ?? 0;
    box.querySelector('.en-pips').innerHTML = Array.from({ length: Math.max(3, h.energy || 0) }, (_, i) => `<i class="${i < (h.energy || 0) ? 'on' : ''}"></i>`).join('');
    box.querySelector('.pile-draw b').textContent = h.draw ?? 0;
    box.querySelector('.pile-discard b').textContent = h.discard ?? 0;
  }
  function heroCenter(seat) { const b = el.querySelector(`.hero-${side(seat)} .emblem`).getBoundingClientRect(); return rectC(b); }
  function pileCenter(seat, which) { return rectC(el.querySelector(`.hero-${side(seat)} .pile-${which}`).getBoundingClientRect()); }
  function popup(seat, text, kind = 'dmg', dy = 0) {
    if (!fx) return;
    const c = heroCenter(seat), p = document.createElement('div');
    p.className = `pop pop-${kind}`;
    p.textContent = text;
    p.style.left = c.x + 'px'; p.style.top = (c.y + dy) + 'px';
    fx.appendChild(p);
    p.animate([{ transform: 'translate(-50%,-30%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-80%) scale(1.15)', opacity: 1, offset: .2 }, { transform: 'translate(-50%,-120%) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,-170%) scale(.95)', opacity: 0 }], { duration: T(1100) + 300, easing: 'ease-out' }).finished.then(() => p.remove(), () => p.remove());
  }
  function shake(seat, heavy) {
    const box = el?.querySelector(`.hero-${side(seat)}`);
    if (!box) return;
    box.classList.remove('hit', 'hit-heavy'); void box.offsetWidth;
    box.classList.add(heavy ? 'hit-heavy' : 'hit');
    setTimeout(() => box.classList.remove('hit', 'hit-heavy'), 520);
  }

  // ------------------------------------------------ turn / end button / banner
  function renderTurn(v) {
    const b = $('.end-turn');
    if (!b) return;
    const finished = v.status === 'finished';
    const mine = !finished && activeShown === mySeat;
    b.hidden = finished;
    b.disabled = !mine || endPending || busy;
    b.classList.toggle('theirs', !mine);
    const h = heroes[mySeat];
    const playable = mine && handCards.some(c => canAfford(c, h));
    b.classList.toggle('ready', mine && !playable && !endPending);
    b.innerHTML = mine ? (endPending ? '<b>结束中…</b>' : '<b>结束回合</b>') + '<small class="t-clock"></small>' : '<b>对手回合</b><small class="t-clock">等待中</small>';
    $('.turn-chip').textContent = `第 ${v.turn} 回合 · ${finished ? '已结束' : mine ? '你的回合' : '对手回合'}`;
    el.classList.toggle('my-turn', mine);
    el.classList.toggle('their-turn', !mine && !finished);
    el.querySelector('.hand-zone').classList.toggle('held', !mine && !finished);
    layoutHand();
    tickClock();
  }
  // ------------------------------------------------ turn timer (server enforced, shown here)
  // The timer belongs to the turn currently on screen only when the animation queue has
  // caught up with it; otherwise hide it rather than show another turn's clock.
  function timerLeft() {
    if (!timer || timer.endsAt == null || !shownView || shownView.status !== 'active') return null;
    if (timer.seat !== activeShown || target?.match?.turn !== timer.turn) return null;
    return timer.endsAt - (Date.now() + skew);
  }
  function timeUp() { const left = timerLeft(); return left !== null && left <= 0; }
  function tickClock() {
    if (!el) return;
    const left = timerLeft(), b = $('.end-turn'), clock = b?.querySelector('.t-clock'), rope = $('.rope');
    const mine = activeShown === mySeat;
    if (left === null) {
      if (clock) clock.textContent = mine ? '' : '等待中';
      if (rope) rope.hidden = true;
      ropeOn = false;
      b?.classList.remove('urgent');
      return;
    }
    if (clock) clock.textContent = left <= 0 ? '超时' : fmtClock(left);
    b?.classList.toggle('urgent', left <= ROPE_MS);
    if (mine && left <= 0 && !endPending && b) { b.disabled = true; b.innerHTML = '<b>超时</b><small class="t-clock">自动结束</small>'; }
    // Burning fuse along the centre line toward the end-turn button for the last 20 s.
    const burning = left > 0 && left <= ROPE_MS;
    if (rope) {
      rope.hidden = !burning;
      rope.classList.toggle('mine', mine);
      rope.classList.toggle('theirs', !mine);
      if (burning) {
        const frac = clamp(left / ROPE_MS, 0, 1);
        rope.style.setProperty('--left', frac.toFixed(4));
        if (!ropeOn) playSfx('turnEnd');
      }
    }
    ropeOn = burning;
    el.classList.toggle("roping", burning);
    const sec = Math.ceil(left / 1000);
    if (mine && left > 0 && sec <= TICK_FROM && sec !== lastTickSec) { lastTickSec = sec; playSfx('tick'); }
    if (left > TICK_FROM * 1000) lastTickSec = -1;
  }
  async function banner(seat) {
    const b = $('.banner');
    if (!b) return;
    const mine = seat === mySeat;
    b.className = `banner show ${mine ? 'mine' : 'theirs'}`;
    b.innerHTML = `<b>${mine ? '你的回合' : '对手回合'}</b>`;
    playSfx(mine ? 'reward' : 'turnEnd');
    await wait(mine ? 1000 : 750);
    b.className = 'banner';
  }
  function canAfford(c, h = heroes[mySeat]) { const t = CARDS[c.id]; return t && t.cost !== null && (t.x || t.cost <= (h.energy ?? 0)); }

  // ------------------------------------------------ opponent card-back fan
  function oppLayout(n) {
    const fan = $('.opp-fan'), r = fan.getBoundingClientRect();
    const w = innerWidth < 720 ? 42 : 56, s = w / DW, step = n > 1 ? Math.min(w * 0.62, (Math.min(r.width, 420) - w) / (n - 1)) : 0;
    return Array.from({ length: n }, (_, i) => { const off = i - (n - 1) / 2; return { x: r.left + r.width / 2 + off * step, y: r.top + 14 - Math.abs(off) * Math.abs(off) * 1.2, s, r: 180 - off * 5 }; });
  }
  function layoutOpp(animFrom = null) {
    if (!el) return;
    const fan = $('.opp-fan');
    while (oppEls.length < oppCount) {
      const b = document.createElement('div');
      b.className = 'ob'; b.innerHTML = BACK;
      if (animFrom) { b.style.transition = 'none'; b.style.transform = tf({ ...animFrom, s: 0.2 }); }
      fx.appendChild(b); oppEls.push(b);
    }
    while (oppEls.length > oppCount) oppEls.pop().remove();
    const pos = oppLayout(oppEls.length);
    oppEls.forEach((b, i) => {
      if (animFrom) { void b.offsetWidth; b.style.transition = ''; }
      b.style.transform = tf(pos[i]); b.style.zIndex = 5 + i;
    });
    fan.querySelector('.fan-count').textContent = oppCount ? `${oppCount}` : '0';
    fan.classList.toggle('empty', !oppCount);
  }

  // ------------------------------------------------ my hand fan
  function handMetrics() {
    const z = $('.hand-zone').getBoundingClientRect(), phone = innerWidth < 720;
    const cardW = phone ? clamp(innerWidth * 0.27, 80, 112) : 132;
    return { z, phone, cardW, s: cardW / DW, cardH: DH * cardW / DW };
  }
  function slots() {
    // The card being dragged leaves the fan, so the others close the gap.
    const fan = handCards.filter(c => !(press?.dragging && press.uid === c.uid));
    const n = fan.length, m = handMetrics(), out = new Map();
    const avail = Math.min(m.z.width, m.phone ? innerWidth : 860) - m.cardW - 30;
    const step = n > 1 ? Math.min(m.cardW * 0.8, avail / (n - 1)) : 0;
    const ang = n > 1 ? Math.min(m.phone ? 5 : 4, 28 / (n - 1)) : 0;
    const arc = m.phone ? 2.2 : 2.6, maxArc = ((n - 1) / 2) ** 2 * arc;
    const cx = m.z.left + m.z.width / 2, baseY = m.z.bottom - m.cardH / 2 - 8 - maxArc * 0.6;
    const hi = press?.dragging ? -1 : fan.findIndex(c => c.uid === (press?.uid || hoverUid));
    fan.forEach((c, i) => {
      const off = i - (n - 1) / 2;
      const push = hi >= 0 && i !== hi ? (i < hi ? -1 : 1) * (m.phone ? 10 : 18) : 0;
      out.set(c.uid, { x: cx + off * step + push, y: baseY + off * off * arc, s: m.s, r: off * ang, z: 10 + i });
    });
    return { map: out, m };
  }
  function previewPos(uid, m) {
    const big = m.phone ? clamp((innerWidth - 150) / DW, 0.95, 1.12) : 1.25;
    const base = handPos.get(uid) || { x: innerWidth / 2 };
    const x = m.phone ? innerWidth / 2 - 34 : clamp(base.x, DW * big / 2 + 10, innerWidth - DW * big / 2 - 10);
    return { x, y: m.z.bottom - DH * big / 2 - 8, s: big, r: 0, z: 200 };
  }
  function layoutHand() {
    if (!el) return;
    const { map, m } = slots();
    const live = activeShown === mySeat && shownView?.status !== 'finished';
    for (const c of handCards) {
      const e = handEls.get(c.uid);
      if (!e) continue;
      let p = map.get(c.uid);
      if (drawing.has(c.uid) || (press?.dragging && press.uid === c.uid)) continue;
      handPos.set(c.uid, p);
      if (selectedUid === c.uid) p = previewPos(c.uid, m);
      else if (press?.uid === c.uid && !press.dragging) p = m.phone ? { x: clamp(p.x, 70, innerWidth - 70), y: m.z.bottom - DH * 0.8 / 2 - 30, s: 0.8, r: 0, z: 190 } : { ...p, y: p.y - m.cardH * 0.28, r: 0, z: 150 };
      else if (hoverUid === c.uid) p = hoverBig ? previewPos(c.uid, m) : { ...p, y: p.y - m.cardH * 0.3, r: 0, z: 150 };
      e.style.transform = tf(p);
      e.style.zIndex = p.z;
      e.classList.toggle('can', live && canAfford(c));
      e.classList.toggle('lifted', selectedUid === c.uid || hoverUid === c.uid || press?.uid === c.uid);
    }
    renderHandActions(m);
  }
  function makeHandEl(c, faceDown) {
    const e = document.createElement('div');
    e.className = 'hc';
    e.dataset.uid = c.uid;
    e.setAttribute('role', 'button');
    e.setAttribute('tabindex', '0');
    e.setAttribute('aria-label', `${cardName(c)}，${CARDS[c.id]?.cost ?? '—'} 行动点，${describe(c)}`);
    e.innerHTML = flipCard(c, faceDown);
    e.addEventListener('pointerdown', ev => onCardDown(ev, c.uid));
    e.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse' && !press) setHover(c.uid); });
    e.addEventListener('pointerleave', ev => {
      if (ev.pointerType !== 'mouse' || hoverUid !== c.uid || press) return;
      // The raised card moved away from the pointer: keep it while the pointer is still over its slot.
      const slot = handPos.get(c.uid), m = handMetrics();
      if (slot && ev.clientY > m.z.top - 10 && Math.abs(ev.clientX - slot.x) < m.cardW * 0.4) return;
      setHover(null);
    });
    e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tapCard(c.uid); } });
    fx.appendChild(e);
    return e;
  }
  // Bring the hand to `cards`: leftovers fly to the discard pile, new ones are drawn.
  async function syncHand(cards, animate = true, discardFirst = false) {
    if (!el) return;
    const keep = new Set(cards.map(c => c.uid));
    const leaving = handCards.filter(c => !keep.has(c.uid) && c.uid !== pendingPlay?.uid);
    for (const c of leaving) {
      const e = handEls.get(c.uid);
      handEls.delete(c.uid);
      if (selectedUid === c.uid) selectedUid = null;
      if (!e) continue;
      if (animate && discardFirst) {
        const to = { ...pileCenter(mySeat, 'discard'), s: 0.12, r: 30 };
        e.style.transition = `transform ${T(380)}ms ease-in, opacity ${T(380)}ms`;
        e.style.transform = tf(to); e.style.opacity = '0.3';
        setTimeout(() => e.remove(), T(400));
      } else e.remove();
    }
    const known = new Set(handCards.map(c => c.uid));
    const added = cards.filter(c => !known.has(c.uid) && c.uid !== pendingPlay?.uid);
    handCards = cards.filter(c => c.uid !== pendingPlay?.uid).map(c => ({ ...c }));
    if (leaving.length && animate && discardFirst) await wait(300);
    if (!animate || !added.length) {
      for (const c of added) handEls.set(c.uid, makeHandEl(c, false));
      layoutHand();
      return;
    }
    for (const c of added) { drawing.add(c.uid); handEls.set(c.uid, makeHandEl(c, true)); }
    const deck = pileCenter(mySeat, 'draw'), tr = $('.table').getBoundingClientRect();
    for (const c of added) { const e = handEls.get(c.uid); e.style.transition = 'none'; e.style.transform = tf({ ...deck, s: 0.14, r: -20 }); e.style.opacity = '0'; }
    layoutHand();
    const phone = innerWidth < 720;
    const show = { x: tr.left + tr.width * (phone ? 0.64 : 0.7), y: tr.top + tr.height * 0.58, s: phone ? 0.78 : 0.95, r: -3 };
    const gap = added.length > 3 ? 170 : 260;
    await Promise.all(added.map((c, i) => (async () => {
      await wait(i * gap);
      const e = handEls.get(c.uid);
      if (!e || !el) return;
      playSfx('draw');
      void e.offsetWidth;
      e.style.transition = `transform ${T(320)}ms cubic-bezier(.2,.8,.2,1), opacity ${T(160)}ms`;
      e.style.opacity = '1';
      e.style.transform = tf({ ...show, x: show.x + (i % 3 - 1) * 6 });
      e.style.zIndex = 300 + i;
      setTimeout(() => e.querySelector('.flip')?.classList.remove('down'), T(120));
      await wait(560);
      drawing.delete(c.uid);
      e.style.transition = '';
      layoutHand();
    })()));
    layoutHand();
  }
  function setHover(uid) {
    clearTimeout(hoverTimer);
    hoverUid = uid; hoverBig = false;
    if (uid) hoverTimer = setTimeout(() => { if (hoverUid === uid && !press) { hoverBig = true; layoutHand(); } }, 800);
    layoutHand();
  }
  function renderHandActions(m) {
    const box = $('.hand-actions');
    if (!box) return;
    const c = handCards.find(x => x.uid === selectedUid);
    if (!c || press?.dragging) { box.hidden = true; return; }
    const p = previewPos(c.uid, m), live = activeShown === mySeat && shownView?.status === 'active';
    const why = !live ? '下回合手牌，轮到你时才能打出' : CARDS[c.id].cost === null ? '这张牌不能打出' : !canAfford(c) ? '行动点不足' : '';
    box.hidden = false;
    box.innerHTML = `${why ? `<p>${why}</p>` : `<button type="button" class="play-btn" data-b="play">打出</button>`}<button type="button" data-b="detail">详情</button><button type="button" data-b="cancel">${why ? '关闭' : '取消'}</button>`;
    const w = DW * p.s;
    const left = m.phone ? p.x + w / 2 + 8 : p.x + w / 2 + 12;
    box.style.left = Math.min(left, innerWidth - 96) + 'px';
    box.style.top = (p.y - 40) + 'px';
  }

  // ------------------------------------------------ pointer: tap, press, drag
  function onCardDown(ev, uid) {
    if (ev.button > 0 || press || !el) return;
    if (drawing.has(uid) || pendingPlay) return;
    ev.preventDefault();
    const e = handEls.get(uid);
    try { e.setPointerCapture(ev.pointerId); } catch {}
    clearTimeout(hoverTimer); hoverBig = false;
    press = { uid, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, vx: 0, tilt: 0, lt: performance.now(), moved: false, dragging: false, touch: ev.pointerType !== 'mouse', long: false };
    if (selectedUid && selectedUid !== uid) selectedUid = null;
    press.timer = setTimeout(() => { if (press && !press.moved && press.uid === uid) { press.long = true; openSheet(handCards.find(c => c.uid === uid)); } }, 560);
    const move = mv => onCardMove(mv), up = u => { e.removeEventListener('pointermove', move); e.removeEventListener('pointerup', up); e.removeEventListener('pointercancel', up); onCardUp(u); };
    e.addEventListener('pointermove', move);
    e.addEventListener('pointerup', up);
    e.addEventListener('pointercancel', up);
    layoutHand();
  }
  function live() { return activeShown === mySeat && shownView?.status === 'active' && !endPending && !timeUp(); }
  function onCardMove(ev) {
    if (!press || ev.pointerId !== press.id) return;
    const now = performance.now(), dt = Math.max(1, now - press.lt);
    press.vx = press.vx * 0.6 + ((ev.clientX - press.x) / dt) * 0.4;
    press.x = ev.clientX; press.y = ev.clientY; press.lt = now;
    if (!press.moved && Math.hypot(press.x - press.x0, press.y - press.y0) > 9) {
      press.moved = true;
      clearTimeout(press.timer);
      if (live() && !busy && CARDS[handCards.find(c => c.uid === press.uid)?.id]?.cost !== null) {
        press.dragging = true; selectedUid = null; hoverUid = null;
        const e = handEls.get(press.uid);
        e.classList.add('dragging'); e.style.transition = 'none'; e.style.zIndex = 400;
        playSfx('draw');
        layoutHand();
      }
    }
    if (press.dragging && !dragRaf) dragRaf = requestAnimationFrame(dragFrame);
  }
  function playLine() { const t = $('.table').getBoundingClientRect(); return t.bottom - 12; }
  function dragFrame() {
    dragRaf = 0;
    if (!press?.dragging || !el) return;
    const e = handEls.get(press.uid), c = handCards.find(x => x.uid === press.uid);
    if (!e || !c) return;
    const m = handMetrics(), over = press.y < playLine(), aimCard = isTargeting(c);
    press.tilt += (clamp(press.vx * 9, -16, 16) - press.tilt) * 0.3;
    const aim = fx.querySelector('.aim'), oppBox = $('.hero-opp');
    let p;
    if (over && aimCard) {
      const tr = $('.table').getBoundingClientRect();
      p = { x: tr.left + tr.width / 2, y: tr.bottom - DH * 0.62 / 2 - 6, s: 0.62, r: 0 };
      const sx = p.x, sy = p.y - DH * 0.62 / 2 + 8, ex = press.x, ey = press.y;
      const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 60;
      aim.classList.add('on');
      aim.querySelector('.aim-path').setAttribute('d', `M${sx},${sy} Q${mx},${my} ${ex},${ey}`);
      const hr = oppBox.getBoundingClientRect();
      oppBox.classList.toggle('aimed', press.y < hr.bottom + 60);
    } else {
      aim.classList.remove('on');
      oppBox.classList.remove('aimed');
      const s = m.phone ? 0.78 : 0.95;
      p = { x: press.x, y: press.y - (press.touch ? DH * s * 0.42 : 0), s, r: press.tilt };
    }
    e.style.transform = tf(p);
    e.classList.toggle('will-play', over);
    $('.table').classList.toggle('drop-hot', over);
  }
  function endDragVisuals() {
    const aim = fx?.querySelector('.aim');
    if (aim) aim.classList.remove('on');
    $('.hero-opp')?.classList.remove('aimed');
    $('.table')?.classList.remove('drop-hot');
  }
  function onCardUp(ev) {
    if (!press || ev.pointerId !== press.id) return;
    const p = press;
    clearTimeout(p.timer);
    cancelAnimationFrame(dragRaf); dragRaf = 0;
    press = null;
    const e = handEls.get(p.uid);
    if (p.dragging) {
      e?.classList.remove('dragging', 'will-play');
      endDragVisuals();
      if (e) e.style.transition = '';
      if (ev.type !== 'pointercancel' && p.y < playLine()) { tryPlay(p.uid, e); return; }
      layoutHand();
      return;
    }
    if (p.long || p.moved || ev.type === 'pointercancel') { layoutHand(); return; }
    tapCard(p.uid);
  }
  function tapCard(uid) {
    if (selectedUid === uid) {
      if (live()) { tryPlay(uid, handEls.get(uid)); return; }
      selectedUid = null;
    } else selectedUid = uid;
    hoverUid = null;
    layoutHand();
  }
  function onRootDown(ev) {
    if (!selectedUid) return;
    if (ev.target.closest('.hc, .hand-actions, .sheet')) return;
    selectedUid = null;
    layoutHand();
  }
  function onResize() { layoutHand(); layoutOpp(); }

  // ------------------------------------------------ my play
  function reject(uid, text) {
    const e = handEls.get(uid);
    ctx.notice(text);
    if (e) { e.classList.remove('nope'); void e.offsetWidth; e.classList.add('nope'); setTimeout(() => e.classList.remove('nope'), 450); }
    selectedUid = null;
    layoutHand();
  }
  async function tryPlay(uid, cardEl) {
    const c = handCards.find(x => x.uid === uid);
    if (!c || !cardEl) return;
    if (!live()) return reject(uid, '还没轮到你，这是下回合手牌。');
    if (busy || pumping || pendingPlay) return reject(uid, '正在结算，请稍候。');
    if (CARDS[c.id].cost === null) return reject(uid, '这张牌不能打出。');
    if (!canAfford(c)) return reject(uid, '行动点不足，无法打出这张牌。');
    ctx.notice('');
    selectedUid = null; hoverUid = null;
    handEls.delete(uid);
    handCards = handCards.filter(x => x.uid !== uid);
    cardEl.classList.remove('can', 'lifted', 'dragging');
    cardEl.classList.add('show');
    cardEl.style.transition = 'none';
    const from = parseTf(cardEl);
    const center = showcasePos();
    const flight = flyTo(cardEl, from, center, 300);
    playSfx('cardSkill');
    layoutHand();
    pendingPlay = { uid, el: cardEl, ready: flight.then(() => wait(250)) };
    busy = true; renderTurn(shownView);
    const ok = await ctx.send({ type: 'play', uid });
    if (ok) {
      // The pump picks the card up from pendingPlay; if the server never recorded
      // the play (should not happen) put the card back rather than hang.
      for (let i = 0; i < 100 && (pumping || pendingPlay?.uid === uid) && el; i++) {
        if (!pumping && pendingPlay?.uid === uid && i > 20) break;
        await new Promise(r => setTimeout(r, 100));
      }
      if (pendingPlay?.uid !== uid) return;
    }
    // Rejected: spring the card back into the fan.
    await flight;
    pendingPlay = null;
    if (!pumping) busy = false;
    if (!el) return;
    handCards = (shownView?.you.hand || []).map(h => ({ ...h }));
    cardEl.classList.remove('show');
    cardEl.style.transition = `transform ${T(280)}ms ease`;
    handEls.set(uid, cardEl);
    layoutHand();
    renderTurn(shownView);
  }
  function parseTf(e) {
    const r = e.getBoundingClientRect();
    const m = /rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/.exec(e.style.transform || '');
    return { ...rectC(r), r: m ? +m[1] : 0, s: m ? +m[2] : r.width / DW };
  }
  function showcasePos() {
    const tr = $('.table').getBoundingClientRect();
    const s = clamp(Math.min((tr.height - 20) / DH, (innerWidth - 40) / DW, 1.35), 0.8, 1.35);
    return { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2, s, r: 0 };
  }
  function flyTo(node, from, to, ms, easing = 'cubic-bezier(.2,.85,.25,1)') {
    node.style.transition = 'none';
    node.style.transform = tf(from);
    node.style.zIndex = 500;
    const a = node.animate([{ transform: tf(from) }, { transform: tf(to) }], { duration: T(ms), easing, fill: 'forwards' });
    return a.finished.then(() => { node.style.transform = tf(to); a.cancel(); }, () => { node.style.transform = tf(to); });
  }

  // ------------------------------------------------ history pump
  async function pump() {
    if (pumping || !el) return;
    pumping = true; busy = true;
    try {
      while (el && target?.match) {
        const hist = target.match.history || [];
        const idx = hist.findIndex(e => e.n > lastN);
        if (idx < 0) break;
        const backlog = hist.length - idx;
        speed = backlog > 6 ? 0.45 : backlog > 3 ? 0.65 : 1;
        if (document.hidden) speed = 0.2;
        const e = hist[idx];
        try { await animateEntry(e, target.match); } catch (err) { console.warn('pvp anim', err); }
        lastN = e.n;
        renderHistory();
      }
      speed = 1;
      if (el && target?.match) applyView(target.match);
    } finally {
      pumping = false; busy = false;
      if (el && shownView) renderTurn(shownView);
    }
    if (el && target?.match && (target.match.history || []).some(e => e.n > lastN)) pump();
  }
  async function animateEntry(e, v) {
    if (e.kind === 'deal') return animDeal(e, v);
    if (e.kind === 'turn') return animTurn(e, v);
    if (e.kind === 'play') return animPlay(e, v);
    if (e.kind === 'end') return animEnd(e, v);
    applyAfter(e);
  }
  async function animDeal(e, v) {
    if (e.seat === mySeat) {
      heroes[mySeat].draw = e.after?.[mySeat]?.[7] ?? heroes[mySeat].draw;
      renderHero(mySeat);
      await syncHand(v.you.hand.slice(0, e.results?.draw || 5), true);
    } else await oppDraw(e.results?.draw || 0);
    applyAfter(e);
  }
  async function oppDraw(n) {
    if (!n) return;
    const from = pileCenter(1 - mySeat, 'draw');
    for (let i = 0; i < n; i++) { oppCount++; layoutOpp(from); playSfx('draw'); await wait(110); }
    await wait(200);
  }
  async function animTurn(e) {
    activeShown = e.seat;
    applyAfter(e);
    renderTurn(target.match);
    await banner(e.seat);
    const r = e.results || {};
    if (r.burnDamage) { popup(e.seat, `-${r.burnDamage}`, 'dmg'); popup(e.seat, '燃烧', 'sts', 34); shake(e.seat, false); playSfx(e.seat === mySeat ? 'hurt' : 'hit'); await wait(500); }
    if (r.block) { popup(e.seat, `+${r.block} 布防`, 'blk'); playSfx('block'); await wait(350); }
    if (r.draw && e.seat !== mySeat) await oppDraw(r.draw);
    if (r.draw && e.seat === mySeat) await syncHand(target.match.you.hand, true);
    else if (r.tokens?.length || r.tokenCount) {
      if (e.seat === mySeat) await syncHand(target.match.you.hand, true);
      else { await oppDraw(r.tokenCount || r.tokens.length); }
    }
  }
  async function animEnd(e, v) {
    const r = e.results || {};
    if (e.auto) await autoEndNotice(e);
    if (r.damage || r.absorbed) { impact(1 - e.seat, r, 'turret'); await wait(600); }
    if (r.block) { popup(e.seat, `+${r.block} 布防`, 'blk'); playSfx('block'); await wait(300); }
    if (r.selfDamage) { popup(e.seat, `-${r.selfDamage}`, 'dmg'); shake(e.seat, false); await wait(450); }
    // Clear this seat's half of the table into its discard pile.
    await sweepTable(e.seat);
    const after = e.after?.[e.seat];
    if (e.seat === mySeat) {
      endPending = false;
      applyAfter(e);
      await syncHand(v.you.hand, true, true);
    } else {
      const kept = r.kept || 0, drawn = r.draw || 0;
      // Leftover backs fly to their discard, then the next hand arrives from their deck.
      const leaving = Math.max(0, oppCount - kept);
      const to = pileCenter(e.seat, 'discard');
      for (let i = 0; i < leaving; i++) { const b = oppEls.pop(); oppCount--; if (b) { b.style.transform = tf({ ...to, s: 0.1, r: 90 }); b.style.opacity = '0.2'; setTimeout(() => b.remove(), T(360)); } }
      if (leaving) await wait(320);
      layoutOpp();
      applyAfter(e);
      await oppDraw(drawn);
      if (after) { oppCount = after[6]; layoutOpp(); }
    }
  }
  async function autoEndNotice(e) {
    const mine = e.seat === mySeat, limit = timer?.afkLimit || 3;
    const b = $('.banner');
    if (mine) { endPending = false; selectedUid = null; $('.sheet').hidden = true; }
    ctx.notice(mine ? `超时，自动结束回合${e.afk ? `（连续 ${e.afk}/${limit} 次，达到 ${limit} 次判负）` : ''}` : '对手超时，自动结束回合');
    if (!b) return;
    b.className = `banner show timeout ${mine ? 'mine' : 'theirs'}`;
    b.innerHTML = `<b>超时，自动结束回合</b>`;
    playSfx('debuff');
    await wait(1100);
    b.className = 'banner';
  }
  function impact(seat, r, how) {
    const heavy = (r.damage || 0) >= 12;
    if (r.damage) {
      popup(seat, `-${r.damage}`, 'dmg');
      shake(seat, heavy);
      flash(seat);
      playSfx(seat === mySeat ? 'hurt' : (r.hits > 1 ? 'multiHit' : heavy ? 'hitHeavy' : 'hit'));
    }
    if (r.absorbed) popup(seat, `布防 -${r.absorbed}`, 'blk', r.damage ? 38 : 0);
    if (!r.damage && r.absorbed) playSfx('block');
    if (how === 'turret') popup(seat, '哨戒炮', 'sts', -40);
  }
  function flash(seat) {
    const box = el?.querySelector(`.hero-${side(seat)}`);
    if (!box) return;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    setTimeout(() => box.classList.remove('flash'), 600);
  }
  async function animPlay(e) {
    const card = { id: e.id, up: !!e.up, ...(e.g ? { g: e.g } : {}) };
    const center = showcasePos();
    let node;
    if (e.seat === mySeat) {
      if (pendingPlay && pendingPlay.uid === e.uid) {
        node = pendingPlay.el;
        await pendingPlay.ready;
        pendingPlay = null;
      } else {
        // My play seen from a reload or another device: lift it out of the fan.
        const he = e.uid && handEls.get(e.uid);
        const from = he ? parseTf(he) : { x: innerWidth / 2, y: innerHeight - 80, s: 0.5, r: 0 };
        if (he) { he.remove(); handEls.delete(e.uid); handCards = handCards.filter(c => c.uid !== e.uid); layoutHand(); }
        node = document.createElement('div'); node.className = 'hc show'; node.innerHTML = flipCard(card, false); fx.appendChild(node);
        await flyTo(node, from, center, 320);
        await wait(250);
      }
      await wait(700);
    } else {
      // A back leaves their fan, flips face-up in the middle of the table.
      const b = oppEls.pop(); oppCount = Math.max(0, oppCount - 1);
      const from = b ? parseTf(b) : { x: innerWidth / 2, y: 20, s: 0.25, r: 180 };
      b?.remove();
      layoutOpp();
      node = document.createElement('div'); node.className = 'hc show'; node.innerHTML = flipCard(card, true); fx.appendChild(node);
      playSfx('draw');
      const fly = flyTo(node, { ...from, r: 0 }, center, 420);
      setTimeout(() => { node.querySelector('.flip')?.classList.remove('down'); playSfx('cardSkill'); }, T(170));
      await fly;
      await wait(1150);
    }
    node.classList.add('resolving');
    // Resolve on the heroes, same numbers on both screens.
    const r = e.results || {};
    const foe = 1 - e.seat;
    if (r.damage || r.absorbed) impact(foe, r);
    else if (e.zone === 'power') playSfx('cardPower');
    let dy = r.damage || r.absorbed ? 70 : 0;
    const stat = (seat, text, kind) => { popup(seat, text, kind, dy); dy += 30; };
    if (r.weak) stat(foe, `压制 +${r.weak}`, 'sts');
    if (r.vulnerable) stat(foe, `易伤 +${r.vulnerable}`, 'sts');
    if (r.burn) stat(foe, `燃烧 +${r.burn}`, 'sts');
    if (r.weak || r.vulnerable || r.burn) playSfx('debuff', { delay: 120 });
    let dy2 = 0;
    const self = (text, kind) => { popup(e.seat, text, kind, dy2); dy2 += 30; };
    if (r.block) { self(`+${r.block} 布防`, 'blk'); playSfx('block', { delay: 60 }); }
    if (r.strength) self(`火力 +${r.strength}`, 'buf');
    if (r.energy) self(`行动点 +${r.energy}`, 'buf');
    if (r.draw) self(`抽 ${r.draw} 张`, 'buf');
    for (const d of r.deploy || []) self(d.kind === 'turret' ? '部署哨戒炮' : '部署屏障无人机', 'buf');
    for (const k of r.traits || []) self(TRAIT_NAMES[k] || '赛区特质', 'buf');
    applyAfter(e);
    await wait(r.damage ? 650 : 480);
    // Lay the card on the owner's half of the table (or dissolve / keep as a power).
    await landCard(node, e, card);
    if (e.seat === mySeat) {
      await syncHand(target.match.you.hand, true);
    } else if (r.draw || r.tokenCount) {
      await oppDraw((r.draw || 0) + (r.tokenCount || 0));
    }
  }
  async function landCard(node, e, card) {
    const from = parseTf(node);
    if (e.zone === 'exhaust') {
      await node.animate([{ transform: tf(from), opacity: 1, filter: 'none' }, { transform: tf({ ...from, s: from.s * 1.12 }), opacity: 0, filter: 'blur(6px) brightness(1.8) sepia(1)' }], { duration: T(420), fill: 'forwards' }).finished.catch(() => {});
      node.remove();
      return;
    }
    if (e.zone === 'power') {
      heroes[e.seat].powers = [...(heroes[e.seat].powers || []), card];
      renderPersist(true);
      const slot = el.querySelector(`[data-persist="${side(e.seat)}"] .pcard:last-child`);
      const to = slot ? { ...rectC(slot.getBoundingClientRect()), s: slot.getBoundingClientRect().width / DW, r: 0 } : { ...from, s: 0.1 };
      await flyTo(node, from, to, 380, 'ease-in');
      node.remove();
      slot?.classList.remove('incoming');
      return;
    }
    table.played[e.seat].push({ ...card, n: e.n });
    renderPlayed(e.seat);
    const slot = el.querySelector(`[data-played="${side(e.seat)}"] .tcard:last-child`);
    const sr = slot?.getBoundingClientRect();
    const to = sr ? { ...rectC(sr), s: sr.width / DW, r: +(slot.dataset.r || 0) } : { ...from, s: 0.3 };
    await flyTo(node, from, to, 360, 'cubic-bezier(.3,.7,.3,1)');
    node.remove();
    slot?.classList.remove('incoming');
    playSfx('click');
  }
  async function sweepTable(seat) {
    const cards = [...(el?.querySelectorAll(`[data-played="${side(seat)}"] .tcard`) || [])];
    if (!cards.length) { table.played[seat] = []; return; }
    const to = pileCenter(seat, 'discard');
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect(), cc = rectC(r);
      c.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${to.x - cc.x}px,${to.y - cc.y}px) scale(.25) rotate(40deg)`, opacity: 0.1 }], { duration: T(380), delay: T(i * 50), easing: 'ease-in', fill: 'forwards' });
    });
    await wait(380 + cards.length * 50);
    table.played[seat] = [];
    renderPlayed();
  }
  // Played-this-turn cards of the active seat, when (re)entering mid-turn.
  function rebuildTable(v) {
    table.played = [[], []];
    const hist = v.history || [];
    let i = hist.length - 1;
    while (i >= 0 && hist[i].kind !== 'turn' && hist[i].kind !== 'end') i--;
    if (i >= 0 && hist[i].kind === 'turn') {
      for (const e of hist.slice(i + 1)) if (e.kind === 'play' && e.zone === 'discard') table.played[e.seat].push({ id: e.id, up: !!e.up, ...(e.g ? { g: e.g } : {}), n: e.n });
    }
  }
  function renderPlayed(incomingSeat = null) {
    if (!el) return;
    const phone = innerWidth < 720, s = phone ? 0.34 : 0.42;
    for (const seat of [0, 1]) {
      const box = el.querySelector(`[data-played="${side(seat)}"]`);
      const list = table.played[seat];
      box.innerHTML = list.map((c, i) => { const r = ((c.n * 37) % 9) - 4; return `<span class="tcard${seat === incomingSeat && i === list.length - 1 ? ' incoming' : ''}" data-r="${r}" data-card="${esc(c.id)}" data-up="${c.up ? 1 : 0}" style="transform:rotate(${r}deg);margin-left:${i ? -DW * s * 0.28 : 0}px">${miniFace(c, s)}</span>`; }).join('');
    }
  }
  function renderPersist(incomingLast = false) {
    if (!el) return;
    const phone = innerWidth < 720, s = phone ? 0.22 : 0.27;
    for (const seat of [0, 1]) {
      const h = heroes[seat], box = el.querySelector(`[data-persist="${side(seat)}"]`);
      const powers = h.powers || [];
      box.innerHTML = powers.map((c, i) => `<span class="pcard${incomingLast && i === powers.length - 1 ? ' incoming' : ''}" data-card="${esc(c.id)}" data-up="${c.up ? 1 : 0}" title="持续能力：${esc(cardName(c))}">${miniFace(c, s)}</span>`).join('')
        + (h.deployables || []).map(d => `<span class="dtoken ${d.kind}" title="${d.kind === 'turret' ? '哨戒炮' : '屏障无人机'}：每回合 ${d.n}，剩 ${d.turns} 回合">${statusIcon(d.kind === 'turret' ? 'sentry' : 'block')}<b>${d.n}</b><small>${d.turns}</small></span>`).join('');
    }
  }

  // ------------------------------------------------ history panel
  function entryVisible(e) {
    if (e.kind === 'play' || e.kind === 'result') return true;
    const r = e.results || {};
    if (e.kind === 'end') return !!(e.auto || r.damage || r.absorbed || r.block || r.selfDamage);
    if (e.kind === 'turn') return !!(r.burnDamage || r.block);
    return false;
  }
  function tileHtml(e) {
    const mine = e.seat === mySeat, r = e.results || {};
    const cls = `tile ${mine ? 'mine' : 'theirs'}`;
    let inner;
    if (e.kind === 'play') inner = `<span class="tile-art">${cardArtwork(e.id)}</span><span class="tile-cost">${CARDS[e.id]?.x ? 'X' : e.cost ?? ''}</span>`;
    else if (e.kind === 'end' && e.auto && !(r.damage || r.absorbed || r.selfDamage || r.block)) inner = `<span class="tile-icon clock">⏱</span>`;
    else if (e.kind === 'end') inner = `<span class="tile-icon">${statusIcon(r.damage || r.absorbed ? 'sentry' : r.selfDamage ? 'curse' : 'block')}</span>`;
    else if (e.kind === 'turn') inner = `<span class="tile-icon">${statusIcon(r.burnDamage ? 'burn' : 'block')}</span>`;
    else inner = `<span class="tile-icon flag">${e.winner === mySeat ? '胜' : e.winner === null ? '平' : '负'}</span>`;
    const dmg = r.damage || r.burnDamage || r.selfDamage;
    return `<span class="${cls}">${inner}${dmg ? `<em>-${dmg}</em>` : r.block ? `<em class="b">+${r.block}</em>` : ''}</span>`;
  }
  function entryTitle(e) {
    const who = e.seat === mySeat ? '你' : '对手';
    if (e.kind === 'play') return `${who} · ${cardName({ id: e.id, up: e.up })}`;
    if (e.kind === 'end') return `${who} · 回合结束${e.auto ? '（超时）' : ''}`;
    if (e.kind === 'turn') return `${who} · 回合开始`;
    if (e.kind === 'result') return e.winner === null ? '平局' : e.winner === mySeat ? '你获胜' : '对手获胜';
    return who;
  }
  function entrySummary(e) {
    if (e.kind === 'result') return (REASON[e.reason] || REASON.hp)[0](e.winner === mySeat);
    const lines = resultLines(e, mySeat);
    return lines.length ? lines.slice(0, 2).map(l => l[1]).join('，') : '无直接效果';
  }
  function renderHistory() {
    if (!el) return;
    const all = (target?.match?.history || shownView?.history || []).filter(e => e.n <= lastN);
    const vis = all.filter(entryVisible);
    const strip = $('.hs-tiles');
    const max = innerWidth < 720 ? 7 : 9;
    strip.innerHTML = vis.slice(-max).reverse().map(tileHtml).join('') || '<span class="hs-empty">—</span>';
    if (!histOpen) return;
    // Newest turn first; each turn has its header on top, its actions newest first.
    const groups = [];
    for (const e of all) {
      if (!groups.length || groups[groups.length - 1].turn !== e.turn) groups.push({ turn: e.turn, seat: null, items: [] });
      const g = groups[groups.length - 1];
      if (e.kind === 'turn') g.seat = e.seat;
      if (entryVisible(e)) g.items.push(e);
    }
    const rows = [];
    for (const g of groups.reverse()) {
      const seat = g.seat ?? g.items[0]?.seat;
      if (seat === undefined || seat === null) { if (!g.items.length) continue; }
      rows.push(`<div class="hist-sep ${seat === mySeat ? 'mine' : 'theirs'}">第 ${g.turn} 回合 · ${seat === mySeat ? '你' : '对手'}</div>`);
      for (const e of [...g.items].reverse()) rows.push(`<button type="button" class="hist-row ${e.seat === mySeat ? 'mine' : 'theirs'}" data-n="${e.n}">${tileHtml(e)}<span class="hr-text"><b>${esc(entryTitle(e))}</b><small>${esc(entrySummary(e))}</small></span></button>`);
      if (!g.items.length) rows.push('<p class="hist-none">没有打出牌</p>');
    }
    $('.hist-list').innerHTML = rows.join('') || '<p class="hist-empty">还没有行动。</p>';
  }
  function openHistory(open) {
    histOpen = open;
    $('.hist-panel').hidden = !open;
    $('.hist-backdrop').hidden = !open;
    el.classList.toggle('hist-open', open);
    if (open) { closeDetail(); renderHistory(); }
  }
  function openDetail(n) {
    const e = (target?.match?.history || []).find(x => x.n === n);
    if (!e) return;
    const box = $('.hist-detail');
    const lines = e.kind === 'result' ? [['mut', entrySummary(e)]] : resultLines(e, mySeat);
    const card = e.kind === 'play' ? { id: e.id, up: !!e.up, ...(e.g ? { g: e.g } : {}) } : null;
    box.innerHTML = `<button type="button" class="hd-back" data-b="detail-back">‹ 返回列表</button>
      <p class="hd-head ${e.seat === mySeat ? 'mine' : 'theirs'}">第 ${e.turn} 回合 · ${esc(entryTitle(e))}${e.kind === 'play' ? ` · 花费 ${CARDS[e.id]?.x ? 'X=' + (e.x ?? e.cost) : e.cost} 行动点` : ''}</p>
      ${card ? `<div class="hd-card">${miniFace(card, 1)}</div><p class="hd-desc">${highlightKeywords(esc(describe(card)).replace(/\n/g, '<br>'), true)}</p>` : ''}
      <ul class="hd-lines">${lines.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('') || '<li class="mut">无直接效果</li>'}</ul>`;
    box.hidden = false;
    requestAnimationFrame(() => box.classList.add('in'));
    histDetail = n;
  }
  function closeDetail() { const box = $('.hist-detail'); if (box) { box.hidden = true; box.classList.remove('in'); } histDetail = null; }
  function bindPanelSwipe() {
    const panel = $('.hist-panel');
    let sx = 0, sy = 0, on = false;
    panel.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; on = true; });
    panel.addEventListener('pointerup', e => {
      if (!on) return; on = false;
      if (e.clientX - sx < -60 && Math.abs(e.clientY - sy) < 50) openHistory(false);
    });
  }

  // ------------------------------------------------ detail sheet (long press)
  function openSheet(c) {
    if (!c || !el) return;
    const sh = $('.sheet');
    const s = clamp(Math.min((innerWidth - 40) / DW, (innerHeight * 0.52) / DH), 1, 1.6);
    const rules = keywordRules(describe(c));
    sh.innerHTML = `<div class="sheet-card">${miniFace(c, s)}</div><div class="sheet-text"><h3>${esc(cardName(c))}</h3><p>${highlightKeywords(esc(describe(c)).replace(/\n/g, '<br>'), true)}</p>${rules.map(([k, t]) => `<p class="rule"><b>${esc(k)}</b> ${esc(t)}</p>`).join('')}<p class="hint">点击任意处关闭</p></div>`;
    sh.hidden = false;
    selectedUid = null; layoutHand();
  }

  // ------------------------------------------------ result
  function showResult(v) {
    if (resultShown || !el) { return; }
    resultShown = true;
    ctx.notice("");
    if (histOpen) openHistory(false);
    $('.sheet').hidden = true;
    $('.hand-actions').hidden = true;
    selectedUid = null;
    const win = v.winner === mySeat, draw = v.winner === null;
    const st = v.stats || [{}, {}], me = st[mySeat] || {}, op = st[1 - mySeat] || {};
    const reason = v.endReason || (draw ? 'draw' : 'hp');
    const why = (REASON[reason] || REASON.hp)[0](win);
    const best = b => b ? `${b.damage}<small>${esc(cardName({ id: b.id, up: b.up }))}</small>` : '—';
    const box = $('.result');
    box.className = `result ${draw ? 'draw' : win ? 'win' : 'lose'}`;
    box.innerHTML = `<div class="res-rays"></div><div class="res-inner">
      <div class="emblem-big"><svg viewBox="0 0 120 120" aria-hidden="true"><polygon points="60,6 110,33 110,87 60,114 10,87 10,33" /><polygon class="in" points="60,18 99,39 99,81 60,102 21,81 21,39"/>${!win && !draw ? '<path class="crack" d="M60 18 L54 44 L66 58 L50 76 L58 102 M66 58 L84 66 M54 44 L36 40"/>' : ''}</svg><b>${draw ? '平局' : win ? '胜利' : '失败'}</b></div>
      <p class="res-why">${esc(why)}</p>
      <table class="res-stats"><thead><tr><th></th><th>你</th><th>对手</th></tr></thead><tbody>
        <tr><th>回合数</th><td>${me.turns ?? '—'}</td><td>${op.turns ?? '—'}</td></tr>
        <tr><th>造成伤害</th><td>${me.dealt ?? 0}</td><td>${op.dealt ?? 0}</td></tr>
        <tr><th>承受伤害</th><td>${me.taken ?? 0}</td><td>${op.taken ?? 0}</td></tr>
        <tr><th>打出牌数</th><td>${me.plays ?? 0}</td><td>${op.plays ?? 0}</td></tr>
        <tr><th>最高单次伤害</th><td>${best(me.best)}</td><td>${best(op.best)}</td></tr>
      </tbody></table>
      ${v.hasHistory === false ? '<p class="res-note">这局开始于旧版本，统计只含更新后的部分。</p>' : ''}
      <div class="res-rematch" aria-live="polite"></div>
      <div class="res-actions"><button type="button" data-b="new-room">新建房间</button><button type="button" data-b="view-log">查看战报</button><button type="button" data-b="back">返回</button></div></div>`;
    box.hidden = false;
    renderRematch();
    el.classList.toggle('lost', !win && !draw);
    if (!RM()) burst(box, win && !draw);
    playSfx(draw ? 'turnEnd' : win ? 'victory' : 'defeat');
    if (!win && !draw) setTimeout(() => playSfx('hitHeavy'), 120);
  }
  // 再来一局: both players agree, the same room starts a new match (see api.mjs rematch).
  function renderRematch() {
    const box = $('.res-rematch');
    if (!box || !room) return;
    const rm = room.rematch, opp = room.members?.find(m => m.seat !== mySeat), me = room.members?.find(m => m.seat === mySeat);
    const oppLeft = !opp || opp.left || rm?.status === 'left';
    const key = JSON.stringify([rm, oppLeft, me?.left, rematchBusy]);
    if (key === lastRematchKey) return;
    const prev = lastRematchKey;
    lastRematchKey = key;
    const incoming = rm?.status === 'pending' && rm.from !== mySeat;
    const dis = rematchBusy ? ' disabled' : '';
    let html;
    if (oppLeft) html = `<p class="rm-msg bad">对手已离开房间，可以新建房间或返回。</p>`;
    else if (incoming) html = `<p class="rm-msg hot">对手想再来一局 <span class="rm-count"></span></p><div class="rm-btns"><button type="button" class="primary" data-b="rm-accept"${dis}>接受</button><button type="button" data-b="rm-decline"${dis}>拒绝</button></div>`;
    else if (rm?.status === 'pending') html = `<p class="rm-msg wait"><i class="rm-spin"></i>等待对手… <span class="rm-count"></span></p><div class="rm-btns"><button type="button" data-b="rm-cancel"${dis}>取消</button></div>`;
    else {
      const note = !rm ? '' : rm.status === 'declined' ? (rm.by === mySeat ? '你拒绝了再来一局。' : '对手拒绝了再来一局。')
        : rm.status === 'cancelled' ? (rm.by === mySeat ? '你取消了请求。' : '对手取消了请求。')
        : rm.status === 'expired' ? (rm.from === mySeat ? '对手没有回应，请求已超时。' : '请求已超时。') : '';
      html = `${note ? `<p class="rm-msg bad">${note}</p>` : ''}<div class="rm-btns"><button type="button" class="primary rm-main" data-b="rm-request"${dis}>再来一局</button></div>`;
    }
    box.innerHTML = html;
    tickRematch();
    if (incoming && !prev.includes('"pending"')) {
      playSfx('reward');
      if ($('.result').hidden) { ctx.notice('对手想再来一局，点「结果」回应'); $('.reopen')?.classList.add('hot'); }
    }
    if (!incoming) $('.reopen')?.classList.remove('hot');
  }
  function tickRematch() {
    const c = $('.res-rematch .rm-count'), exp = room?.rematch?.expiresAt;
    if (c) c.textContent = exp ? fmtClock(exp - (Date.now() + skew)) : '';
  }
  async function rematch(op) {
    if (rematchBusy || !ctx.rematch) return;
    rematchBusy = true; renderRematch();
    try { await ctx.rematch(op, round); } finally { rematchBusy = false; if (el) renderRematch(); }
  }
  function burst(box, win) {
    const n = win ? 26 : 12;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const a = (i / n) * Math.PI * 2, d = (win ? 150 : 90) + Math.random() * 80;
      s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
      s.style.animationDelay = `${Math.random() * 0.15}s`;
      box.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }
  }

  // ------------------------------------------------ clicks
  async function onClick(ev) {
    const sheet = ev.target.closest('.sheet');
    if (sheet) { sheet.hidden = true; return; }
    const mini = ev.target.closest('.tcard, .pcard');
    if (mini && !ev.target.closest('.hist-panel')) { openSheet({ id: mini.dataset.card, up: mini.dataset.up === '1' }); return; }
    const row = ev.target.closest('.hist-row');
    if (row) { openDetail(+row.dataset.n); return; }
    if (ev.target.closest('.hist-backdrop')) { openHistory(false); return; }
    const b = ev.target.closest('[data-b]');
    if (!b) { $('.menu-pop').hidden = true; return; }
    const k = b.dataset.b;
    if (k !== 'menu') $('.menu-pop').hidden = true;
    if (k === 'menu') { const m = $('.menu-pop'); m.hidden = !m.hidden; }
    else if (k === 'hist') openHistory(true);
    else if (k === 'hist-close') openHistory(false);
    else if (k === 'detail-back') closeDetail();
    else if (k === 'play') { const uid = selectedUid; if (uid) tryPlay(uid, handEls.get(uid)); }
    else if (k === 'cancel') { selectedUid = null; layoutHand(); }
    else if (k === 'detail') { const c = handCards.find(x => x.uid === selectedUid); openSheet(c); }
    else if (k === 'end') {
      if (!live() || busy || pumping || pendingPlay) return;
      endPending = true; selectedUid = null;
      playSfx('turnEnd');
      renderTurn(shownView);
      const ok = await ctx.send({ type: 'end' });
      if (!ok) { endPending = false; renderTurn(shownView); }
    }
    else if (k.startsWith('trait-')) {
      const h = heroes[k === 'trait-me' ? mySeat : 1 - mySeat];
      if (h.trait) ctx.notice(`${h.trait.name}：${h.trait.text}`);
    }
    else if (k === 'concede') { if (confirm('确认认输？本局判负。')) await ctx.send({ type: 'concede' }); }
    else if (k === 'leave') { if (shownView?.status !== 'active' || confirm('对局进行中，退出房间会直接判负。确认退出？')) ctx.leave(); }
    else if (k === 'new-room') ctx.newRoom();
    else if (k === 'rm-request') rematch('request');
    else if (k === 'rm-accept') rematch('accept');
    else if (k === 'rm-decline') rematch('decline');
    else if (k === 'rm-cancel') rematch('cancel');
    else if (k === 'back') ctx.leave();
    else if (k === 'view-log') { $('.result').hidden = true; resultDismissed = true; openHistory(true); addReopen(); }
    else if (k === 'reopen-result') { $('.result').hidden = false; b.classList.remove('hot'); if (histOpen) openHistory(false); }
  }
  function addReopen() {
    if ($('.reopen')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'reopen'; b.dataset.b = 'reopen-result'; b.textContent = '结果';
    el.appendChild(b);
  }

  return { show, hide, isAnimating, faceHtml };
}
