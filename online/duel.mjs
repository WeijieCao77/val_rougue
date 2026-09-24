import { CARDS, SKINS, effects, cardName } from '../content.js';

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function hashSeed(seed) {
  let a = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    a = Math.imul(a ^ str.charCodeAt(i), 16777619);
  }
  a >>>= 0;
  if (a === 0) a = 1;
  return a;
}

function createRng(seed) {
  let state = hashSeed(seed);
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    },
    getState() { return state; },
    setState(x) { state = x >>> 0; if (state === 0) state = 1; }
  };
}

function shuffleWithRng(rng, items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValidCardId(id) {
  return typeof id === 'string' && CARDS[id] !== undefined;
}

function isPermanentCard(id) {
  if (typeof id !== 'string') return false;
  const card = CARDS[id];
  if (!card) return false;
  // Regional tactic cards (e.g. CNT01) are recruitable season cards too, so builds may contain them.
  return card.player === true || card.trainable === true || id.startsWith('CU');
}

function validateDeck(deck) {
  if (!Array.isArray(deck)) throw new Error('deck must be array');
  if (deck.length === 0) throw new Error('deck empty');
  if (deck.length > 200) throw new Error('deck too large');
  const seenUids = new Set();
  const counts = {};
  const result = [];
  for (const card of deck) {
    if (!card || typeof card !== 'object') throw new Error('invalid card entry');
    if (typeof card.uid !== 'string' || card.uid.length === 0 || card.uid.length > 100) throw new Error('invalid uid');
    if (seenUids.has(card.uid)) throw new Error('duplicate uid');
    seenUids.add(card.uid);
    if (!isValidCardId(card.id)) throw new Error('unknown card id: ' + card.id);
    if (!isPermanentCard(card.id)) throw new Error('non-permanent card in deck: ' + card.id);
    if (card.up !== undefined && typeof card.up !== 'boolean') throw new Error('up must be boolean');
    counts[card.id] = (counts[card.id] || 0) + 1;
    result.push({ uid: card.uid, id: card.id, up: !!card.up });
  }
  return result;
}

function validateSkins(skins) {
  if (!Array.isArray(skins)) throw new Error('skins must be array');
  const result = [];
  const seen = new Set();
  for (const id of skins) {
    if (typeof id !== 'string' || !Object.hasOwn(SKINS, id)) throw new Error('unknown skin: ' + id);
    if (seen.has(id)) throw new Error('duplicate skin');
    seen.add(id);
    result.push(id);
  }
  if (result.length > 3) throw new Error('too many skins');
  return result;
}

function validateNumeric(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(name + ' must be number');
  if (!Number.isInteger(value)) throw new Error(name + ' must be integer');
  if (value < min || value > max) throw new Error(name + ' out of bounds');
  return value;
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot required');
  if (snapshot.version !== 'wa-pvp-1') throw new Error('unsupported snapshot version');
  if (typeof snapshot.runId !== 'string' || snapshot.runId.length === 0 || snapshot.runId.length > 100) throw new Error('runId required');
  const act = validateNumeric(snapshot.act, 'act', 1, 3);
  if (typeof snapshot.seed !== 'string' || snapshot.seed.length === 0 || snapshot.seed.length > 200) throw new Error('seed required');
  if (!snapshot.region || !['CN', 'AM', 'EMEA', 'PAC'].includes(snapshot.region)) throw new Error('region invalid');
  const deck = validateDeck(snapshot.deck);
  const skins = validateSkins(snapshot.skins || []);
  const maxHp = validateNumeric(snapshot.maxHp, 'maxHp', 1, 999);
  const hp = validateNumeric(snapshot.hp, 'hp', 1, 999);
  if (hp !== maxHp) throw new Error('snapshot hp must equal maxHp');
  const money = snapshot.money !== undefined ? validateNumeric(snapshot.money, 'money', 0, 99999) : 0;
  const actionsCount = snapshot.actionsCount !== undefined ? validateNumeric(snapshot.actionsCount, 'actionsCount', 0, 99999) : 0;
  return {
    id: `${snapshot.runId}:${act}`,
    runId: snapshot.runId,
    act,
    version: 'wa-pvp-1',
    seed: snapshot.seed,
    region: snapshot.region,
    deck,
    skins,
    maxHp,
    hp: maxHp,
    money,
    actionsCount
  };
}

function createPlayerState(snapshot, seat, matchSeed) {
  const deck = snapshot.deck.map(c => ({ ...c }));
  const rngSeed = `${matchSeed}|pvp|${seat}|${snapshot.runId}`;
  const rng = createRng(rngSeed);
  const drawPile = shuffleWithRng(rng, deck);
  return {
    maxHp: snapshot.maxHp,
    hp: snapshot.maxHp,
    block: 0,
    weak: 0,
    vulnerable: 0,
    burn: 0,
    strength: 0,
    overload: 0,
    overloadNext: 0,
    plays: 0,
    deployables: [],
    energy: 0,
    drawPile,
    hand: [],
    discard: [],
    exhaust: [],
    powers: [],
    roleCounts: {},
    skinZeroUsed: false,
    skins: snapshot.skins,
    turnsTaken: 0,
    rngState: rng.getState()
  };
}

function rngNext(player, matchSeed) {
  const rng = createRng(matchSeed);
  rng.setState(player.rngState);
  const val = rng.next();
  player.rngState = rng.getState();
  return val;
}

function shuffleDiscardIntoDraw(player, matchSeed) {
  const rng = {
    next: () => rngNext(player, matchSeed)
  };
  player.drawPile = shuffleWithRng(rng, player.discard);
  player.discard = [];
}

function drawCards(state, seat, count) {
  const player = state.players[seat];
  for (let i = 0; i < count; i++) {
    if (player.hand.length >= 10) {
      state.log.push('手牌已满，停止抽牌。');
      break;
    }
    if (player.drawPile.length === 0) {
      if (player.discard.length === 0) break;
      shuffleDiscardIntoDraw(player, state.matchSeed);
      state.log.push('弃牌堆洗回抽牌堆。');
    }
    const card = player.drawPile.shift();
    player.hand.push(card);
  }
  if (count > 0) state.log.push(`抽 ${count} 张牌。`);
}

function powerTotal(player, key) {
  return player.powers.flatMap(effects).filter(e => e.key === key).reduce((sum, e) => sum + e.n, 0);
}

function damageCalc(base, weak, vulnerable) {
  let mult = 1;
  if (weak) mult *= 0.75;
  if (vulnerable) mult *= 1.5;
  return Math.floor(Math.max(0, base) * mult);
}

function attackPlayer(state, attackerSeat, defenderSeat, damage) {
  const defender = state.players[defenderSeat];
  const absorbed = Math.min(defender.block, damage);
  defender.block -= absorbed;
  const actual = damage - absorbed;
  defender.hp = Math.max(0, defender.hp - actual);
  state.log.push(`玩家${defenderSeat} 受到 ${actual} 伤害（布防 ${absorbed}），剩余 HP ${defender.hp}`);
  if (defender.hp === 0) {
    state.status = 'finished';
    state.winner = attackerSeat;
  }
}

function playCard(state, seat, uid) {
  if (state.status !== 'active') throw new Error('match not active');
  if (state.active !== seat) throw new Error('not your turn');
  const player = state.players[seat];
  const opponent = state.players[1 - seat];
  const cardIndex = player.hand.findIndex(c => c.uid === uid);
  if (cardIndex === -1) throw new Error('card not in hand');
  const card = player.hand[cardIndex];
  const t = CARDS[card.id];
  if (t.cost === null) throw new Error('cannot play');
  if (t.cost > player.energy) throw new Error('not enough energy');

  player.hand.splice(cardIndex, 1);
  player.energy -= t.cost;
  const playsBefore = player.plays || 0;
  player.plays = playsBefore + 1;
  const wasVuln = opponent.vulnerable > 0, wasBurning = (opponent.burn || 0) > 0;
  const extra = (card.id === 'TK03' ? powerTotal(player, 'knife') : 0) + (playsBefore >= 2 ? powerTotal(player, 'comboAtk') : 0) + (player.strength || 0);
  player.roleCounts[t.role] = (player.roleCounts[t.role] || 0) + 1;
  const first = player.roleCounts[t.role] === 1;
  let bonus = (t.player && t.role === '决斗' && first) ? powerTotal(player, 'duel') : 0;
  const wasWeak = opponent.weak > 0;
  state.log.push(`玩家${seat} 打出 ${cardName(card)}。`);

  const list = effects(card).flatMap(e => e.type === 'combo' ? (playsBefore > 0 ? [e.effect] : []) : [e]);
  for (const e of list) {
    if (e.type === 'hit') {
      for (let i = 0; i < e.times; i++) {
        const dmg = damageCalc(e.n + bonus + extra + (e.ifWeak && wasWeak ? e.ifWeak : 0) + (e.ifVuln && wasVuln ? e.ifVuln : 0) + (e.ifBurn && wasBurning ? e.ifBurn : 0), player.weak > 0, opponent.vulnerable > 0);
        attackPlayer(state, seat, 1 - seat, dmg);
        bonus = 0;
        if (state.status === 'finished') break;
      }
      if (state.status === 'finished') break;
    } else if (e.type === 'block') {
      player.block += e.n;
      state.log.push(`获得 ${e.n} 布防。`);
    } else if (e.type === 'weak') {
      opponent.weak += e.n;
      state.log.push(`对手压制 +${e.n}。`);
    } else if (e.type === 'vulnerable') {
      opponent.vulnerable += e.n;
      state.log.push(`对手易伤 +${e.n}。`);
    } else if (e.type === 'draw') {
      drawCards(state, seat, e.n);
    } else if (e.type === 'burn') {
      opponent.burn = (opponent.burn || 0) + e.n;
      state.log.push(`对手燃烧 +${e.n}。`);
    } else if (e.type === 'burnMultiply') {
      opponent.burn = (opponent.burn || 0) * e.n;
    } else if (e.type === 'detonate') {
      const n = (opponent.burn || 0) * e.per;
      opponent.burn = 0;
      if (n) attackPlayer(state, seat, 1 - seat, damageCalc(n, player.weak > 0, opponent.vulnerable > 0));
    } else if (e.type === 'deploy') {
      player.deployables.push({ kind: e.kind, n: e.n, turns: e.turns });
      state.log.push(e.kind === 'turret' ? `部署哨戒炮（${e.n}×${e.turns}）。` : `部署屏障无人机（${e.n}×${e.turns}）。`);
    } else if (e.type === 'fireTurrets') {
      for (const d of player.deployables) {
        if (d.kind !== 'turret') continue;
        attackPlayer(state, seat, 1 - seat, damageCalc(d.n, false, opponent.vulnerable > 0));
        if (state.status === 'finished') break;
      }
    } else if (e.type === 'bodyslam') {
      attackPlayer(state, seat, 1 - seat, damageCalc(player.block + (player.strength || 0), player.weak > 0, opponent.vulnerable > 0));
    } else if (e.type === 'strength') {
      player.strength = (player.strength || 0) + e.n;
    } else if (e.type === 'overload') {
      player.overloadNext = (player.overloadNext || 0) + e.n;
    } else if (e.type === 'token') {
      if (player.hand.length >= 10) {
        state.log.push('手牌已满，未生成临时牌。');
      } else {
        const tokenCard = { uid: `t${state.nextTokenId++}`, id: e.id, up: false };
        player.hand.push(tokenCard);
        state.log.push(`生成 ${CARDS[e.id].name}。`);
      }
    }
    if (state.status === 'finished') break;
  }

  if (t.player && t.cost === 0 && player.skins.includes('SK02') && !player.skinZeroUsed) {
    player.skinZeroUsed = true;
    state.log.push('信号线：本场首次 0 费选手，抽 1 张。');
    drawCards(state, seat, 1);
  }

  if (t.zone === 'power') {
    player.powers.push(card);
    state.log.push(`${cardName(card)} 能力生效。`);
  } else if (['exhaust', 'temporary'].includes(t.zone)) {
    player.exhaust.push(card);
    state.log.push(`${cardName(card)} 消耗。`);
  } else {
    player.discard.push(card);
  }

  if (t.player && t.role === '先锋' && first) {
    const n = powerTotal(player, 'init');
    if (n) {
      player.block += n;
      state.log.push(`信息联防：获得 ${n} 布防。`);
    }
  }

  if (t.player && t.role === '哨位' && first && player.skins.includes('SK03')) {
    player.block += 2;
    state.log.push('守望涂层：获得 2 布防。');
  }
}

function beginTurn(state, seat) {
  const player = state.players[seat];
  player.block = 0;
  player.energy = Math.max(0, 3 + powerTotal(player, 'energy') - (player.overloadNext || 0));
  player.overload = player.overloadNext || 0;
  player.overloadNext = 0;
  player.plays = 0;
  player.roleCounts = {};
  const opponent = state.players[1 - seat];
  const tick = powerTotal(player, 'burnTick');
  if (tick) opponent.burn = (opponent.burn || 0) + tick;
  // Burn on this player ticks at the start of their own turn and ignores block.
  if (player.burn > 0) {
    player.hp = Math.max(0, player.hp - player.burn);
    state.log.push(`玩家${seat} 燃烧 -${player.burn} 声望。`);
    player.burn--;
    if (player.hp === 0) { state.status = 'finished'; state.winner = 1 - seat; return; }
  }
  if (player.turnsTaken === 0 && player.skins.includes('SK01')) {
    player.block += 3;
    state.log.push('磨砂黑：获得 3 布防。');
  }
  player.turnsTaken++;
  const extraDraw = powerTotal(player, 'extraDraw');
  drawCards(state, seat, 5 + extraDraw);
}

function endTurn(state, seat) {
  const player = state.players[seat];
  for (const card of player.hand.filter(c => c.id === 'CU02')) {
    player.hp = Math.max(0, player.hp - 2);
    state.log.push('舆论压力：直接失去 2 声望。');
    if (player.hp === 0) {
      state.status = 'finished';
      state.winner = 1 - seat;
      return;
    }
  }
  const kept = [];
  for (const card of player.hand) {
    if (CARDS[card.id].zone === 'retain') kept.push(card);
    else if (CARDS[card.id].zone === 'exhaustEnd' || CARDS[card.id].zone === 'temporary') {
      player.exhaust.push(card);
      state.log.push(`${cardName(card)} 在回合末消耗。`);
    } else {
      player.discard.push(card);
    }
  }
  player.hand = kept;
  for (const d of player.deployables || []) {
    if (d.kind === 'turret') {
      attackPlayer(state, seat, 1 - seat, damageCalc(d.n, false, state.players[1 - seat].vulnerable > 0));
      if (state.status === 'finished') return;
    } else player.block += d.n;
    d.turns--;
  }
  player.deployables = (player.deployables || []).filter(d => d.turns > 0);
  player.weak = Math.max(0, player.weak - 1);
  player.vulnerable = Math.max(0, player.vulnerable - 1);
}

function startNextTurn(state) {
  state.turn++;
  if (state.turn > 200) {
    state.status = 'finished';
    state.winner = null;
    state.log.push('达到200回合上限，平局。');
    return;
  }
  state.active = 1 - state.active;
  beginTurn(state, state.active);
}

export function createMatch(snapshotA, snapshotB, seed) {
  const snapA = validateSnapshot(snapshotA);
  const snapB = validateSnapshot(snapshotB);
  if (snapA.act !== snapB.act) throw new Error('acts must match');
  if (snapA.version !== snapB.version) throw new Error('versions must match');
  const matchSeed = String(seed || `${snapA.runId}|${snapB.runId}`);
  const state = {
    rev: 0,
    status: 'active',
    active: 0,
    winner: null,
    turn: 0,
    players: [
      createPlayerState(snapA, 0, matchSeed),
      createPlayerState(snapB, 1, matchSeed)
    ],
    log: [],
    nextTokenId: 1,
    matchSeed
  };
  const rng = createRng(matchSeed + '|first');
  state.active = rng.next() < 0.5 ? 0 : 1;
  state.turn = 1;
  beginTurn(state, state.active);
  return state;
}

export function applyCommand(match, seat, command) {
  if (!match || match.status !== 'active') throw new Error('match not active');
  if (seat !== 0 && seat !== 1) throw new Error('invalid seat');
  if (!command || typeof command !== 'object') throw new Error('invalid command');
  const state = deepCopy(match);
  if (command.type === 'concede') {
    state.status = 'finished';
    state.winner = 1 - seat;
    state.rev++;
    state.log.push(`玩家${seat} 认输。`);
    return state;
  }
  if (state.active !== seat) throw new Error('not your turn');
  if (command.type === 'play') {
    if (!command.uid) throw new Error('uid required');
    playCard(state, seat, command.uid);
  } else if (command.type === 'end') {
    endTurn(state, seat);
    if (state.status === 'active') {
      startNextTurn(state);
    }
  } else {
    throw new Error('unknown command type');
  }
  state.rev++;
  return state;
}

export function viewFor(match, seat) {
  if (!match) throw new Error('match required');
  if (seat !== 0 && seat !== 1) throw new Error('invalid seat');
  const me = match.players[seat];
  const opp = match.players[1 - seat];
  return {
    rev: match.rev,
    status: match.status,
    active: match.active,
    winner: match.winner,
    turn: match.turn,
    you: {
      hp: me.hp,
      maxHp: me.maxHp,
      block: me.block,
      weak: me.weak,
      vulnerable: me.vulnerable,
      burn: me.burn || 0,
      strength: me.strength || 0,
      overload: me.overload || 0,
      deployables: (me.deployables || []).map(d => ({ ...d })),
      energy: me.energy,
      hand: me.hand.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      drawCount: me.drawPile.length,
      discard: me.discard.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      exhaust: me.exhaust.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      powers: me.powers.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      skins: me.skins,
      roleCounts: { ...me.roleCounts },
      skinZeroUsed: me.skinZeroUsed,
      turnsTaken: me.turnsTaken
    },
    opponent: {
      hp: opp.hp,
      maxHp: opp.maxHp,
      block: opp.block,
      weak: opp.weak,
      vulnerable: opp.vulnerable,
      burn: opp.burn || 0,
      strength: opp.strength || 0,
      overload: opp.overload || 0,
      deployables: (opp.deployables || []).map(d => ({ ...d })),
      energy: opp.energy,
      handCount: opp.hand.length,
      drawCount: opp.drawPile.length,
      discard: opp.discard.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      exhaust: opp.exhaust.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      powers: opp.powers.map(c => ({ uid: c.uid, id: c.id, up: c.up })),
      skins: opp.skins,
      roleCounts: { ...opp.roleCounts },
      skinZeroUsed: opp.skinZeroUsed,
      turnsTaken: opp.turnsTaken
    },
    log: [...match.log]
  };
}
