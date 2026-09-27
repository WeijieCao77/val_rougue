// Deck viewer for a cloud build (Hearthstone-style "view deck"): the cards as
// full faces, duplicates stacked with a count, a cost curve, a compact list
// strip, and a tap-to-inspect detail with the trained version beside it.
import { CARDS, cardName, describe, TACTICS, SKINS, REGIONS } from '/pvp/content.js';
import { faceHtml } from '/pvp/battle.js';
import { keywordRules, highlightKeywords } from '/shared/status-icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const costOf = c => { const t = CARDS[c.id]; return t?.x ? 'X' : t?.cost ?? null; };
const costKey = c => { const v = costOf(c); return v === null ? 99 : v === 'X' ? 50 : v; };
const photo = id => (CARDS[id]?.player ? `/assets/players/${id}.png` : '');
const REGION_NAME = { CN: '中国', AM: '美洲', EMEA: 'EMEA', PAC: '太平洋' };

// Same card twice (same id and training) is one stack with a count.
function stacks(deck) {
  const map = new Map();
  for (const c of deck) {
    const k = `${c.id}|${c.up ? 1 : 0}`;
    const s = map.get(k) || { card: { id: c.id, up: !!c.up }, n: 0 };
    s.n++; map.set(k, s);
  }
  return [...map.values()].filter(s => CARDS[s.card.id]).sort((a, b) => costKey(a.card) - costKey(b.card) || cardName(a.card).localeCompare(cardName(b.card), 'zh'));
}

function curveHtml(deck) {
  const buckets = [0, 1, 2, 3].map(v => ({ label: v === 3 ? '3+' : String(v), n: 0 }));
  let other = 0;
  for (const c of deck) { const v = costOf(c); if (typeof v === 'number') buckets[Math.min(3, v)].n++; else other++; }
  const max = Math.max(1, ...buckets.map(b => b.n));
  return `<div class="dv-curve" aria-label="费用分布">${buckets.map(b => `<div class="dv-bar"><b>${b.n}</b><i style="height:${Math.round(b.n / max * 100)}%"></i><span>${b.label}</span></div>`).join('')}${other ? `<div class="dv-bar dv-bar-x"><b>${other}</b><i style="height:${Math.round(other / max * 100)}%"></i><span>其他</span></div>` : ''}</div>`;
}

function detailHtml(card) {
  const t = CARDS[card.id];
  const trained = !card.up && t.upgraded ? { id: card.id, up: true } : null;
  const text = describe(card);
  const rules = keywordRules(text + (trained ? describe(trained) : ''));
  const tactic = TACTICS[card.id];
  return `<div class="dv-detail" role="dialog" aria-label="${esc(cardName(card))}">
    <div class="dv-detail-cards">
      <figure><span class="dv-big">${faceHtml(card, true)}</span><figcaption>${card.up ? '已训练' : '当前'}</figcaption></figure>
      ${trained ? `<figure class="dv-trained"><span class="dv-big">${faceHtml(trained, true)}</span><figcaption>训练后</figcaption></figure>` : ''}
    </div>
    <div class="dv-detail-text">
      <h3>${esc(cardName(card))}${tactic?.title ? ` · ${esc(tactic.title)}` : ''}</h3>
      <p class="dv-effect">${highlightKeywords(esc(text))}</p>
      ${trained ? `<p class="dv-effect dv-effect-up"><small>训练后</small>${highlightKeywords(esc(describe(trained)))}</p>` : ''}
      ${rules.map(([k, v]) => `<p class="dv-kw"><strong>${esc(k)}</strong>${esc(v)}</p>`).join('')}
      ${tactic?.scene ? `<p class="dv-scene">${esc(tactic.scene)}</p>` : ''}
    </div>
    <button type="button" class="dv-detail-close">关闭</button>
  </div>`;
}

export function openDeckView(archive) {
  const snap = archive.snapshot || {};
  const deck = snap.deck || [];
  const skins = snap.skins || [];
  const list = stacks(deck);
  const region = snap.region || deck.map(c => c.id.slice(0, 2)).find(p => ({ CN: 1, AM: 1, EU: 1, PA: 1 })[p]);
  const regionName = REGION_NAME[region] || REGIONS?.[region]?.name || '';
  const trainedCount = deck.filter(c => c.up).length;

  const root = document.createElement('div');
  root.className = 'dv';
  root.innerHTML = `
    <header class="dv-head">
      <button type="button" class="dv-back" aria-label="返回">‹ 返回</button>
      <div class="dv-title"><h2>${esc(archive.name || `第${snap.act}幕存档`)}</h2>
        <p>${regionName ? `${esc(regionName)} · ` : ''}第${snap.act}幕 · 最大声望 ${snap.maxHp} · 资金 ${snap.money}${Number.isInteger(snap.ascension) ? ` · 难度 ${snap.ascension}` : ''}</p></div>
    </header>
    <div class="dv-summary">
      <div class="dv-count"><b>${deck.length}</b><span>张牌</span><small>${trainedCount ? `已训练 ${trainedCount}` : '未训练'}</small></div>
      ${curveHtml(deck)}
      <div class="dv-toggle" role="tablist"><button type="button" class="on" data-mode="grid">卡牌</button><button type="button" data-mode="list">列表</button></div>
    </div>
    <div class="dv-body" data-mode="grid">
      <div class="dv-grid">${list.map((s, i) => `<button type="button" class="dv-card" data-i="${i}" aria-label="${esc(cardName(s.card))}${s.n > 1 ? ` ×${s.n}` : ''}"><span class="dv-face">${faceHtml(s.card)}</span>${s.n > 1 ? `<span class="dv-n">×${s.n}</span>` : ''}</button>`).join('')}</div>
      <ol class="dv-list">${list.map((s, i) => { const p = photo(s.card.id); const v = costOf(s.card); return `<li><button type="button" class="dv-row role-${esc(CARDS[s.card.id].player ? CARDS[s.card.id].role : 'tactic')}" data-i="${i}"${p ? ` style="--photo:url('${p}')"` : ''}><span class="dv-gem">${v === null ? '—' : v}</span><span class="dv-name">${esc(cardName(s.card))}</span><span class="dv-rn">${s.n > 1 ? `×${s.n}` : ''}</span></button></li>`; }).join('')}</ol>
    </div>
    <section class="dv-skins"><h3>皮肤 · ${skins.length} 件</h3>${skins.length ? `<ul>${skins.map(id => `<li><strong>${esc(SKINS[id]?.name || id)}</strong><span>${esc(SKINS[id]?.text || '')}</span></li>`).join('')}</ul>` : '<p>这份构筑没有携带皮肤。</p>'}</section>`;
  document.body.append(root);
  document.body.classList.add('dv-open');
  requestAnimationFrame(() => root.classList.add('in'));

  let detail = null;
  const closeDetail = () => { detail?.remove(); detail = null; };
  const close = () => { closeDetail(); document.body.classList.remove('dv-open'); root.remove(); removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') detail ? closeDetail() : close(); };
  addEventListener('keydown', onKey);

  root.addEventListener('click', e => {
    if (e.target.closest('.dv-back')) return close();
    const tab = e.target.closest('.dv-toggle button');
    if (tab) {
      root.querySelectorAll('.dv-toggle button').forEach(b => b.classList.toggle('on', b === tab));
      root.querySelector('.dv-body').dataset.mode = tab.dataset.mode;
      return;
    }
    if (detail && (e.target.closest('.dv-detail-close') || e.target === detail)) return closeDetail();
    const pick = e.target.closest('[data-i]');
    if (pick && !detail) {
      detail = document.createElement('div');
      detail.className = 'dv-detail-wrap';
      detail.innerHTML = detailHtml(list[+pick.dataset.i].card);
      root.append(detail);
      detail.addEventListener('click', ev => { if (ev.target === detail || ev.target.closest('.dv-detail-close')) closeDetail(); });
    }
  });
  return close;
}
