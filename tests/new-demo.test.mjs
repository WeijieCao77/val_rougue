import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CARDS, CARD_IDS, STATUS_CARDS, TEAMS, ENEMIES, RELICS, SUPPLIES } from '../new-demo/content.js';
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

test('content: 144 shared (87 core + 33 archetype + 4 area + 20 keyword) plus four 75-card regional pools and 19 afflictions', () => {
  assert.equal(CARD_IDS.length, 444);
  assert.equal(new Set(CARD_IDS).size, 444);
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
    for (let step = 1; step < 16; step++) {
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

test('sniper aims then fires a heavy shot, and a flash in between breaks the aim', () => {
  const fight = () => {
    const s = createTestBattle({ enemyIntent: [{ type: 'aim' }], stance: 'cover' });
    s.battle.enemyId = 'E02';
    s.battle.enemyScript = [[{ type: 'snipe', n: 24 }]];
    return act(s, { type: 'end' }).state;
  };
  let s = fight();
  assert.equal(s.battle.statuses.enemy.aim, 1);
  assert.match(engine.describeIntent(s), /重狙24/);
  const hp = s.hp;
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  assert.equal(act(s, { type: 'end' }).state.hp, hp - 24);
  s.battle.hand = [{ uid: 'fl', id: 'TA04', up: false }];
  s.battle.energy = 3;
  s = act(s, { type: 'play', uid: 'fl' }).state;
  assert.equal(s.battle.statuses.enemy.aim, 0, 'flash breaks the aim');
  assert.match(engine.describeIntent(s), /仓促射击8/);
});

test('sentinel counter-fire punishes each attack hit, rusher enrages once below half', () => {
  let s = createTestBattle({ handCards: ['TA31'], enemyHp: 50, energy: 3 });
  s.battle.trait = { id: 'thorns', n: 3 };
  const hp = s.hp;
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.equal(s.hp, hp - 6, 'two hits, three counter damage each');
  s = createTestBattle({ handCards: ['TA25'], enemyHp: 40, energy: 3 });
  s.battle.enemyMaxHp = 40;
  s.battle.trait = { id: 'berserk', n: 4 };
  s.battle.traitState = {};
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.equal(s.battle.statuses.enemy.strength, 4);
});

test('battlefield modifiers change both sides and the preview shows it', () => {
  let s = createTestBattle({ handCards: ['TA31'], enemyHp: 50, energy: 3, enemyIntent: [{ type: 'hit', n: 4, times: 2 }] });
  s.battle.field = 'corridor';
  assert.equal(engine.describeIntent(s), '攻击5×2');
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.equal(s.battle.enemyHp, 50 - 2 * 5, 'player multi-hit also gains one per hit');
  s = createTestBattle({ handCards: ['TA01', 'TA01'], enemyHp: 50, energy: 3 });
  s.battle.field = 'highground';
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'play', uid: 'h1' }).state;
  assert.equal(s.battle.enemyHp, 50 - 9 - 6, 'only the first attack of the turn gets +3');
});

test('every map battle has a known enemy and later fights carry a battlefield', async () => {
  const { ENEMIES, GROUPS, FIELDS } = await import('../new-demo/content.js');
  for (const seed of ['a', 'b', 'c']) for (const actNo of [1, 2, 3]) {
    const map = buildMap(seed, actNo);
    for (const node of map.nodes) {
      if (['battle', 'elite', 'boss'].includes(node.kind)) assert.ok(ENEMIES[node.enemy] || GROUPS[node.enemy]?.members.every(m => ENEMIES[m.id]), node.enemy);
      if (node.kind === 'elite' || (node.kind === 'battle' && node.step > 2)) assert.ok(FIELDS[node.field], `${node.key} field`);
    }
  }
});

test('burn ticks through block at the enemy turn and detonate cashes it in', () => {
  let s = createTestBattle({ handCards: ['TA88', 'TA92'], enemyHp: 60, energy: 3, enemyStatuses: { block: 20 }, enemyIntent: [{ type: 'block', n: 1 }] });
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.equal(s.battle.statuses.enemy.burn, 4);
  s = act(s, { type: 'play', uid: 'h1' }).state;
  assert.equal(s.battle.statuses.enemy.burn, 0);
  assert.equal(s.battle.enemyHp, 60, 'detonate damage (8) is an attack, soaked by the 20 block');
  s = createTestBattle({ handCards: ['TA88'], enemyHp: 60, energy: 3, enemyStatuses: { block: 20 }, enemyIntent: [{ type: 'block', n: 1 }] });
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.battle.enemyHp, 56, 'burn ignores block');
  assert.equal(s.battle.statuses.enemy.burn, 3);
});

test('turrets fire at end of turn for their duration, barriers add block', () => {
  let s = createTestBattle({ handCards: ['TA95', 'TA96'], enemyHp: 60, energy: 3, enemyIntent: [{ type: 'block', n: 1 }] });
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'play', uid: 'h1' }).state;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.battle.enemyHp, 55);
  assert.equal(s.battle.deployables.length, 2);
  s = act(s, { type: 'end' }).state;
  s = act(s, { type: 'end' }).state;
  assert.deepEqual(s.battle.deployables, [], 'both expire');
});

test('knives, combo, overload, retain and block-to-damage behave as written', () => {
  let s = createTestBattle({ handCards: ['TA102', 'TA101'], enemyHp: 60, energy: 3 });
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'play', uid: 'h1' }).state;
  const knife = s.battle.hand.find(c => c.id === 'TK01');
  s = act(s, { type: 'play', uid: knife.uid }).state;
  assert.equal(s.battle.enemyHp, 53, 'knife 4 + knife master 3');
  s = createTestBattle({ handCards: ['TA103', 'TA103'], enemyHp: 60, energy: 3 });
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'play', uid: 'h1' }).state;
  assert.equal(s.battle.enemyHp, 60 - 6 - 12);
  s = createTestBattle({ handCards: ['TA111', 'TA117'], enemyHp: 60, energy: 3, enemyIntent: [{ type: 'block', n: 1 }] });
  s.battle.enemyScript = [[{ type: 'block', n: 1 }]];
  s = act(s, { type: 'play', uid: 'h0' }).state;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.battle.energy, 2, 'overload 1');
  assert.ok(s.battle.hand.some(c => c.id === 'TA117'), 'retained card stays in hand');
  s = createTestBattle({ handCards: ['TA107'], enemyHp: 60, energy: 3, playerBlock: 13 });
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.equal(s.battle.enemyHp, 47);
});

test('discover pauses play until a choice is made; the found card is free and exhausts', () => {
  let s = createTestBattle({ handCards: ['TA118', 'TA01'], enemyHp: 60, energy: 1 });
  s = act(s, { type: 'play', uid: 'h0' }).state;
  const options = legalActions(s);
  assert.equal(options.length, 3);
  assert.ok(options.every(a => a.type === 'discover' && CARDS[a.id].type === 'attack'));
  assert.ok(act(s, { type: 'play', uid: 'h1' }).error);
  s = act(s, options[0]).state;
  const found = s.battle.hand.find(c => c.temp);
  assert.ok(legalActions(s).some(a => a.uid === found.uid), 'free even with 0 energy');
  s = act(s, { type: 'play', uid: found.uid }).state;
  if (s.phase === 'combat') assert.ok(s.battle.exhaustPile.some(c => c.uid === found.uid));
});

// ----------------------------- Group fights -----------------------------
function createGroupBattle(groupId, { handCards = [], energy = 3, seed = 'group-fixture' } = {}) {
  const run = createRun(seed);
  run.map = { nodes: [{ key: 'g-node', kind: 'battle', enemy: groupId, step: 5 }], edges: [], starts: ['g-node'], bossId: 'x' };
  const s = act(run, { type: 'enter', key: 'g-node' }).state;
  s.battle.hand = handCards.map((id, i) => ({ uid: `h${i}`, id, up: false }));
  s.battle.energy = energy;
  return s;
}
const quiet = s => { for (const e of s.battle.enemies) { e.intent = [{ type: 'block', n: 0 }]; e.script = [[{ type: 'block', n: 0 }]]; } return s; };

test('group fights keep one roster per enemy and drop the single-enemy mirror', () => {
  const s = createGroupBattle('G01');
  assert.equal(s.battle.enemies.length, 3);
  assert.deepEqual(s.battle.enemies.map(e => e.uid), ['e0', 'e1', 'e2']);
  assert.ok(s.battle.enemies.every(e => e.intent && e.hp > 0 && e.look));
  assert.ok(s.battle.enemies[0].name.endsWith(' A'), 'repeated members are lettered');
  assert.equal(s.battle.enemyHp, undefined);
  assert.equal(s.battle.statuses.enemy, undefined);
});

test('legalActions lists one play per living target for aimed cards, one for area and self cards', () => {
  const s = createGroupBattle('G01', { handCards: ['TA01', 'TA121', 'TA02'] });
  const plays = legalActions(s).filter(a => a.type === 'play');
  assert.deepEqual(plays.filter(a => a.uid === 'h0').map(a => a.target), ['e0', 'e1', 'e2']);
  assert.deepEqual(plays.filter(a => a.uid === 'h1'), [{ type: 'play', uid: 'h1' }]);
  assert.deepEqual(plays.filter(a => a.uid === 'h2'), [{ type: 'play', uid: 'h2' }]);
  s.battle.enemies[1].hp = 0;
  assert.deepEqual(legalActions(s).filter(a => a.uid === 'h0').map(a => a.target), ['e0', 'e2'], 'dead enemies are not targets');
  assert.ok(engine.cardNeedsTarget('TA22') && !engine.cardNeedsTarget('TA121') && !engine.cardNeedsTarget('TA116'));
});

test('aimed cards need a valid target in group fights and only touch that enemy', () => {
  let s = quiet(createGroupBattle('G01', { handCards: ['TA22', 'TA22'] }));
  s.battle.enemies.forEach(e => { e.statuses = {}; });
  assert.match(act(s, { type: 'play', uid: 'h0' }).error, /目标/);
  assert.match(act(s, { type: 'play', uid: 'h0', target: 'nope' }).error, /目标/);
  const hp = s.battle.enemies.map(e => e.hp);
  s = act(s, { type: 'play', uid: 'h0', target: 'e1' }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.hp), [hp[0], hp[1] - 5, hp[2]]);
  assert.equal(s.battle.enemies[1].statuses.vuln, 2);
  assert.equal(s.battle.enemies[0].statuses.vuln || 0, 0);
});

test('area cards hit every living enemy; burn ticks per enemy', () => {
  let s = quiet(createGroupBattle('G03', { handCards: ['TA121', 'TA123'] }));
  s.battle.enemies.forEach(e => { e.statuses = {}; });
  s.battle.enemies[2].hp = 5;
  const hp = s.battle.enemies.map(e => e.hp);
  s = act(s, { type: 'play', uid: 'h0' }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.hp), [hp[0] - 7, hp[1] - 7, 0]);
  s = act(s, { type: 'play', uid: 'h1' }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.statuses.burn || 0), [3, 3, 0], 'dead enemies are skipped');
  s = act(s, { type: 'end' }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.hp), [hp[0] - 10, hp[1] - 10, 0]);
  assert.match(CARDS.TA121.text, /对所有敌人造成7点伤害/);
  assert.match(CARDS.TA122.text, /给予所有敌人2层烟雾/);
});

test('support enemies heal, guard and rally their allies', () => {
  let s = quiet(createGroupBattle('G01'));
  const [a, medic] = s.battle.enemies;
  a.hp = 2;
  medic.intent = [{ type: 'heal', n: 9 }, { type: 'guard', n: 8 }];
  s.battle.enemies[2].hp = s.battle.enemies[2].maxHp - 4;
  s.battle.enemies.forEach(e => { e.statuses = {}; });
  assert.match(engine.describeIntents(s)[medic.uid], /治疗伤势最重的队友9，为队友布防8/);
  s = act(s, { type: 'end' }).state;
  assert.equal(s.battle.enemies[0].hp, 11, 'heal goes to the most wounded ally');
  assert.equal(s.battle.enemies[0].statuses.block, 8, 'guard goes to the lowest-HP other ally');
  assert.equal(s.battle.enemies[1].statuses.block || 0, 0);

  s = quiet(createGroupBattle('G02'));
  s.battle.enemies.forEach(e => { e.statuses = {}; });
  const [r1, spotter, r2] = s.battle.enemies;
  spotter.intent = [{ type: 'rally', n: 2 }];
  r2.intent = [{ type: 'hit', n: 5, times: 1 }];
  const intents = engine.describeIntents(s);
  assert.equal(intents[r2.uid], '攻击7×1', 'rally from an earlier ally shows in the later hit');
  assert.equal(intents[r1.uid], '布防0');
  const hp = s.hp;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.hp, hp - 7);
  assert.deepEqual(s.battle.enemies.map(e => e.statuses.strength), [2, 2, 2]);
});

test('killing one enemy keeps the fight going; the fight is won only when all are down', () => {
  let s = quiet(createGroupBattle('G04', { handCards: ['TA25', 'TA25'], energy: 4 }));
  s.battle.enemies.forEach(e => { e.hp = 10; e.statuses = {}; });
  s = act(s, { type: 'play', uid: 'h0', target: 'e0' }).state;
  assert.equal(s.phase, 'combat');
  assert.equal(s.battle.enemies[0].hp, 0);
  assert.deepEqual(legalActions(s).filter(a => a.type === 'play').map(a => a.target), [undefined], 'one survivor: target implied');
  s = act(s, { type: 'play', uid: 'h1' }).state;
  assert.equal(s.phase, 'reward');
  assert.equal(s.battle.rewardPool.length, 3);
});

test('turrets shoot the lowest-HP living enemy; dead enemies do not act', () => {
  let s = quiet(createGroupBattle('G01', { handCards: ['TA95'] }));
  s.battle.enemies.forEach((e, i) => { e.hp = [20, 9, 15][i]; e.statuses = {}; });
  s = act(s, { type: 'play', uid: 'h0' }).state;
  const hp = s.hp;
  s = act(s, { type: 'end' }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.hp), [20, 4, 15]);
  s.battle.enemies[1].hp = 0;
  s.battle.enemies[1].intent = [{ type: 'hit', n: 30, times: 1 }];
  s.battle.enemies[1].script = [[{ type: 'hit', n: 30, times: 1 }]];
  s = act(s, { type: 'end' }).state;
  assert.equal(s.hp, hp, 'the dead enemy never fires');
  assert.equal(s.battle.enemies[2].hp, 10, 'next shot moves to the new lowest');
});

test('group placement on maps is deterministic and covers roughly a third of later fights', async () => {
  const { GROUPS } = await import('../new-demo/content.js');
  let groups = 0, later = 0;
  for (let i = 0; i < 30; i++) for (const a of [1, 2, 3]) {
    const m = buildMap(`grp-${i}`, a);
    assert.deepEqual(m, buildMap(`grp-${i}`, a));
    for (const n of m.nodes) {
      if (n.kind === 'battle' && n.step < 3) assert.ok(!GROUPS[n.enemy], 'no groups in the first two steps');
      if ((n.kind === 'battle' && n.step >= 3) || n.kind === 'elite') { later++; if (GROUPS[n.enemy]) groups++; }
    }
  }
  assert.ok(groups / later > 0.25 && groups / later < 0.45, `${groups}/${later}`);
});

// ----------------------------- Team traits -----------------------------
const withSquad = (s, squad) => { s.battle.squad = squad; return s; };
const noHit = [{ type: 'block', n: 0 }];

test('每支队伍都有专属特质，开局牌组能触发它', () => {
  assert.deepEqual(Object.values(TEAMS).map(t => t.trait), ['momentum', 'fortify', 'intel', 'dispatch']);
  for (const team of Object.keys(TEAMS)) {
    const run = createRun('trait-' + team, team);
    const s = act(run, { type: 'enter', key: run.map.starts[0] }).state;
    assert.equal(s.battle.squad.id, TEAMS[team].trait);
    const ids = TEAMS[team].startingDeck.map(([id]) => id);
    if (team === 'breach') assert.ok(ids.filter(id => CARDS[id].type === 'attack').length >= 6);
    if (team === 'utility') assert.ok(ids.filter(id => CARDS[id].effects.some(e => e.type === 'smoke' || e.type === 'flash')).length >= 4);
    if (team === 'rotation') assert.ok(ids.some(id => CARDS[id].effects.some(e => e.type === 'stanceSwitch')));
  }
});

test('突击势能：每3张攻击牌后，下一张攻击牌伤害翻倍', () => {
  let s = withSquad(createTestBattle({ handCards: ['TA05', 'TA05', 'TA05', 'TA05', 'TA05', 'TA02'], enemyHp: 100, energy: 3 }), { id: 'momentum', n: 0, armed: false });
  for (let i = 0; i < 3; i++) s = playCardById(s, 'TA05');
  assert.equal(s.battle.enemyHp, 88);
  assert.deepEqual(s.battle.squad, { id: 'momentum', n: 0, armed: true });
  s = playCardById(s, 'TA02');
  assert.equal(s.battle.squad.armed, true, 'skills do not spend the charge');
  s = playCardById(s, 'TA05');
  assert.equal(s.battle.enemyHp, 80, 'doubled hit: 4×2');
  assert.deepEqual(s.battle.squad, { id: 'momentum', n: 1, armed: false });
});

test('工事：敌方回合后剩余布防的一半（向上取整，最多12）保留到下回合', () => {
  let s = withSquad(createTestBattle({ enemyHp: 50, playerBlock: 16, enemyIntent: [{ type: 'hit', n: 5, times: 1 }] }), { id: 'fortify', kept: 0 });
  s.battle.enemyScript = [noHit];
  s = endTurn(s);
  assert.equal(s.hp, 80);
  assert.equal(s.battle.playerBlock, 6);
  assert.equal(s.battle.squad.kept, 6);
  s.battle.playerBlock = 40;
  s = endTurn(s);
  assert.equal(s.battle.playerBlock, 12, 'capped at 12');
  const plain = endTurn(createTestBattle({ enemyHp: 50, playerBlock: 15, enemyIntent: noHit }));
  assert.equal(plain.battle.playerBlock, 0, 'other teams lose block as before');
});

test('情报：每次给予烟雾或闪光+1，满6抽1张牌并获得1能量；范围效果只算一次', () => {
  let s = withSquad(createTestBattle({ handCards: ['TA66', 'TA12', 'TA66'], drawPile: ['TA01', 'TA01'], enemyHp: 50, energy: 3 }), { id: 'intel', n: 3 });
  s = playCardById(s, 'TA66');
  assert.equal(s.battle.squad.n, 5);
  s = playCardById(s, 'TA12');
  assert.equal(s.battle.squad.n, 0, 'the 6th point triggers and resets');
  s = playCardById(s, 'TA66');
  assert.equal(s.battle.squad.n, 2);
  assert.equal(s.battle.energy, 3 - 1 - 1 - 1 + 1);
  assert.equal(s.battle.hand.length, 1, 'drew one card');
  let g = createGroupBattle('G01', { handCards: ['TA122'], seed: 'intel-group' });
  g.battle.squad = { id: 'intel', n: 0 };
  g = act(g, { type: 'play', uid: 'h0' }).state;
  assert.equal(g.battle.squad.n, 1);
});

test('机动调度：每回合第一次切换姿态抽1张牌，手动切换不耗能量', () => {
  let s = withSquad(createTestBattle({ handCards: ['TA64'], drawPile: ['TA01', 'TA01', 'TA01'], enemyHp: 50, energy: 0 }), { id: 'dispatch', used: false });
  assert.ok(legalActions(s).some(a => a.type === 'stance'), 'free manual switch at 0 energy');
  s = act(s, { type: 'stance' }).state;
  assert.equal(s.battle.energy, 0);
  assert.equal(s.battle.stance, 'push');
  assert.equal(s.battle.hand.length, 2);
  s.battle.energy = 1;
  s = playCardById(s, 'TA64');
  assert.equal(s.battle.hand.length, 1, 'second switch this turn draws nothing');
  s.battle.enemyIntent = noHit; s.battle.enemyScript = [noHit];
  s = endTurn(s);
  assert.equal(s.battle.squad.used, false, 'resets each turn');
  const other = createTestBattle({ enemyHp: 50, energy: 0 });
  assert.ok(!legalActions(other).some(a => a.type === 'stance'), 'others still pay 1');
});

// ----------------------------- 赛前准备 -----------------------------
test('赛前准备：按种子给出2个免费、1个代价、1个热身选项，结果可复现', () => {
  const a = createRun('open-1', 'anchor', { opening: true });
  const b = createRun('open-1', 'anchor', { opening: true });
  assert.equal(a.phase, 'opening');
  assert.deepEqual(a.opening, b.opening);
  assert.deepEqual(a.opening.options.map(o => o.group), ['free', 'free', 'trade', 'steady']);
  assert.deepEqual(legalActions(a).map(x => x.choice), a.opening.options.map(o => o.id));
  const seen = new Set();
  for (let i = 0; i < 40; i++) for (const o of createRun('open-v' + i, 'breach', { opening: true }).opening.options) seen.add(o.id);
  assert.ok(seen.size >= 8, 'options vary across seeds');
  assert.equal(createRun('open-1', 'anchor').phase, 'map', 'without the option runs start on the map');
});

test('赛前准备：各选项效果与后续选牌阶段', () => {
  const make = id => { const s = createRun('open-fx', 'breach', { opening: true }); s.opening.options[0] = { id, group: 'free', text: id, cards: id === 'uncommon' ? ['TA22', 'TA27', 'TA29'] : undefined }; return s; };
  let s = act(make('maxhp'), { type: 'opening', choice: 'maxhp' }).state;
  assert.equal(s.maxHp, 88); assert.equal(s.hp, 88); assert.equal(s.phase, 'map');
  s = act(make('gold'), { type: 'opening', choice: 'gold' }).state;
  assert.equal(s.money, 200);
  s = act(make('remove'), { type: 'opening', choice: 'remove' }).state;
  assert.equal(s.phase, 'openingPick');
  const before = s.deck.length;
  s = act(s, legalActions(s)[0]).state;
  assert.equal(s.deck.length, before - 1); assert.equal(s.phase, 'map');
  s = act(make('upgrade'), { type: 'opening', choice: 'upgrade' }).state;
  s = act(s, legalActions(s)[0]).state;
  assert.equal(s.deck.filter(c => c.up).length, 1);
  s = act(make('uncommon'), { type: 'opening', choice: 'uncommon' }).state;
  assert.ok(act(s, { type: 'openingPick', id: 'TA01' }).error);
  s = act(s, { type: 'openingPick', id: 'TA27' }).state;
  assert.ok(s.deck.some(c => c.id === 'TA27'));
  const trade = createRun('open-fx', 'breach', { opening: true });
  trade.opening.options[2] = { id: 'hpForRare', group: 'trade', text: '', cards: ['TA41', 'TA65'] };
  s = act(trade, { type: 'opening', choice: 'hpForRare' }).state;
  assert.equal(s.maxHp, 72);
  s = act(s, { type: 'openingPick', id: null }).state;
  assert.equal(s.phase, 'map', 'card choices can be skipped');
  trade.opening.options[2] = { id: 'goldForRelics', group: 'trade', text: '' };
  s = act(trade, { type: 'opening', choice: 'goldForRelics' }).state;
  assert.equal(s.money, 0); assert.equal(s.relics.length, 2); assert.notEqual(s.relics[0].id, s.relics[1].id);
  trade.opening.options[2] = { id: 'curseForRelic', group: 'trade', text: '' };
  s = act(trade, { type: 'opening', choice: 'curseForRelic' }).state;
  assert.equal(s.relics.length, 1); assert.ok(s.deck.some(c => STATUS_CARDS[c.id]?.curse));
  s = act(trade, { type: 'opening', choice: 'warmup' }).state;
  assert.equal(s.warmup, 3);
  s = act(s, { type: 'enter', key: s.map.starts[0] }).state;
  delete s.battle.enemyHp; const e = s.battle.enemies[0];
  assert.equal(e.maxHp, Math.round(ENEMIES[e.id].hp * 0.7));
  assert.equal(s.warmup, 2);
});

// ----------------------------- 难度等级 -----------------------------
test('难度等级：0级与原版完全一致，各级规则叠加生效', () => {
  const base = createRun('asc-seed', 'utility');
  const zero = createRun('asc-seed', 'utility', { ascension: 0 });
  assert.deepEqual(zero, base);
  assert.equal(engine.ASCENSION_RULES.length, 11);
  const a6 = createRun('asc-seed', 'utility', { ascension: 6 });
  assert.equal(a6.hp, 72); assert.equal(a6.maxHp, 80);
  assert.equal(engine.restHealAmount(a6), 16);
  assert.equal(engine.restHealAmount(base), 24);
  const a9 = createRun('asc-seed', 'utility', { ascension: 9 });
  assert.equal(a9.deck.length, base.deck.length + 1);
  assert.ok(STATUS_CARDS[a9.deck.at(-1).id].curse);
  let e0 = 0, e1 = 0;
  for (let i = 0; i < 20; i++) for (const a of [1, 2, 3]) {
    e0 += buildMap('asc-map-' + i, a).nodes.filter(n => n.kind === 'elite').length;
    e1 += buildMap('asc-map-' + i, a, 1).nodes.filter(n => n.kind === 'elite').length;
  }
  assert.ok(e1 > e0 * 1.3, `elites ${e0} -> ${e1}`);
});

test('难度等级：敌人生命与伤害按类别提高，10级决战对手开局3层火力', () => {
  const fight = (asc, enemy, kind) => {
    const run = createRun('asc-fight', 'breach', { ascension: asc });
    run.map = { nodes: [{ key: 'x', kind, enemy, step: 5 }], edges: [], starts: ['x'], bossId: 'x' };
    return act(run, { type: 'enter', key: 'x' }).state.battle.enemies[0];
  };
  const hits = e => e.script.flat().filter(a => a.type === 'hit').map(a => a.n).sort((x, y) => x - y);
  const n0 = fight(0, 'E01', 'battle'), n2 = fight(2, 'E01', 'battle'), n7 = fight(7, 'E01', 'battle');
  assert.deepEqual(hits(n2), hits(n0).map(n => Math.round(n * 1.1)));
  assert.equal(n2.maxHp, n0.maxHp);
  assert.equal(n7.maxHp, Math.round(n0.maxHp * 1.1));
  const el0 = fight(0, 'EL01', 'elite'), el3 = fight(3, 'EL01', 'elite'), el8 = fight(8, 'EL01', 'elite');
  assert.deepEqual(hits(el3), hits(el0).map(n => Math.round(n * 1.15)));
  assert.equal(el8.maxHp, Math.round(el0.maxHp * 1.1));
  const b0 = fight(0, 'B01', 'boss'), b4 = fight(4, 'B01', 'boss'), b10 = fight(10, 'B01', 'boss');
  assert.deepEqual(hits(b4), hits(b0).map(n => Math.round(n * 1.1)));
  assert.equal(b0.statuses.strength || 0, 0);
  assert.equal(b10.statuses.strength, 3);
  assert.equal(fight(3, 'E01', 'battle').maxHp, n0.maxHp, 'elite rules leave normal fights alone');
});

// ----------------------------- 装备 / 补给品 / 决战奖励 -----------------------------
const gear = (s, ...ids) => { for (const id of ids) s.relics.push({ id, name: RELICS[id].name, desc: RELICS[id].desc }); return s; };
function soloFight(kind, enemy, { seed = 'gear-fight', relics = [], supplies = [], team = 'breach' } = {}) {
  const run = createRun(seed, team);
  gear(run, ...relics);
  run.supplies = supplies.slice();
  run.map = { nodes: [{ key: 'x', kind, enemy, step: 5 }], edges: [], starts: ['x'], bossId: 'x' };
  return act(run, { type: 'enter', key: 'x' }).state;
}
const winNow = s => { delete s.battle.enemyHp; for (const e of s.battle.enemies) e.hp = 1; s.battle.hand = [{ uid: 'k', id: 'TA121', up: false }]; s.battle.energy = 3; return act(s, { type: 'play', uid: 'k' }).state; };

test('装备与补给品：数量、等级与原创命名', () => {
  const ids = Object.keys(RELICS);
  assert.ok(ids.length >= 45 && ids.length <= 50, `${ids.length}`);
  const count = t => ids.filter(id => RELICS[id].tier === t).length;
  assert.ok(count('common') >= 10 && count('uncommon') >= 8 && count('rare') >= 6 && count('shop') >= 3);
  assert.ok(count('boss') >= 10 && count('boss') <= 12);
  const supplies = Object.keys(SUPPLIES);
  assert.ok(supplies.length >= 15 && supplies.length <= 20);
  for (const x of [...Object.values(RELICS), ...Object.values(SUPPLIES)]) {
    assert.ok(x.name && x.desc, x.id);
    assert.doesNotMatch(x.name + x.desc, /遗物|药水|无畏契约|VCT/);
  }
});

test('精英战胜利必得1件不重复的装备，随机装备按普通/罕见/稀有加权', () => {
  const s = winNow(soloFight('elite', 'EL01'));
  assert.equal(s.phase, 'reward');
  assert.equal(s.relics.length, 1);
  assert.deepEqual(s.battle.rewardRelics, [s.relics[0].id]);
  assert.ok(['common', 'uncommon', 'rare'].includes(RELICS[s.relics[0].id].tier));
  const tally = { common: 0, uncommon: 0, rare: 0 };
  for (let i = 0; i < 300; i++) tally[RELICS[winNow(soloFight('elite', 'EL01', { seed: 'tier-' + i })).relics[0].id].tier]++;
  assert.ok(tally.common > tally.uncommon && tally.uncommon > tally.rare && tally.rare > 20, JSON.stringify(tally));
  let owned = soloFight('elite', 'EL01', { seed: 'dupe' });
  const all = ['common', 'uncommon', 'rare'].flatMap(t => Object.keys(RELICS).filter(id => RELICS[id].tier === t));
  gear(owned, ...all.slice(0, -1));
  owned = winNow(owned);
  assert.equal(owned.pendingRelics[0], all.at(-1), 'never offers a duplicate (slots are full, so it waits)');
});

test('幕末决战后从3件决战专属装备中选1件或跳过，然后进入幕间', () => {
  let s = winNow(soloFight('boss', 'B01'));
  s = act(s, { type: 'reward', id: null }).state;
  assert.equal(s.phase, 'bossRelic');
  const opts = s.bossRelic.options;
  assert.equal(new Set(opts).size, 3);
  assert.ok(opts.every(id => RELICS[id].tier === 'boss'));
  const took = act(s, { type: 'bossRelic', id: opts[0] }).state;
  assert.equal(took.phase, 'intermission');
  assert.ok(took.relics.some(r => r.id === opts[0]));
  assert.ok(took.checkpoint.relics.some(r => r.id === opts[0]));
  const skipped = act(s, { type: 'bossRelic', id: null }).state;
  assert.equal(skipped.phase, 'intermission');
  assert.ok(act(s, { type: 'bossRelic', id: 'R02' }).error);
});

test('决战装备：能量+1、抽牌变化与代价', () => {
  let s = soloFight('battle', 'E01', { relics: ['R40'] });
  assert.equal(s.battle.energy, 4);
  assert.equal(s.battle.hand.length, 4, '超频战术背包 draws one fewer');
  s = soloFight('battle', 'E01', { relics: ['R43'] });
  assert.equal(s.battle.hand.length, 6);
  assert.equal(s.battle.drawPile.filter(c => c.id === 'ST01').length, 2);
  s = soloFight('battle', 'E01', { relics: ['R44'] });
  assert.equal(s.hp, 75); assert.equal(s.battle.energy, 4);
  const rest = gear(createRun('no-rest'), 'R42'); rest.phase = 'rest';
  assert.ok(!legalActions(rest).some(a => a.choice === 'heal'));
  assert.ok(act(rest, { type: 'rest', choice: 'heal' }).error);
  s = soloFight('battle', 'E01', { relics: ['R45'] });
  s.battle.hand = Array.from({ length: 8 }, (_, i) => ({ uid: 'q' + i, id: 'TA05', up: false }));
  delete s.battle.enemyHp; s.battle.enemies[0].hp = 999;
  for (let i = 0; i < 6; i++) s = act(s, { type: 'play', uid: 'q' + i }).state;
  assert.ok(!legalActions(s).some(a => a.type === 'play'), 'at most 6 cards per turn');
  const zero = winNow(soloFight('battle', 'E01', { relics: ['R48'] }));
  assert.equal(zero.money, 100, '零薪合约: no combat gold');
});

test('装备效果：双发扳机、抗冲击背心、反应装甲、快速弹匣、急救自注射器、预案卡', () => {
  let s = soloFight('battle', 'E01', { relics: ['R30'] });
  delete s.battle.enemyHp; s.battle.enemies[0].hp = 100; s.battle.enemies[0].statuses = {};
  s.battle.hand = [{ uid: 'a', id: 'TA19', up: false }, { uid: 'b', id: 'TA19', up: false }];
  s.battle.stance = 'cover';
  s = act(s, { type: 'play', uid: 'a' }).state;
  assert.equal(s.battle.enemyHp, 100 - 18, 'first attack resolves twice');
  s = act(s, { type: 'play', uid: 'b' }).state;
  assert.equal(s.battle.enemyHp, 100 - 27);

  s = soloFight('battle', 'E01', { relics: ['R31', 'R16'] });
  delete s.battle.enemyHp; const e = s.battle.enemies[0];
  e.intent = [{ type: 'hit', n: 20, times: 1 }]; e.script = [[{ type: 'block', n: 0 }]]; e.statuses = {}; e.hp = 50;
  s.battle.hand = []; s.battle.playerBlock = 0;
  s = act(s, { type: 'end' }).state;
  assert.equal(s.hp, 79, 'vest turns the first hit into 1');
  assert.equal(s.battle.enemyHp, 47, 'reactive armour hits back for 3');

  s = soloFight('battle', 'E01', { relics: ['R26'] });
  delete s.battle.enemyHp; s.battle.enemies[0].intent = [{ type: 'block', n: 0 }];
  s.battle.hand = [{ uid: 'c1', id: 'TA05', up: false }, { uid: 'c2', id: 'TA10', up: false }];
  s = act(s, { type: 'end' }).state;
  assert.ok(s.battle.hand.some(c => c.uid === 'c2'), 'priciest card kept');
  assert.ok(!s.battle.hand.some(c => c.uid === 'c1'));

  s = soloFight('battle', 'E01', { relics: ['R34'] });
  s.hp = 3;
  delete s.battle.enemyHp; s.battle.enemies[0].intent = [{ type: 'hit', n: 30, times: 1 }]; s.battle.enemies[0].statuses = {};
  s.battle.hand = [];
  s = act(s, { type: 'end' }).state;
  assert.equal(s.phase, 'combat');
  assert.equal(s.hp, 40);
  assert.ok(s.relics.find(r => r.id === 'R34').used);

  s = soloFight('battle', 'E01', { relics: ['R29'] });
  const pricey = s.battle.hand.reduce((m, c) => (CARDS[c.id].cost > CARDS[m.id].cost ? c : m));
  assert.equal(pricey.free, true);
});

test('补给品：掉落概率40%起并±10，栏位满时可替换或放弃', () => {
  let s = soloFight('battle', 'E01', { seed: 'drop-a' });
  s.supplyChance = 100;
  s = winNow(s);
  assert.equal(s.supplies.length, 1);
  assert.equal(s.supplyChance, 90);
  s = soloFight('battle', 'E01', { seed: 'drop-b' });
  s.supplyChance = 0;
  s = winNow(s);
  assert.equal(s.supplies.length, 0);
  assert.equal(s.supplyChance, 10);
  assert.equal(createRun('x').supplyChance, 40);
  s = soloFight('battle', 'E01', { seed: 'drop-c', supplies: ['P01', 'P02', 'P03'] });
  s.supplyChance = 100;
  s = winNow(s);
  const found = s.battle.rewardSupply;
  assert.ok(found);
  assert.deepEqual(legalActions(s).filter(a => a.type === 'takeSupply').map(a => a.replace), [0, 1, 2]);
  const replaced = act(s, { type: 'takeSupply', replace: 1 }).state;
  assert.deepEqual(replaced.supplies, ['P01', found, 'P03']);
  const skipped = act(s, { type: 'reward', id: null }).state;
  assert.deepEqual(skipped.supplies, ['P01', 'P02', 'P03']);
  const dropped = act(skipped, { type: 'discardSupply', index: 0 }).state;
  assert.deepEqual(dropped.supplies, ['P02', 'P03']);
});

test('补给品：战斗中使用，需目标的在多名敌人时必须选目标', () => {
  let s = createGroupBattle('G01', { seed: 'supply-group' });
  s.supplies = ['P09', 'P03', 'P01'];
  s.hp = 50;
  assert.match(act(s, { type: 'useSupply', index: 0 }).error, /目标/);
  s = act(s, { type: 'useSupply', index: 0, target: 'e1' }).state;
  assert.equal(s.battle.enemies[1].statuses.vuln, 3);
  assert.deepEqual(s.supplies, ['P03', 'P01']);
  const hp = s.battle.enemies.map(e => e.hp);
  s = act(s, { type: 'useSupply', index: 0 }).state;
  assert.deepEqual(s.battle.enemies.map(e => e.hp), hp.map((h, i) => Math.max(0, h - (i === 1 ? 15 : 10))));
  s = act(s, { type: 'useSupply', index: 0 }).state;
  assert.equal(s.hp, 62);
  assert.equal(s.supplies.length, 0);
  const outside = createRun('out'); outside.supplies = ['P01'];
  assert.ok(act(outside, { type: 'useSupply', index: 0 }).error, 'only in combat');
});

test('补给站：卖2件随机装备+1件补给站专属装备和3件补给品，会员卡打八折', () => {
  let s = createRun('shop-gear');
  s.money = 1000;
  s.map = { nodes: [{ key: 'sh', kind: 'shop', step: 6 }], edges: [], starts: ['sh'], bossId: 'x' };
  s = act(s, { type: 'enter', key: 'sh' }).state;
  assert.equal(s.shop.relics.length, 3);
  assert.equal(RELICS[s.shop.relics[2].id].tier, 'shop');
  assert.equal(s.shop.supplies.length, 3);
  const shopOnly = s.shop.relics[2];
  s = act(s, { type: 'buyRelic', index: 2 }).state;
  assert.equal(s.money, 1000 - shopOnly.price);
  assert.ok(s.relics.some(r => r.id === shopOnly.id));
  const before = s.money;
  const withCard = gear(s, 'R36');
  const item = withCard.shop.supplies[0];
  const next = act(withCard, { type: 'buySupply', index: 0 }).state;
  assert.equal(next.money, before - Math.floor(item.price * 0.8));
  assert.equal(next.supplies.length, 1);
  next.supplies = ['P01', 'P01', 'P01'];
  assert.match(act(next, { type: 'buySupply', index: 0 }).error, /栏位/);
});

test('装备槽：最多6件，槽满时替换（按品级折算金币）或放弃新装备，随时可出售', () => {
  let s = soloFight('elite', 'EL01', { seed: 'slots', relics: ['R02', 'R03', 'R13', 'R01', 'R06', 'R40'] });
  assert.equal(engine.RELIC_SLOTS, 6);
  s = winNow(s);
  assert.equal(s.relics.length, 6);
  assert.equal(s.pendingRelics.length, 1);
  const newcomer = s.pendingRelics[0];
  const legal = legalActions(s);
  assert.deepEqual(legal.map(a => a.type), ['declineRelic', ...Array(6).fill('replaceRelic')]);
  assert.match(act(s, { type: 'reward', id: null }).error, /新装备/);
  const money = s.money;
  const replaced = act(s, { type: 'replaceRelic', index: 5 }).state;
  assert.equal(replaced.money, money + 50, 'boss piece sells for 50');
  assert.ok(!replaced.relics.some(r => r.id === 'R40'));
  assert.ok(replaced.relics.some(r => r.id === newcomer));
  assert.equal(replaced.pendingRelics.length, 0);
  const declined = act(s, { type: 'declineRelic' }).state;
  assert.equal(declined.money, money);
  assert.ok(!declined.relics.some(r => r.id === newcomer));
  const sold = act(declined, { type: 'sellRelic', index: 0 }).state;
  assert.equal(sold.money, money + 15, 'common sells for 15');
  assert.equal(sold.relics.length, 5);
  assert.equal(engine.relicSellValue('R06'), 40);
  assert.equal(engine.relicSellValue('R01'), 25);
  // Shop gear needs a free slot.
  const shop = gear(createRun('slot-shop'), 'R02', 'R03', 'R13', 'R01', 'R06', 'R40');
  shop.money = 999;
  shop.map = { nodes: [{ key: 'sh', kind: 'shop', step: 6 }], edges: [], starts: ['sh'], bossId: 'x' };
  const inShop = act(shop, { type: 'enter', key: 'sh' }).state;
  assert.ok(!legalActions(inShop).some(a => a.type === 'buyRelic'));
  assert.match(act(inShop, { type: 'buyRelic', index: 0 }).error, /装备槽已满/);
});

// ----------------------------- Boss pool, encounter pools, keywords (2026-09-24) -----------------------------
test('boss pool: each act draws one of three bosses by seed, stable across rebuilds, with preview data', async () => {
  const { BOSSES, BOSS_IDS_BY_ACT, GROUPS } = await import('../new-demo/content.js');
  const { BOSS_POOL, bossForAct } = await import('../new-demo/season-map.js');
  assert.equal(Object.keys(BOSSES).length, 9);
  const looks = new Set();
  for (const a of [1, 2, 3]) {
    assert.deepEqual(BOSS_POOL[a], BOSS_IDS_BY_ACT[a]);
    for (const id of BOSS_POOL[a]) {
      const b = BOSSES[id];
      assert.ok(b && b.name && b.text && b.look && b.color && b.icon, id);
      assert.equal(b.act, a);
      assert.doesNotMatch(b.name + b.text, /无畏契约|VCT|建议|构筑/);
      looks.add(b.look);
      // Every candidate is a real fight: a boss enemy or a boss group.
      const members = GROUPS[id]?.members.map(m => m.id) || [id];
      assert.ok(members.every(m => ENEMIES[m]), id);
      assert.ok(members.some(m => ENEMIES[m].boss), `${id} has a boss`);
    }
  }
  assert.equal(looks.size, 9, 'every boss has its own look');
  for (let i = 0; i < 20; i++) for (const a of [1, 2, 3]) {
    const m = buildMap(`boss-${i}`, a);
    assert.equal(m.boss, buildMap(`boss-${i}`, a).boss);
    assert.equal(m.boss, bossForAct(`boss-${i}`, a));
    assert.equal(m.nodes.find(n => n.kind === 'boss').enemy, m.boss);
  }
  // A saved run keeps its boss: the map (and boss node) travel with the save.
  const run = createRun('boss-save');
  const reloaded = JSON.parse(JSON.stringify(run));
  assert.equal(reloaded.map.boss, run.map.boss);
});

test('boss pool: all three candidates of every act appear across seeds', async () => {
  const { BOSS_POOL } = await import('../new-demo/season-map.js');
  for (const a of [1, 2, 3]) {
    const seen = new Set();
    for (let i = 0; i < 60; i++) seen.add(buildMap(`reach-${i}`, a).boss);
    assert.deepEqual([...seen].sort(), BOSS_POOL[a].slice().sort(), `act ${a}`);
  }
});

test('encounter pools: weak opening floors, strong pool later, no parent/grandparent repeats', async () => {
  const { WEAK_POOL, STRONG_SINGLES, STRONG_GROUPS, WEAK_STEPS } = await import('../new-demo/season-map.js');
  const { GROUPS } = await import('../new-demo/content.js');
  let repeats = 0, checked = 0;
  for (let i = 0; i < 40; i++) for (const a of [1, 2, 3]) {
    const m = buildMap(`pool-${i}`, a);
    const prefix = a === 1 ? '' : `A${a}_`;
    const byKey = new Map(m.nodes.map(n => [n.key, n]));
    const parents = n => m.edges.filter(e => e.to === n.key).map(e => byKey.get(e.from));
    const enc = n => n.kind === 'battle' ? n.enemy : n.kind === 'event' ? n.ambush : null;
    for (const n of m.nodes) {
      const id = enc(n);
      if (!id) continue;
      const bare = id.slice(prefix.length);
      if (n.step <= WEAK_STEPS[a]) {
        assert.ok(WEAK_POOL.includes(bare), `${n.key} step ${n.step}: ${id} should be weak`);
        assert.ok(!GROUPS[id], 'no group fights in the weak phase');
      } else {
        assert.ok([...STRONG_SINGLES, ...STRONG_GROUPS].includes(bare), `${n.key} step ${n.step}: ${id} should be strong`);
      }
      if (n.kind !== 'battle') continue;
      for (const p of parents(n)) {
        for (const q of [p, ...parents(p)]) { checked++; if (enc(q) === id && q.kind === 'battle') repeats++; }
      }
    }
    // Elites never repeat on a direct elite-to-elite chain.
    for (const n of m.nodes.filter(x => x.kind === 'elite')) for (const p of parents(n)) if (p.kind === 'elite') assert.notEqual(p.enemy, n.enemy);
  }
  assert.equal(repeats, 0, `${repeats}/${checked} parent/grandparent repeats`);
});

test('虚无: an ethereal card still in hand at end of turn is exhausted, not discarded', () => {
  let s = createTestBattle({ handCards: ['TA125', 'TA01'], enemyIntent: [{ type: 'block', n: 0 }] });
  s = endTurn(s);
  assert.ok(s.battle.exhaustPile.some(c => c.id === 'TA125'));
  assert.ok(!s.battle.discardPile.some(c => c.id === 'TA125'));
  assert.ok(s.battle.discardPile.some(c => c.id === 'TA01') || s.battle.hand.some(c => c.id === 'TA01'));
  // Played normally it goes to the discard pile like any card.
  let t = createTestBattle({ handCards: ['TA125'], enemyHp: 50 });
  t = playCardById(t, 'TA125');
  assert.equal(t.battle.enemyHp, 50 - 11);
  assert.ok(t.battle.discardPile.some(c => c.id === 'TA125'));
  assert.match(CARDS.TA125.text, /虚无/);
});

test('固有: innate cards are always in the opening hand', () => {
  for (let i = 0; i < 12; i++) {
    const run = createRun(`innate-${i}`);
    run.deck.push({ uid: 'inn1', id: 'TA130', up: false }, { uid: 'inn2', id: 'TA131', up: false });
    const s = act(run, { type: 'enter', key: run.map.starts[0] }).state;
    assert.ok(s.battle.hand.some(c => c.uid === 'inn1') && s.battle.hand.some(c => c.uid === 'inn2'), `seed ${i}`);
  }
  // More innate cards than the normal draw: the opening hand grows to hold them.
  const run = createRun('innate-many');
  for (let i = 0; i < 7; i++) run.deck.push({ uid: `many${i}`, id: 'TA131', up: false });
  const s = act(run, { type: 'enter', key: run.map.starts[0] }).state;
  assert.ok(s.battle.hand.filter(c => c.id === 'TA131').length === 7);
  assert.match(CARDS.TA130.text, /^固有/);
});

test('X 费: spends all current energy and scales with it; upgrades add to X', () => {
  let s = createTestBattle({ handCards: ['TA139'], enemyHp: 60, energy: 3 });
  assert.ok(legalActions(s).some(a => a.type === 'play'));
  s = playCardById(s, 'TA139');
  assert.equal(s.battle.energy, 0);
  assert.equal(s.battle.enemyHp, 60 - 3 * 7);
  let up = createTestBattle({ handCards: ['TA139'], enemyHp: 60, energy: 3 });
  up.battle.hand[0].up = true;
  up = playCardById(up, 'TA139');
  assert.equal(up.battle.enemyHp, 60 - 4 * 7, 'upgraded: X+1 hits');
  let zero = createTestBattle({ handCards: ['TA139'], enemyHp: 60, energy: 0 });
  zero = playCardById(zero, 'TA139');
  assert.equal(zero.battle.enemyHp, 60, 'X = 0 does nothing');
  let blk = createTestBattle({ handCards: ['TA136'], energy: 2, stance: 'push' });
  blk = playCardById(blk, 'TA136');
  assert.equal(blk.battle.playerBlock, 10);
  assert.equal(blk.battle.energy, 0);
  // Banked energy/draw arrive at the start of the next turn.
  let bank = createTestBattle({ handCards: ['TA138'], drawPile: Array(10).fill('TA01'), energy: 2, enemyIntent: [{ type: 'block', n: 0 }] });
  bank = playCardById(bank, 'TA138');
  bank = endTurn(bank);
  assert.equal(bank.battle.energy, 3 + 2);
  assert.equal(bank.battle.hand.length, 5 + 2);
  assert.equal(engine.observe(createTestBattle({ handCards: ['TA135'] })).hand[0].x, true);
  assert.match(CARDS.TA135.text, /^X 费/);
});

test('成长: each play improves only that copy, only for the current combat', () => {
  let s = createTestBattle({ handCards: ['TA140', 'TA140'], enemyHp: 100, energy: 3 });
  const [a, b] = s.battle.hand.map(c => c.uid);
  s = act(s, { type: 'play', uid: a }).state;
  assert.equal(s.battle.enemyHp, 100 - 7);
  s = act(s, { type: 'play', uid: b }).state;
  assert.equal(s.battle.enemyHp, 100 - 14, 'the other copy has not grown');
  // Bring copy A back to hand: it now hits for 7 + 4.
  const i = s.battle.discardPile.findIndex(c => c.uid === a);
  s.battle.hand.push(s.battle.discardPile.splice(i, 1)[0]);
  assert.equal(s.battle.hand[0].grow, 1);
  assert.match(engine.combatCardText(s.battle.hand[0]), /11点伤害/);
  s = act(s, { type: 'play', uid: a }).state;
  assert.equal(s.battle.enemyHp, 100 - 14 - 11);
  assert.ok(s.deck.every(c => !c.grow), 'deck copies never change');
  // A new combat starts from the deck copy: no growth carried over.
  const run = createRun('growth-reset');
  run.deck.push({ uid: 'gr', id: 'TA140', up: false });
  const fight = act(run, { type: 'enter', key: run.map.starts[0] }).state;
  const copy = [...fight.battle.hand, ...fight.battle.drawPile].find(c => c.uid === 'gr');
  assert.ok(copy && !copy.grow);
});

test('boss traits: overwatch fires from the 6th card, reactive shield, summon refills escorts, mode shift', () => {
  // 全程监视
  let s = soloFight('boss', 'A3_B02', { seed: 'ow' });
  s.battle.hand = Array.from({ length: 7 }, (_, i) => ({ uid: `z${i}`, id: 'TA06', up: false }));
  s.battle.energy = 3;
  const hp = s.hp;
  for (let i = 0; i < 5; i++) s = act(s, { type: 'play', uid: `z${i}` }).state;
  assert.equal(s.hp, hp);
  const blockBefore = s.battle.playerBlock;
  s = act(s, { type: 'play', uid: 'z5' }).state;
  assert.equal(s.hp + s.battle.playerBlock, hp + blockBefore + 3 - engine.OVERWATCH_DAMAGE, '6th card draws fire (block absorbs first)');
  // 应激护盾
  let r = soloFight('boss', 'A2_B02', { seed: 'rx' });
  r.battle.hand = [{ uid: 'q', id: 'TA06', up: false }];
  r.battle.energy = 3;
  r = act(r, { type: 'play', uid: 'q' }).state;
  assert.equal(engine.battleEnemies(r.battle)[0].statuses.block, ENEMIES.A2_B02.trait.n);
  r = act(r, { type: 'end' }).state;
  assert.equal(engine.battleEnemies(r.battle)[0].statuses.block || 0, 0, 'shield drops when it acts');
  // 战区指挥: escorts killed, the summon brings one back.
  let m = soloFight('boss', 'A2_B03', { seed: 'mx' });
  assert.equal(m.battle.enemies.length, 3);
  m.battle.enemies[0].hp = 0;
  const cmd = m.battle.enemies[1];
  cmd.intent = [{ type: 'summon', id: 'A2_M09', n: 10 }];
  m.battle.enemies[2].intent = [{ type: 'block', n: 0 }];
  assert.match(engine.describeIntents(m)[cmd.uid], /调兵/);
  m = act(m, { type: 'end' }).state;
  assert.ok(m.battle.enemies[0].hp > 0, 'escort slot refilled');
  assert.equal(m.battle.enemies.length, 3);
  // 防御架势
  let w = soloFight('boss', 'B02', { seed: 'wd' });
  w.battle.hand = [{ uid: 'big', id: 'TA25', up: true }];
  w.battle.energy = 3;
  delete w.battle.enemyHp;
  const warden = w.battle.enemies[0];
  warden.hp = warden.maxHp - 10;
  warden.statuses.block = 0;
  w = act(w, { type: 'play', uid: 'big' }).state;
  const after = engine.battleEnemies(w.battle)[0];
  assert.equal(after.traitState.shifts, 1);
  assert.ok(after.statuses.block > 0 && after.traitState.spikes > 0);
  // 毒雾渗透
  let t = soloFight('boss', 'B03', { seed: 'tx' });
  t.battle.enemies[0].intent = [{ type: 'block', n: 0 }];
  delete t.battle.enemyIntent;
  const drawBefore = t.battle.drawPile.filter(c => c.id === 'ST02').length;
  t = act(t, { type: 'end' }).state;
  assert.ok([...t.battle.drawPile, ...t.battle.hand].filter(c => c.id === 'ST02').length > drawBefore);
});
