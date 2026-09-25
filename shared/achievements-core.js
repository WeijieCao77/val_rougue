// Achievements (成就) shared by both demos: storage, the per-run memory that
// turns engine transitions into concrete moments, evaluation, and the small
// pieces of UI (unlock toast, hall page, results list, worn title).
//
// Each demo supplies a *view* adapter (engine state -> a plain normalized
// object, see VIEW below) and its own list of definitions. A definition is
//   { key, cat, name, desc, secret?, career?, reward?: { title }, test(ctx) }
// and `test` is a pure function of the context built for one transition:
//   ctx = { prev, next, action, raw, mem, fight, ended, hit, entered, runEnd, career }
// Nothing here changes game state or rules: it only reads before/after states.
// No imports: the Wa build packs this file as-is and the new demo loads it
// from /shared/achievements-core.js.
//
// VIEW (what an adapter returns; null when there is no run):
//   { runId, phase, inCombat, result: 'win'|'loss'|'abandon'|null, hp, maxHp,
//     money, act, floor, nodeKind, team, asc,
//     deck: [{ id, up, cost, type, tag, basic, curse, upgradable, role }],
//     gear: [ids], gearMax, supplies, supplyMax,
//     combat: null | { turn, plays, block, encounter, kind, bossId, warmup,
//       enemies: [{ uid, id, hp, maxHp, boss, elite, aim, block, weak, trait, traitState, intent }],
//       hand: [{ uid, id, type, cost }] } }

export const ACH_BOOK_VERSION = 1;

const clone = v => JSON.parse(JSON.stringify(v));
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

function readJson(storage, key, fallback) {
  try { const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ---------------------------------------------------------------- book
// The saved book: what is unlocked (with when and in which run), the worn
// title, and a small career record of facts (not grind counters).
export function emptyCareer() {
  return { runs: 0, wins: 0, losses: 0, lossStreak: 0, streakBeforeWin: 0, teamWins: {}, bossWins: {}, bossLosses: {}, fastestWinMs: null, seeded: false };
}
export function emptyBook() {
  return { v: ACH_BOOK_VERSION, unlocked: {}, order: [], worn: null, career: emptyCareer() };
}
export function normalizeBook(raw) {
  const book = emptyBook();
  if (!raw || typeof raw !== 'object') return book;
  if (raw.unlocked && typeof raw.unlocked === 'object') {
    for (const [k, v] of Object.entries(raw.unlocked)) if (typeof k === 'string' && v && typeof v === 'object') book.unlocked[k] = { at: num(v.at) || null, run: v.run == null ? null : String(v.run), label: typeof v.label === 'string' ? v.label : '' };
  }
  const order = Array.isArray(raw.order) ? raw.order.filter(k => book.unlocked[k]) : [];
  book.order = [...new Set([...order, ...Object.keys(book.unlocked)])];
  book.worn = typeof raw.worn === 'string' ? raw.worn : null;
  const c = raw.career && typeof raw.career === 'object' ? raw.career : {};
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  book.career = { ...emptyCareer(), runs: num(c.runs), wins: num(c.wins), losses: num(c.losses), lossStreak: num(c.lossStreak), streakBeforeWin: num(c.streakBeforeWin), teamWins: obj(c.teamWins), bossWins: obj(c.bossWins), bossLosses: obj(c.bossLosses), fastestWinMs: c.fastestWinMs == null ? null : num(c.fastestWinMs), seeded: !!c.seeded };
  return book;
}
export function loadBook(storage, key) { return normalizeBook(readJson(storage, key, null)); }
export function saveBook(storage, key, book) { return writeJson(storage, key, book); }

// A book made before any run was tracked learns what the run history already
// holds (wins per team and difficulty, fastest win), once.
export function seedCareer(career, history = []) {
  if (career.seeded) return career;
  const out = { ...career, teamWins: { ...career.teamWins }, seeded: true };
  const list = [...history].filter(e => e && e.outcome !== 'abandon').sort((a, b) => num(a.endedAt) - num(b.endedAt));
  for (const e of list) {
    out.runs++;
    if (e.outcome === 'win') {
      out.wins++;
      out.streakBeforeWin = Math.max(out.streakBeforeWin, out.lossStreak);
      out.lossStreak = 0;
      const team = e.teamId;
      if (team) out.teamWins[team] = Math.max(out.teamWins[team] ?? -1, num(e.ascension));
      if (e.durationMs != null && (out.fastestWinMs == null || e.durationMs < out.fastestWinMs)) out.fastestWinMs = num(e.durationMs);
    } else { out.losses++; out.lossStreak++; }
  }
  return out;
}

// Records the keys (known defs only, never twice). Returns the fresh defs.
export function unlockKeys(book, defs, keys, meta = {}) {
  const byKey = new Map(defs.map(d => [d.key, d]));
  const fresh = [];
  for (const key of keys) {
    const d = byKey.get(key);
    if (!d || book.unlocked[key]) continue;
    book.unlocked[key] = { at: meta.at ?? Date.now(), run: meta.run == null ? null : String(meta.run), label: meta.label || '' };
    book.order.push(key);
    fresh.push(d);
  }
  return fresh;
}

// ---------------------------------------------------------------- run memory
export function newRunMemory(runId, now = Date.now()) {
  return {
    runId: String(runId), startedAt: now, fight: null, lastFight: null, shop: null,
    run: { fightsWon: 0, elitesWon: 0, elitesFought: 0, bossesWon: [], shopsVisited: 0, removed: 0, sold: 0, flags: {} },
    acts: {}, unlocked: []
  };
}
export function actMemory(mem, act) {
  const k = String(act || 1);
  if (!mem.acts[k]) mem.acts[k] = { rest: 0, event: 0, shop: 0, elite: 0, battle: 0, boss: 0, crate: 0, eliteWins: 0 };
  return mem.acts[k];
}
function newFight(v, partial = false) {
  const c = v.combat || {};
  return {
    kind: c.kind || 'battle', encounter: c.encounter ?? null, bossId: c.bossId ?? null, enemyIds: (c.enemies || []).map(e => e.id),
    act: v.act, floor: v.floor, hpStart: v.hp, maxHp: v.maxHp, hpLost: 0, turn: c.turn ?? 1,
    kills: 0, turnKills: 0, turnDamage: 0, maxTurnKills: 0, maxTurnDamage: 0, maxCardDamage: 0,
    maxPlays: 0, maxBlock: 0, played: 0, types: {}, flags: {}, warmup: !!c.warmup, partial
  };
}

// Folds one transition into the run memory. `observe(ctx)` (per demo) may add
// fight/run flags before a fight is closed. Returns what happened this step.
export function stepMemory(mem0, prev, next, action, { now = Date.now(), raw = {}, observe } = {}) {
  const mem = mem0 && next && mem0.runId === String(next.runId) ? clone(mem0) : newRunMemory(next?.runId ?? 'none', now);
  const hit = { damage: 0, kills: 0, card: null };
  let ended = null, entered = null, runEnd = null;
  if (!next) return { mem, hit, ended, entered, runEnd };
  const wasIn = !!prev?.inCombat, isIn = !!next.inCombat;
  if (isIn && (!wasIn || !mem.fight)) mem.fight = newFight(next, wasIn);
  const f = mem.fight;
  if (wasIn && prev.combat) {
    const won = !isIn && next.hp > 0 && (next.result == null || next.result === 'win');
    const after = new Map((next.combat?.enemies || []).map(e => [e.uid, e]));
    for (const e of prev.combat.enemies || []) {
      if (!(e.hp > 0)) continue;
      const n = after.get(e.uid) || (won ? { hp: 0 } : null);
      if (!n) continue;
      const d = e.hp - Math.max(0, n.hp);
      if (d > 0) hit.damage += d;
      if (n.hp <= 0) hit.kills++;
    }
    if (action?.type === 'play') hit.card = (prev.combat.hand || []).find(c => c.uid === action.uid) || null;
  }
  const ctx = { prev, next, action, raw, mem, fight: f, hit };
  if (f && wasIn) {
    f.hpLost += Math.max(0, num(prev.hp) - num(next.hp));
    f.kills += hit.kills;
    f.turnKills += hit.kills;
    f.turnDamage += hit.damage;
    f.maxTurnKills = Math.max(f.maxTurnKills, f.turnKills);
    f.maxTurnDamage = Math.max(f.maxTurnDamage, f.turnDamage);
    if (hit.card) {
      f.played++;
      f.types[hit.card.type || 'other'] = (f.types[hit.card.type || 'other'] || 0) + 1;
      f.maxCardDamage = Math.max(f.maxCardDamage, hit.damage);
    }
  }
  if (f && next.combat && isIn) {
    f.maxPlays = Math.max(f.maxPlays, num(next.combat.plays));
    f.maxBlock = Math.max(f.maxBlock, num(next.combat.block));
  }
  try { observe?.(ctx); } catch {}
  if (f && next.combat && isIn && next.combat.turn !== f.turn) { f.turn = next.combat.turn; f.turnKills = 0; f.turnDamage = 0; }
  if (f && wasIn && !isIn) {
    const outcome = next.result === 'abandon' ? 'abandon' : next.hp > 0 && next.result !== 'loss' ? 'win' : 'loss';
    ended = { ...f, outcome, hpEnd: next.hp, turns: prev.combat?.turn ?? f.turn };
    mem.lastFight = ended;
    mem.fight = null;
    if (outcome === 'win') {
      mem.run.fightsWon++;
      if (ended.kind === 'elite') { mem.run.elitesWon++; actMemory(mem, ended.act).eliteWins++; }
      if (ended.kind === 'boss' && ended.bossId) mem.run.bossesWon.push(ended.bossId);
    }
  }
  if (prev && prev.phase === 'map' && next.phase !== 'map' && next.nodeKind) {
    entered = next.nodeKind;
    const a = actMemory(mem, next.act);
    a[entered] = (a[entered] || 0) + 1;
    if (entered === 'elite') mem.run.elitesFought++;
    if (entered === 'shop') mem.run.shopsVisited++;
  }
  if (next.phase === 'shop') {
    if (prev?.phase !== 'shop' || !mem.shop) mem.shop = { spent: 0 };
    else mem.shop.spent += Math.max(0, num(prev.money) - num(next.money));
  } else mem.shop = null;
  if (action?.type === 'remove') mem.run.removed++;
  if (action?.type === 'sellRelic' || action?.type === 'sellGear') mem.run.sold++;
  if (prev && prev.phase !== 'result' && next.phase === 'result') runEnd = next.result || 'loss';
  return { mem, hit, ended, entered, runEnd };
}

// Career facts at the end of a run (abandoned runs change nothing).
export function updateCareer(career, { runEnd, next, mem, now = Date.now() }) {
  const c = { ...career, teamWins: { ...career.teamWins }, bossWins: { ...career.bossWins }, bossLosses: { ...career.bossLosses } };
  if (!runEnd || runEnd === 'abandon') return c;
  c.runs++;
  if (runEnd === 'win') {
    c.wins++;
    c.streakBeforeWin = Math.max(c.streakBeforeWin, c.lossStreak);
    c.lastStreakBeforeWin = c.lossStreak;
    c.lossStreak = 0;
    if (next?.team) c.teamWins[next.team] = Math.max(c.teamWins[next.team] ?? -1, num(next.asc));
    const ms = mem?.startedAt ? now - mem.startedAt : null;
    if (ms != null && ms > 0 && (c.fastestWinMs == null || ms < c.fastestWinMs)) c.fastestWinMs = ms;
  } else {
    c.losses++;
    c.lossStreak++;
    const lf = mem?.lastFight;
    if (lf && lf.outcome === 'loss' && lf.kind === 'boss' && lf.bossId) c.bossLosses[lf.bossId] = (c.bossLosses[lf.bossId] || 0) + 1;
  }
  return c;
}

// Tests every locked definition against ctx; unlocks the ones that pass.
export function evaluate(defs, ctx, book, meta = {}) {
  const fresh = [];
  for (const d of defs) {
    if (book.unlocked[d.key]) continue;
    if (meta.careerOnly && !d.career) continue;
    let ok = false;
    try { ok = !!d.test(ctx); } catch { ok = false; }
    if (ok) fresh.push(...unlockKeys(book, defs, [d.key], meta));
  }
  return fresh;
}

// One engine transition: update memory and career, evaluate, return fresh unlocks.
export function achStep({ defs, book, mem, prev, next, action, raw = {}, observe, now = Date.now(), label = '' }) {
  const s = stepMemory(mem, prev, next, action, { now, raw, observe });
  if (s.ended && s.ended.outcome === 'win' && s.ended.kind === 'boss' && s.ended.bossId) {
    book.career = { ...book.career, bossWins: { ...book.career.bossWins, [s.ended.bossId]: (book.career.bossWins[s.ended.bossId] || 0) + 1 } };
  }
  if (s.runEnd) book.career = updateCareer(book.career, { runEnd: s.runEnd, next, mem: s.mem, now });
  const ctx = { prev, next, action, raw, mem: s.mem, fight: s.mem.fight, ended: s.ended, hit: s.hit, entered: s.entered, runEnd: s.runEnd, career: book.career };
  const fresh = evaluate(defs, ctx, book, { at: now, run: next?.runId ?? null, label });
  if (fresh.length) s.mem.unlocked = [...new Set([...(s.mem.unlocked || []), ...fresh.map(d => d.key)])];
  return { book, mem: s.mem, fresh, ctx };
}

// Career definitions only, from the book alone (e.g. when the hall opens).
export function evaluateCareer(defs, book, now = Date.now()) {
  return evaluate(defs, { career: book.career, prev: null, next: null, mem: null, fight: null, ended: null, hit: { damage: 0, kills: 0, card: null }, entered: null, runEnd: null, action: null, raw: {} }, book, { at: now, run: null, label: '生涯记录', careerOnly: true });
}

// ---------------------------------------------------------------- small helpers for definitions
export const wonFight = ctx => ctx.ended?.outcome === 'win';
export const wonKind = (ctx, kind) => wonFight(ctx) && ctx.ended.kind === kind;
export const wonBoss = (ctx, id) => wonKind(ctx, 'boss') && (!id || ctx.ended.bossId === id);
export const deckOf = ctx => ctx.next?.deck || [];
export const costAtLeast = (card, n) => card.cost === 'x' || (typeof card.cost === 'number' && card.cost >= n);

// ---------------------------------------------------------------- titles
export function earnedTitles(defs, book) {
  const byKey = new Map(defs.map(d => [d.key, d]));
  return book.order.map(k => byKey.get(k)?.reward?.title).filter(Boolean);
}
export function wornTitle(defs, book) {
  const all = earnedTitles(defs, book);
  return book.worn && all.includes(book.worn) ? book.worn : all[all.length - 1] || null;
}
export function wearTitle(defs, book, title) {
  if (title === null) { book.worn = null; return true; }
  if (!earnedTitles(defs, book).includes(title)) return false;
  book.worn = title;
  return true;
}

// ---------------------------------------------------------------- UI (browser only when called)
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TROPHY = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M9 17h6"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
export const rewardText = d => (d?.reward?.title ? `称号「${d.reward.title}」` : '');
const dateText = at => (at ? new Date(at).toLocaleDateString('zh-CN') : '');

// Non-blocking unlock toasts at the top of the screen, one after another.
export function showAchToasts(list, { delay = 0, sound = true } = {}) {
  if (!list?.length || typeof document === 'undefined') return;
  const go = () => {
    let host = document.getElementById('ach-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ach-toasts';
      host.className = 'ach-toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.append(host);
    }
    list.forEach((d, i) => setTimeout(() => {
      const el = document.createElement('div');
      el.className = `ach-toast${d.secret ? ' is-secret' : ''}`;
      el.innerHTML = `<span class="ach-toast-icon">${TROPHY}</span><span class="ach-toast-text"><small>${d.secret ? '隐藏成就解锁' : '成就解锁'}</small><b>${esc(d.name)}</b><em>${esc(d.desc)}</em>${d.reward?.title ? `<i class="ach-toast-reward">${esc(rewardText(d))}</i>` : ''}</span>`;
      el.addEventListener('click', () => dismiss());
      host.append(el);
      requestAnimationFrame(() => el.classList.add('is-in'));
      if (sound) try { globalThis.gameSfx?.play?.('achieve'); } catch {}
      let gone = false;
      function dismiss() { if (gone) return; gone = true; el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 320); }
      setTimeout(dismiss, 4200);
    }, i * 700));
  };
  if (delay > 0) setTimeout(go, delay); else go();
}

// The hall (成就页): summary, worn title, then each category with progress.
export function hallHtml(defs, cats, book, { note = '' } = {}) {
  const total = defs.length, got = defs.filter(d => book.unlocked[d.key]).length;
  const titles = earnedTitles(defs, book), worn = wornTitle(defs, book);
  const titleRow = titles.length
    ? `<div class="ach-titles"><span class="ach-titles-label">佩戴称号</span>${[...new Set(titles)].map(t => `<button type="button" class="ach-title-chip${t === worn ? ' is-worn' : ''}" data-ach-wear="${esc(t)}" aria-pressed="${t === worn}">${esc(t)}</button>`).join('')}</div>`
    : '<p class="ach-note">解锁带称号的成就后，可以在这里选择佩戴，称号会显示在首页和结算页。</p>';
  const sections = cats.map(cat => {
    const list = defs.filter(d => d.cat === cat.key);
    if (!list.length) return '';
    const n = list.filter(d => book.unlocked[d.key]).length;
    const rows = list.map(d => {
      const u = book.unlocked[d.key];
      const hidden = d.secret && !u;
      return `<li class="ach-item${u ? ' is-done' : ''}${d.secret ? ' is-secret' : ''}">
        <span class="ach-item-icon">${u ? TROPHY : LOCK}</span>
        <span class="ach-item-body"><b>${hidden ? '？？？' : esc(d.name)}${d.secret ? '<small class="ach-tag">隐藏</small>' : ''}</b>
        <span class="ach-item-desc">${hidden ? '隐藏成就：达成后揭晓。' : esc(d.desc)}</span>
        ${d.reward?.title && !hidden ? `<span class="ach-item-reward">${esc(rewardText(d))}</span>` : ''}
        ${u ? `<span class="ach-item-when">${esc(dateText(u.at))}${u.label ? ` · ${esc(u.label)}` : ''}</span>` : ''}</span>
      </li>`;
    }).join('');
    return `<section class="ach-cat"><header><h3>${esc(cat.name)}</h3><span class="ach-cat-count">${n} / ${list.length}</span></header><div class="ach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${n}"><i style="width:${Math.round(n / list.length * 100)}%"></i></div><ul class="ach-list">${rows}</ul></section>`;
  }).join('');
  return `<div class="ach-hall"><div class="ach-summary"><div class="ach-total"><strong>${got}</strong><span>/ ${total} 已解锁</span></div><div class="ach-bar ach-bar-total"><i style="width:${total ? Math.round(got / total * 100) : 0}%"></i></div>${note ? `<p class="ach-note">${esc(note)}</p>` : ''}${titleRow}</div>${sections}</div>`;
}

// Wires the title chips inside a rendered hall. onChange(book) persists and re-renders.
export function bindHall(root, defs, book, onChange) {
  root?.querySelectorAll?.('[data-ach-wear]').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.dataset.achWear;
    wearTitle(defs, book, t);
    onChange?.(book);
  }));
}

// Results screen: what this run unlocked.
export function runAchievementsHtml(defs, book, runId) {
  const id = runId == null ? null : String(runId);
  const list = defs.filter(d => book.unlocked[d.key] && book.unlocked[d.key].run === id);
  if (!list.length) return '';
  return `<section class="ach-run"><h3 class="rm-h">本局解锁的成就 · ${list.length}</h3><ul class="ach-run-list">${list.map(d => `<li><span class="ach-item-icon">${TROPHY}</span><span><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>${d.reward?.title ? `<em>${esc(rewardText(d))}</em>` : ''}</span></li>`).join('')}</ul></section>`;
}

// Home / results: the worn title.
export function titleBadgeHtml(defs, book, extraClass = '') {
  const t = wornTitle(defs, book);
  return t ? `<p class="ach-badge ${extraClass}"><span>称号</span><b>${esc(t)}</b></p>` : '';
}
