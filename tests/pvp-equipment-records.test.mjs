import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, applyCommand, viewFor } from '../online/duel.mjs';
import { recordPvpResult, pvpProgress } from '../online/pvp-records.js';
import { PVP_GEAR, gearStatus } from '../online/equipment.js';
import { CARDS } from '../content.js';

const snap=(runId,gear=[],extra={})=>({version:'wa-pvp-1',runId,act:1,seed:'seed',region:'CN',deck:Array.from({length:10},(_,i)=>({uid:runId+i,id:'CN03',up:false})),skins:[],gear,supplies:['SP01'],maxHp:70,hp:70,money:999,actionsCount:0,...extra});

test('PvP preserves max HP at full health, activates suitable equipment, excludes supplies and story gear',()=>{
 const m=createMatch(snap('a',['GR01','GR04','GR05','GR11','BX01','GR08']),snap('b',[]),'gear-1',{first:0});
 assert.equal(m.players[0].hp,70);assert.equal(m.players[0].maxHp,70);
 assert.equal(m.players[0].energy,5);assert.equal(m.players[0].strength,1);assert.equal(m.players[0].block,8);
 assert.equal(m.players[1].vulnerable,1);assert.equal(m.players[1].strength,1);
 assert.deepEqual(m.players[0].gear,['GR04','GR05','GR11','BX01','GR08']);
 assert.ok(!('supplies' in m.players[0]));assert.equal(viewFor(m,0).you.gear.length,5);
 assert.equal(gearStatus('GR01').label,'成长已继承');assert.equal(gearStatus('BX02').label,'仅故事模式');
 assert.ok(PVP_GEAR.has('GR04'));
});

test('BX06 fatigue does not displace innate cards from opening draw',()=>{
 const innate=Object.keys(CARDS).find(id=>CARDS[id].innate && CARDS[id].cost!==null);
 assert.ok(innate);
 const a=snap('a',['BX06'],{deck:[{uid:'innate',id:innate,up:false},...Array.from({length:9},(_,i)=>({uid:'a'+i,id:'CN03',up:false}))]});
 const m=createMatch(a,snap('b',[]),'gear-innate',{first:0});
 assert.ok(m.players[0].hand.some(c=>c.uid==='innate'));
 assert.equal([...m.players[0].hand,...m.players[0].drawPile].filter(c=>c.id==='ST03').length,2);
});

test('PvP record counters, rematch rounds, 100 wins and 50 recent records are stable',()=>{
 const accounts={a:{archives:[{id:'a',name:'Alpha'}]},b:{archives:[{id:'b',name:'Beta'}]}};
 const t={account:id=>accounts[id]};
 const room={code:'ABC123',round:1,status:'finished',match:{status:'finished',winner:0,turn:4,endReason:'hp'},members:[{seat:0,accountId:'a',archiveId:'a',archiveSnapshot:snap('a'),name:'A'},{seat:1,accountId:'b',archiveId:'b',archiveSnapshot:snap('b'),name:'B'}]};
 for(let round=1;round<=100;round++){room.round=round;room.recordedRound=round-1;recordPvpResult(t,room,1000+round);recordPvpResult(t,room,2000+round);}
 const a=pvpProgress(accounts.a),b=pvpProgress(accounts.b);
 assert.equal(a.played,100);assert.equal(a.wins,100);assert.equal(a.bestStreak,100);assert.equal(a.records.length,50);
 assert.ok(a.achievements['hundred-wins']);assert.ok(a.achievements.veteran);assert.equal(a.records[0].round,100);assert.equal(a.records[0].archiveName,'Alpha');
 assert.equal(b.losses,100);assert.equal(b.wins,0);assert.equal(b.records.length,50);
});



test('negative cards remain in PvP and resolve draw, held and play triggers',()=>{
 const all=(id,run)=>snap(run,[],{deck:Array.from({length:10},(_,i)=>({uid:run+i,id,up:false}))});
 const draw=createMatch(all('CU03','draw'),snap('foe'), 'curse-energy',{first:0});
 assert.equal(draw.players[0].hand.length,5);assert.equal(draw.players[0].energy,0,'drawn energy curses reduce first turn energy');
 const hold=createMatch(all('CU02','hold'),snap('foe'),'curse-hold',{first:0});
 assert.equal(hold.players[0].hp,70);
 const ended=applyCommand(hold,0,{type:'end'});
 assert.equal(ended.players[0].hp,60,'five held pressure curses each lose 2 HP');
 const play=createMatch(snap('play'),snap('foe'),'curse-play',{first:0});
 play.players[0].hand.push({uid:'curse',id:'CU09',up:false});
 const card=play.players[0].hand.find(c=>c.id==='CN03');
 const after=applyCommand(play,0,{type:'play',uid:card.uid});
 assert.equal(after.players[0].hp,69,'held CU09 loses HP when another card is played');
});
