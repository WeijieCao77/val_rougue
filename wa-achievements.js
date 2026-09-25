// Achievements (成就) for the Wa demo: the season-state view adapter, the list
// of definitions and the glue ui-source.js calls. Storage, evaluation and the
// toast / hall / results rendering live in shared/achievements-core.js.
// Client-side only: nothing here enters a run's action list, so the server
// replay of a season is unaffected.
import {achStep,loadBook,saveBook,seedCareer,evaluateCareer,showAchToasts,hallHtml,bindHall,runAchievementsHtml,titleBadgeHtml,wonKind,wonBoss,costAtLeast,actMemory} from './shared/achievements-core.js';
import {CARDS,effects,ENEMIES,REGIONS,BOSS_INFO} from './content.js';
import {R,battleFoes,enemyMaxHp,supplySlots} from './engine.js';
import {GEAR_SLOTS} from './wa-rules.js';

export const WA_ACH_KEY='wa-achievements-v1';
export const WA_ACH_RUN_KEY='wa-ach-run-v1';
const WA_HISTORY_KEY='wa-run-history-v1';
const FIGHT_KINDS=new Set(['battle','elite','boss']);
const nodeOf=s=>s?.map?.nodes?.find(n=>n.key===s.currentNode)||null;
const isJam=id=>CARDS[id]?.role==='比赛干扰';

function waType(t,c){
 if(!t)return 'status';
 if(c.id.startsWith('ST')||c.id.startsWith('CU'))return 'status';
 if(t.zone==='power')return 'power';
 return (effects(c)||[]).some(e=>e.type==='hit')?'attack':'skill';
}
function cardView(s,c){
 const t=CARDS[c.id];
 return {uid:c.uid,id:c.id,up:!!c.up,cost:t?.x?'x':typeof t?.cost==='number'?t.cost:null,type:waType(t,c),tag:'',basic:!!REGIONS[s.region]?.start?.includes(c.id),curse:c.id.startsWith('CU'),upgradable:!!t?.trainable,role:t?.player?t.role:null};
}

// Season state -> the normalized view the shared core reads (null outside a season).
export function waView(s){
 if(!s||s.mode!=='season'||!Array.isArray(s.deck))return null;
 const node=nodeOf(s),b=s.battle;
 let combat=null;
 if(b){
  const foes=battleFoes(b)||[{enemy:b.enemy,enemyHp:b.enemyHp,enemyMaxHp:b.enemyMaxHp,enemyBlock:b.enemyBlock,enemyWeak:b.enemyWeak,trait:b.trait,traitState:b.traitState,aim:b.aim}];
  const enemies=foes.map((f,i)=>{const d=ENEMIES[f.enemy]||{};return {uid:b.foes?'f'+i:'enemy',id:f.enemy,hp:Math.max(0,f.enemyHp||0),maxHp:enemyMaxHp(f),boss:!!d.boss,elite:!!d.elite,aim:(f.aim||0)>0,block:f.enemyBlock||0,weak:f.enemyWeak||0,trait:f.trait?.id||null,traitState:f.traitState||{},intent:null};});
  combat={turn:b.turn||1,plays:b.plays||0,block:b.block||0,encounter:b.group||b.enemy,kind:node&&FIGHT_KINDS.has(node.kind)?node.kind:'battle',bossId:node?.kind==='boss'?node.enemy:null,warmup:false,enemies,hand:(b.hand||[]).map(c=>cardView(s,c))};
 }
 return {runId:String(s.runId||s.seed),phase:s.phase,inCombat:s.phase==='combat'&&!!b,
  result:s.phase==='result'?(s.outcome==='win'?'win':s.outcome==='abandoned'?'abandon':'loss'):null,
  hp:s.hp,maxHp:s.maxHp,money:s.money||0,act:s.act||1,floor:node?.step??null,nodeKind:node?.kind||null,team:s.region,asc:R(s)?s.ascension||0:0,
  deck:s.deck.map(c=>cardView(s,c)),gear:[...(s.skins||[])],gearMax:GEAR_SLOTS,supplies:(s.supplies||[]).length,supplyMax:R(s)?supplySlots(s):0,combat};
}

// Season-specific moments: the text log and a few battle fields.
export function waObserve(ctx){
 const f=ctx.fight,before=ctx.raw?.prev,after=ctx.raw?.next;
 if(ctx.action?.type==='opening'&&ctx.action.choice==='hpForGear')ctx.mem.run.flags.hpForGear=true;
 if(!f)return;
 const logs=(after?.logs||[]).slice((before?.logs||[]).length);
 for(const l of logs){
  const t=String(l?.text||'');
  if(t.startsWith('控制节奏'))f.flags.trait_tempo=(f.flags.trait_tempo||0)+1;
  if(t.startsWith('决胜局'))f.flags.trait_phase2=(f.flags.trait_phase2||0)+1;
  if(t.includes('打断了对手的瞄准'))f.flags.aimBroken=(f.flags.aimBroken||0)+1;
 }
 const pc=ctx.prev?.combat,nc=ctx.next?.combat;
 if(!pc)return;
 // An opponent still aiming when the turn ends fires its full shot this enemy turn.
 if(ctx.action?.type==='end')for(const e of pc.enemies)if(e.hp>0&&e.aim)f.flags.aimedSnipe=(f.flags.aimedSnipe||0)+1;
 const nextById=new Map((nc?.enemies||[]).map(e=>[e.uid,e]));
 const fell=e=>{const n=nextById.get(e.uid);return e.hp>0&&(!n||n.hp<=0);};
 for(const e of pc.enemies){
  const n=nextById.get(e.uid);
  if(e.id==='S_B02'&&ctx.action?.type==='play'&&n&&e.block-n.block>=25)f.flags.wallBreak=true;
  if(e.id==='A2_S_B03'&&fell(e)){const pb=before?.battle;const jams=['hand','draw','discard'].reduce((k,p)=>k+(pb?.[p]||[]).filter(c=>isJam(c.id)).length,0);if(!jams)f.flags.cleanKill=true;}
  if(e.id==='A3_S_B03'&&fell(e)&&pc.enemies.filter(x=>x.hp>0).length>=3)f.flags.escortsAlive=true;
 }
 const nb=after?.battle;
 if(nb&&Object.keys(nb.roleCounts||{}).length>=5)f.flags.cn5=true;
 if((nb?.rt?.temps||0)>=10)f.flags.pac10=true;
 if(nc&&ctx.next.inCombat&&nc.block>=40&&nc.enemies.some(e=>e.hp>0&&e.weak>0))f.flags.emea40=true;
}

export const WA_CATS=[
 {key:'route',name:'开局与路线'},
 {key:'fight',name:'比赛技巧'},
 {key:'deck',name:'阵容构筑'},
 {key:'boss',name:'强敌与幕末决赛'},
 {key:'econ',name:'资金与补给'},
 {key:'risk',name:'事件与风险'},
 {key:'asc',name:'难度等级'},
 {key:'team',name:'赛区专属'},
 {key:'career',name:'生涯'}
];

const E=ctx=>ctx.ended;
const F=ctx=>ctx.fight||ctx.ended||null;
const won=ctx=>ctx.ended?.outcome==='win';
const bossWin=ctx=>wonKind(ctx,'boss');
const deck=ctx=>ctx.next?.deck||[];
const regionName=r=>REGIONS[r]?.name||r;
const regionWin=r=>ctx=>(ctx.career?.teamWins?.[r]??-1)>=0;
const inRegion=(ctx,r)=>ctx.next?.team===r||ctx.prev?.team===r;

export const WA_ACHIEVEMENTS=[
 // ---- 开局与路线
 {key:'first_win',cat:'route',name:'开门红',desc:'赢下本赛季的第一场比赛',test:ctx=>won(ctx)&&ctx.mem.run.fightsWon===1},
 {key:'act1_clear',cat:'route',name:'晋级',desc:'赢下第一幕的幕末决赛',reward:{title:'晋级者'},test:ctx=>bossWin(ctx)&&E(ctx).act===1},
 {key:'run_clear',cat:'route',name:'赛季冠军',desc:'赢下第三幕冠军赛，完成整个赛季',reward:{title:'赛季冠军'},test:ctx=>ctx.runEnd==='win'},
 {key:'no_rest_act',cat:'route',name:'连轴转',desc:'一幕之内没有进入俱乐部活动，赢下该幕的幕末决赛',reward:{title:'铁人'},test:ctx=>bossWin(ctx)&&!actMemory(ctx.mem,E(ctx).act).rest},
 {key:'unknown5',cat:'route',name:'赛程外的机会',desc:'同一幕进入 5 个未知节点',test:ctx=>ctx.entered==='event'&&actMemory(ctx.mem,ctx.next.act).event>=5},
 {key:'elite3_act',cat:'route',name:'强敌猎人',desc:'同一幕击败 3 场强敌',reward:{title:'猎人'},test:ctx=>wonKind(ctx,'elite')&&actMemory(ctx.mem,E(ctx).act).eliteWins>=3},
 {key:'no_elite_clear',cat:'route',secret:true,name:'绕行者',desc:'完成整个赛季，全程没有进入过强敌节点',reward:{title:'绕行者'},test:ctx=>ctx.runEnd==='win'&&ctx.mem.run.elitesFought===0},

 // ---- 比赛技巧
 {key:'flawless_elite',cat:'fight',name:'零失误',desc:'不失去声望击败一场强敌',test:ctx=>wonKind(ctx,'elite')&&!E(ctx).partial&&E(ctx).hpLost===0},
 {key:'flawless_boss',cat:'fight',name:'完美决赛',desc:'不失去声望赢下一场幕末决赛',reward:{title:'无懈可击'},test:ctx=>bossWin(ctx)&&!E(ctx).partial&&E(ctx).hpLost===0},
 {key:'big40',cat:'fight',name:'一波带走',desc:'一张牌让对手防线减少 40 点以上',test:ctx=>ctx.hit?.card&&ctx.hit.damage>=40},
 {key:'big80',cat:'fight',secret:true,name:'高光时刻',desc:'一张牌让对手防线减少 80 点以上',reward:{title:'高光选手'},test:ctx=>ctx.hit?.card&&ctx.hit.damage>=80},
 {key:'triple',cat:'fight',name:'一回合三杀',desc:'群战中同一回合击倒 3 名对手',reward:{title:'收割者'},test:ctx=>(F(ctx)?.maxTurnKills||0)>=3},
 {key:'one_hp',cat:'fight',name:'一滴血',desc:'以恰好 1 点声望赢下一场比赛',reward:{title:'悬崖边'},test:ctx=>won(ctx)&&E(ctx).hpEnd===1},
 {key:'turn1',cat:'fight',name:'首回合终结',desc:'在第 1 回合就赢下一场比赛',test:ctx=>won(ctx)&&E(ctx).turns===1&&!E(ctx).partial},
 {key:'long_fight',cat:'fight',name:'拉锯战',desc:'一场比赛打到第 12 回合并获胜',test:ctx=>won(ctx)&&E(ctx).turns>=12},
 {key:'ten_plays',cat:'fight',name:'连续操作',desc:'一回合打出 10 张牌',test:ctx=>(ctx.next?.combat?.plays||0)>=10},
 {key:'block40',cat:'fight',name:'铜墙铁壁',desc:'格挡一度达到 40 点',test:ctx=>(ctx.next?.combat?.block||0)>=40},
 {key:'aim_break',cat:'fight',name:'打断瞄准',desc:'在狙击手开枪前用压制打断它的瞄准',test:ctx=>(F(ctx)?.flags?.aimBroken||0)>0},

 // ---- 阵容构筑
 {key:'thin_deck',cat:'deck',name:'精兵简政',desc:'牌组不超过 15 张时赢下第二或第三幕的幕末决赛',reward:{title:'精兵'},test:ctx=>bossWin(ctx)&&E(ctx).act>=2&&deck(ctx).length<=15},
 {key:'light_deck',cat:'deck',name:'轻装上阵',desc:'赢下幕末决赛时，牌组里没有 2 行动点及以上的牌',reward:{title:'轻骑'},test:ctx=>bossWin(ctx)&&!deck(ctx).some(c=>costAtLeast(c,2))},
 {key:'polished',cat:'deck',name:'全员特训',desc:'牌组至少 15 张，且每张可训练的牌都已训练',test:ctx=>{const d=deck(ctx);return d.length>=15&&d.filter(c=>c.upgradable).length>=12&&d.every(c=>!c.upgradable||c.up);}},
 {key:'power3',cat:'deck',name:'体系成型',desc:'一场比赛中打出 3 张持续能力牌',test:ctx=>(F(ctx)?.types?.power||0)>=3},
 {key:'same3',cat:'deck',name:'三张同名',desc:'牌组中同一张非初始选手牌达到 3 张',test:ctx=>{const n={};for(const c of deck(ctx))if(c.role&&!c.basic)n[c.id]=(n[c.id]||0)+1;return Object.values(n).some(v=>v>=3);}},
 {key:'role10',cat:'deck',name:'清一色',desc:'牌组中同一定位的选手牌达到 10 张',test:ctx=>{const n={};for(const c of deck(ctx))if(c.role)n[c.role]=(n[c.role]||0)+1;return Object.values(n).some(v=>v>=10);}},
 {key:'cursed_boss',cat:'deck',secret:true,name:'带伤作战',desc:'牌组里带着 3 张及以上俱乐部隐患赢下幕末决赛',reward:{title:'百毒不侵'},test:ctx=>bossWin(ctx)&&deck(ctx).filter(c=>c.curse).length>=3},

 // ---- 强敌与幕末决赛
 {key:'first_elite',cat:'boss',name:'第一个强敌',desc:'击败一场强敌',test:ctx=>wonKind(ctx,'elite')},
 {key:'elite_early',cat:'boss',name:'早早出手',desc:'在一幕的第 6 层或更早击败强敌',test:ctx=>wonKind(ctx,'elite')&&E(ctx).floor!=null&&E(ctx).floor<=6},
 {key:'boss_tempo',cat:'boss',name:'不给节奏',desc:'击败大师赛冠军卫队，它一次也没有触发「控制节奏」',test:ctx=>wonBoss(ctx,'S_B01')&&!E(ctx).partial&&!E(ctx).flags.trait_tempo},
 {key:'boss_wall',cat:'boss',name:'破壁',desc:'对铁壁教官一张牌打掉 25 点以上布防，并赢下这场比赛',test:ctx=>wonBoss(ctx,'S_B02')&&!!E(ctx).flags.wallBreak},
 {key:'boss_sniper',cat:'boss',name:'截断狙击',desc:'击败狙击教官，它一次也没有打出瞄准后的重狙',test:ctx=>wonBoss(ctx,'S_BG1')&&!E(ctx).partial&&!E(ctx).flags.aimedSnipe},
 {key:'boss_blitz',cat:'boss',name:'以快打快',desc:'在第 5 回合或更早击败爆破突击长',test:ctx=>wonBoss(ctx,'A2_S_B02')&&E(ctx).turns<=5},
 {key:'boss_toxin',cat:'boss',name:'干净利落',desc:'击倒毒雾控场长时，你的手牌、抽牌堆和弃牌堆里没有比赛干扰',test:ctx=>wonBoss(ctx,'A2_S_B03')&&!!E(ctx).flags.cleanKill},
 {key:'boss_phase2',cat:'boss',secret:true,name:'一口气',desc:'击败总决赛冠军卫队，没有让它进入决胜局',reward:{title:'一气呵成'},test:ctx=>wonBoss(ctx,'A3_S_B01')&&!E(ctx).partial&&!E(ctx).flags.trait_phase2},
 {key:'boss_escort',cat:'boss',name:'擒贼先擒王',desc:'两名近卫都还在场时击倒总指挥',test:ctx=>wonBoss(ctx,'A3_S_BG1')&&!!E(ctx).flags.escortsAlive},
 {key:'all_bosses',cat:'boss',career:true,name:'九场决赛',desc:'击败过全部 9 名幕末决赛对手',reward:{title:'决赛之王'},test:ctx=>Object.keys(BOSS_INFO).every(id=>(ctx.career?.bossWins?.[id]||0)>0)},

 // ---- 资金与补给
 {key:'rich',cat:'econ',name:'资金充裕',desc:'同时持有 400 资金',test:ctx=>(ctx.next?.money||0)>=400},
 {key:'spree',cat:'econ',name:'转会窗疯狂',desc:'在一次转会市场里花掉 300 资金',test:ctx=>(ctx.mem?.shop?.spent||0)>=300},
 {key:'broke_boss',cat:'econ',name:'零预算',desc:'以 0 资金赢下幕末决赛（结算奖励前）',test:ctx=>bossWin(ctx)&&(ctx.prev?.money??1)===0},
 {key:'gear_full',cat:'econ',name:'满配',desc:'同时持有 6 件装备',test:ctx=>(ctx.next?.gear?.length||0)>=(ctx.next?.gearMax||6)},
 {key:'sell_gear',cat:'econ',name:'以旧换新',desc:'卖掉一件装备',test:ctx=>ctx.action?.type==='sellGear'},
 {key:'supply_full',cat:'econ',name:'后勤满载',desc:'补给品栏全部装满',test:ctx=>ctx.next&&ctx.next.supplyMax>0&&ctx.next.supplies>=ctx.next.supplyMax},
 {key:'no_shop',cat:'econ',secret:true,name:'青训自给',desc:'完成整个赛季，全程没有进入转会市场',reward:{title:'青训派'},test:ctx=>ctx.runEnd==='win'&&ctx.mem.run.shopsVisited===0},

 // ---- 事件与风险
 {key:'hard_sponsor',cat:'risk',name:'高强度商业赛',desc:'签约日选择高强度商业赛后，赢下第一幕的幕末决赛',test:ctx=>bossWin(ctx)&&E(ctx).act===1&&!!ctx.mem.run.flags.hpForGear},
 {key:'no_heal_rest',cat:'risk',name:'不开见面会',desc:'声望低于三成时，在俱乐部活动没有选择粉丝见面会',test:ctx=>ctx.action?.type==='activity'&&ctx.action.choice!=='fans'&&ctx.prev&&ctx.prev.hp<ctx.prev.maxHp*0.3},
 {key:'low_boss',cat:'risk',name:'残血翻盘',desc:'声望不超过上限一成时赢下幕末决赛',reward:{title:'绝境'},test:ctx=>bossWin(ctx)&&E(ctx).hpEnd<=Math.floor(E(ctx).maxHp*0.1)},
 {key:'remove4',cat:'risk',name:'阵容瘦身',desc:'一个赛季中在转会市场移除 4 张牌',test:ctx=>(ctx.mem?.run.removed||0)>=4},

 // ---- 难度等级（生涯）
 {key:'asc1',cat:'asc',career:true,name:'更进一步',desc:'在难度 1 或更高完成赛季',test:ctx=>Object.values(ctx.career?.teamWins||{}).some(v=>v>=1)},
 {key:'asc5',cat:'asc',career:true,name:'高压赛程',desc:'在难度 5 或更高完成赛季',reward:{title:'硬骨头'},test:ctx=>Object.values(ctx.career?.teamWins||{}).some(v=>v>=5)},
 {key:'asc10',cat:'asc',career:true,name:'极限难度',desc:'在难度 10 完成赛季',reward:{title:'传奇'},test:ctx=>Object.values(ctx.career?.teamWins||{}).some(v=>v>=10)},
 {key:'asc3_all',cat:'asc',career:true,name:'四赛区高难',desc:'四个赛区都在难度 3 或更高完成赛季',reward:{title:'全球巡回'},test:ctx=>Object.keys(REGIONS).every(r=>(ctx.career?.teamWins?.[r]??-1)>=3)},

 // ---- 赛区专属
 ...Object.keys(REGIONS).map(r=>({key:'win_'+r,cat:'team',career:true,name:`${regionName(r)}赛区夺冠`,desc:`以${regionName(r)}赛区完成赛季`,reward:{title:`${regionName(r)}代表`},test:regionWin(r)})),
 {key:'trait_CN',cat:'team',name:'五人齐全',desc:'使用中国赛区时，一回合内打出五种定位的选手牌',test:ctx=>inRegion(ctx,'CN')&&!!F(ctx)?.flags?.cn5},
 {key:'trait_AM',cat:'team',name:'火力倾泻',desc:'使用美洲赛区时，一回合内让对手防线减少 60 点以上',test:ctx=>inRegion(ctx,'AM')&&(F(ctx)?.maxTurnDamage||0)>=60},
 {key:'trait_EMEA',cat:'team',name:'压制反打',desc:'使用 EMEA 赛区时，对手处于压制中且你的格挡达到 40 点',test:ctx=>inRegion(ctx,'EMEA')&&!!F(ctx)?.flags?.emea40},
 {key:'trait_PAC',cat:'team',name:'临场发挥',desc:'使用太平洋赛区时，一场比赛打出 10 张临时牌',test:ctx=>inRegion(ctx,'PAC')&&!!F(ctx)?.flags?.pac10},

 // ---- 生涯
 {key:'first_loss',cat:'career',name:'从头再来',desc:'第一次出局',test:ctx=>ctx.runEnd==='loss'},
 {key:'act1_bosses',cat:'career',career:true,secret:true,name:'三座大山',desc:'分别输给过第一幕的三名幕末决赛对手',reward:{title:'越挫越勇'},test:ctx=>['S_B01','S_B02','S_BG1'].every(id=>(ctx.career?.bossLosses?.[id]||0)>0)},
 {key:'comeback',cat:'career',secret:true,name:'事不过三',desc:'连续出局 3 个赛季之后，下一个赛季夺冠',reward:{title:'不屈'},test:ctx=>ctx.runEnd==='win'&&(ctx.career?.lastStreakBeforeWin||0)>=3},
 {key:'speedrun',cat:'career',career:true,name:'速通',desc:'在 45 分钟内完成整个赛季',reward:{title:'速攻'},test:ctx=>ctx.career?.fastestWinMs!=null&&ctx.career.fastestWinMs<=45*60*1000},
 {key:'all_regions',cat:'career',career:true,name:'四赛区制霸',desc:'四个赛区都完成过赛季',reward:{title:'全能教练'},test:ctx=>Object.keys(REGIONS).every(r=>(ctx.career?.teamWins?.[r]??-1)>=0)}
];

// ---------------------------------------------------------------- glue for ui-source.js
const store=()=>{try{return globalThis.localStorage||null;}catch{return null;}};
function readMem(){try{const raw=store()?.getItem(WA_ACH_RUN_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
function writeMem(mem){try{store()?.setItem(WA_ACH_RUN_KEY,JSON.stringify(mem));}catch{}}
function history(){try{const v=JSON.parse(store()?.getItem(WA_HISTORY_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}}
export function loadWaBook(){
 const book=loadBook(store(),WA_ACH_KEY);
 if(!book.career.seeded){book.career=seedCareer(book.career,history());saveBook(store(),WA_ACH_KEY,book);}
 return book;
}
function runLabel(v){return v?`${regionName(v.team)}赛区 · 难度 ${v.asc} · 第 ${v.act} 幕${v.floor!=null?`第 ${v.floor} 站`:''}`:'';}

// Called in commit() right after the engine accepts an action.
export function waAchieve(before,after,action,{delay=0}={}){
 try{
  const pv=waView(before),nv=waView(after);
  if(!nv)return [];
  const book=loadWaBook();
  const r=achStep({defs:WA_ACHIEVEMENTS,book,mem:readMem(),prev:pv,next:nv,action,raw:{prev:before,next:after},observe:waObserve,label:runLabel(nv)});
  writeMem(r.mem);
  if(r.fresh.length){saveBook(store(),WA_ACH_KEY,r.book);showAchToasts(r.fresh,{delay});}
  else if(r.ctx.runEnd||r.ctx.ended)saveBook(store(),WA_ACH_KEY,r.book);
  return r.fresh;
 }catch{return [];}
}
const HALL_NOTE='局内成就在赛季中达成时解锁；生涯成就按你的全部赛季记录判定。每项只解锁一次，奖励是可佩戴的称号，不影响比赛数值。';
export function waHallHtml(){
 const book=loadWaBook(),fresh=evaluateCareer(WA_ACHIEVEMENTS,book);
 saveBook(store(),WA_ACH_KEY,book);
 if(fresh.length)showAchToasts(fresh,{delay:300});
 return hallHtml(WA_ACHIEVEMENTS,WA_CATS,book,{note:HALL_NOTE});
}
// Wires title chips in a rendered hall; re-renders the hall in place on change.
export function bindWaHall(root,onChange){
 const book=loadWaBook();
 bindHall(root,WA_ACHIEVEMENTS,book,b=>{saveBook(store(),WA_ACH_KEY,b);const host=root.querySelector('.ach-hall');if(host)host.outerHTML=hallHtml(WA_ACHIEVEMENTS,WA_CATS,b,{note:HALL_NOTE});bindWaHall(root,onChange);onChange?.();});
}
export function waAchResultHtml(runId){try{return runAchievementsHtml(WA_ACHIEVEMENTS,loadWaBook(),runId);}catch{return '';}}
export function waTitleHtml(extraClass=''){try{return titleBadgeHtml(WA_ACHIEVEMENTS,loadWaBook(),extraClass);}catch{return '';}}
