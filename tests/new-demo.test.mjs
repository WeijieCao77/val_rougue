import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS } from '../new-demo/content.js';
import * as engine from '../new-demo/engine.js';
import { createRun, act, legalActions, categoryUpgradeQuote } from '../new-demo/engine.js';
import { buildMap } from '../new-demo/season-map.js';

// Helper: create a controlled combat state with a battle fixture.
function createTestBattle({
  handCards = [],
  drawPile = [],
  discardPile = [],
  enemyHp = 50,
  enemyIntent = [],
  enemyStatuses = {},
  playerStatuses = {},
  playerBlock = 0,
  stance = 'cover',
  energy = 3,
  act = 1,
  currentNodeKey = 'test-node'
} = {}) {
  const state = createRun('fixture-seed');
  state.phase = 'combat';
  state.currentNode = currentNodeKey;
  state.act = act;
  state.map = {
    nodes: [{ key: currentNodeKey, kind: 'battle', enemy: 'E01' }],
    edges: []
  };
  state.battle = {
    enemyId: 'E01',
    enemyName: 'Test Enemy',
    enemyHp,
    enemyMaxHp: enemyHp,
    enemyScript: [],
    enemyScriptIndex: 0,
    enemyIntent,
    turn: 1,
    energy,
    stance,
    stanceSwitchUsedThisTurn: false,
    attackPlayedThisTurn: false,
    blockPlayedThisTurn: false,
    stanceChangedThisTurn: false,
    playsThisTurn: 0,
    hand: handCards.map((id, i) => ({ uid: `h${i}`, id, up: false })),
    drawPile: drawPile.map((id, i) => ({ uid: `d${i}`, id, up: false })),
    discardPile: discardPile.map((id, i) => ({ uid: `dsc${i}`, id, up: false })),
    exhaustPile: [],
    powers: [],
    powerStacks: {},
    powerCards: [],
    statuses: { player: playerStatuses, enemy: enemyStatuses },
    rewardPool: null,
    rewardTaken: false,
    playerBlock,
    smokeBonusUsedThisTurn: false,
    flashBonusUsedThisTurn: false
  };
  return state;
}

// Helper: add a specific card to battle hand.
function addCardToHand(state, cardId) {
  state.battle.hand.push({ uid: `test-${cardId}-${Math.random()}`, id: cardId, up: false });
}

// Helper: set enemy intent.
function setEnemyIntent(state, intent) {
  state.battle.enemyIntent = intent;
}

// Helper: play first card matching predicate (or specific id) from hand.
function playCardById(state, cardId) {
  const cardUid = state.battle.hand.find(c => c.id === cardId)?.uid;
  assert(cardUid, `Card ${cardId} not in hand`);
  const res = act(state, { type: 'play', uid: cardUid });
  assert(!res.error, res.error);
  return res.state;
}

// Helper: end turn.
function endTurn(state) {
  const res = act(state, { type: 'end' });
  assert(!res.error, res.error);
  return res.state;
}

// Helper: count total cards in all battle piles.
function totalBattleCards(battle) {
  return battle.hand.length + battle.drawPile.length + battle.discardPile.length + battle.exhaustPile.length + battle.powerCards.length;
}

// ----------------------------- Tests -----------------------------

test('content: 87 shared plus four 75-card regional pools and 19 afflictions', () => {
  assert.equal(CARD_IDS.length, 387);
  assert.equal(new Set(CARD_IDS).size, 387);
  assert.equal(Object.keys(STATUS_CARDS).length, 19);
  for (const id of CARD_IDS) {
    const c = CARDS[id];
    assert(c, `missing card ${id}`);
    assert(Array.isArray(c.effects), `${id} effects not array`);
    assert(Array.isArray(c.upgradeEffects), `${id} upgradeEffects not array`);
  }
  for (const id of Object.keys(STATUS_CARDS)) {
    assert(!CARD_IDS.includes(id), `status card ${id} should not be in CARD_IDS`);
  }
});

test('hand and whole-combat upgrades never modify the permanent deck or status cards', () => {
  let s = createTestBattle({handCards:['TA77','TA01','TA02','ST01'], drawPile:['TA05'], discardPile:['TA06'], energy:3});
  const permanent = structuredClone(s.deck);
  s = playCardById(s, 'TA77');
  assert(s.battle.hand.filter(c=>c.id!=='ST01').every(c=>c.up));
  assert.equal(s.battle.hand.find(c=>c.id==='ST01').up, false);
  assert.equal(s.battle.hand.find(c=>c.id==='TA05').up, true);
  assert.equal(s.battle.discardPile[0].up, false);
  assert.deepEqual(s.deck, permanent);

  s = createTestBattle({handCards:['TA78','TA01','ST01'], drawPile:['TA05'], discardPile:['TA06'], energy:3});
  const original = structuredClone(s.deck);
  s = playCardById(s, 'TA78');
  assert.equal(s.battle.hand.find(c=>c.id==='TA01').up, true);
  assert.equal(s.battle.hand.find(c=>c.id==='ST01').up, false);
  assert.equal(s.battle.drawPile[0].up, true);
  assert.equal(s.battle.discardPile[0].up, true);
  assert.deepEqual(s.deck, original);
});

test('source-anchored upgrade cards use their upgraded effect and energy cost', () => {
  let state = createTestBattle({handCards:['TA76','TA01','TA02'], energy:1});
  state.battle.hand.find(card => card.id === 'TA76').up = true;
  state = playCardById(state, 'TA76');
  assert.equal(state.battle.energy, 0);
  assert.equal(state.battle.playerBlock, 8); // 5 printed block + 3 from cover stance
  assert(state.battle.hand.every(card => card.up));

  state = createTestBattle({handCards:['TA78','TA01'], energy:1});
  const base = act(state, {type:'play', uid:state.battle.hand[0].uid});
  assert(base.error, 'base TA78 must require 2 energy');
  state.battle.hand[0].up = true;
  assert(legalActions(state).some(action => action.type === 'play' && action.uid === state.battle.hand[0].uid));
  state = playCardById(state, 'TA78');
  assert.equal(state.battle.energy, 0);
  assert.equal(state.battle.playerBlock, 0);
  assert.equal(state.battle.hand[0].up, true);
});

test('source-anchored abilities retain block and scale every attack or defense', () => {
  let state = createTestBattle({handCards:['TA84'], playerBlock:7, energy:2});
  assert(act(state, {type:'play', uid:state.battle.hand[0].uid}).error);
  state.battle.hand[0].up = true;
  state = playCardById(state, 'TA84');
  assert.equal(state.battle.energy, 0);
  assert.equal(state.battle.discardPile.length, 0);
  state = endTurn(state);
  assert.equal(state.battle.playerBlock, 7);

  state = createTestBattle({handCards:['TA85','TA24'], enemyHp:50, energy:3});
  state = playCardById(state, 'TA85');
  state = playCardById(state, 'TA24');
  assert.equal(state.battle.enemyHp, 23); // (7 + 2 firepower) × 3 hits

  state = createTestBattle({handCards:['TA85','TA85','TA05'], enemyHp:30, energy:3});
  state.battle.hand[1].up = true;
  state = playCardById(state, 'TA85');
  state = playCardById(state, 'TA85');
  state = playCardById(state, 'TA05');
  assert.equal(state.battle.enemyHp, 21); // 4 base + 2 normal + 3 upgraded

  state = createTestBattle({handCards:['TA86','TA02'], energy:3});
  state.battle.hand[0].up = true;
  state = playCardById(state, 'TA86');
  state = playCardById(state, 'TA02');
  assert.equal(state.battle.playerBlock, 11); // 5 card + 3 cover + 3 upgraded defense
});

test('exhaust draw ability draws after the played card leaves hand', () => {
  let state = createTestBattle({handCards:['TA87','TA74'], drawPile:['TA01'], energy:3});
  state = playCardById(state, 'TA87');
  assert.equal(state.battle.powerCards.length, 1);
  state = playCardById(state, 'TA74');
  assert.equal(state.battle.exhaustPile.length, 1);
  assert.equal(state.battle.hand.length, 1);
  assert.equal(state.battle.hand[0].id, 'TA01');
});

test('upgrade payoff counts other upgraded cards and power returns energy once per turn', () => {
  let s = createTestBattle({handCards:['TA81','TA01','TA02','TA05'], enemyHp:40, energy:3});
  s.battle.hand.filter(c=>c.id!=='TA81').forEach(c=>{c.up=true});
  s = playCardById(s,'TA81');
  assert.equal(s.battle.enemyHp,29);

  s = createTestBattle({handCards:['TA83','TA05','TA06'], energy:3});
  s.battle.hand.filter(c=>c.id!=='TA83').forEach(c=>{c.up=true});
  s = playCardById(s,'TA83');
  assert.equal(s.battle.energy,1);
  s = playCardById(s,'TA05');
  assert.equal(s.battle.energy,2);
  s = playCardById(s,'TA06');
  assert.equal(s.battle.energy,2);
});

test('shop category training quotes live deck, upgrades once, and rejects unaffordable actions', () => {
  let s = createRun('shop-upgrade');
  s.phase = 'shop';
  s.shop = {cards:[{id:'TA01'}]}; // Older saves have no categoryUpgradeUsed field.
  s.money = 1000;
  const before = categoryUpgradeQuote(s,'attack');
  s = act(s,{type:'buy',index:0,id:'TA01'}).state;
  assert.equal(categoryUpgradeQuote(s,'attack').count, before.count+1);
  s.money = 0;
  const snapshot = structuredClone(s);
  assert(act(s,{type:'upgradeCategory',category:'attack'}).error);
  assert.deepEqual(s,snapshot);
  s.money = 1000;
  const quote = categoryUpgradeQuote(s,'attack');
  const upgraded = act(s,{type:'upgradeCategory',category:'attack'});
  assert(!upgraded.error,upgraded.error);
  assert.equal(upgraded.state.money,1000-quote.price);
  assert(upgraded.state.deck.filter(c=>CARDS[c.id].type==='attack').every(c=>c.up));
  assert(upgraded.state.deck.some(c=>CARDS[c.id].type==='skill'&&!c.up));
  assert(act(upgraded.state,{type:'upgradeCategory',category:'skill'}).error);
});

test('starter decks: at least 3 attacks and 2 block cards', () => {
  for (const team of Object.values(TEAMS)) {
    let attackCount = 0;
    let blockCount = 0;
    for (const [cardId, count] of team.startingDeck) {
      const card = CARDS[cardId];
      assert(card, `starter card ${cardId} missing`);
      if (card.type === 'attack') attackCount += count;
      const hasBlock = card.effects.some(e => e.type === 'block' || (e.type === 'conditional' && e.effect?.type === 'block'));
      if (hasBlock) blockCount += count;
    }
    assert(attackCount >= 3, `${team.id} has only ${attackCount} attacks`);
    assert(blockCount >= 2, `${team.id} has only ${blockCount} block cards`);
  }
});

test('map generation is deterministic for same seed', () => {
  const mapA = buildMap('repro-seed', 1);
  const mapB = buildMap('repro-seed', 1);
  assert.deepEqual(mapA, mapB);
});

test('map specials move across seeds while every act keeps reachable event, shop and elite nodes', () => {
  const layouts = new Set();
  for (let i = 0; i < 30; i++) {
    const map = buildMap(`variety-${i}`, 1);
    const byKey = new Map(map.nodes.map(n => [n.key, n]));
    const reachable = new Set(map.starts);
    for (let step = 1; step < 11; step++) {
      for (const edge of map.edges) if (reachable.has(edge.from)) reachable.add(edge.to);
    }
    for (const kind of ['event', 'shop', 'elite']) {
      assert(map.nodes.some(n => n.kind === kind && reachable.has(n.key)), `${kind} missing or unreachable for variety-${i}`);
    }
    layouts.add(map.nodes.filter(n => ['event','shop','elite'].includes(n.kind)).map(n => `${n.step}:${n.lane}:${n.kind}`).join('|'));
    assert(byKey.has(map.bossId));
  }
  assert(layouts.size > 20, `only ${layouts.size} layouts across 30 seeds`);
});

test('opponent intent order varies by seed and remains replayable', () => {
  const orders = new Set();
  for (let i = 0; i < 20; i++) {
    const seed = `opponent-${i}`;
    const start = (s) => act(s, {type:'enter', key:s.map.starts[0]}).state.battle;
    const first = start(createRun(seed));
    const replay = start(createRun(seed));
    assert.deepEqual(first.enemyScript, replay.enemyScript);
    assert.deepEqual(first.enemyIntent, replay.enemyIntent);
    orders.add(JSON.stringify(first.enemyScript));
  }
  assert(orders.size > 1);
});

test('expensive cards trade raw damage for tactical effects', () => {
  let s = createTestBattle({ handCards:['TA30'], enemyHp:50, enemyStatuses:{block:12}, energy:3 });
  s = playCardById(s, 'TA30');
  assert.equal(s.battle.enemyHp, 31, 'counter-angle strips guard before damage');
  assert.equal(s.battle.exhaustPile.length, 1);
  s = createTestBattle({ handCards:['TA21'], enemyHp:60, enemyStatuses:{smoke:1}, drawPile:['TA01'], energy:3 });
  s = playCardById(s, 'TA21');
  assert.equal(s.battle.enemyHp, 26, 'smoke setup adds thirteen damage');
  assert.equal(s.battle.hand.length, 1, 'high cost payoff also cycles a card');
});

test('new event choices preserve resources and reject unaffordable options atomically', () => {
  const event = {id:'ev5', choices:[{id:'cash'},{id:'fans'}]};
  let s = createRun('event-tradeoff');
  s.phase = 'event';
  s.event = event;
  s.money = 40;
  const before = structuredClone(s);
  const rejected = act(s, {type:'event', choice:'fans'});
  assert(rejected.error);
  assert.deepEqual(s, before);
  const accepted = act(s, {type:'event', choice:'cash'});
  assert(!accepted.error, accepted.error);
  assert.equal(accepted.state.maxHp, s.maxHp - 4);
  assert.equal(accepted.state.money, 110);
});

test('illegal action does not mutate state', () => {
  const state = createRun('test-seed');
  const snapshot = JSON.parse(JSON.stringify(state));
  const res = act(state, { type: 'play', uid: 'nonexistent' });
  assert(res.error);
  assert.deepEqual(state, snapshot);
});

test('cover stance: first block +3, second block no bonus', () => {
  let state = createTestBattle({ handCards: [], energy: 10 });
  // Add two block cards: one cost 1 block n=5 (TA02), one cost 0 block n=3 (TA06)
  addCardToHand(state, 'TA02');
  addCardToHand(state, 'TA06');
  state = playCardById(state, 'TA02');
  assert.equal(state.battle.playerBlock, 5 + 3, 'cover first block should get +3');
  state = playCardById(state, 'TA06');
  assert.equal(state.battle.playerBlock, 5 + 3 + 3, 'second block no bonus (base 3)');
});

test('push stance: first attack +3', () => {
  let state = createTestBattle({ handCards: [], energy: 10, stance: 'push' });
  // Use attack with base n=7 (TA28 "警戒射击" cost 1, attack 7)
  addCardToHand(state, 'TA28');
  const enemyHpBefore = state.battle.enemyHp;
  state = playCardById(state, 'TA28');
  const damage = enemyHpBefore - state.battle.enemyHp;
  assert.equal(damage, 7 + 3, 'push first attack should get +3');
});

test('enemy smoke does not reduce player outgoing damage to enemy', () => {
  let state = createTestBattle({
    handCards: [],
    energy: 10,
    enemyStatuses: { smoke: 2 }
  });
  const enemyHpBefore = state.battle.enemyHp;
  addCardToHand(state, 'TA01'); // base attack 6
  state = playCardById(state, 'TA01');
  const damage = enemyHpBefore - state.battle.enemyHp;
  assert.equal(damage, 6, 'player attack should deal base 6 damage regardless of enemy smoke');
  assert.equal(state.battle.statuses.enemy.smoke, 2, 'smoke should not be consumed by player attack');
});

test('enemy flash does not reduce player outgoing damage or get consumed', () => {
  let state = createTestBattle({
    handCards: [],
    energy: 10,
    enemyStatuses: { flash: 2 }
  });
  const enemyHpBefore = state.battle.enemyHp;
  addCardToHand(state, 'TA01'); // base attack 6
  state = playCardById(state, 'TA01');
  const damage = enemyHpBefore - state.battle.enemyHp;
  assert.equal(damage, 6, 'player attack should deal base 6 damage regardless of enemy flash');
  assert.equal(state.battle.statuses.enemy.flash, 2, 'flash should not be consumed by player attack');
});

test('enemy smoke and flash reduce damage player takes from enemy; push adds +2 per hit', () => {
  // Smoke case: enemy smoke 2, two 7-damage hits -> player takes 10 (smoke reduces each hit by 2), smoke becomes 1
  let state = createTestBattle({
    handCards: [],
    energy: 10,
    enemyStatuses: { smoke: 2 },
    playerBlock: 0,
    playerStatuses: {}
  });
  setEnemyIntent(state, [{ type: 'hit', n: 7, times: 2 }]);
  state = endTurn(state);
  assert.equal(state.hp, 80 - 10, 'smoke 2 should reduce 2 hits of 7 to 10 total damage (80->70)');
  assert.equal(state.battle.statuses.enemy.smoke, 1, 'smoke should decrement from 2 to 1');

  // Flash case: enemy flash 2, two 7-damage hits -> player takes 8 (flash reduces each hit by 3), flash becomes 0
  state = createTestBattle({
    handCards: [],
    energy: 10,
    enemyStatuses: { flash: 2 },
    playerBlock: 0,
    playerStatuses: {}
  });
  setEnemyIntent(state, [{ type: 'hit', n: 7, times: 2 }]);
  state = endTurn(state);
  assert.equal(state.hp, 80 - 8, 'flash 2 should reduce 2 hits of 7 to 8 total damage (80->72)');
  assert.equal(state.battle.statuses.enemy.flash, 0, 'flash should be consumed to 0');

  // Push stance: enemy 7-damage single hit adds +2, so player takes 9 damage
  state = createTestBattle({
    handCards: [],
    energy: 10,
    stance: 'push',
    enemyStatuses: {},
    playerBlock: 0,
    playerStatuses: {}
  });
  setEnemyIntent(state, [{ type: 'hit', n: 7, times: 1 }]);
  state = endTurn(state);
  assert.equal(state.hp, 80 - 9, 'push stance should add +2 to enemy hit, 7 -> 9 damage');
});

test('powers stack correctly: powerStacks and powerCards', () => {
  let state = createTestBattle({ handCards: [], energy: 10 });
  addCardToHand(state, 'TA53'); // Tactical Core
  state = playCardById(state, 'TA53');
  addCardToHand(state, 'TA53');
  state = playCardById(state, 'TA53');
  assert.equal(state.battle.powers.length, 1, 'only one unique power entry');
  assert.equal(state.battle.powerStacks.tactical_core, 2, 'powerStacks should be 2');
  assert.equal(state.battle.powerCards.length, 2, 'powerCards should have 2 cards');
});

test('status cards cause damage on discard, isolated from enemy intent', () => {
  let state = createTestBattle({
    handCards: ['ST01'], // status card, damage 1
    energy: 10,
    enemyIntent: [], // empty intent
    playerBlock: 0,
    playerStatuses: {}
  });
  const hpBefore = state.hp;
  state = endTurn(state);
  assert.equal(state.hp, hpBefore - 1, 'status card should deal 1 damage on discard');
});

test('reward cannot be taken twice', () => {
  let state = createTestBattle({ handCards: [], energy: 10 });
  // Simulate winning: set enemy HP to 1, play attack to kill.
  state.battle.enemyHp = 1;
  addCardToHand(state, 'TA05'); // 0 cost attack 4
  state = playCardById(state, 'TA05');
  assert.equal(state.phase, 'reward');
  const rewardId = state.battle.rewardPool[0];
  const takeRes = act(state, { type: 'reward', id: rewardId });
  assert(!takeRes.error);
  state = takeRes.state;
  const againRes = act(state, { type: 'reward', id: rewardId });
  assert(againRes.error, 'reward should not be taken twice');
});

test('boss reward full heals and retains grown max hp; act3 gives win', () => {
  // Prepare a state with increased maxHp, reduced hp, in reward phase as if boss won.
  let state = createTestBattle({
    handCards: [],
    energy: 10,
    act: 3,
    currentNodeKey: 'boss-node'
  });
  // Mimic boss node
  state.map.nodes[0].kind = 'boss';
  state.maxHp += 20; // grown maxHp
  state.hp = 10; // damaged
  state.phase = 'reward';
  state.battle.rewardPool = ['TA01', 'TA02', 'TA03'];
  state.battle.rewardTaken = false;
  const res = act(state, { type: 'reward', id: 'TA01' });
  assert(!res.error, res.error);
  state = res.state;
  assert.equal(state.hp, state.maxHp, 'boss reward should full heal');
  assert.equal(state.maxHp, 100, 'maxHp should be retained (80+20)');
  assert.equal(state.phase, 'result');
  assert.equal(state.result, 'win');
});

test('exhaust card is removed after play and cannot be replayed', () => {
  let state = createTestBattle({ handCards: [], energy: 10 });
  // TA73 紧急调度: cost 0, draw 3, exhaustSelf, exhaust:true
  addCardToHand(state, 'TA73');
  state = playCardById(state, 'TA73');
  assert.equal(state.battle.exhaustPile.length, 1, 'exhaust card should be in exhaust pile');
  assert.equal(state.battle.discardPile.some(c => c.id === 'TA73'), false, 'should not be in discard');
  assert.equal(state.battle.hand.some(c => c.id === 'TA73'), false, 'should not be in hand');
  // Attempt to play it again should fail because not in hand.
  const res = act(state, { type: 'play', uid: 'h0' }); // old uid might still be reference but card removed
  assert(res.error, 'should not find card in hand');
});

test('card upgrade text matches upgradeEffects', () => {
  // Check TA01: base attack 6, upgrade attack 8.
  const card = CARDS['TA01'];
  assert(card.upgradeText, 'TA01 should have upgradeText');
  assert.notEqual(card.upgradeText, card.text, 'upgrade text should differ from base text');
  assert(card.upgradeText.includes('8'), 'upgrade text should contain 8');
  // Check all cards with upgradeEffects have upgradeText defined.
  for (const id of CARD_IDS) {
    const c = CARDS[id];
    if (c.upgradeEffects && c.upgradeEffects.length > 0) {
      assert(c.upgradeText, `${id} missing upgradeText`);
      assert.strictEqual(typeof c.upgradeText, 'string');
    }
  }
});

test('end turn conserves total battle card count', () => {
  // Use full starter deck from breach (9 cards). Enter battle draws 5, leaving 4 in draw.
  const teamDeck = TEAMS.breach.startingDeck;
  const initialCount = teamDeck.reduce((sum, [, count]) => sum + count, 0);
  let state = createRun('conservation-seed');
  // Manually set up battle with full deck as drawPile.
  let drawPile = [];
  for (const [id, count] of teamDeck) {
    for (let i = 0; i < count; i++) {
      drawPile.push({ uid: `d${drawPile.length}`, id, up: false });
    }
  }
  state.phase = 'combat';
  state.currentNode = 'test-node';
  state.map = { nodes: [{ key: 'test-node', kind: 'battle', enemy: 'E01' }], edges: [] };
  state.battle = {
    enemyId: 'E01',
    enemyName: 'Test Enemy',
    enemyHp: 50,
    enemyMaxHp: 50,
    enemyScript: [],
    enemyScriptIndex: 0,
    enemyIntent: [{ type: 'hit', n: 0, times: 1 }], // no damage
    turn: 1,
    energy: 3,
    stance: 'cover',
    stanceSwitchUsedThisTurn: false,
    attackPlayedThisTurn: false,
    blockPlayedThisTurn: false,
    stanceChangedThisTurn: false,
    playsThisTurn: 0,
    hand: [],
    drawPile,
    discardPile: [],
    exhaustPile: [],
    powers: [],
    powerStacks: {},
    powerCards: [],
    statuses: { player: {}, enemy: {} },
    rewardPool: null,
    rewardTaken: false,
    playerBlock: 0,
    smokeBonusUsedThisTurn: false,
    flashBonusUsedThisTurn: false
  };
  // Draw initial hand (5 cards) manually by calling engine draw? But drawCards is not exported. Simulate by shifting.
  for (let i = 0; i < 5; i++) {
    state.battle.hand.push(state.battle.drawPile.shift());
  }
  const initialBattleTotal = totalBattleCards(state.battle);
  state = endTurn(state);
  const afterBattleTotal = totalBattleCards(state.battle);
  assert.equal(afterBattleTotal, initialBattleTotal, 'total battle cards should be conserved');
});

test('shop removal restrictions: cannot remove last attack or make deck <=5', () => {
  // Setup shop phase with deck of 6 cards: 2 attacks, 4 non-attacks.
  let state = createRun('shop-seed');
  state.phase = 'shop';
  state.deck = [];
  const cardIds = ['TA01', 'TA05', 'TA02', 'TA06', 'TA07', 'TA09']; // two attacks: TA01, TA05
  cardIds.forEach((id, i) => state.deck.push({ uid: `c${i}`, id, up: false }));
  state.money = 1000;
  state.shop = { cards: [] };
  // Attempt to remove the only attack (TA05) when we have two attacks, but after removal one attack remains? Actually we have two attacks: TA01, TA05. Removing TA05 leaves TA01, so allowed.
  // To test disallow, we'll temporarily make only one attack by removing TA01? Simpler: create deck with 1 attack and 5 non-attacks.
  let state2 = createRun('shop2');
  state2.phase = 'shop';
  state2.deck = [
    { uid: 'a1', id: 'TA01', up: false }, // attack
    { uid: 's1', id: 'TA02', up: false },
    { uid: 's2', id: 'TA06', up: false },
    { uid: 's3', id: 'TA07', up: false },
    { uid: 's4', id: 'TA09', up: false },
    { uid: 's5', id: 'TA16', up: false }
  ];
  state2.money = 1000;
  state2.shop = { cards: [] };
  const removeRes = act(state2, { type: 'remove', uid: 'a1' });
  assert(removeRes.error, 'should not allow removing last attack');

  // Now test deck size <= 5 disallow.
  let state3 = createRun('shop3');
  state3.phase = 'shop';
  state3.deck = [
    { uid: 'x1', id: 'TA01', up: false },
    { uid: 'x2', id: 'TA02', up: false },
    { uid: 'x3', id: 'TA03', up: false },
    { uid: 'x4', id: 'TA04', up: false },
    { uid: 'x5', id: 'TA05', up: false }
  ];
  state3.money = 1000;
  state3.shop = { cards: [] };
  const removeRes2 = act(state3, { type: 'remove', uid: 'x1' });
  assert(removeRes2.error, 'should not allow removal when deck size <=5');
});

test('enemy firepower buffs persist, raise later hits, and show in the intent', () => {
  let s = createTestBattle({ enemyIntent: [{ type: 'buff', n: 3 }], stance: 'cover' });
  s.battle.enemyScript = [[{ type: 'hit', n: 10, times: 2 }]];
  const hpBefore = s.hp;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.battle.statuses.enemy.strength, 3);
  assert.equal(s.hp, hpBefore, 'a buff turn deals no damage');
  const { describeIntent } = engine;
  assert.equal(describeIntent(s), '攻击13×2');
  s = act(s, { type: 'end' }).state;
  assert.equal(s.hp, hpBefore - 26);
});

test('a turn stops offering plays once the per-turn play cap is reached', () => {
  const s = createTestBattle({ handCards: ['TA05'] });
  s.battle.playsThisTurn = 40;
  assert.deepEqual(legalActions(s).filter(a => a.type === 'play'), []);
});

test('intent preview counts a same-turn buff before the hit it strengthens', () => {
  const s = createTestBattle({ enemyIntent: [{ type: 'buff', n: 2 }, { type: 'hit', n: 7, times: 1 }] });
  assert.equal(engine.describeIntent(s), '强化火力+2，攻击9×1');
  const hpBefore = s.hp;
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  const after = act(s, { type: 'end' }).state;
  assert.equal(after.hp, hpBefore - 9);
});
