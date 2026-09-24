import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRun,act,clone,instance,startBattle,drawCards,offers,preview,intent,healAmount,removalReason,replay,observe,legalActions} from '../engine.js';
import {CARDS,PLAYER_IDS,VERSION} from '../content.js';
function action(s,a){const r=act(s,a);assert.equal(r.error,null);return r.state;}
function playId(s,id){const c=s.battle.hand.find(c=>c.id===id);assert.ok(c,`Missing ${id}`);return action(s,{type:'play',uid:c.uid});}
function fixture(ids,enemy='B01'){
 const s=createRun('test',false);startBattle(s,enemy);const b=s.battle;b.hand=ids.map(id=>instance(s,id));b.draw=[];b.discard=[];b.exhaust=[];b.powers=[];return s;
}
test('content totals and five-role / cost distribution match approved demo',()=>{
 assert.equal(PLAYER_IDS.length,18);assert.equal(Object.keys(CARDS).length,342,'321 plus the TK03 knife token and 20 rules-3 keyword tactic cards');
 assert.deepEqual([0,1,2,3].map(cost=>PLAYER_IDS.filter(id=>CARDS[id].cost===cost).length),[3,10,3,2]);
 assert.deepEqual(['决斗','哨位','控场','先锋','自由人'].map(role=>PLAYER_IDS.filter(id=>CARDS[id].role===role).length),[6,4,4,4,0],'CHICHOO 哨位, Haodong 控场, AAAAY 先锋 per vlr.gg agent history (2026-09-24)');
});
test('tutorial defensive line: damage, block and expiry follow written example',()=>{
 let s=createRun('tutorial');s=playId(s,'CN11');s=playId(s,'CN07');s=playId(s,'CN03');
 assert.equal(s.battle.block,9);assert.equal(s.battle.enemyHp,21);assert.equal(s.battle.energy,0);
 s=action(s,{type:'end'});assert.equal(s.hp,80);assert.equal(s.battle.block,0);assert.equal(s.battle.enemyWeak,0);assert.equal(s.battle.hand.length,5);assert.equal(intent(s)[0].n,8);
});
test('tutorial ability line: persistent ability, reshuffle and no self-draw',()=>{
 let s=createRun('tutorial');s=playId(s,'CN16');s=playId(s,'CN14');s=playId(s,'CN03');assert.equal(s.battle.enemyHp,18);
 s=action(s,{type:'end'});assert.equal(s.hp,74);assert.equal(s.battle.powers.length,1);assert.equal(s.battle.hand.length,5);assert.ok(!s.battle.hand.some(c=>c.id==='CN16'));assert.ok(s.logs.some(l=>l.text.includes('洗回')));
});
test('R01 invalid action preserves entire state and RNG',()=>{
 const s=fixture(['CN06']);s.battle.energy=2;const before=JSON.stringify(s),r=act(s,{type:'play',uid:s.battle.hand[0].uid});assert.ok(r.error);assert.equal(JSON.stringify(s),before);assert.equal(r.state,s);
});
test('R02/R03 currently resolving draw card cannot draw itself',()=>{
 let s=fixture(['CN14']);s.battle.discard=[instance(s,'CN03')];s=playId(s,'CN14');assert.deepEqual(s.battle.hand.map(c=>c.id),['CN03']);assert.deepEqual(s.battle.discard.map(c=>c.id),['CN14']);
});
test('R04 hand cap stops drawing without losing unseen cards',()=>{
 const s=fixture(Array(10).fill('CN03'));s.battle.draw=[instance(s,'CN07')];const rng=s.rng;drawCards(s,3);assert.equal(s.battle.hand.length,10);assert.equal(s.battle.draw.length,1);assert.equal(s.rng,rng);
 let p=fixture(['CN02',...Array(9).fill('CN03')]);p.skins=['SK02'];p=playId(p,'CN02');assert.equal(p.battle.hand.length,10);assert.equal(p.battle.hand.filter(c=>c.id==='TK01').length,1);
});
test('R05 multi-hit damage consumes block per hit; enemy block survives into player turn',()=>{
 let s=fixture([],'E03');s.battle.block=5;s=action(s,{type:'end'});assert.equal(s.hp,76);
 s.battle.intent=2;s=action(s,{type:'end'});assert.equal(s.battle.enemyBlock,5);
 s.battle.hand=[instance(s,'CN04')];s=playId(s,'CN04');assert.equal(s.battle.enemyBlock,0);assert.equal(s.battle.enemyHp,37);
});
test('R06 start-of-match skin applies after block clear, once per match',()=>{
 let s=createRun();s.skins=['SK01'];startBattle(s,'E01');assert.equal(s.battle.block,3);s.battle.block=99;s=action(s,{type:'end'});assert.equal(s.battle.block,0);
});
test('R07/R08 weak lasts through the affected side turn',()=>{
 let s=fixture(['CN10'],'E01');s=playId(s,'CN10');assert.equal(intent(s)[0].n,4);s=action(s,{type:'end'});assert.equal(s.hp,76);assert.equal(s.battle.enemyWeak,0);
 s=fixture(['CN03'],'E05');s=action(s,{type:'end'});assert.equal(s.battle.weak,1);s=playId(s,'CN03');assert.equal(s.battle.enemyHp,39);s=action(s,{type:'end'});assert.equal(s.battle.weak,0);
});
test('R09 first-hit additive bonus, vulnerable and Rarga conditional damage',()=>{
 let s=fixture(['CN04']);s.battle.powers=[instance(s,'CN16')];s.battle.enemyVulnerable=2;s=playId(s,'CN04');assert.equal(s.battle.enemyHp,64);
 s=fixture(['CN05']);s.battle.hand[0].up=true;s.battle.enemyWeak=1;s.battle.enemyVulnerable=1;s=playId(s,'CN05');assert.equal(s.battle.enemyHp,50);
});
test('R10 upgrade changes one instance only; returning spends nothing',()=>{
 let s=createRun();s.node=7;s.phase='activity';const before=clone(s.deck);s=action(s,{type:'activity',choice:'upgrade'});s=action(s,{type:'activityBack'});assert.deepEqual(s.deck,before);
 s=action(s,{type:'activity',choice:'upgrade'});s=action(s,{type:'upgrade',uid:s.deck[0].uid});assert.equal(s.node,8);assert.equal(s.deck.filter(c=>c.up).length,1);assert.equal(s.deck.filter(c=>c.id==='CN03'&&!c.up).length,2);
});
test('R11/R12 combat zones reset; permanent curses survive and temporary statuses vanish',()=>{
 const s=createRun();s.deck.push(instance(s,'CN10'),instance(s,'CU02'));startBattle(s,'E02');s.battle.exhaust=[instance(s,'ST01')];s.battle.powers=[instance(s,'CN16')];startBattle(s,'E03');
 const cards=[...s.battle.hand,...s.battle.draw];assert.ok(cards.some(c=>c.id==='CN10'));assert.ok(cards.some(c=>c.id==='CU02'));assert.ok(!cards.some(c=>c.id==='ST01'));assert.equal(s.battle.powers.length,0);assert.equal(s.battle.exhaust.length,0);
});
test('R13 curse causes immediate loss before enemy action regardless of block',()=>{
 let s=fixture(['CU02']);s.hp=2;s.battle.block=99;s=action(s,{type:'end'});assert.equal(s.outcome,'loss');assert.equal(s.battle.turn,1);assert.ok(!s.logs.some(l=>l.text.startsWith('对手行动')));
});
test('R14 kill stops generated tokens and multi-hit effects; boss has no reward screen',()=>{
 let s=fixture(['CN02','CU02']);s.hp=1;s.battle.enemyHp=4;s=playId(s,'CN02');assert.equal(s.outcome,'win');assert.equal(s.hp,1);assert.ok(!s.battle.hand.some(c=>c.id==='TK01'));assert.equal(s.money,60);
 s=fixture(['CN04'],'E01');s.battle.enemyHp=3;s=playId(s,'CN04');assert.equal(s.wins,1);assert.equal(s.money,80);assert.equal(s.logs.filter(l=>l.text.startsWith('攻击 ')).length,1);
});
test('R15 abilities do not retroactively count a second role card as first',()=>{
 let s=fixture(['CN03','CN16','CN03']);s=playId(s,'CN03');s=playId(s,'CN16');s=playId(s,'CN03');assert.equal(s.battle.enemyHp,66);
 s=fixture(['CN13','CN17','CN13']);s=playId(s,'CN13');s=playId(s,'CN17');s=playId(s,'CN13');assert.equal(s.battle.block,0);
});
test('R16 AAAAY activates next turn, stacks and upgraded extra draw is real',()=>{
 let s=fixture(['CN18']);s.battle.hand[0].up=true;s.battle.draw=Array.from({length:9},()=>instance(s,'CN03'));s=playId(s,'CN18');assert.equal(s.battle.energy,0);s=action(s,{type:'end'});assert.equal(s.battle.energy,4);assert.equal(s.battle.hand.length,6);
});
test('R17 token is not a role / zero-cost player trigger; unused tokens expire',()=>{
 let s=fixture(['TK01','TK02','CN01']);s.skins=['SK02','SK03'];s.battle.powers=[instance(s,'CN16')];s=playId(s,'TK01');assert.equal(s.battle.enemyHp,77);assert.equal(s.battle.skinZero,false);s=playId(s,'CN01');assert.equal(s.battle.enemyHp,71);assert.equal(s.battle.skinZero,true);s=action(s,{type:'end'});assert.ok(s.battle.exhaust.some(c=>c.id==='TK02'));assert.equal(s.deck.filter(c=>c.id.startsWith('TK')).length,0);
});
test('unplayable / playable statuses have distinct end-turn and played destinations',()=>{
 let s=fixture(['ST01','ST02','ST03']);const second=s.battle.hand[1].uid;s.battle.draw=Array.from({length:5},()=>instance(s,'CN03'));s=action(s,{type:'end'});assert.ok(s.battle.exhaust.some(c=>c.id==='ST01'));assert.ok(s.battle.discard.some(c=>c.uid===second));assert.ok(s.battle.discard.some(c=>c.id==='ST03'));
 s=fixture(['ST02']);s=playId(s,'ST02');assert.equal(s.battle.energy,2);assert.equal(s.battle.exhaust[0].id,'ST02');
});
test('R18 offers respect all three copies including upgraded ones and never duplicate',()=>{
 const s=createRun();s.deck[0].up=true;for(let i=0;i<100;i++){const list=offers(s);assert.equal(new Set(list).size,list.length);assert.ok(!list.includes('CN03'));assert.ok(!list.includes('CN07'));}
});
test('R19 boss scaling changes attack hits, not block or status amounts',()=>{
 let s=fixture([]);s.hp=s.maxHp=1000;for(let i=0;i<4;i++)s=action(s,{type:'end'});assert.equal(s.battle.cycles,1);assert.equal(intent(s)[0].n,10);assert.equal(s.battle.enemyBlock,10);s.battle.intent=1;assert.equal(intent(s)[0].n,6);assert.equal(intent(s)[0].times,3);
});
test('R20 stale revision cannot claim reward, buy twice, or advance twice',()=>{
 let s=createRun();s.node=5;s.phase='branch';s=action(s,{type:'branch',choice:'shop'});s.money=300;const a={type:'buy',slot:0,rev:s.rev};s=action(s,a);const again=act(s,a);assert.ok(again.error);assert.equal(again.state,s);
 const leave={type:'leaveShop',rev:s.rev};s=action(s,leave);assert.equal(s.node,6);assert.ok(act(s,leave).error);
});
test('R21 removal keeps five player instances and one direct damage source',()=>{
 const s=createRun();s.deck=['CN03','CN07','CN07','CN07','CN14','CN16'].map(id=>instance(s,id));assert.match(removalReason(s,s.deck[0].uid),/直接攻击|直接伤害/);s.deck.pop();assert.match(removalReason(s,s.deck[1].uid),/5 张/);
});
test('R22 trial return does not refresh RNG; choosing atomically gains player and curse',()=>{
 let s=createRun();s.node=3;s.phase='event';s.eventOffers=['CN01','CN02','CN04'];const rng=s.rng,length=s.deck.length;s=action(s,{type:'event',choice:'trial'});s=action(s,{type:'trial',id:null});assert.equal(s.rng,rng);assert.equal(s.deck.length,length);s=action(s,{type:'event',choice:'trial'});s=action(s,{type:'trial',id:'CN01'});assert.equal(s.deck.length,length+2);assert.ok(s.deck.some(c=>c.id==='CU01'));assert.equal(s.node,4);
});
test('R23 JSON persistence preserves all combat, shop, reward and event substates',()=>{
 let s=createRun();for(const phase of ['combat','shop','reward','event','trial','upgrade','skin']){s.phase=phase;s.shop={slots:['CN01',null,'CN06'],removed:true};s.reward={offers:['CN02'],skins:['SK01']};s.eventOffers=['CN04'];assert.deepEqual(JSON.parse(JSON.stringify(s)),s);}
});
test('R24 seed + actions reproduce a real sequence exactly; observation hides future RNG',()=>{
 let s=createRun('repeat');s=playId(s,'CN11');s=playId(s,'CN03');s=action(s,{type:'end'});const record={version:VERSION,seed:s.seed,tutorial:s.tutorial,actions:s.actions};assert.deepEqual(replay(record),s);
 const view=observe(s);assert.ok(!('rng' in view));assert.ok(!('seed' in view));assert.ok(!('actions' in view));assert.deepEqual(view.battle.draw.map(c=>c.id),[...view.battle.draw.map(c=>c.id)].sort());
});
test('R25 fan event uses max reputation fraction, round-up, cap and full prohibition',()=>{
 for(const [hp,maxHp,expected] of [[50,80,24],[70,80,10],[50,81,25],[50,100,30],[80,80,0]]){
  let s=createRun();s.hp=hp;s.maxHp=maxHp;s.node=7;s.phase='activity';assert.equal(healAmount(s),expected);
  const r=act(s,{type:'activity',choice:'fans'});if(!expected)assert.ok(r.error);else{assert.equal(r.state.hp,hp+expected);assert.equal(r.state.node,8);}
 }
});
test('preview uses actual drawing limits and does not expose names, alter state or RNG',()=>{
 const s=fixture(['CN14',...Array(9).fill('CN03')]);s.battle.draw=[instance(s,'CN07')];const before=JSON.stringify(s),p=preview(s,s.battle.hand[0].uid);assert.equal(p.draw,1);assert.equal(p.shuffle,false);assert.equal(JSON.stringify(s),before);assert.ok(!JSON.stringify(p).includes('yosemite'));
});
test('all successful states advertise only executable legal actions',()=>{
 const s=createRun();for(const a of legalActions(s))assert.equal(act(s,a).error,null);
});
test('elite rewards, skin trigger and branch progression complete without double grants',()=>{
 let s=fixture(['CN06'],'EL01');s.node=6;s.battle.enemyHp=20;s=playId(s,'CN06');assert.equal(s.money,95);assert.equal(s.phase,'reward');
 s=action(s,{type:'recruit',id:null});assert.equal(s.phase,'skin');assert.equal(s.reward.skins.length,2);const id=s.reward.skins[0];s=action(s,{type:'skin',id});assert.equal(s.node,7);assert.equal(s.phase,'activity');assert.deepEqual(s.skins,[id]);
 s.skins=['SK03'];startBattle(s,'E01');s.battle.hand=[instance(s,'CN07'),instance(s,'CN07')];s=playId(s,'CN07');assert.equal(s.battle.block,8);s=playId(s,'CN07');assert.equal(s.battle.block,14);
});
test('commercial event and club bonding permanently remove a curse',()=>{
 let s=createRun();s.node=3;s.phase='event';s.eventOffers=[];s=action(s,{type:'event',choice:'money'});assert.equal(s.money,130);assert.equal(s.deck.filter(c=>c.id==='CU02').length,1);
 s.node=5;s.phase='branch';s=action(s,{type:'branch',choice:'activity'});s=action(s,{type:'activity',choice:'cleanse'});s=action(s,{type:'cleanse',uid:s.deck.find(c=>c.id==='CU02').uid});assert.equal(s.node,6);assert.ok(!s.deck.some(c=>c.id==='CU02'));
});
test('shop removal is atomic and a full collection converts skin reward to funds',()=>{
 let s=createRun();s.node=5;s.phase='branch';s=action(s,{type:'branch',choice:'shop'});s.money=49;const original=JSON.stringify(s);assert.ok(act(s,{type:'remove',uid:s.deck[0].uid}).error);assert.equal(JSON.stringify(s),original);
 s=fixture(['CN06'],'EL01');s.node=6;s.skins=['SK01','SK02','SK03'];s.battle.enemyHp=1;s=playId(s,'CN06');s=action(s,{type:'recruit',id:null});assert.equal(s.money,115);assert.equal(s.phase,'activity');
});
test('DeepSeek legacy recorded actions replay exactly',async()=>{
 const s=JSON.parse(await readFile(new URL('./fixtures/legacy.json',import.meta.url),'utf8'));
 assert.deepEqual(replay(s),s);assert.ok(s.node>=1);
});
