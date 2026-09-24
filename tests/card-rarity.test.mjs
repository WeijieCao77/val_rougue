import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSeason,createRun,act,instance,rarityOffers,rarityChances,shopPrice,RARITY_ODDS,SHOP_PRICE_RANGE} from '../engine.js';
import {availableNodes} from '../season-map.js';
import {CARDS,REGIONS,TACTICS} from '../content.js';
import {CARD_RARITY,RARITY_LABELS,RARITY_ORDER} from '../card-rarity.js';
const step=(s,a)=>{const r=act(s,a);assert.equal(r.error,null);return r.state;};

test('every regional pool has 35-45 common, 20-30 uncommon and 7-13 rare cards',()=>{
 for(const region of Object.values(REGIONS))for(const pool of [region.pool,region.pool3]){
  const n={common:0,uncommon:0,rare:0};
  for(const id of pool){assert.ok(RARITY_ORDER.includes(CARD_RARITY[id]),`${id} lacks rarity`);n[CARD_RARITY[id]]++;}
  assert.ok(n.common>=35&&n.common<=45,`${region.id} common ${n.common}`);
  assert.ok(n.uncommon>=20&&n.uncommon<=30,`${region.id} uncommon ${n.uncommon}`);
  assert.ok(n.rare>=7&&n.rare<=13,`${region.id} rare ${n.rare}`);
  for(const id of region.start)assert.equal(CARD_RARITY[id],'common',`starter ${id}`);
 }
 const pooled=new Set(Object.values(REGIONS).flatMap(r=>[...r.pool,...r.pool3]));
 for(const id of Object.keys(CARD_RARITY))assert.ok(pooled.has(id),`${id} has rarity but is not recruitable`);
 for(const id of Object.keys(CARDS))if(/^(CU|ST|TK)/.test(id))assert.equal(CARD_RARITY[id],undefined);
});

test('rarity is labelled as offer frequency, never as a grade of the player',async()=>{
 assert.deepEqual(RARITY_LABELS,{common:'普通',uncommon:'罕见',rare:'稀有'});
 const ui=await readFile(new URL('../ui-source.js',import.meta.url),'utf8');
 const data=await readFile(new URL('../card-rarity.js',import.meta.url),'utf8');
 assert.match(ui,/出现频率：\$\{RARITY_LABELS/);
 for(const text of [ui,data]){
  assert.doesNotMatch(text,/[金银铜]卡|黑铁|[金银铜]牌选手|(普通|罕见|稀有|顶级|一流|二流)选手|选手(等级|评级|档次)/);
 }
});

test('season reward odds follow StS-like tiers and the rare pity raises +1% per rare-less reward',()=>{
 const s=createSeason('odds',false,'CN');
 assert.deepEqual(rarityChances(s,'normal'),[60,37,3]);
 assert.deepEqual(rarityChances(s,'elite'),[50,40,10]);
 assert.deepEqual(rarityChances(s,'boss'),[0,0,100]);
 s.rarePity=5;assert.deepEqual(rarityChances(s,'normal'),[55,37,8]);assert.deepEqual(rarityChances(s,'elite'),[45,40,15]);assert.deepEqual(rarityChances(s,'boss'),[0,0,100]);
 s.rarePity=0;
 for(const [kind,expected] of Object.entries({normal:RARITY_ODDS.normal,elite:RARITY_ODDS.elite})){
  const tally={common:0,uncommon:0,rare:0};
  for(let i=0;i<6000;i++)for(const id of rarityOffers(s,kind))tally[CARD_RARITY[id]]++;
  const total=tally.common+tally.uncommon+tally.rare;
  RARITY_ORDER.forEach((r,i)=>assert.ok(Math.abs(tally[r]/total*100-expected[i])<2,`${kind} ${r} ${(tally[r]/total*100).toFixed(1)}`));
 }
 for(let i=0;i<200;i++)assert.ok(rarityOffers(s,'boss').every(id=>CARD_RARITY[id]==='rare'));
});

test('season rewards update pity, stay regional and keep a build-direction card',()=>{
 let rares=0,archetype=0;
 for(let i=0;i<60;i++){
  let s=createSeason(`pity-${i}`,false,'EMEA');
  s=step(s,{type:'chooseNode',key:availableNodes(s)[0].key});
  s.rarePity=4;s.battle.enemyHp=1;s.battle.energy=3;s.battle.hand=[instance(s,'EU03')];
  s=step(s,{type:'play',uid:s.battle.hand[0].uid});
  assert.equal(s.phase,'reward');
  const list=s.reward.offers,hasRare=list.some(id=>CARD_RARITY[id]==='rare');
  assert.equal(s.rarePity,hasRare?0:5);rares+=hasRare;
  assert.ok(list.every(id=>REGIONS.EMEA.pool.includes(id)));assert.equal(new Set(list).size,list.length);
  if(list.some(id=>TACTICS[id]?.archetype))archetype++;
 }
 assert.equal(archetype,60);assert.ok(rares<60);
});

test('season shop keeps 3 slots priced by rarity; legacy shop keeps 40/65/90',()=>{
 for(let i=0;i<40;i++){
  let s=createSeason(`shop-${i}`,false,['CN','AM','EMEA','PAC'][i%4]);
  s.phase='map';const node=s.map.nodes.find(n=>n.kind==='shop');s.currentNode=null;
  s.map.starts=[node.key];s.completed=[];
  s=step(s,{type:'chooseNode',key:node.key});assert.equal(s.phase,'shop');assert.equal(s.shop.slots.length,3);assert.equal(s.shop.prices.length,3);
  let last=-1;
  s.shop.slots.forEach((id,slot)=>{const rarity=CARD_RARITY[id],[lo,hi]=SHOP_PRICE_RANGE[rarity];const p=shopPrice(s,slot);assert.ok(p>=lo&&p<=hi,`${rarity} ${p}`);assert.ok(RARITY_ORDER.indexOf(rarity)>=last);last=RARITY_ORDER.indexOf(rarity);});
  s.money=500;const price=s.shop.prices[2];s=step(s,{type:'buy',slot:2});assert.equal(s.money,500-price);
 }
 let legacy=createRun();legacy.node=5;legacy.phase='branch';legacy=step(legacy,{type:'branch',choice:'shop'});
 assert.equal(legacy.shop.prices,undefined);assert.deepEqual([0,1,2].map(i=>shopPrice(legacy,i)),[40,65,90]);
});
