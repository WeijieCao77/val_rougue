import {VERSION,CARDS,PLAYER_IDS,SKINS,ENEMIES,START,effects,cardName,REGIONS} from './content.js';
import {buildMap,availableNodes} from './season-map.js';
import {CURSES,CURSE_RULES,EXTRA_STATUS_RULES} from './afflictions.js';
export const clone = x => structuredClone(x);
const log = (s,text) => s.logs.push({node:s.node,turn:s.battle?.turn||0,text});
export function random(s) { let x=s.rng; x^=x<<13; x^=x>>>17; x^=x<<5; s.rng=x>>>0; return s.rng/4294967296; }
function seedHash(text) { let n=2166136261; for(const c of String(text)) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>0)||1; }
export function shuffle(s,items) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function instance(s,id,up=false) { return {uid:`c${s.nextId++}`,id,up}; }
const count = (s,id) => s.deck.filter(c=>c.id===id).length;
const eligible = (s,id) => count(s,id)<3;
const SEASON_VERSION = 'D0.2.0';
export const SEASON_EVENTS = {
  sponsor:{label:'商业活动',desc:'资金 +70，获得舆论压力。',options:{accept:'接受赞助',skip:'谢绝'}},
  trial:{label:'紧急试训',desc:'从候选池招募一名选手并加入磨合不足。',options:{accept:'试训',skip:'谢绝'}},
  scrim:{label:'训练赛',desc:'支付20资金回复15%声望，或冒风险失去8声望换35资金。',options:{safe:'支付训练（-20资金，回复15%）',risk:'冒险（-8声望，+35资金）'}},
  training:{label:'特训',desc:'支付40升级一名选手，或免费升级但获得磨合不足。',options:{paid:'付费训练（-40）',risky:'鲁莽训练（免费但+磨合不足）'}},
  rally:{label:'动员',desc:'支付60移除一个诅咒并回复15%声望，或获得100资金但获得两个舆论压力。',options:{cleanse:'净化（-60资金，移除诅咒+回复）',sponsor:'接受赞助（+100资金，+2舆论压力）'}}
  ,risk:{label:'高风险合作',desc:'领取90资金并加入一张随机俱乐部隐患，或谢绝。',options:{accept:'接受合作',skip:'谢绝'}}
};
export function offers(s,weights=[15,60,20,5],number=3,excluded=[]) {
 const result=[];
 const allowed = s.mode==='season' ? REGIONS[s.region].pool : PLAYER_IDS;
 for(let k=0;k<number;k++) {
  const bins=[0,1,2,3].map(cost=>allowed.filter(id=>CARDS[id].cost===cost&&eligible(s,id)&&!result.includes(id)&&!excluded.includes(id)));
  const total=weights.reduce((sum,w,i)=>sum+(bins[i].length?w:0),0); if(!total) break;
  let roll=random(s)*total, cost=0;
  for(;cost<4;cost++){if(!bins[cost].length)continue;roll-=weights[cost];if(roll<0)break;}
  const pool=bins[cost]; result.push(pool[Math.floor(random(s)*pool.length)]);
 }
 return result;
}
export function createRun(seed='first-season',tutorial=true) {
 const s={version:VERSION,seed:String(seed),tutorial,rng:seedHash(seed),rev:0,nextId:1,node:1,phase:'combat',hp:80,maxHp:80,money:60,deck:[],skins:[],logs:[],actions:[],wins:0,battle:null};
 s.deck=START.map(id=>instance(s,id)); log(s,'新赛季开始：中国赛区 · 首幕大师赛征程。'); startBattle(s,'E01'); return s;
}
export function createSeason(seed='first-season',tutorial=false,region='CN') {
 if(!REGIONS[region]) throw Error('未知赛区');
 const s={version:SEASON_VERSION,mode:'season',region,seed:String(seed),tutorial,rng:seedHash(seed),rev:0,nextId:1,act:1,map:buildMap(seed,1),currentNode:null,completed:[],node:0,phase:'map',hp:80,maxHp:80,money:60,deck:[],skins:[],logs:[],actions:[],wins:0,battle:null,seenEvents:[]};
 s.deck=REGIONS[region].start.map(id=>instance(s,id));
 log(s,`新赛季开始：${REGIONS[region].name}赛区 · 第1幕。`);
 return s;
}
export function startBattle(s,id) {
 const enemy=ENEMIES[id];
 s.phase='combat';
 s.battle={enemy:id,enemyHp:enemy.hp,enemyBlock:0,enemyWeak:0,enemyVulnerable:0,weak:0,block:0,energy:3,turn:0,intent:0,cycles:0,draw:s.tutorial&&s.node===1?clone(s.deck):shuffle(s,clone(s.deck)),hand:[],discard:[],exhaust:[],powers:[],resolving:null,roleCounts:{},skinZero:false};
 log(s,`比赛开始：${enemy.name}，对手防线 ${enemy.hp}。`); beginTurn(s);
}
function powerTotal(b,key){return b.powers.flatMap(effects).filter(e=>e.key===key).reduce((sum,e)=>sum+e.n,0);}
export function drawCards(s,n) {
 const b=s.battle;
 for(let i=0;i<n;i++) {
  if(s.phase!=='combat')break;
  if(b.hand.length>=10){log(s,'手牌已满：停止本次剩余抽牌。');break;}
  if(!b.draw.length){if(!b.discard.length)break;b.draw=shuffle(s,b.discard);b.discard=[];log(s,'抽牌堆耗尽：弃牌堆洗回抽牌堆。');}
  const c=b.draw.shift();b.hand.push(c);log(s,`抽到 ${cardName(c)}。`);
  const rule=CURSE_RULES[c.id]||EXTRA_STATUS_RULES[c.id];
  if(rule?.trigger==='onDrawLoseEnergy'){b.energy=Math.max(0,b.energy-rule.n);log(s,`${rule.name}：行动点 -${rule.n}。`);}
  if(rule?.trigger==='onDrawWeak'){b.weak+=rule.n;log(s,`${rule.name}：自身压制 +${rule.n}。`);}
  if(rule?.trigger==='onDrawVuln'){b.vulnerable=(b.vulnerable||0)+rule.n;log(s,`${rule.name}：自身易伤 +${rule.n}。`);}
  if(rule?.trigger==='onDrawLoseHp'){s.hp=Math.max(0,s.hp-rule.n);log(s,`${rule.name}：声望 -${rule.n}。`);if(!s.hp){lose(s,rule.name);break;}}
  if(rule?.trigger==='onDrawDiscard')for(let j=0;j<rule.n;j++){
   const choices=b.hand.filter(card=>card.uid!==c.uid);if(!choices.length)break;
   const target=choices[Math.floor(random(s)*choices.length)];b.hand.splice(b.hand.findIndex(card=>card.uid===target.uid),1);b.discard.push(target);log(s,`${rule.name}：${cardName(target)} 弃入弃牌堆。`);
  }
 }
}
function beginTurn(s) {
 const b=s.battle;b.turn++;b.block=0;b.energy=3+powerTotal(b,'energy');b.roleCounts={};
 if(b.turn===1&&s.skins.includes('SK01')){b.block=3;log(s,'磨砂黑：开局获得 3 格挡。');}
 log(s,`第 ${b.turn} 回合：行动点 ${b.energy}，旧格挡清空。`);drawCards(s,5+powerTotal(b,'extraDraw'));
}
export function damage(base,weak=false,vulnerable=false){return Math.floor(Math.max(0,base)*(weak ? 0.75 : 1)*(vulnerable ? 1.5 : 1));}
export function intent(s) {
 const b=s.battle, e=ENEMIES[b.enemy];
 return e.script[b.intent].map(a=>a.type==='hit'?{...a,n:damage(a.n+(e.boss?b.cycles*(e.growth??2):0),b.enemyWeak>0)}:{...a});
}
export function intentText(s) {return intent(s).map(a=>a.type==='hit'?`攻击 ${a.n}${a.times>1?` × ${a.times} = ${a.n*a.times}`:''}`:a.type==='block'?`获得 ${a.n} 格挡`:a.type==='weak'?`使你虚弱 ${a.n} 回合`:`将 ${a.n} 张${CARDS[a.id].name}放入弃牌堆`).join('；');}
function lose(s,reason){s.hp=0;s.phase='result';s.outcome='loss';log(s,`${reason}。声望归零，俱乐部解散。`);}
function win(s) {
 if(s.mode==='season') return winSeason(s);
 s.wins++;log(s,`战胜 ${ENEMIES[s.battle.enemy].name}！`);
 if(s.battle.enemy==='B01'){s.phase='result';s.outcome='win';log(s,'夺得首幕大师赛冠军！纯文字 Demo 完成。');return;}
 const elite=ENEMIES[s.battle.enemy].elite, money=elite?35:20;s.money+=money;
 s.phase='reward';s.reward={offers:offers(s,elite?[10,45,30,15]:undefined),elite:!!elite};log(s,`资金 +${money}。招募候选：${s.reward.offers.map(id=>CARDS[id].name).join('、')}。`);
}
function winSeason(s) {
 const node = s.map.nodes.find(n=>n.key===s.currentNode);
 const isBoss = node && node.kind==='boss';
 s.wins++;
 log(s, `战胜 ${ENEMIES[s.battle.enemy].name}！`);
 if (isBoss && s.act===3) {
  s.phase='result'; s.outcome='win'; if(!s.completed.includes(s.currentNode))s.completed.push(s.currentNode); log(s,'赢得冠军赛，三幕赛季全部完成！');
  return;
 }
 if (isBoss) {
  s.money += 50;
  log(s,'世界赛胜利：资金 +50。');
  const eligibleSkins = Object.keys(SKINS).filter(id=>!s.skins.includes(id));
  if (s.skins.length>=3 || eligibleSkins.length===0) {
   s.money += 20;
   log(s,'无可领取皮肤：改为 20 资金。');
   finishBossSkin(s);
   return;
  } else {
   s.reward={skins:shuffle(s,eligibleSkins).slice(0,3),boss:true,elite:false};
   s.phase='skin';
   return;
  }
 }
 const elite = node && node.kind==='elite' ? true : ENEMIES[s.battle.enemy].elite;
 const money = elite ? 35 : 20;
 s.money += money;
 s.reward={offers:offers(s,elite?[10,45,30,15]:undefined),elite:!!elite};
 s.phase='reward';
 log(s, `资金 +${money}。招募候选：${s.reward.offers.map(id=>CARDS[id].name).join('、')}。`);
}
function finishBossSkin(s) {
 const healed=healAmount(s);s.hp+=healed;s.intermissionHeal=healed;log(s,`晋级宣传：恢复最大声望的 30%，实际 +${healed} 声望。`);
 if(s.currentNode) { if(!s.completed.includes(s.currentNode))s.completed.push(s.currentNode);  }
 s.battle=null; delete s.reward; delete s.shop; delete s.eventOffers; delete s.eventId; delete s.pendingEvent;
 s.phase='intermission';
}
function strike(s,n) {
 const b=s.battle, absorbed=Math.min(b.enemyBlock,n);b.enemyBlock-=absorbed;b.enemyHp=Math.max(0,b.enemyHp-(n-absorbed));
 log(s,`攻击 ${n}：对手格挡抵消 ${absorbed}，防线减少 ${n-absorbed}，剩余 ${b.enemyHp}。`);
 if(!b.enemyHp)win(s);
}
export function canPlay(s,uid) {
 if(s.phase!=='combat')return '当前不在比赛中';
 const c=s.battle.hand.find(c=>c.uid===uid);if(!c)return '此牌不在手中';
 const t=CARDS[c.id];if(t.cost===null)return '不能打出';if(t.cost>s.battle.energy)return `还差 ${t.cost-s.battle.energy} 行动点`;return '';
}
function play(s,uid) {
 const reason=canPlay(s,uid);if(reason)throw Error(reason);
 const b=s.battle,c=b.hand.splice(b.hand.findIndex(c=>c.uid===uid),1)[0],t=CARDS[c.id];
 b.energy-=t.cost;b.resolving=c;const first=!(b.roleCounts[t.role]||0);
 if(t.player)b.roleCounts[t.role]=(b.roleCounts[t.role]||0)+1;
 let bonus=t.player&&t.role==='决斗'&&first?powerTotal(b,'duel'):0;
 const wasWeak=b.enemyWeak>0;log(s,`打出 ${cardName(c)}，支付 ${t.cost} 行动点。`);
 for(const held of b.hand){const rule=CURSE_RULES[held.id];if(rule?.trigger==='onPlayLoseHp'){s.hp=Math.max(0,s.hp-rule.n);log(s,`${rule.name}：声望 -${rule.n}。`);if(!s.hp){lose(s,rule.name);b.resolving=null;return;}}}
 for(const e of effects(c)) {
  if(e.type==='hit')for(let i=0;i<e.times;i++){
   strike(s,damage(e.n+bonus+(e.ifWeak&&wasWeak?e.ifWeak:0),b.weak>0,b.enemyVulnerable>0));bonus=0;
   if(s.phase!=='combat'){b.resolving=null;return;}
  }
  if(e.type==='block'){b.block+=e.n;log(s,`获得 ${e.n} 格挡（现有 ${b.block}）。`);}
  if(e.type==='weak'){b.enemyWeak+=e.n;log(s,`对手虚弱 +${e.n} 回合。`);}
  if(e.type==='vulnerable'){b.enemyVulnerable+=e.n;log(s,`对手易伤 +${e.n} 回合。`);}
  if(e.type==='draw')drawCards(s,e.n);
  if(e.type==='token'){
   if(b.hand.length>=10)log(s,'手牌已满，未生成临时牌。');else{b.hand.push(instance(s,e.id));log(s,`生成 ${CARDS[e.id].name}。`);}
  }
 }
 if(t.player&&t.role==='先锋'&&first){const n=powerTotal(b,'init');if(n){b.block+=n;log(s,`${s.mode==='season'?'团队协同':'Haodong'} 能力：获得 ${n} 格挡。`);}}
 if(t.player&&t.cost===0&&s.skins.includes('SK02')&&!b.skinZero){b.skinZero=true;log(s,'信号线：本场首次 0 费选手，抽 1 张。');drawCards(s,1);}
 if(t.player&&t.role==='哨位'&&first&&s.skins.includes('SK03')){b.block+=2;log(s,'守望涂层：获得 2 格挡。');}
 if(t.zone==='power'){b.powers.push(c);log(s,`${cardName(c)} 能力生效，离开普通循环。`);}
 else if(['exhaust','temporary'].includes(t.zone)){b.exhaust.push(c);log(s,`${cardName(c)} 消耗，本场不再抽到。`);}
 else b.discard.push(c);
 b.resolving=null;
}
function endTurn(s) {
 const b=s.battle;
 for(const c of b.hand){const rule=CURSE_RULES[c.id];if(rule?.trigger==='endTurnLoseHp'){s.hp=Math.max(0,s.hp-rule.n);log(s,`${rule.name}：直接失去 ${rule.n} 声望。`);if(!s.hp){lose(s,`${rule.name}耗尽声望`);return;}}}
 for(const c of b.hand){if(['temporary','exhaustEnd'].includes(CARDS[c.id].zone)){b.exhaust.push(c);log(s,`${cardName(c)} 在回合末消耗。`);}else b.discard.push(c);}
 b.hand=[];b.weak=Math.max(0,b.weak-1);b.enemyBlock=0;
 log(s,`对手行动：${intentText(s)}。`);
 for(const e of intent(s)) {
  if(e.type==='hit')for(let i=0;i<e.times;i++){
   const incoming=b.vulnerable>0?Math.floor(e.n*1.5):e.n,absorbed=Math.min(b.block,incoming);b.block-=absorbed;s.hp=Math.max(0,s.hp-incoming+absorbed);
   log(s,`对手攻击 ${incoming}：格挡抵消 ${absorbed}，失去 ${incoming-absorbed} 声望（剩余 ${s.hp}）。`);
   if(!s.hp){lose(s,'比赛失利');return;}
  }
  if(e.type==='block'){b.enemyBlock+=e.n;log(s,`对手获得 ${e.n} 格挡。`);}
  if(e.type==='weak'){b.weak+=e.n;log(s,`我方虚弱 +${e.n} 回合。`);}
  if(e.type==='jam')for(let i=0;i<e.n;i++){b.discard.push(instance(s,e.id));log(s,`${CARDS[e.id].name} 加入弃牌堆。`);}
 }
 b.enemyWeak=Math.max(0,b.enemyWeak-1);b.enemyVulnerable=Math.max(0,b.enemyVulnerable-1);
 if(b.vulnerable)b.vulnerable=Math.max(0,b.vulnerable-1);
 b.intent++;if(b.intent===ENEMIES[b.enemy].script.length){b.intent=0;b.cycles++;if(ENEMIES[b.enemy].boss)log(s,`Boss 完成一轮意图，之后每段攻击基础值 +${ENEMIES[b.enemy].growth??2}（累计 +${b.cycles*(ENEMIES[b.enemy].growth??2)}）。`);}
 beginTurn(s);
}
function advance(s) {
 if(s.mode==='season')return advanceSeason(s);
 s.node++;s.battle=null;delete s.reward;delete s.shop;delete s.eventOffers;
 const fights={2:'E02',4:'E03',8:'E05',9:'B01'};
 if(fights[s.node])startBattle(s,fights[s.node]);
 else if(s.node===3){s.phase='event';s.eventOffers=offers(s);log(s,`收到赛程外邀请。固定试训候选：${s.eventOffers.map(id=>CARDS[id].name).join('、')}。`);}
 else if(s.node===5)s.phase='branch';
 else if(s.node===6)s.phase='opponent';
 else if(s.node===7)s.phase='activity';
 else throw Error('无效赛程节点');
}
function advanceSeason(s) {
 if(s.currentNode) {
  if(!s.completed.includes(s.currentNode))s.completed.push(s.currentNode);

 }
 s.battle=null; delete s.reward; delete s.shop; delete s.eventOffers; delete s.eventId; delete s.pendingEvent;
 s.phase='map';
}
function addPlayer(s,id){
 const allowed = s.mode==='season' ? REGIONS[s.region].pool : PLAYER_IDS;
 if(!allowed.includes(id)||!eligible(s,id))throw Error('该选手已达到三张上限或不在本赛区池');
 s.deck.push(instance(s,id));log(s,`招募 ${CARDS[id].name}，赛季牌组共 ${s.deck.length} 张。`);
}
function finishReward(s) {
 if(s.mode==='season') {
  finishRewardSeason(s);
 } else {
  if(s.reward.elite){
   const eligibleSkins=Object.keys(SKINS).filter(id=>!s.skins.includes(id));
   if(s.skins.length>=3||!eligibleSkins.length){s.money+=20;log(s,'无可领取皮肤：改为 20 资金。');advance(s);}
   else {s.reward.skins=shuffle(s,eligibleSkins).slice(0,2);s.phase='skin';}
  }else advance(s);
 }
}
function finishRewardSeason(s) {
 if(s.reward.elite){
  const eligibleSkins=Object.keys(SKINS).filter(id=>!s.skins.includes(id));
  if(s.skins.length>=3||!eligibleSkins.length){s.money+=20;log(s,'无可领取皮肤：改为 20 资金。');advanceSeason(s);}
  else {s.reward.skins=shuffle(s,eligibleSkins).slice(0,2);s.phase='skin';}
 } else advanceSeason(s);
}
export function removalReason(s,uid) {
 const c=s.deck.find(c=>c.uid===uid);if(!c)return '未找到这张牌';
 if(!CARDS[c.id].trainable)return c.id.startsWith('CU')?'':'此类牌不能永久移除';
 const rest=s.deck.filter(c=>c.uid!==uid&&CARDS[c.id].player);
 if(rest.length<5)return '至少保留 5 张选手牌';
 if(!rest.some(c=>effects(c).some(e=>e.type==='hit')))return '至少保留 1 张能直接攻击的选手牌';return '';
}
export function healAmount(s,rate=.3){return Math.min(s.maxHp-s.hp,Math.ceil(s.maxHp*rate));}
function perform(s,a) {
 const requirePhase=(...phases)=>{if(!phases.includes(s.phase))throw Error('此操作已失效');};
 if(a.type==='abandon'){if(s.phase==='result')throw Error('赛季已经结束');s.phase='result';s.outcome='abandoned';log(s,'主动结束本次赛季。');return;}
 switch(a.type){
 case 'play':requirePhase('combat');play(s,a.uid);break;
 case 'end':requirePhase('combat');endTurn(s);break;
 case 'recruit':requirePhase('reward');if(a.id!==null){if(!s.reward.offers.includes(a.id))throw Error('不是本次候选');addPlayer(s,a.id);}else log(s,'跳过招募，保留现有牌组。');finishReward(s);break;
 case 'skin':requirePhase('skin');
  if(a.id!==null){if(!s.reward.skins.includes(a.id)||s.skins.includes(a.id)||s.skins.length>=3)throw Error('不是可领取皮肤');s.skins.push(a.id);log(s,`获得皮肤：${SKINS[a.id].name}。`);}else log(s,'跳过皮肤。');
  if(s.mode==='season' && s.reward.boss){
   finishBossSkin(s);
  } else if(s.mode==='season'){
   advanceSeason(s);
  } else {
   advance(s);
  }
  break;
 case 'event':requirePhase('event');if(s.mode==='season')throw Error('请使用当前事件选项');
  if(a.choice==='money'){s.money+=70;s.deck.push(instance(s,'CU02'));log(s,'商业活动：资金 +70，加入舆论压力。');advance(s);}
  else if(a.choice==='trial'){if(!s.eventOffers.length)throw Error('无合格试训候选');s.phase='trial';}
  else if(a.choice==='skip'){log(s,'谢绝活动，保持训练。');advance(s);}else throw Error('未知事件选项');break;
 case 'trial':requirePhase('trial');if(a.id===null){s.phase='event';break;}if(!s.eventOffers.includes(a.id))throw Error('不是试训候选');addPlayer(s,a.id);s.deck.push(instance(s,'CU01'));log(s,'紧急试训：同时加入磨合不足。');if(s.mode==='season')advanceSeason(s);else advance(s);break;
 case 'branch':requirePhase('branch');
  if(a.choice==='activity')s.phase='activity';
  else if(a.choice==='shop'){
   const low=offers(s,[1,4,0,0],1),mid=offers(s,[0,0,1,0],1),high=offers(s,[0,0,0,1],1);
   s.shop={slots:[low[0]||null,mid[0]||null,high[0]||null],removed:false};s.phase='shop';log(s,`进入转会市场：${s.shop.slots.map(id=>id?CARDS[id].name:'空位').join('、')}。`);
  }else throw Error('未知路线');break;
 case 'opponent':requirePhase('opponent');if(!['E04','EL01'].includes(a.id))throw Error('未知对手');startBattle(s,a.id);break;
 case 'buy':requirePhase('shop');{
  const id=s.shop.slots[a.slot],price=[40,65,90][a.slot];if(!id||!price)throw Error('该货位已售出');if(s.money<price)throw Error('资金不足');addPlayer(s,id);s.money-=price;s.shop.slots[a.slot]=null;log(s,`转会支出 ${price} 资金。`);break;}
 case 'remove':requirePhase('shop');if(s.shop.removed)throw Error('本次移除已使用');if(s.money<50)throw Error('需要 50 资金');{const reason=removalReason(s,a.uid);if(reason)throw Error(reason);const c=s.deck.find(c=>c.uid===a.uid);log(s,`支付 50 资金，永久移除 ${cardName(c)}。`);s.money-=50;s.deck=s.deck.filter(c=>c.uid!==a.uid);s.shop.removed=true;}break;
 case 'leaveShop':requirePhase('shop');advance(s);break;
 case 'activity':requirePhase('activity');
  if(a.choice==='fans'){const n=healAmount(s);if(n<=0)throw Error('声望已满');s.hp+=n;log(s,`粉丝见面会：恢复最大声望的 30%，实际 +${n} 声望。`);advance(s);}
  else if(a.choice==='upgrade'){if(!s.deck.some(c=>CARDS[c.id].trainable&&!c.up))throw Error('没有可训练的牌');s.phase='upgrade';}
  else if(a.choice==='cleanse'){if(!s.deck.some(c=>c.id.startsWith('CU')))throw Error('没有俱乐部隐患');s.phase='cleanse';}
  else if(a.choice==='skip'){log(s,'跳过俱乐部活动。');advance(s);}else throw Error('未知活动');break;
 case 'activityBack':requirePhase('upgrade','cleanse');s.phase='activity';break;
 case 'upgrade':requirePhase('upgrade');{
  const c=s.deck.find(c=>c.uid===a.uid);if(!c||!CARDS[c.id].trainable||c.up)throw Error('此牌不能升级');c.up=true;log(s,`训练完成：${cardName(c)}（${c.uid}）。`);advance(s);break;}
 case 'cleanse':requirePhase('cleanse');{
  const c=s.deck.find(c=>c.uid===a.uid);if(!c||!c.id.startsWith('CU'))throw Error('只能移除俱乐部隐患');s.deck=s.deck.filter(c=>c.uid!==a.uid);log(s,`团建：永久移除 ${cardName(c)}。`);advance(s);break;}
 case 'chooseNode':{
  requirePhase('map'); if(s.mode!=='season') throw Error('非赛季模式');
  const avail=availableNodes(s); const node=avail.find(n=>n.key===a.key); if(!node) throw Error('不可进入此节点');
  s.currentNode=a.key; s.node++;
  if(node.kind==='battle'||node.kind==='elite'||node.kind==='boss'){
   startBattle(s,node.enemy);
  } else if(node.kind==='event'){
   startSeasonEvent(s);
  } else if(node.kind==='shop'){
   const low=offers(s,[1,4,0,0],1),mid=offers(s,[0,0,1,0],1),high=offers(s,[0,0,0,1],1);
   s.shop={slots:[low[0]||null,mid[0]||null,high[0]||null],removed:false};s.phase='shop';
   log(s,`进入转会市场：${s.shop.slots.map(id=>id?CARDS[id].name:'空位').join('、')}。`);
  } else if(node.kind==='rest'){
   s.phase='activity';
  } else throw Error('未知节点类型');
  break;}
 case 'nextAct':{
  requirePhase('intermission'); if(s.mode!=='season') throw Error('非赛季模式');
  s.act++; s.map=buildMap(s.seed,s.act); s.currentNode=null; delete s.intermissionHeal; s.seenEvents=[]; s.phase='map';
  log(s,`进入第 ${s.act} 幕。`);
  break;}
 case 'seasonEvent':{
  requirePhase('event'); if(s.mode!=='season') throw Error('非赛季模式');
  const id=s.eventId; if(!id) throw Error('无事件');
  if(a.choice==='skip'){ log(s,'谢绝事件。'); advanceSeason(s); break; }
  switch(id){
   case 'sponsor':
    if(a.choice==='accept'){s.money+=70; s.deck.push(instance(s,'CU02')); log(s,'商业活动：资金 +70，加入舆论压力。'); advanceSeason(s);}
    else throw Error('未知选项');
    break;
   case 'trial':
    if(a.choice==='accept'){ if(!s.eventOffers.length)throw Error('无可招募选手');s.phase='trial'; } else throw Error('未知选项');
    break;
   case 'scrim':
    if(a.choice==='safe'){
     if(s.money<20) throw Error('资金不足'); if(s.hp>=s.maxHp) throw Error('声望已满');
     s.money-=20; const n=healAmount(s,0.15); s.hp+=n; log(s,`训练赛：支付20资金，回复 ${n} 声望。`); advanceSeason(s);
    } else if(a.choice==='risk'){
     if(s.hp<=8) throw Error('声望过低'); const dmg=8; s.hp-=dmg; s.money+=35; log(s,`训练赛冒险：失去 ${dmg} 声望，资金 +35。`); advanceSeason(s);
    } else throw Error('未知选项');
    break;
   case 'training':
    if(a.choice==='paid'||a.choice==='risky'){
     if(!s.deck.some(c=>CARDS[c.id].trainable&&!c.up))throw Error('没有可训练牌');if(a.choice==='paid'&&s.money<40)throw Error('资金不足');
     s.pendingEvent=a.choice; s.phase='eventUpgrade';
    } else throw Error('未知选项');
    break;
   case 'rally':
    if(a.choice==='cleanse'){
     if(s.money<60) throw Error('资金不足');
     if(!s.deck.some(c=>c.id.startsWith('CU'))) throw Error('没有诅咒');
     s.pendingEvent='cleanse'; s.phase='eventCleanse';
    } else if(a.choice==='sponsor'){
     s.money+=100; s.deck.push(instance(s,'CU02')); s.deck.push(instance(s,'CU02')); log(s,'动员赞助：资金 +100，加入两个舆论压力。'); advanceSeason(s);
    } else throw Error('未知选项');
    break;
   case 'risk':
    if(a.choice==='accept'){const curse=CURSES[2+Math.floor(random(s)*(CURSES.length-2))];s.money+=90;s.deck.push(instance(s,curse.id));log(s,`高风险合作：资金 +90，加入 ${curse.name}。`);advanceSeason(s);}else throw Error('未知选项');
    break;
   default: throw Error('未知事件');
  }
  break;}
 case 'eventUpgrade':{
  requirePhase('eventUpgrade');
  const pending=s.pendingEvent; if(!pending) throw Error('无待处理事件');
  const c=s.deck.find(c=>c.uid===a.uid); if(!c||!CARDS[c.id].trainable||c.up) throw Error('此牌不能升级');
  if(pending==='paid'){ if(s.money<40) throw Error('资金不足'); s.money-=40; }
  c.up=true; if(pending==='risky') s.deck.push(instance(s,'CU01'));
  log(s,`特训完成：${cardName(c)}。`);
  delete s.pendingEvent; advanceSeason(s);
  break;}
 case 'eventCleanse':{
  requirePhase('eventCleanse');
  if(s.money<60) throw Error('资金不足');
  const c=s.deck.find(c=>c.uid===a.uid); if(!c||!c.id.startsWith('CU')) throw Error('只能移除诅咒');
  s.money-=60; s.deck=s.deck.filter(c=>c.uid!==a.uid); const n=healAmount(s,0.15); s.hp+=n;
  log(s,`动员净化：费用 -60，移除 ${cardName(c)}，回复 ${n} 声望。`);
  delete s.pendingEvent; advanceSeason(s);
  break;}
 case 'eventBack':{
  requirePhase('eventUpgrade','eventCleanse');
  delete s.pendingEvent; s.phase='event';
  break;}
 default:throw Error('未知操作');
 }
}
export function act(state,action) {
 if(action.rev!==undefined&&action.rev!==state.rev)return {state,error:'界面已更新，请使用当前操作'};
 const s=clone(state);try{perform(s,action);}catch(e){return {state,error:e.message};}
 s.rev++;const clean={...action};delete clean.rev;s.actions.push(clean);return {state:s,error:null};
}
export function replay(record) {
 if(record.version===VERSION){
  let s=createRun(record.seed,record.tutorial);
  for(const a of record.actions){const r=act(s,a);if(r.error)throw Error(r.error);s=r.state;}
  return s;
 } else if(record.version===SEASON_VERSION){
  let s=createSeason(record.seed,record.tutorial,record.region);
  for(const a of record.actions){const r=act(s,a);if(r.error)throw Error(r.error);s=r.state;}
  return s;
 } else throw Error('回放版本不匹配');
}
export function preview(s,uid) {
 const reason=canPlay(s,uid);if(reason)return {reason};
 const c=s.battle.hand.find(c=>c.uid===uid),copy=clone(s),before=s.battle,working=copy.battle;play(copy,uid);const after=copy.battle||working;
 const newLogs=copy.logs.slice(s.logs.length);return {energy:after.energy,damage:before.enemyHp-after.enemyHp,enemyBlock:before.enemyBlock-after.enemyBlock,block:after.block-before.block,draw:newLogs.filter(l=>l.text.startsWith('抽到 ')).length,shuffle:newLogs.some(l=>l.text==='抽牌堆耗尽：弃牌堆洗回抽牌堆。'),wins:copy.phase!=='combat'};
}
function startSeasonEvent(s) {
 const pool = ['sponsor','trial','scrim','risk'];
 if (s.act===2) pool.push('training');
 if (s.act===3) pool.push('rally');
 let fresh = pool.filter(id=>!s.seenEvents.includes(id));
 if (fresh.length===0) { fresh = pool; s.seenEvents = s.seenEvents.filter(id=>!pool.includes(id)); }
 const id = fresh[Math.floor(random(s)*fresh.length)];
 s.seenEvents.push(id);
 s.eventId = id;
 if (id==='trial') s.eventOffers = offers(s);
 s.phase='event';
 log(s, `事件：${SEASON_EVENTS[id].label}`);
}
export function legalActions(s) {
 const actions=[];
 if(s.phase==='combat'){for(const c of s.battle.hand)if(!canPlay(s,c.uid))actions.push({type:'play',uid:c.uid});actions.push({type:'end'});}
 if(s.phase==='reward')actions.push(...s.reward.offers.map(id=>({type:'recruit',id})),{type:'recruit',id:null});
 if(s.phase==='skin')actions.push(...s.reward.skins.map(id=>({type:'skin',id})),{type:'skin',id:null});
 if(s.phase==='event'){
  if(s.mode==='season'){
   const id=s.eventId;
   if(id){
    actions.push({type:'seasonEvent',choice:'skip'});
    if(id==='sponsor') actions.push({type:'seasonEvent',choice:'accept'});
    if(id==='risk') actions.push({type:'seasonEvent',choice:'accept'});
    if(id==='trial'&&s.eventOffers.length) actions.push({type:'seasonEvent',choice:'accept'});
    if(id==='scrim'){
     if(s.money>=20 && s.hp<s.maxHp) actions.push({type:'seasonEvent',choice:'safe'});
     if(s.hp>8) actions.push({type:'seasonEvent',choice:'risk'});
    }
    if(id==='training'){
     if(s.deck.some(c=>CARDS[c.id].trainable&&!c.up)){
      if(s.money>=40) actions.push({type:'seasonEvent',choice:'paid'});
      actions.push({type:'seasonEvent',choice:'risky'});
     }
    }
    if(id==='rally'){
     if(s.money>=60 && s.deck.some(c=>c.id.startsWith('CU'))) actions.push({type:'seasonEvent',choice:'cleanse'});
     actions.push({type:'seasonEvent',choice:'sponsor'});
    }
   }
  } else {
   actions.push({type:'event',choice:'money'},{type:'event',choice:'skip'},...(s.eventOffers.length?[{type:'event',choice:'trial'}]:[]));
  }
 }
 if(s.phase==='trial')actions.push(...s.eventOffers.map(id=>({type:'trial',id})),{type:'trial',id:null});
 if(s.phase==='branch')actions.push({type:'branch',choice:'shop'},{type:'branch',choice:'activity'});
 if(s.phase==='opponent')actions.push({type:'opponent',id:'E04'},{type:'opponent',id:'EL01'});
 if(s.phase==='shop'){
  s.shop.slots.forEach((id,slot)=>{if(id&&eligible(s,id)&&s.money>=[40,65,90][slot])actions.push({type:'buy',slot});});
  if(!s.shop.removed&&s.money>=50)for(const c of s.deck)if(!removalReason(s,c.uid))actions.push({type:'remove',uid:c.uid});actions.push({type:'leaveShop'});
 }
 if(s.phase==='activity'){
  if(healAmount(s)>0)actions.push({type:'activity',choice:'fans'});
  if(s.deck.some(c=>CARDS[c.id].trainable&&!c.up))actions.push({type:'activity',choice:'upgrade'});
  if(s.deck.some(c=>c.id.startsWith('CU')))actions.push({type:'activity',choice:'cleanse'});actions.push({type:'activity',choice:'skip'});
 }
 if(s.phase==='upgrade'||s.phase==='cleanse'){
  for(const c of s.deck)if(s.phase==='upgrade'?CARDS[c.id].trainable&&!c.up:c.id.startsWith('CU'))actions.push({type:s.phase,uid:c.uid});actions.push({type:'activityBack'});
 }
 if(s.mode==='season' && s.phase==='map'){
  for(const n of availableNodes(s)) actions.push({type:'chooseNode',key:n.key});
 }
 if(s.mode==='season' && s.phase==='intermission') actions.push({type:'nextAct'});
 if(s.mode==='season' && s.phase==='eventUpgrade'){
  for(const c of s.deck) if(CARDS[c.id].trainable&&!c.up) actions.push({type:'eventUpgrade',uid:c.uid});
  actions.push({type:'eventBack'});
 }
 if(s.mode==='season' && s.phase==='eventCleanse'){
  for(const c of s.deck) if(c.id.startsWith('CU')) actions.push({type:'eventCleanse',uid:c.uid});
  actions.push({type:'eventBack'});
 }
 return actions.map(a=>({...a,rev:s.rev}));
}
export function observe(s) {
 const {rng,actions,...visible}=clone(s);
 if(visible.battle)visible.battle.draw.sort((a,b)=>a.id.localeCompare(b.id)||a.uid.localeCompare(b.uid));
 delete visible.seed;return {...visible,legalActions:legalActions(s)};
}
