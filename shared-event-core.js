// Event option interpreter shared by both demos. Each demo keeps its own event
// scenes and numbers; this module only checks, describes and applies the
// option "ops" so the cost text shown to the player is generated from the
// exact numbers the engine applies.
//
// Ops (applied in order):
//   {money:n}            gain (n>0) or pay (n<0) money; paying requires enough money
//   {hp:n}               heal (n>0, capped) or lose (n<0; requires hp > loss)
//   {healPct:p}          heal ceil(maxHp*p), capped
//   {maxHp:n}            raise max hp (and hp) or lower it (hp is capped)
//   {equip:{fallback:m}} gain one random equipment; if none left, gain m money
//   {curse:id|true}      add a specific or random curse card
//   {card:tier, up}      add one random card of the tier (demo-defined)
//   {upgradeRandom:n}    upgrade n random upgradeable cards
//   {transformRandom:n}  transform n random transformable cards
//   {pick:kind}          player picks one card: upgrade|remove|transform|duplicate|cleanse
//   {gamble:{p,win,lose}} seeded roll: win ops with probability p, else lose ops
//   {fight:'elite', bonus:[ops]}  start an optional elite fight; bonus ops on victory
//   {special:name}       demo-specific follow-up handled by the engine

const PICK_NEEDS = {
  upgrade: ['upgradeable', '没有可升级的牌'],
  remove: ['removable', '没有可移除的牌'],
  transform: ['transformable', '没有可变换的牌'],
  duplicate: ['duplicable', '没有可复制的牌'],
  cleanse: ['isCurse', '牌组中没有隐患']
};

export function pickKind(ops) {
  for (const op of ops || []) if (op.pick) return op.pick;
  return null;
}

export function pickCandidates(s, kind, ctx) {
  const need = PICK_NEEDS[kind];
  if (!need) return [];
  return s.deck.filter(c => ctx[need[0]](s, c));
}

// '' when the option can be chosen now, otherwise the reason shown on the button.
export function opsReason(s, ops, ctx) {
  const L = ctx.labels;
  let money = s.money, hp = s.hp, maxHp = s.maxHp;
  // Paying only to heal makes no sense at full health.
  const gains = (ops || []).filter(op => !(op.money < 0 || op.hp < 0 || op.maxHp < 0 || op.curse));
  if (gains.length && gains.every(op => op.hp > 0 || op.healPct) && s.hp >= s.maxHp) return `${L.hp}已满`;
  for (const op of ops || []) {
    if (op.money < 0) { if (money < -op.money) return `${L.money}不足（需要 ${-op.money}）`; money += op.money; }
    if (op.hp < 0) { if (hp <= -op.hp) return `${L.hp}不足（需高于 ${-op.hp}）`; hp += op.hp; }
    if (op.maxHp < 0 && maxHp + op.maxHp < 20) return `最大${L.hp}过低`;
    if (op.upgradeRandom && !s.deck.some(c => ctx.upgradeable(s, c))) return '没有可升级的牌';
    if (op.transformRandom && !s.deck.some(c => ctx.transformable(s, c))) return '没有可变换的牌';
    if (op.card && !ctx.randomCardAvailable(s, op.card)) return '没有可获得的牌';
    if (op.pick) { const need = PICK_NEEDS[op.pick]; if (!s.deck.some(c => ctx[need[0]](s, c))) return need[1]; }
    if (op.gamble) {
      const r = opsReason({ ...s, money, hp, maxHp }, op.gamble.win, ctx) || opsReason({ ...s, money, hp, maxHp }, op.gamble.lose, ctx);
      if (r) return r;
    }
    if (op.special && ctx.specialReason) { const r = ctx.specialReason(s, op.special); if (r) return r; }
  }
  return '';
}

export function describeOps(ops, ctx) {
  const L = ctx.labels;
  const parts = [];
  for (const op of ops || []) {
    if (op.money > 0) parts.push(`获得 ${op.money} ${L.money}`);
    if (op.money < 0) parts.push(`支付 ${-op.money} ${L.money}`);
    if (op.hp > 0) parts.push(`回复 ${op.hp} ${L.hp}`);
    if (op.hp < 0) parts.push(`失去 ${-op.hp} ${L.hp}`);
    if (op.healPct) parts.push(`回复最大${L.hp}的 ${Math.round(op.healPct * 100)}%`);
    if (op.maxHp > 0) parts.push(`最大${L.hp} +${op.maxHp}`);
    if (op.maxHp < 0) parts.push(`最大${L.hp} −${-op.maxHp}`);
    if (op.equip) parts.push(`获得 1 件随机${L.equip}（${L.equipNone}改为 ${op.equip.fallback} ${L.money}）`);
    if (op.curse) parts.push(op.curse === true ? `加入 1 张随机${L.curse}` : `加入 1 张「${ctx.cardName(op.curse)}」`);
    if (op.card) parts.push(`获得 1 张随机${L.tier[op.card] || '牌'}${op.up ? `（已${L.upgrade}）` : ''}`);
    if (op.upgradeRandom) parts.push(`随机${L.upgrade} ${op.upgradeRandom} 张牌`);
    if (op.transformRandom) parts.push(`随机变换 ${op.transformRandom} 张牌`);
    if (op.pick === 'upgrade') parts.push(`选择 1 张牌${L.upgrade}`);
    if (op.pick === 'remove') parts.push('选择 1 张牌永久移除');
    if (op.pick === 'transform') parts.push('选择 1 张牌，变换为随机另一张');
    if (op.pick === 'duplicate') parts.push('选择 1 张牌复制一份');
    if (op.pick === 'cleanse') parts.push(`选择 1 张${L.curse}永久移除`);
    if (op.gamble) parts.push(`${Math.round(op.gamble.p * 100)}% 概率：${describeOps(op.gamble.win, ctx)}；否则：${op.gamble.lose?.length ? describeOps(op.gamble.lose, ctx) : '一无所获'}`);
    if (op.fight) parts.push(`迎战一名强敌（胜利照常获得比赛奖励）；获胜后额外：${describeOps(op.bonus || [], ctx)}`);
    if (op.special && ctx.describeSpecial) parts.push(ctx.describeSpecial(op.special));
  }
  return parts.length ? parts.join('，') : '无事发生，继续赛程';
}


// ----------------------------- Result summaries -----------------------------
// Whenever the game applies an effect the player did not pick (a random
// upgrade, transform, curse, card, equipment…), the engine records it in
// s.lastResult = {title, entries:[{kind, text, random, id?, from?, diff?}]}.
// Engines clear lastResult at the start of every action; the UI shows the
// entries after the action resolves. Presentation only: no RNG is consumed.
export function noteResult(s, entry, title) {
  if (!s) return;
  const r = (s.lastResult ||= { title: title || '结果', entries: [] });
  if (title && r.title === '结果') r.title = title;
  r.entries.push(entry);
}
export function setResultTitle(s, title) {
  if (s?.lastResult) s.lastResult.title = title;
}
export function hasRandomResult(s) {
  return !!s?.lastResult?.entries?.some(e => e.random);
}

const NUM = /\d+(?:\.\d+)?/g;
const skeleton = t => t.replace(NUM, '#');
// One clause before/after an upgrade: "伤害 7" / "伤害 10" -> "伤害 7 → 10".
function clauseDiff(a, b) {
  const na = a.match(NUM) || [];
  let i = 0;
  return b.replace(NUM, m => { const old = na[i++]; return old !== m ? ` ${old} → ${m} ` : m; }).replace(/\s+/g, ' ').trim();
}
// Short before→after description of an upgrade from the card's text clauses
// (Wa face lines or new-demo sentences) and costs.
export function upgradeDiffText(before, after, costBefore, costAfter) {
  const a = before.map(x => String(x).trim()).filter(Boolean), b = after.map(x => String(x).trim()).filter(Boolean);
  const parts = [];
  if (costBefore != null && costAfter != null && costBefore !== costAfter) parts.push(`费用 ${costBefore} → ${costAfter}`);
  const used = new Set();
  const added = [];
  for (const clause of b) {
    const same = a.findIndex((x, i) => !used.has(i) && x === clause);
    if (same >= 0) { used.add(same); continue; }
    const like = a.findIndex((x, i) => !used.has(i) && skeleton(x) === skeleton(clause));
    if (like >= 0) { used.add(like); parts.push(clauseDiff(a[like], clause)); continue; }
    added.push(clause);
  }
  const removed = a.filter((x, i) => !used.has(i));
  // One clause rewritten into another: show it as before → after.
  if (added.length === 1 && removed.length === 1) parts.push(`${removed[0]} → ${added[0]}`);
  else {
    for (const x of added) parts.push(`新增「${x}」`);
    for (const x of removed) parts.push(`去掉「${x}」`);
  }
  return parts.join('，') || '效果提升';
}
// Upgrade result entry: "已训练：XXX（伤害 7 → 10）".
export function upgradeEntry(ctx, id, random) {
  const diff = ctx.upgradeDiff ? ctx.upgradeDiff(id) : '';
  return { kind: 'upgrade', id, random: !!random, diff, text: `已${ctx.labels.upgrade}：${ctx.cardName(id)}${diff ? `（${diff}）` : ''}` };
}

function upgradeRandom(s, n, ctx, out) {
  for (let i = 0; i < n; i++) {
    const pool = s.deck.filter(c => ctx.upgradeable(s, c));
    if (!pool.length) break;
    const c = pool[Math.floor(ctx.rand(s) * pool.length)];
    c.up = true;
    out.push(`${ctx.cardName(c.id)} ${ctx.labels.upgrade}完成`);
    noteResult(s, upgradeEntry(ctx, c.id, true));
  }
}

function transformCard(s, c, ctx, out) {
  const id = ctx.transformInto(s, c);
  if (!id) return;
  const idx = s.deck.findIndex(x => x.uid === c.uid);
  s.deck.splice(idx, 1, ctx.newCard(s, id, false));
  out.push(`${ctx.cardName(c.id)} 变换为 ${ctx.cardName(id)}`);
  noteResult(s, { kind: 'transform', id, from: c.id, random: true, text: `已变换：${ctx.cardName(c.id)} → ${ctx.cardName(id)}` });
}

// Applies ops. `picked` is the chosen deck card for a {pick} op. Returns
// {log, fight} where fight is {bonus} if an elite fight must start next.
export function applyOps(s, ops, ctx, picked = null, out = []) {
  let fight = null;
  for (const op of ops || []) {
    if (op.money) { s.money = Math.max(0, s.money + op.money); out.push(`${op.money > 0 ? '+' : '−'}${Math.abs(op.money)} ${ctx.labels.money}`); noteResult(s, { kind: 'money', text: `${ctx.labels.money} ${op.money > 0 ? '+' : '−'}${Math.abs(op.money)}` }); }
    if (op.hp > 0) { const n = Math.min(op.hp, s.maxHp - s.hp); s.hp += n; out.push(`回复 ${n} ${ctx.labels.hp}`); noteResult(s, { kind: 'hp', text: `回复 ${n} ${ctx.labels.hp}` }); }
    if (op.hp < 0) { s.hp = Math.max(1, s.hp + op.hp); out.push(`失去 ${-op.hp} ${ctx.labels.hp}`); noteResult(s, { kind: 'hp', text: `失去 ${-op.hp} ${ctx.labels.hp}` }); }
    if (op.healPct) { const n = Math.min(Math.ceil(s.maxHp * op.healPct), s.maxHp - s.hp); s.hp += n; out.push(`回复 ${n} ${ctx.labels.hp}`); noteResult(s, { kind: 'hp', text: `回复 ${n} ${ctx.labels.hp}` }); }
    if (op.maxHp > 0) { s.maxHp += op.maxHp; s.hp += op.maxHp; out.push(`最大${ctx.labels.hp} +${op.maxHp}`); noteResult(s, { kind: 'maxHp', text: `最大${ctx.labels.hp} +${op.maxHp}` }); }
    if (op.maxHp < 0) { s.maxHp = Math.max(1, s.maxHp + op.maxHp); s.hp = Math.min(s.hp, s.maxHp); out.push(`最大${ctx.labels.hp} −${-op.maxHp}`); noteResult(s, { kind: 'maxHp', text: `最大${ctx.labels.hp} −${-op.maxHp}` }); }
    if (op.equip) {
      const got = ctx.gainEquip(s);
      if (got) { out.push(`获得${ctx.labels.equip}「${got}」`); noteResult(s, { kind: 'equip', random: true, text: `获得${ctx.labels.equip}：${got}${ctx.equipDesc?.(got) ? `（${ctx.equipDesc(got)}）` : ''}` }); }
      else { s.money += op.equip.fallback; out.push(`${ctx.labels.equip}已集齐，改为 +${op.equip.fallback} ${ctx.labels.money}`); noteResult(s, { kind: 'money', random: true, text: `${ctx.labels.equip}已集齐，改为 ${ctx.labels.money} +${op.equip.fallback}` }); }
    }
    if (op.curse) {
      const id = op.curse === true ? ctx.curseIds[Math.floor(ctx.rand(s) * ctx.curseIds.length)] : op.curse;
      s.deck.push(ctx.newCard(s, id, false));
      out.push(`加入「${ctx.cardName(id)}」`);
      noteResult(s, { kind: 'curse', id, random: op.curse === true, text: `加入${ctx.labels.curse}：${ctx.cardName(id)}${ctx.cardText?.(id) ? `（${ctx.cardText(id)}）` : ''}` });
    }
    if (op.card) {
      const id = ctx.randomCard(s, op.card);
      if (id) { s.deck.push(ctx.newCard(s, id, !!op.up)); out.push(`获得「${ctx.cardName(id)}」${op.up ? '（已' + ctx.labels.upgrade + '）' : ''}`); noteResult(s, { kind: 'card', id, random: true, text: `获得卡牌：${ctx.cardName(id)}${op.up ? `（已${ctx.labels.upgrade}）` : ''}` }); }
    }
    if (op.upgradeRandom) upgradeRandom(s, op.upgradeRandom, ctx, out);
    if (op.transformRandom) for (let i = 0; i < op.transformRandom; i++) {
      const pool = s.deck.filter(c => ctx.transformable(s, c));
      if (pool.length) transformCard(s, pool[Math.floor(ctx.rand(s) * pool.length)], ctx, out);
    }
    if (op.pick) {
      if (!picked) throw Error('需要选择一张牌');
      const c = s.deck.find(x => x.uid === picked.uid);
      if (op.pick === 'upgrade') { c.up = true; out.push(`${ctx.cardName(c.id)} ${ctx.labels.upgrade}完成`); noteResult(s, upgradeEntry(ctx, c.id, false)); }
      else if (op.pick === 'remove' || op.pick === 'cleanse') { s.deck = s.deck.filter(x => x.uid !== c.uid); out.push(`移除「${ctx.cardName(c.id)}」`); noteResult(s, { kind: 'remove', id: c.id, text: `已移除：${ctx.cardName(c.id)}` }); }
      else if (op.pick === 'transform') transformCard(s, c, ctx, out);
      else if (op.pick === 'duplicate') { s.deck.push(ctx.newCard(s, c.id, !!c.up)); out.push(`复制「${ctx.cardName(c.id)}」`); noteResult(s, { kind: 'duplicate', id: c.id, text: `已复制：${ctx.cardName(c.id)}${c.up ? '（已' + ctx.labels.upgrade + '）' : ''}` }); }
    }
    if (op.gamble) {
      const won = ctx.rand(s) < op.gamble.p;
      out.push(won ? '赌中了' : '没赌中');
      noteResult(s, { kind: 'gamble', random: true, won, text: won ? `判定成功（成功率 ${Math.round(op.gamble.p * 100)}%）` : `判定失败（成功率 ${Math.round(op.gamble.p * 100)}%）` });
      const r = applyOps(s, won ? op.gamble.win : op.gamble.lose, ctx, picked, out);
      if (r.fight) fight = r.fight;
    }
    if (op.fight) fight = { bonus: op.bonus || [] };
  }
  return { log: out, fight };
}
