import {VERSION,CARDS,PLAYER_IDS,SKINS,ENEMIES,START,effects,cardName,REGIONS,TACTICS} from './content.js';
import {buildMap,availableNodes} from './season-map.js';
import {CURSES,CURSE_RULES,EXTRA_STATUS_RULES} from './afflictions.js';
import {WA_EVENTS,WA_EVENT_POOLS,WA_CRATE_LOOT} from './wa-events.js';
import {opsReason,describeOps,applyOps,pickKind,pickCandidates} from './shared-event-core.js';
import {freshUnknownOdds,resolveUnknown,blockedUnknownKinds,rollCrateSize} from './shared-unknown-room.js';
import {ROUTE_STEPS} from './shared-route-generator.js';
export const clone = x => structuredClone(x);
const log = (s,text) => s.logs.push({node:s.node,turn:s.battle?.turn||0,text});
export function random(s) { let x=s.rng; x^=x<<13; x^=x>>>17; x^=x<<5; s.rng=x>>>0; return s.rng/4294967296; }
function seedHash(text) { let n=2166136261; for(const c of String(text)) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>0)||1; }
export function shuffle(s,items) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function instance(s,id,up=false) { return {uid:`c${s.nextId++}`,id,up}; }
const count = (s,id) => s.deck.filter(c=>c.id===id).length;
const eligible = (s,id) => count(s,id)<3;
const SEASON_VERSION = 'D0.2.0';
export const SEASON_EVENTS = Object.fromEntries(Object.entries(WA_EVENTS).map(([id,e])=>[id,{label:e.title,desc:e.scene}]));
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
// Season rewards always include one build-direction card (burn, deploy, combo...)
// so every reward screen offers a real choice of direction.
function withArchetype(s,list){
 if(list.some(id=>TACTICS[id]?.archetype))return list;
 const pool=REGIONS[s.region].pool.filter(id=>TACTICS[id]?.archetype&&eligible(s,id)&&!list.includes(id));
 if(!pool.length||!list.length)return list;
 return [...list.slice(0,-1),pool[Math.floor(random(s)*pool.length)]];
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
 // Season-only additions; legacy tutorial enemies have none of these fields.
 const node=s.mode==='season'?s.map?.nodes.find(n=>n.key===s.currentNode):null;
 const b=s.battle;
 if(node?.field){b.field=node.field;}
 if(enemy.trait){b.trait=clone(enemy.trait);b.traitState={};b.tempoCount=0;}
 if(enemy.startBlock)b.enemyBlock=enemy.startBlock;
 if(b.field==='suppress')b.enemyWeak=2;
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
 if(b.plays!==undefined)b.plays=0;
 if(b.overloadNext){b.energy=Math.max(0,b.energy-b.overloadNext);b.overload=b.overloadNext;b.overloadNext=0;}else if(b.overload)b.overload=0;
 const tick=powerTotal(b,'burnTick');if(tick){b.enemyBurn=(b.enemyBurn||0)+tick;}
 if(b.field)b.attackedThisTurn=false;
 const eco=b.turn===1&&b.field==='eco'?1:0;b.energy+=eco;
 if(b.turn===1&&s.skins.includes('SK01')){b.block=3;log(s,'磨砂黑：开局获得 3 格挡。');}
 log(s,`第 ${b.turn} 回合：行动点 ${b.energy}，旧格挡清空。`);drawCards(s,5+eco+powerTotal(b,'extraDraw'));
}
// Battlefield change to one hit's base damage (both sides).
function fieldHitBonus(b,n,times){return (b.field==='corridor'&&times>1?1:0)+(b.field==='longrange'&&n>=8?2:0);}
function enemyScript(b){const e=ENEMIES[b.enemy];return b.traitState?.phase2?e.phase2:e.script;}
function hurtPlayerDirect(s,n){const b=s.battle,absorbed=Math.min(b.block,n);b.block-=absorbed;s.hp=Math.max(0,s.hp-(n-absorbed));return n-absorbed;}
function checkEnemyHpTraits(s){
 const b=s.battle,t=b.trait;if(!t||b.enemyHp<=0)return;const max=ENEMIES[b.enemy].hp;
 if(t.id==='berserk'&&!b.traitState.berserk&&b.enemyHp<=max/2){b.traitState.berserk=true;b.enemyStrength=(b.enemyStrength||0)+t.n;log(s,`背水一战：对手火力 +${t.n}。`);}
 if(t.id==='phase2'&&!b.traitState.phase2&&b.enemyHp<=max/2){b.traitState.phase2=true;b.enemyWeak=0;b.enemyVulnerable=0;b.enemyBlock+=10;b.enemyStrength=(b.enemyStrength||0)+2;b.intent=0;log(s,'决胜局：对手清除负面状态，布防 +10、火力 +2，换成全新打法。');}
}
export function damage(base,weak=false,vulnerable=false){return Math.floor(Math.max(0,base)*(weak ? 0.75 : 1)*(vulnerable ? 1.5 : 1));}
export function intent(s) {
 const b=s.battle, e=ENEMIES[b.enemy];
 // Actions resolve in order, so a buff listed before a hit already applies to it.
 let strength=(b.enemyStrength||0)+(b.field==='overtime'&&b.turn>=5?2:0);
 return enemyScript(b)[b.intent].map(a=>{
  if(a.type==='buff'){strength+=a.n;return {...a};}
  if(a.type==='hit')return {...a,n:damage(a.n+(e.boss?b.cycles*(e.growth??2):0)+strength+fieldHitBonus(b,a.n,a.times),b.enemyWeak>0)};
  if(a.type==='snipe'){const aimed=(b.aim||0)>0;return {...a,aimed,n:damage((aimed?a.n+fieldHitBonus(b,a.n,1):Math.ceil(a.n/3))+strength,b.enemyWeak>0)};}
  return {...a};
 });
}
export function intentText(s) {return intent(s).map(a=>a.type==='hit'?`攻击 ${a.n}${a.times>1?` × ${a.times} = ${a.n*a.times}`:''}`:a.type==='block'?`获得 ${a.n} 格挡`:a.type==='weak'?`使你虚弱 ${a.n} 回合`:a.type==='buff'?`火力 +${a.n}`:a.type==='aim'?'瞄准（下回合重狙）':a.type==='snipe'?(a.aimed?`重狙 ${a.n}（压制可打断）`:`仓促射击 ${a.n}（瞄准已被打断）`):a.type==='cleanse'?'清除自身负面状态':a.type==='vuln'?`使你易伤 ${a.n} 回合`:`将 ${a.n} 张${CARDS[a.id].name}放入弃牌堆`).join('；');}
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
 s.reward={offers:withArchetype(s,offers(s,elite?[10,45,30,15]:undefined)),elite:!!elite};
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
 if(!b.enemyHp){win(s);return;}
 if(!b.trait)return;
 checkEnemyHpTraits(s);
 if(b.trait.id==='thorns'){const lost=hurtPlayerDirect(s,b.trait.n);log(s,`交叉火力：反击 ${b.trait.n}，失去 ${lost} 声望。`);if(!s.hp)lose(s,'被交叉火力击倒');}
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
 // Plays-this-turn is only tracked in season mode so frozen legacy replays keep their exact state.
 const playsBefore=b.plays||0;if(s.mode==='season')b.plays=playsBefore+1;
 const wasVuln=b.enemyVulnerable>0,wasBurning=(b.enemyBurn||0)>0;
 const knifeBonus=c.id==='TK03'?powerTotal(b,'knife'):0,comboBonus=playsBefore>=2?powerTotal(b,'comboAtk'):0;
 if(t.player)b.roleCounts[t.role]=(b.roleCounts[t.role]||0)+1;
 let bonus=t.player&&t.role==='决斗'&&first?powerTotal(b,'duel'):0;
 const wasWeak=b.enemyWeak>0;log(s,`打出 ${cardName(c)}，支付 ${t.cost} 行动点。`);
 for(const held of b.hand){const rule=CURSE_RULES[held.id];if(rule?.trigger==='onPlayLoseHp'){s.hp=Math.max(0,s.hp-rule.n);log(s,`${rule.name}：声望 -${rule.n}。`);if(!s.hp){lose(s,rule.name);b.resolving=null;return;}}}
 const list=effects(c).flatMap(e=>e.type==='combo'?(playsBefore>0?[e.effect]:[]):[e]);
 for(const e of list) {
  if(e.type==='hit'){
   let first=0;if(b.field==='highground'&&!b.attackedThisTurn){first=3;}
   if(b.field)b.attackedThisTurn=true;
   for(let i=0;i<e.times;i++){
    strike(s,damage(e.n+bonus+first+fieldHitBonus(b,e.n,e.times)+(e.ifWeak&&wasWeak?e.ifWeak:0)+(e.ifVuln&&wasVuln?e.ifVuln:0)+(e.ifBurn&&wasBurning?e.ifBurn:0)+(b.selfStrength||0)+knifeBonus+comboBonus,b.weak>0,b.enemyVulnerable>0));bonus=0;first=0;
    if(s.phase!=='combat'){b.resolving=null;return;}
   }
  }
  if(e.type==='block'){b.block+=e.n;log(s,`获得 ${e.n} 格挡（现有 ${b.block}）。`);}
  if(e.type==='weak'){b.enemyWeak+=e.n;log(s,`对手虚弱 +${e.n} 回合。`);if(b.aim){b.aim=0;log(s,'压制打断了对手的瞄准。');}}
  if(e.type==='vulnerable'){b.enemyVulnerable+=e.n;log(s,`对手易伤 +${e.n} 回合。`);}
  if(e.type==='draw')drawCards(s,e.n);
  if(e.type==='burn'){b.enemyBurn=(b.enemyBurn||0)+e.n;log(s,`对手燃烧 +${e.n}。`);}
  if(e.type==='burnMultiply'){b.enemyBurn=(b.enemyBurn||0)*e.n;log(s,`对手燃烧层数 ×${e.n}。`);}
  if(e.type==='detonate'){const n=(b.enemyBurn||0)*e.per;b.enemyBurn=0;if(n){strike(s,damage(n,b.weak>0,b.enemyVulnerable>0));if(s.phase!=='combat'){b.resolving=null;return;}}}
  if(e.type==='deploy'){(b.deployables||=[]).push({kind:e.kind,n:e.n,turns:e.turns});log(s,e.kind==='turret'?`部署哨戒炮（${e.n} 伤害 × ${e.turns} 回合）。`:`部署屏障无人机（${e.n} 布防 × ${e.turns} 回合）。`);}
  if(e.type==='fireTurrets')for(const d of b.deployables||[]){if(d.kind!=='turret')continue;strike(s,damage(d.n,false,b.enemyVulnerable>0));if(s.phase!=='combat'){b.resolving=null;return;}}
  if(e.type==='bodyslam'){strike(s,damage(b.block+(b.selfStrength||0),b.weak>0,b.enemyVulnerable>0));if(s.phase!=='combat'){b.resolving=null;return;}}
  if(e.type==='strength'){b.selfStrength=(b.selfStrength||0)+e.n;log(s,`本场火力 +${e.n}。`);}
  if(e.type==='overload'){b.overloadNext=(b.overloadNext||0)+e.n;log(s,`过载 ${e.n}：下回合行动点 -${e.n}。`);}
  if(e.type==='token'){
   if(b.hand.length>=10)log(s,'手牌已满，未生成临时牌。');else{b.hand.push(instance(s,e.id));log(s,`生成 ${CARDS[e.id].name}。`);}
  }
 }
 if(t.player&&t.role==='先锋'&&first){const n=powerTotal(b,'init');if(n){b.block+=n;log(s,`${s.mode==='season'?'团队协同':'Haodong'} 能力：获得 ${n} 格挡。`);}}
 if(t.player&&t.cost===0&&s.skins.includes('SK02')&&!b.skinZero){b.skinZero=true;log(s,'信号线：本场首次 0 费选手，抽 1 张。');drawCards(s,1);}
 if(t.player&&t.role==='哨位'&&first&&s.skins.includes('SK03')){b.block+=2;log(s,'守望涂层：获得 2 格挡。');}
 if(b.trait&&s.phase==='combat'){
  if(b.trait.id==='enrageOnSkill'&&!effects(c).some(e=>e.type==='hit')){b.enemyStrength=(b.enemyStrength||0)+b.trait.n;log(s,`信息读取：对手火力 +${b.trait.n}。`);}
  if(b.trait.id==='tempo'&&++b.tempoCount>=b.trait.n){b.tempoCount=0;b.enemyStrength=(b.enemyStrength||0)+2;b.enemyBlock+=6;log(s,'控制节奏：对手火力 +2、布防 +6。');}
 }
 if(t.zone==='power'){b.powers.push(c);log(s,`${cardName(c)} 能力生效，离开普通循环。`);}
 else if(['exhaust','temporary'].includes(t.zone)){b.exhaust.push(c);log(s,`${cardName(c)} 消耗，本场不再抽到。`);}
 else b.discard.push(c);
 b.resolving=null;
}
function endTurn(s) {
 const b=s.battle;
 for(const c of b.hand){const rule=CURSE_RULES[c.id];if(rule?.trigger==='endTurnLoseHp'){s.hp=Math.max(0,s.hp-rule.n);log(s,`${rule.name}：直接失去 ${rule.n} 声望。`);if(!s.hp){lose(s,`${rule.name}耗尽声望`);return;}}}
 const kept=[];
 for(const c of b.hand){if(CARDS[c.id].zone==='retain')kept.push(c);else if(['temporary','exhaustEnd'].includes(CARDS[c.id].zone)){b.exhaust.push(c);log(s,`${cardName(c)} 在回合末消耗。`);}else b.discard.push(c);}
 b.hand=kept;
 if(b.deployables?.length){
  for(const d of b.deployables){if(d.kind==='turret'){log(s,'哨戒炮开火。');strike(s,damage(d.n,false,b.enemyVulnerable>0));if(s.phase!=='combat')return;}else{b.block+=d.n;log(s,`屏障无人机：布防 +${d.n}。`);}d.turns--;}
  b.deployables=b.deployables.filter(d=>d.turns>0);
 }
 if(b.enemyBurn>0){const n=b.enemyBurn;b.enemyHp=Math.max(0,b.enemyHp-n);b.enemyBurn--;log(s,`燃烧：对手防线 -${n}（剩余 ${b.enemyHp}）。`);if(!b.enemyHp){win(s);return;}checkEnemyHpTraits(s);}
 b.weak=Math.max(0,b.weak-1);b.enemyBlock=0;
 log(s,`对手行动：${intentText(s)}。`);
 const acting=intent(s);
 if(b.field==='overtime'&&b.turn>=5)b.enemyStrength=(b.enemyStrength||0)+2;
 for(const e of acting) {
  if(e.type==='buff'){b.enemyStrength=(b.enemyStrength||0)+e.n;log(s,`对手火力 +${e.n}。`);}
  if(e.type==='aim'){b.aim=1;log(s,'对手进入瞄准。');}
  if(e.type==='cleanse'){b.enemyWeak=0;b.enemyVulnerable=0;log(s,'对手清除了负面状态。');}
  if(e.type==='vuln'){b.vulnerable=(b.vulnerable||0)+e.n;log(s,`我方易伤 +${e.n} 回合。`);}
  if(e.type==='snipe'){b.aim=0;e.type='hit';e.times=1;}
  if(e.type==='hit')for(let i=0;i<e.times;i++){
   const incoming=b.vulnerable>0?Math.floor(e.n*1.5):e.n,absorbed=Math.min(b.block,incoming);b.block-=absorbed;s.hp=Math.max(0,s.hp-incoming+absorbed);
   log(s,`对手攻击 ${incoming}：格挡抵消 ${absorbed}，失去 ${incoming-absorbed} 声望（剩余 ${s.hp}）。`);
   if(!s.hp){lose(s,'比赛失利');return;}
  }
  if(e.type==='block'){b.enemyBlock+=e.n;log(s,`对手获得 ${e.n} 格挡。`);}
  if(e.type==='weak'){b.weak+=e.n;log(s,`我方虚弱 +${e.n} 回合。`);}
  if(e.type==='jam')for(let i=0;i<e.n;i++){b.discard.push(instance(s,e.id));log(s,`${CARDS[e.id].name} 加入弃牌堆。`);}
 }
 if(b.trait?.id==='ritual'){b.enemyStrength=(b.enemyStrength||0)+b.trait.n;log(s,`手感渐热：对手火力 +${b.trait.n}。`);}
 b.enemyWeak=Math.max(0,b.enemyWeak-1);b.enemyVulnerable=Math.max(0,b.enemyVulnerable-1);
 if(b.vulnerable)b.vulnerable=Math.max(0,b.vulnerable-1);
 b.intent++;if(b.intent===enemyScript(b).length){b.intent=0;b.cycles++;if(ENEMIES[b.enemy].boss)log(s,`Boss 完成一轮意图，之后每段攻击基础值 +${ENEMIES[b.enemy].growth??2}（累计 +${b.cycles*(ENEMIES[b.enemy].growth??2)}）。`);}
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
 if(s.eventBonus){const bonus=s.eventBonus;delete s.eventBonus;log(s,`约战额外奖励：${applyOps(s,bonus,WA_CTX).log.join('，')}。`);}
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
   enterUnknownSeason(s,node);
  } else if(node.kind==='crate'){
   enterCrateSeason(s);
  } else if(node.kind==='shop'){
   openSeasonShop(s);
  } else if(node.kind==='rest'){
   s.phase='activity';
  } else throw Error('未知节点类型');
  break;}
 case 'nextAct':{
  requirePhase('intermission'); if(s.mode!=='season') throw Error('非赛季模式');
  s.act++; s.map=buildMap(s.seed,s.act); s.currentNode=null; delete s.intermissionHeal; s.seenEvents=[]; s.phase='map';
  log(s,`进入第 ${s.act} 幕。`);
  break;}
 case 'seasonEvent':requirePhase('event'); if(s.mode!=='season') throw Error('非赛季模式'); applySeasonEvent(s,a); break;
 case 'eventUpgrade': case 'eventCleanse': case 'eventPick':requirePhase(a.type); pickSeasonEvent(s,a); break;
 case 'crate':requirePhase('crate'); crateSeason(s,a); break;
 case 'crateUpgrade':{requirePhase('crate');
  if(!s.crate.opened||!s.crate.result?.upgrade) throw Error('没有可用的训练机会');
  const c=s.deck.find(c=>c.uid===a.uid); if(!c||!WA_CTX.upgradeable(s,c)) throw Error('此牌不能升级');
  c.up=true; log(s,`补给箱训练：${cardName(c)}。`); delete s.crate; advanceSeason(s); break;}
 case 'eventBack':{
  requirePhase('eventUpgrade','eventCleanse','eventPick');
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
// ---- Unknown rooms, supply crates and events (season mode only) ----
// Every roll uses the run RNG inside the action that triggers it, so the online
// server's action-by-action replay reproduces the same rooms and outcomes.
const WA_CTX={
 labels:{hp:'声望',money:'资金',equip:'皮肤',equipNone:'皮肤已满或已集齐时',curse:'俱乐部隐患',upgrade:'训练',tier:{any:'选手或战术牌',star:'高费选手或战术牌'}},
 rand:s=>random(s),
 newCard:(s,id,up)=>instance(s,id,up),
 cardName:id=>CARDS[id]?.name||id,
 upgradeable:(s,c)=>!!CARDS[c.id]?.trainable&&!c.up,
 removable:(s,c)=>!removalReason(s,c.uid),
 transformable:(s,c)=>!removalReason(s,c.uid),
 duplicable:(s,c)=>!!CARDS[c.id]?.trainable&&eligible(s,c.id),
 isCurse:(s,c)=>c.id.startsWith('CU'),
 curseIds:CURSES.slice(2).map(c=>c.id),
 randomCardAvailable:(s,tier)=>REGIONS[s.region].pool.some(id=>eligible(s,id)&&(tier!=='star'||CARDS[id].cost>=2)),
 randomCard:(s,tier)=>offers(s,tier==='star'?[0,0,1,2]:undefined,1)[0]||null,
 transformInto:(s,c)=>offers(s,undefined,1,[c.id])[0]||null,
 gainEquip:s=>{if(s.skins.length>=3)return null;const ids=Object.keys(SKINS).filter(id=>!s.skins.includes(id));if(!ids.length)return null;const id=ids[Math.floor(random(s)*ids.length)];s.skins.push(id);return SKINS[id].name;},
 specialReason:(s,name)=>name==='trial'&&!s.eventOffers?.length?'无可招募选手':'',
 describeSpecial:name=>name==='trial'?'从三名候选中招募一名，同时加入 1 张「磨合不足」':''
};
function openSeasonShop(s){
 const low=offers(s,[1,4,0,0],1),mid=offers(s,[0,0,1,0],1),high=offers(s,[0,0,0,1],1);
 s.shop={slots:[low[0]||null,mid[0]||null,high[0]||null],removed:false};s.phase='shop';
 log(s,`进入转会市场：${s.shop.slots.map(id=>id?CARDS[id].name:'空位').join('、')}。`);
}
function enterUnknownSeason(s,node){
 if(!s.unknownOdds||s.unknownOdds.act!==s.act)s.unknownOdds=freshUnknownOdds(s.act);
 const {kind,odds}=resolveUnknown(s.unknownOdds,random(s),blockedUnknownKinds(node.step,ROUTE_STEPS.shop,ROUTE_STEPS.crate));
 s.unknownOdds=odds;node.revealed=kind;
 log(s,`未知节点揭晓：${{battle:'遭遇战',shop:'转会市场',crate:'补给箱',event:'事件'}[kind]}。`);
 if(kind==='battle')startBattle(s,node.ambush||(s.act===1?'S_E02':`A${s.act}_S_E02`));
 else if(kind==='shop')openSeasonShop(s);
 else if(kind==='crate')enterCrateSeason(s);
 else startSeasonEvent(s);
}
function enterCrateSeason(s){s.phase='crate';s.crate={size:rollCrateSize(random(s)),opened:false,result:null};}
function crateSeason(s,a){
 if(a.choice==='open'){
  if(s.crate.opened)throw Error('补给箱已经打开');
  const loot=WA_CRATE_LOOT[s.crate.size],money=loot.money[0]+Math.floor(random(s)*(loot.money[1]+1));
  s.money+=money;const r={money,skin:null,bonusMoney:0,upgrade:false};
  if(random(s)<loot.skin)r.skin=WA_CTX.gainEquip(s);
  if(!r.skin){r.bonusMoney=loot.bonus;s.money+=loot.bonus;r.upgrade=loot.upgrade&&s.deck.some(c=>WA_CTX.upgradeable(s,c));}
  s.crate.opened=true;s.crate.result=r;
  log(s,`打开补给箱：资金 +${money+r.bonusMoney}${r.skin?`，获得皮肤「${r.skin}」`:''}。`);
 } else if(a.choice==='leave'){
  if(!s.crate.opened)throw Error('先打开补给箱');
  delete s.crate;advanceSeason(s);
 } else throw Error('未知选项');
}
function startSeasonEvent(s) {
 const pool=WA_EVENT_POOLS[s.act]||WA_EVENT_POOLS[1];
 s.seenEvents||=[];
 let fresh=pool.filter(id=>!s.seenEvents.includes(id));
 if(fresh.length===0){fresh=pool;s.seenEvents=s.seenEvents.filter(id=>!pool.includes(id));}
 const id=fresh[Math.floor(random(s)*fresh.length)];
 s.seenEvents.push(id);
 s.eventId=id;
 if(id==='trial')s.eventOffers=offers(s);
 s.phase='event';
 log(s,`事件：${WA_EVENTS[id].title}`);
}
function seasonEventActions(s){
 const def=WA_EVENTS[s.eventId];if(!def)return [];
 return [{type:'seasonEvent',choice:'skip'},...def.options.filter(o=>!opsReason(s,o.ops,WA_CTX)).map(o=>({type:'seasonEvent',choice:o.id}))];
}
// Scene, options with generated effect text and the reason an option is closed.
export function describeSeasonEvent(s){
 const def=WA_EVENTS[s?.eventId];if(!def)return null;
 const pending=s.pendingEvent?def.options.find(o=>o.id===s.pendingEvent):null;
 return {id:s.eventId,title:def.title,scene:def.scene,
  options:def.options.map(o=>({id:o.id,title:o.title,effects:describeOps(o.ops,WA_CTX),reason:opsReason(s,o.ops,WA_CTX),pick:pickKind(o.ops)})),
  pending:pending?{id:pending.id,title:pending.title,effects:describeOps(pending.ops,WA_CTX),kind:pickKind(pending.ops),candidates:pickCandidates(s,pickKind(pending.ops),WA_CTX).map(c=>c.uid)}:null};
}
function applySeasonEvent(s,a){
 const id=s.eventId;if(!id)throw Error('无事件');
 if(a.choice==='skip'){log(s,'谢绝事件。');advanceSeason(s);return;}
 const def=WA_EVENTS[id];if(!def)throw Error('未知事件');
 const opt=def.options.find(o=>o.id===a.choice);if(!opt)throw Error('未知选项');
 const reason=opsReason(s,opt.ops,WA_CTX);if(reason)throw Error(reason);
 if(opt.ops.some(op=>op.special==='trial')){s.phase='trial';return;}
 const kind=pickKind(opt.ops);
 if(kind){s.pendingEvent=opt.id;s.phase=kind==='upgrade'?'eventUpgrade':kind==='cleanse'?'eventCleanse':'eventPick';return;}
 resolveSeasonEvent(s,opt,null);
}
function pickSeasonEvent(s,a){
 const opt=WA_EVENTS[s.eventId]?.options.find(o=>o.id===s.pendingEvent);if(!opt)throw Error('无待处理事件');
 const card=pickCandidates(s,pickKind(opt.ops),WA_CTX).find(c=>c.uid===a.uid);if(!card)throw Error('这张牌不能选择');
 const reason=opsReason(s,opt.ops,WA_CTX);if(reason)throw Error(reason);
 resolveSeasonEvent(s,opt,card);
}
function resolveSeasonEvent(s,opt,picked){
 const {log:lines,fight}=applyOps(s,opt.ops,WA_CTX,picked);
 log(s,`${WA_EVENTS[s.eventId].title} · ${opt.title}：${lines.join('，')||'无变化'}。`);
 delete s.pendingEvent;
 if(fight){
  const prefix=s.act===1?'':`A${s.act}_`,ids=['S_EL01','S_EL02'].map(id=>prefix+id).filter(id=>ENEMIES[id]);
  const enemy=ids[Math.floor(random(s)*ids.length)];
  delete s.eventId;s.eventBonus=fight.bonus;startBattle(s,enemy);log(s,`接受约战：${ENEMIES[enemy].name}。`);return;
 }
 advanceSeason(s);
}
export function legalActions(s) {
 const actions=[];
 if(s.phase==='combat'){for(const c of s.battle.hand)if(!canPlay(s,c.uid))actions.push({type:'play',uid:c.uid});actions.push({type:'end'});}
 if(s.phase==='reward')actions.push(...s.reward.offers.map(id=>({type:'recruit',id})),{type:'recruit',id:null});
 if(s.phase==='skin')actions.push(...s.reward.skins.map(id=>({type:'skin',id})),{type:'skin',id:null});
 if(s.phase==='event'){
  if(s.mode==='season'){
   actions.push(...seasonEventActions(s));
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
 if(s.mode==='season' && ['eventUpgrade','eventCleanse','eventPick'].includes(s.phase)){
  const opt=WA_EVENTS[s.eventId]?.options.find(o=>o.id===s.pendingEvent);
  if(opt) for(const c of pickCandidates(s,pickKind(opt.ops),WA_CTX)) actions.push({type:s.phase,uid:c.uid});
  actions.push({type:'eventBack'});
 }
 if(s.mode==='season' && s.phase==='crate'){
  if(!s.crate.opened) actions.push({type:'crate',choice:'open'});
  else { if(s.crate.result?.upgrade) for(const c of s.deck) if(WA_CTX.upgradeable(s,c)) actions.push({type:'crateUpgrade',uid:c.uid}); actions.push({type:'crate',choice:'leave'}); }
 }
 return actions.map(a=>({...a,rev:s.rev}));
}
export function observe(s) {
 const {rng,actions,...visible}=clone(s);
 if(visible.battle)visible.battle.draw.sort((a,b)=>a.id.localeCompare(b.id)||a.uid.localeCompare(b.uid));
 delete visible.seed;return {...visible,legalActions:legalActions(s)};
}
