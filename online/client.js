import { CARDS, cardName, compactLines, describe, SKINS, TACTICS } from '/pvp/content.js';
import { ACTS } from '/pvp/season-map.js';
import {
  loadAccount, saveAccount, getPendingProofCache, clearPendingProofCache,
  apiCreateAccount, apiGetAccount, apiResolvePending,
  apiCreateRoom, apiJoinRoom, apiGetRoom, apiReady, apiAction, apiLeaveRoom
} from '/pvp/helper.js';

const app = document.getElementById('pvp-app');
const noticeEl = document.getElementById('pvp-notice');
const dialog = document.getElementById('pvp-dialog');
const modal = document.getElementById('pvp-dialog-content');
const closeDialog = document.getElementById('pvp-close-dialog');

let token = null;
let account = null;
let room = null;
let screen = 'home';
let selectedCardUid = null;
let actionInFlight = false;
let pollTimer = null;
let pollFailures = 0;
let latestRoomKey = '';
let visibilityInstalled = false;
let pendingRetry = null;
let dialogResolve = null;

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(text) { noticeEl.textContent = text; noticeEl.style.display = text ? 'block' : 'none'; }
function showModal(title, html) {
  modal.innerHTML = `<h2 tabindex="-1">${title}</h2>${html}`;
  dialog.showModal();
  modal.querySelector('h2')?.focus({preventScroll:true});
  dialog.scrollTop = 0;
}
closeDialog.addEventListener('click', () => { dialog.close(); if (dialogResolve) { dialogResolve(null); dialogResolve = null; } });

function cardFace(c, compact = false) {
  const t = CARDS[c.id];
  if (!t) return '<div class="card-face"><span class="card-title">未知卡牌</span></div>';
  const name = cardName(c);
  const zone = t.zone;
  const tag = zone === 'exhaust' ? '消耗' : zone === 'temporary' ? '临时 · 消耗' : zone === 'exhaustEnd' ? '回合末消耗' : zone === 'power' ? '持续能力' : t.id.startsWith('CU') ? '跨比赛保留' : c.up ? '已训练' : t.player ? '选手牌' : '辅助牌';
  const role = t.player ? t.role : t.id.startsWith('CU') ? '隐患' : '行动';
  const lines = compact ? compactLines(c) : compactLines(c);
  const title = describe(c).replace(/\n/g, ' / ');
  return `<div class="card-face" title="${esc(title)}">
    <span class="card-cost">${t.cost === null ? '—' : t.cost}</span>
    <span class="card-title">${esc(name)}</span>
    <span class="card-portrait" aria-hidden="true"><span class="portrait-placeholder">${esc(role.charAt(0))}</span><span class="portrait-role">${esc(role)}</span></span>
    <b class="card-tactic">${esc(TACTICS[c.id]?.title || '')}</b>
    <span class="card-effect">${lines.map(line => `<span>${esc(line).replace(/(\d+)/g,'<strong>$1</strong>')}</span>`).join('')}</span>
    <span class="card-foot"><b class="${['exhaust','temporary','exhaustEnd'].includes(zone) ? 'exhaust-tag' : ''}">${tag}</b></span>
  </div>`;
}

function archiveCard(a, selected = false) {
  const actInfo = ACTS[a.snapshot.act - 1] || { name: `第${a.snapshot.act}赛段` };
  return `<article class="archive-card ${selected ? 'selected' : ''}" data-archive-id="${a.id}">
    <h3>${esc(a.name || `构筑 ${a.id.slice(-6)}`)}</h3>
    <p>第${a.snapshot.act}幕 · ${esc(actInfo.name)}</p>
    <dl>
      <dt>最大声望</dt><dd>${a.snapshot.maxHp}</dd>
      <dt>牌组</dt><dd>${a.snapshot.deck.length} 张</dd>
      <dt>皮肤</dt><dd>${a.snapshot.skins.length} 件</dd>
    </dl>
  </article>`;
}

function render() {
  if ((screen === 'lobby' || screen === 'game') && room && (room.status === 'active' || room.status === 'finished')) {
    screen = 'game';
  }
  if (screen === 'home') renderHome();
  else if (screen === 'archives') renderArchives();
  else if (screen === 'lobby') renderLobby();
  else if (screen === 'game') renderGame();

  if (room && (room.status === 'active' || room.status === 'waiting') && (screen === 'game' || screen === 'lobby')) {
    startPolling();
  } else {
    stopPolling();
  }
}

function renderHome() {
  const hasActiveRoom = room && (room.status === 'active' || room.status === 'waiting');
  const serverPending = account?.pending;
  const offlinePending = getPendingProofCache();
  const accountSummary = account ? `${account.archives.length}/10 个构筑` : '未连接';
  app.innerHTML = `
    <header class="pvp-header">
      <div class="brand">瓦demo · 登峰赛季 <span>好友 PvP</span></div>
      <nav>
        <button data-nav="archives">构筑库</button>
        <button data-nav="account">账号</button>
        <a href="/" class="nav-link">返回瓦demo</a>
        ${globalThis.DEMO_CONFIG?.newDemoEnabled === true ? `<a href="/new/" class="nav-link">新demo</a>` : ''}
      </nav>
    </header>
    <main class="pvp-main home-main">
      <h1>好友真人 PvP</h1>
      <p class="subtitle">选择你的同幕构筑，创建房间或加入朋友码。</p>
      ${hasActiveRoom ? `<div class="continue-room"><strong>你有进行中的房间</strong><button data-action="resume-room">继续（${esc(room.code)}）</button></div>` : ''}
      ${serverPending ? `<div class="pending-banner"><strong>云端待处理保存</strong> 第${serverPending.snapshot.act}幕 · ${serverPending.snapshot.maxHp}声望<button data-action="resolve-server-pending">处理</button></div>` : ''}
      ${offlinePending ? `<div class="pending-banner"><strong>离线保存待处理</strong> 第${offlinePending.act}幕 · ${offlinePending.checkpoint.maxHp}声望<button data-action="offline-proof">处理</button></div>` : ''}
      <section class="quick-actions">
        <button class="primary" data-action="start-create">创建房间</button>
        <button data-action="start-join">加入朋友码</button>
        <button data-action="manage-account">账号凭证</button>
      </section>
      <section class="hero-tip">
        <p>${accountSummary}。需要先在瓦demo中完成赛段并云端保存，之后这里可选构筑开局。</p>
        <p>同幕、同版本才能对战；PvP 胜负不改存档。</p>
      </section>
    </main>`;
}

function renderArchives() {
  const serverPending = account?.pending;
  const offlinePending = getPendingProofCache();
  app.innerHTML = `
    <header class="pvp-header">
      <div class="brand">瓦demo · 登峰赛季 <span>构筑库</span></div>
      <button data-nav="home">返回</button>
    </header>
    <main class="pvp-main">
      <h2>云端构筑库（已用 ${account?.archives.length || 0}/10）</h2>
      ${serverPending ? `<div class="pending-banner"><strong>云端待处理保存</strong> 第${serverPending.snapshot.act}幕 · ${serverPending.snapshot.maxHp}声望<button data-action="resolve-server-pending">处理</button></div>` : ''}
      ${offlinePending ? `<div class="pending-banner"><strong>离线保存待处理</strong> 第${offlinePending.act}幕 · ${offlinePending.checkpoint.maxHp}声望<button data-action="offline-proof">处理</button></div>` : ''}
      <div class="archive-grid">
        ${(account?.archives || []).length ? account.archives.map(a => archiveCard(a)).join('') : '<p class="empty">暂无云端构筑。去瓦demo完成赛段后自动保存。</p>'}
      </div>
    </main>`;
}

function renderLobby() {
  const mySeat = room?.seat ?? 0;
  const myMember = room?.members?.[mySeat];
  const ready = myMember?.ready;
  app.innerHTML = `
    <header class="pvp-header">
      <div class="brand">好友 PvP <span>${esc(room?.code || '')}</span></div>
      <button data-action="leave-room">退出房间</button>
    </header>
    <main class="pvp-main lobby-main">
      <section class="room-panel">
        <h2>房间 ${esc(room?.code || '')}</h2>
        <div class="room-members">
          ${room?.members?.map(m => `<div class="member ${m.ready ? 'ready' : ''}"><span class="name">${esc(m.name || '玩家')}</span><span class="act">第${m.act}幕</span><span class="deck">${m.deckCount}张</span><span class="maxhp">${m.maxHp}声望</span><span class="ready">${m.ready ? '已准备' : '未准备'}</span></div>`).join('') || '<p>等待成员加入...</p>'}
        </div>
        <p class="hint">构筑在加入时锁定，如需更换请退出房间。</p>
        ${room?.status === 'waiting' ? `<button class="primary" data-action="ready-toggle">${ready ? '取消准备' : '准备'}</button>` : ''}
        <p class="friend-code">朋友码：<strong>${esc(room?.code || '')}</strong> <button data-action="copy-code">复制</button></p>
      </section>
    </main>`;
}

function renderGame() {
  const view = room?.match;
  if (!view) {
    app.innerHTML = `<header class="pvp-header"><div class="brand">好友 PvP</div></header><main class="pvp-main"><p class="error">牌局数据不可用。</p></main>`;
    return;
  }
  const mySeat = room.seat;
  const isMyTurn = view.status === 'active' && view.active === mySeat;
  const me = view.you;
  const opp = view.opponent;
  const cards = me.hand || [];
  const selected = cards.find(c => c.uid === selectedCardUid);
  const targetHint = selected ? '点击对手或我方目标，然后点打出' : '选择一张手牌';
  const finished = view.status === 'finished';
  const resultText = finished ? (view.winner === mySeat ? '胜利' : view.winner === null ? '平局' : '失败') : '';
  app.innerHTML = `
    <header class="pvp-header">
      <div class="brand">好友 PvP <span>回合 ${view.turn}</span></div>
      <div class="status">${finished ? `已结束 · ${resultText}` : isMyTurn ? '你的回合' : '等待对方...'}</div>
      <button data-action="leave-room">退出房间</button>
    </header>
    <main class="pvp-main game-main">
      <section class="opponent-panel">
        <h3>${esc(room.members?.find(m => m.seat !== mySeat)?.name || '对手')}</h3>
        <p>手牌 ${opp.handCount} 张 · 抽牌堆 ${opp.drawCount}</p>
        <p>声望 ${opp.hp}/${opp.maxHp} · 布防 ${opp.block}${opp.weak ? ` · 压制 ${opp.weak}` : ''}${opp.vulnerable ? ` · 易伤 ${opp.vulnerable}` : ''}</p>
        <div class="opp-hand-stub">${Array.from({ length: Math.min(opp.handCount, 10) }).map(() => '<span class="card-back"></span>').join('')}</div>
      </section>
      <section class="battle-ground">
        ${finished ? `<div class="battle-result">${resultText}</div>` : ''}
        <div class="my-info">
          <h3>你</h3>
          <p>声望 ${me.hp}/${me.maxHp} · 布防 ${me.block}${me.weak ? ` · 压制 ${me.weak}` : ''}${me.vulnerable ? ` · 易伤 ${me.vulnerable}` : ''}</p>
          <p>行动点 ${me.energy} · 抽牌堆 ${me.drawCount}</p>
          <div class="powers">${(me.powers || []).map(p => `<span class="power-chip">${esc(cardName(p))}</span>`).join('')}</div>
        </div>
        <div class="log-box"><h4>战报</h4><ul>${(view.log || []).map(l => `<li><small>${esc(l)}</small></li>`).join('')}</ul></div>
      </section>
      <section class="hand-panel">
        <div class="hand-header">
          <span>手牌 ${cards.length} 张 · 弃牌堆 ${me.discard?.length || 0} · 消耗区 ${me.exhaust?.length || 0}</span>
          <span>${targetHint}</span>
          <span>${isMyTurn ? '可以操作' : '等待对方'}</span>
        </div>
        <div class="hand-cards" id="hand-cards">
          ${cards.length ? cards.map((c, i) => `<button class="hand-card-pvp ${selectedCardUid === c.uid ? 'selected' : ''}" data-card-uid="${c.uid}" style="--card-index:${i}">${cardFace(c, true)}</button>`).join('') : '<p class="empty-hand">手牌为空</p>'}
        </div>
        <div class="hand-actions">
          ${selected ? `<button class="secondary" data-action="clear-selection">取消</button><button class="primary" data-action="play-selected" ${!isMyTurn ? 'disabled' : ''}>打出</button>` : ''}
          <button class="primary" data-action="end-turn" ${!isMyTurn ? 'disabled' : ''}>结束回合</button>
          <button class="danger" data-action="concede" ${finished ? 'disabled' : ''}>认输</button>
        </div>
      </section>
    </main>`;
}

function roomKey(r) {
  if (!r) return '';
  return JSON.stringify({
    code: r.code,
    status: r.status,
    seat: r.seat,
    members: r.members?.map(m => [m.seat, m.ready, m.deckCount, m.maxHp]),
    match: r.match ? {
      rev: r.match.rev,
      status: r.match.status,
      active: r.match.active,
      winner: r.match.winner,
      turn: r.match.turn,
      you: {
        hp: r.match.you.hp, maxHp: r.match.you.maxHp, block: r.match.you.block,
        weak: r.match.you.weak, vulnerable: r.match.you.vulnerable,
        energy: r.match.you.energy, hand: r.match.you.hand?.map(c => c.uid),
        drawCount: r.match.you.drawCount, discardCount: r.match.you.discard?.length,
        exhaustCount: r.match.you.exhaust?.length, powers: r.match.you.powers
      },
      opponent: {
        hp: r.match.opponent.hp, maxHp: r.match.opponent.maxHp, block: r.match.opponent.block,
        weak: r.match.opponent.weak, vulnerable: r.match.opponent.vulnerable,
        handCount: r.match.opponent.handCount, drawCount: r.match.opponent.drawCount
      },
      log: r.match.log
    } : null
  });
}

function startPolling() {
  if (!visibilityInstalled) {
    visibilityInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') stopPolling();
      else if (room?.code && (room.status === 'active' || room.status === 'waiting')) startPolling();
    });
  }
  if (pollTimer) return;
  pollTimer = setInterval(pollRoom, 1000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollRoom() {
  if (!token || !room?.code) return;
  try {
    const res = await apiGetRoom(token, room.code);
    const fresh = res.room;
    if (!fresh) throw new Error('房间为空');
    const key = roomKey(fresh);
    if (key !== latestRoomKey) {
      latestRoomKey = key;
      room = fresh;
      render();
    } else {
      room = fresh;
    }
    pollFailures = 0;
  } catch (err) {
    pollFailures++;
    if (pollFailures <= 3) notice('网络重连中...');
    else notice('暂时无法同步，牌局保留，可继续尝试。');
  }
}

async function sendAction(command) {
  if (!token || !room?.code || actionInFlight) return;
  actionInFlight = true;
  try {
    if (!pendingRetry) {
      pendingRetry = {
        requestId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        expectedRev: room.match ? room.match.rev : 0,
        command
      };
    }
    const { requestId, expectedRev } = pendingRetry;
    const res = await apiAction(token, room.code, requestId, expectedRev, pendingRetry.command);
    room = res.room;
    latestRoomKey = roomKey(room);
    pendingRetry = null;
    selectedCardUid = null;
    render();
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) {
      pendingRetry = null;
      notice('操作被拒绝，牌局已更新，请重新选择操作。');
    } else {
      notice('操作失败：' + err.message + ' 可重试同一命令。');
    }
  } finally {
    actionInFlight = false;
  }
}

async function apiClaimArchive(token, runId, act, checkpoint, ownerToken) {
  try {
    const res = await fetch('/api/archive/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ run: runId, act })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || 'claim失败');
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

async function loadInitial() {
  token = loadAccount();
  if (!token) {
    try {
      token = await apiCreateAccount();
      if (!saveAccount(token)) throw new Error('无法保存凭证');
      notice('自动创建账号凭证成功。');
    } catch (err) {
      token = null;
      notice('无法创建账号：' + err.message);
    }
  }
  if (token) {
    try {
      account = await apiGetAccount(token);
      if (account.roomCode) {
        const res = await apiGetRoom(token, account.roomCode);
        room = res.room || null;
        latestRoomKey = roomKey(room);
      }
    } catch (err) {
      notice('获取账号数据失败：' + err.message);
    }
  }
  render();
}

// Event delegation for clicks
document.addEventListener('click', async e => {
  const btn = e.target.closest('button, a, article[data-archive-id]');
  if (!btn) return;

  if (btn.matches('[data-archive-id]')) {
    if (screen === 'archives') {
      const id = btn.dataset.archiveId;
      const archive = (account?.archives || []).find(a => a.id === id);
      if (archive) showArchiveDetail(archive);
    }
    return;
  }

  if (btn.dataset.nav) {
    const nav = btn.dataset.nav;
    if (nav === 'home') { screen = 'home'; stopPolling(); render(); }
    else if (nav === 'archives') { screen = 'archives'; stopPolling(); render(); }
    else if (nav === 'account') showAccountDialog();
    return;
  }

  if (btn.dataset.action) {
    const action = btn.dataset.action;
    if (action === 'start-create') showCreateDialog();
    else if (action === 'start-join') showJoinDialog();
    else if (action === 'resume-room') { if (room?.code) { screen = room.status === 'active' ? 'game' : 'lobby'; render(); } }
    else if (action === 'copy-code') { if (room?.code) { navigator.clipboard?.writeText(room.code); notice('已复制房间码'); } }
    else if (action === 'leave-room') await handleLeaveRoom();
    else if (action === 'ready-toggle') await handleReadyToggle();
    else if (action === 'resolve-server-pending') showResolvePendingDialog();
    else if (action === 'offline-proof') showOfflineProofDialog();
    else if (action === 'manage-account') showAccountDialog();
    else if (action === 'clear-selection') { selectedCardUid = null; render(); }
    else if (action === 'play-selected') {
      if (!selectedCardUid) return;
      const me = room?.match?.you;
      const card = me?.hand?.find(c => c.uid === selectedCardUid);
      if (card) {
        const def = CARDS[card.id];
        if (def && def.cost != null && def.cost > me.energy) {
          notice('费用不足，无法打出这张牌。');
          return;
        }
      }
      await sendAction({ type: 'play', uid: selectedCardUid });
    }
    else if (action === 'end-turn') await sendAction({ type: 'end' });
    else if (action === 'concede') { if (confirm('确认认输？')) await sendAction({ type: 'concede' }); }
    return;
  }

  const cardEl = e.target.closest('[data-card-uid]');
  if (cardEl && screen === 'game') {
    selectedCardUid = cardEl.dataset.cardUid;
    render();
    return;
  }
});

async function handleLeaveRoom() {
  if (!room?.code || !token) return;
  try {
    await apiLeaveRoom(token, room.code);
    room = null;
    latestRoomKey = '';
    stopPolling();
    screen = 'home';
    render();
  } catch (err) {
    notice('退出失败：' + err.message);
  }
}

async function handleReadyToggle() {
  if (!room?.code || !token) return;
  const mySeat = room.seat;
  const member = room.members?.[mySeat];
  const ready = !(member?.ready);
  const archiveId = member?.archiveId || null;
  try {
    const res = await apiReady(token, room.code, ready, archiveId);
    room = res.room;
    latestRoomKey = roomKey(room);
    render();
  } catch (err) {
    notice('准备失败：' + err.message);
  }
}

function showCreateDialog() {
  const archives = account?.archives || [];
  if (!archives.length) {
    showModal('无法创建', '<p>你没有云端构筑。请先在瓦demo中完成赛段并保存。</p>');
    return;
  }
  const groups = {};
  archives.forEach(a => {
    (groups[a.snapshot.act] = groups[a.snapshot.act] || []).push(a);
  });
  const html = `<p>选择要使用的构筑：</p>` +
    Object.entries(groups).map(([act, list]) => `<h4>第${act}幕</h4><div class="dialog-options">${list.map(a => `<button data-create-archive="${a.id}">${esc(a.name || '构筑')} · ${a.snapshot.maxHp}声望 · ${a.snapshot.deck.length}张</button>`).join('')}</div>`).join('');
  showModal('创建房间', html);
  modal.querySelectorAll('[data-create-archive]').forEach(btn => btn.addEventListener('click', async () => {
    try {
      const res = await apiCreateRoom(token, btn.dataset.createArchive);
      room = res.room;
      latestRoomKey = roomKey(room);
      screen = 'lobby';
      dialog.close();
      render();
    } catch (err) {
      notice('创建房间失败：' + err.message);
    }
  }));
}

function showJoinDialog() {
  if (!(account?.archives || []).length) {
    showModal('无法加入', '<p>你没有云端构筑。请先在瓦demo中完成赛段并保存。</p>');
    return;
  }
  showModal('加入房间', `
    <p>输入朋友码并选择你的同幕构筑。</p>
    <input id="join-code" placeholder="朋友码（6-8位）" maxlength="8" autocomplete="off">
    <div id="join-archives" class="dialog-options"></div>
    <div class="button-row"><button id="join-confirm" class="primary">加入</button></div>`);
  const codeInput = modal.querySelector('#join-code');
  const archiveBox = modal.querySelector('#join-archives');
  function renderJoinArchives(code) {
    if (!code) { archiveBox.innerHTML = '<p class="muted">输入朋友码后选择构筑。</p>'; return; }
    // We don't know act until joining; show all archives, server will reject mismatch.
    archiveBox.innerHTML = (account.archives || []).map(a => `<button data-join-archive="${a.id}">${esc(a.name || '构筑')} · 第${a.snapshot.act}幕</button>`).join('');
  }
  codeInput.addEventListener('input', () => renderJoinArchives(codeInput.value));
  archiveBox.addEventListener('click', e => {
    const b = e.target.closest('[data-join-archive]');
    if (b) {
      archiveBox.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    }
  });
  modal.querySelector('#join-confirm').addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const selectedBtn = archiveBox.querySelector('button.selected');
    if (!code || !selectedBtn) { notice('请输入朋友码并选择构筑'); return; }
    try {
      const res = await apiJoinRoom(token, code, selectedBtn.dataset.joinArchive);
      room = res.room;
      latestRoomKey = roomKey(room);
      screen = 'lobby';
      dialog.close();
      render();
    } catch (err) {
      notice('加入房间失败：' + err.message);
    }
  });
}

function showArchiveDetail(archive) {
  const deck = archive.snapshot.deck || [];
  const skins = archive.snapshot.skins || [];
  const html = `
    <p>第${archive.snapshot.act}幕 · 最大声望 ${archive.snapshot.maxHp} · 资金 ${archive.snapshot.money}</p>
    <h4>牌组（${deck.length}张）</h4>
    <div class="cards modal-cards">${deck.map(c => {
      const name = cardName(c);
      return `<article class="mini-card"><strong>${esc(name)}</strong> ${c.up ? '（已训练）' : ''}</article>`;
    }).join('')}</div>
    <h4>皮肤（${skins.length}件）</h4>
    <ul class="skin-list">${skins.map(id => `<li><strong>${esc(SKINS[id]?.name || id)}</strong>：${esc(SKINS[id]?.text || '')}</li>`).join('')}</ul>`;
  showModal('构筑详情', html);
}

function showAccountDialog() {
  showModal('账号凭证', `
    <p>你的账号凭证用于恢复好友 PvP 账号。不要发送给好友。</p>
    <button id="export-token" class="secondary">导出凭证</button>
    <details><summary>恢复凭证</summary>
      <p>粘贴完整 token（64位hex）并点击恢复。</p>
      <textarea id="account-import" rows="2" placeholder="64位hex token"></textarea>
      <button id="import-token" class="secondary">恢复</button>
    </details>`);
  modal.querySelector('#export-token').addEventListener('click', () => {
    const blob = new Blob([token || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wa-online-token.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  modal.querySelector('#import-token').addEventListener('click', async () => {
    const value = modal.querySelector('#account-import').value.trim();
    if (!/^[a-f0-9]{64}$/i.test(value)) { notice('凭证格式无效'); return; }
    try {
      // Validate token before saving
      const testAccount = await apiGetAccount(value);
      if (!testAccount) throw new Error('无效凭证');
      if (!saveAccount(value)) throw new Error('本地保存失败');
      token = value;
      dialog.close();
      notice('凭证已恢复，重新加载...');
      loadInitial();
    } catch (err) {
      notice('恢复失败：' + err.message);
    }
  });
}

function showResolvePendingDialog() {
  const pending = account?.pending;
  if (!pending) {
    notice('没有待处理的云端保存。');
    return;
  }
  const archives = account?.archives || [];
  const html = `
    <p>云端待处理保存：第${pending.snapshot.act}幕 · ${pending.snapshot.maxHp}声望 · ${pending.snapshot.deck.length}张牌</p>
    <p>选择要替换的构筑（替换将覆盖该构筑）：</p>
    <div class="dialog-options">${archives.map(a => `<button data-replace-id="${a.id}">${esc(a.name || '构筑')} · 第${a.snapshot.act}幕</button>`).join('')}</div>
    <div class="button-row">
      <button data-resolve="replace" class="primary">替换并保存</button>
      <button data-resolve="discard" class="danger">放弃待定</button>
    </div>`;
  showModal('处理云端待保存', html);
  let replaceId = null;
  modal.querySelectorAll('[data-replace-id]').forEach(btn => btn.addEventListener('click', () => {
    replaceId = btn.dataset.replaceId;
    modal.querySelectorAll('[data-replace-id]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }));
  modal.querySelector('[data-resolve="replace"]').addEventListener('click', async () => {
    if (!replaceId) { notice('请选择要替换的构筑'); return; }
    if (!confirm(`确认用待处理保存替换构筑 ${replaceId.slice(-6)}？此操作不可撤销。`)) return;
    await resolvePending({ decision: 'replace', archiveId: replaceId, expectedPendingId: pending.id });
  });
  modal.querySelector('[data-resolve="discard"]').addEventListener('click', async () => {
    if (!confirm('确定放弃云端待处理保存？')) return;
    await resolvePending({ decision: 'discard', expectedPendingId: pending.id });
  });
}

function showOfflineProofDialog() {
  const pending = getPendingProofCache();
  if (!pending) {
    notice('没有离线保存。');
    return;
  }
  const belongsToUs = pending.ownerToken ? token === pending.ownerToken : null;
  const html = `
    <p>离线保存：第${pending.act}幕 · ${pending.checkpoint.maxHp}声望 · ${pending.checkpoint.deck.length}张牌</p>
    ${pending.ownerToken ? (belongsToUs ? '<p>此保存属于当前账号。</p>' : '<p class="error">此保存属于其他账号，不能提交为当前账号。</p>') : '<p>此保存未标记归属，提交前请确认为当前账号。</p>'}
    <div class="button-row">
      ${(belongsToUs === true || belongsToUs === null) ? `<button id="offline-claim" class="primary">${belongsToUs === null ? '确认归属并提交' : '提交云端保存'}</button>` : ''}
      <button id="offline-discard" class="danger">放弃本地保存（保留云端）</button>
    </div>`;
  showModal('处理离线保存', html);
  const claimBtn = modal.querySelector('#offline-claim');
  if (claimBtn) claimBtn.addEventListener('click', async () => {
    try {
      const res = await apiClaimArchive(token, pending.run, pending.act, pending.checkpoint, pending.ownerToken);
      clearPendingProofCache();
      account = await apiGetAccount(token);
      dialog.close();
      notice('离线保存已提交，云端状态已更新。');
      render();
    } catch (err) {
      notice('提交失败：' + err.message);
    }
  });
  const discardBtn = modal.querySelector('#offline-discard');
  discardBtn.addEventListener('click', () => {
    if (confirm('确定放弃本地离线保存？云端数据不受影响。')) {
      clearPendingProofCache();
      dialog.close();
      notice('离线保存已放弃。');
      render();
    }
  });
}

async function resolvePending(decision) {
  try {
    await apiResolvePending(token, decision);
    account = await apiGetAccount(token);
    dialog.close();
    notice('云端待处理保存已处理。');
    render();
  } catch (err) {
    notice('处理失败：' + err.message);
  }
}

loadInitial();
