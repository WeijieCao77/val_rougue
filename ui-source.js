import {cardArtwork,opponentArtwork,artCredit} from './art-ui.js';
import {combatEvents} from './combat-events.js';
import {clearCombatFx,captureCombatStage,playCombatFx} from './combat-fx.js';
import {VERSION,CARDS,SKINS,ENEMIES,describe,cardName,effects,TACTICS,displayText,compactLines,cardKeywords,REGIONS,CURSE_RULES,TRAITS,FIELDS} from './content.js';
import {statusBadges,statusIcon,highlightKeywords} from './shared/status-icons.js';
import {createRun,canPlay,preview,intent,intentText,healAmount,removalReason,observe,shopPrice,R,hasGear,supplySlots,marketPrice,restHeal,enemyMaxHp,gearSellValue,describeSeasonEvent} from './engine.js';
import {CARD_RARITY,RARITY_LABELS} from './card-rarity.js';
import {REGION_TRAITS,TRAIT_TUNING,ASCENSION_LEVELS,MAX_ASCENSION,OPENING_OPTIONS,GEAR,SUPPLIES,RARITY,SUPPLY_PRICES,GEAR_PRICES,GEAR_SLOTS,gearName} from './wa-rules.js';
import {createWaSeason,waAct as act,waLegalActions as legalActions} from './wa-season.js';
import {syncWaCheckpoint} from './wa-online.js';
import {flyCardsFromPile,flyCardsToPile} from './shared/card-pile-motion.js';
import {soundToggleHtml} from './shared/sfx.js';
import {waJuiceAction,waSlam} from './wa-juice.js';
const createSeason=(seed,tutorial,region,opts)=>createWaSeason(seed,tutorial,region,crypto.randomUUID(),opts);
// Difficulty unlocks per region: the highest level the player may pick (0–10).
const ASC_KEY='wa-ascension-v1';
function ascUnlocks(){try{const v=JSON.parse(localStorage.getItem(ASC_KEY)||'{}');return v&&typeof v==='object'?v:{};}catch{return {};}}
function ascUnlocked(r){const n=ascUnlocks()[r];return Number.isInteger(n)?Math.max(0,Math.min(MAX_ASCENSION,n)):0;}
const ascChoice={};
function chosenAsc(r){const max=ascUnlocked(r),c=ascChoice[r];return Number.isInteger(c)&&c<=max?c:max;}
function recordAscensionWin(s){
 if(!s||!R(s)||s.outcome!=='win')return '';
 const next=Math.min(MAX_ASCENSION,(s.ascension||0)+1);if(next<=ascUnlocked(s.region))return '';
 const v=ascUnlocks();v[s.region]=next;try{localStorage.setItem(ASC_KEY,JSON.stringify(v));}catch{return '';}
 return `已解锁${REGIONS[s.region].name}赛区难度 ${next}。`;
}
import {routeNodes,mapEntry,nextScreen,restoreScreen} from './navigation.js';
import {ACTS,availableNodes} from './season-map.js';
const app=document.querySelector('#app'),dialog=document.querySelector('#dialog'),modal=document.querySelector('#dialog-content');
const SAVE='bao-yi-ba-D0.1-save-route-v2',SEASON_SAVE='peak-season-D0.2-save-route-v6',HINTS='bao-yi-ba-hints',VIEW='bao-yi-ba-view-route-v5',LEGACY_VIEW='bao-yi-ba-view-legacy-route-v2';
// Internal beta: old maps cannot be resumed under the new route rules.
try{for(const key of ['bao-yi-ba-D0.1-save','peak-season-D0.2-save','bao-yi-ba-view','bao-yi-ba-view-legacy','peak-season-D0.2-save-route-v2','bao-yi-ba-view-route-v2','peak-season-D0.2-save-route-v3','bao-yi-ba-view-route-v3','peak-season-D0.2-save-route-v4','peak-season-D0.2-save-route-v5','bao-yi-ba-view-route-v4'])localStorage.removeItem(key);}catch{}
let state=null,atHome=true,hints=true,saveError='',saved=null,screen='map',selected=null,echo=null,dragging=null,pointerDrag=null,suppressClick=false,region='CN',turnAnimating=false;
let libraryFilter='all',libraryRegionFilter='all',libraryRarityFilter='all';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadSave(key,legacy=false){try{const raw=localStorage.getItem(key);if(!raw)return null;const s=JSON.parse(raw);if(!s||!Array.isArray(s.deck)||!Array.isArray(s.actions)||!Number.isInteger(s.rev)||!s.phase)return null;if(legacy){if(s.version!==VERSION)return null;return s;}if(s.version!=='D0.2.0'||s.mode!=='season'||(s.mapVersion||1)<2||!REGIONS[s.region]||!s.map||!Array.isArray(s.map.nodes)||!Array.isArray(s.map.edges)||!Array.isArray(s.completed)||![1,2,3].includes(s.act))return null;return s;}catch{return null;}}
try{saved=loadSave(SEASON_SAVE)||loadSave(SAVE,true);if(!saved&&(localStorage.getItem(SEASON_SAVE)||localStorage.getItem(SAVE)))saveError='存档无法读取，可重新开始。';hints=localStorage.getItem(HINTS)!=='off';}catch{saveError='本地存档无法读取；仍可开始新赛季。';region='CN';}
function notice(text){document.querySelector('#notice').textContent=text;}
function saveView(){if(state)try{const key=state.mode==='season'?VIEW:LEGACY_VIEW;localStorage.setItem(key,JSON.stringify({seed:state.seed,rev:state.rev,screen,mode:state.mode,region:state.region,version:state.version}));}catch{notice('页面位置未能保存。');}}
function persist(){
  try{
    const key=state.mode==='season'?SEASON_SAVE:SAVE;
    localStorage.setItem(key,JSON.stringify(state));
    saved=state; saveError=''; saveView();
    const unlocked=recordAscensionWin(state);if(unlocked)state.ascensionNotice=unlocked;
  }catch{
    saveError='自动保存失败，请导出对局记录留存。';
    notice(saveError);
  }
  syncWaCheckpoint(state, (msg)=>notice(msg)).catch(err=>notice('云端同步失败：'+err.message));
}
const button=(label,action,cls='',disabled='')=>`<button class="${cls}" ${disabled?'disabled':''} data-action="${esc(JSON.stringify({...action,rev:state?.rev}))}">${esc(label)}</button>${disabled?`<small class="disabled-reason">${esc(disabled)}</small>`:''}`;
const ui=(label,name,cls='secondary',extra='')=>`<button class="${cls}" data-ui="${name}" ${extra}>${esc(label)}</button>`;
const shapes={
 battle:'<path d="M7 4l12 12-3 3L4 7V4h3zM5 19l5-5m4-4l5-5M14 4h6v6M4 14v6h6"/>',
 elite:'<path d="M5 6l3 3 4-6 4 6 3-3v8l-7 7-7-7V6zM8 13l2 1m6-1l-2 1M10 17h4"/>',
 boss:'<path d="M3 6l5 4 4-7 4 7 5-4-3 14H6L3 6zM7 16h10"/>',
 shop:'<path d="M4 9h16l-2-5H6L4 9zM5 10v10h14V10M9 20v-7h6v7"/>',
 rest:'<path d="M12 3c4 4 7 7 7 11a7 7 0 01-14 0c0-3 2-5 4-7v6c3-2 3-6 3-10z"/>',
 event:'<path d="M8 7a4 4 0 118 0c0 3-4 3-4 7m0 4v1"/><circle cx="12" cy="12" r="10"/>',
 shield:'<path d="M12 2L3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4zM8 12l3 3 5-6"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 smoke:'<path d="M5 19h14M4 14c-4-4 1-8 5-5-1-7 9-8 9-1 7-1 7 8 1 8M8 19v2m8-2v2"/>',
 power:'<path d="M13 2L4 14h7l-1 8 10-13h-7l0-7z"/>',
 cards:'<path d="M5 3h13v17H5V3zM2 6v17h13M8 8l4-3 3 3-3 5-4-5z"/>',
 coin:'<circle cx="12" cy="12" r="9"/><path d="M9 7h6m-6 5h6m-6 5h6M12 5v14"/>',
 crate:'<path d="M3 8l9-4 9 4v9l-9 4-9-4V8zM3 8l9 4 9-4M12 12v9M7.5 6l9 4"/>',
};
function icon(key,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shapes[key]||shapes.cards}</svg>`;}
const roleIcon={'决斗':'battle','哨位':'shield','控场':'smoke','先锋':'eye','自由人':'power'};
// Rarity only says how often a card is offered; it is never a grade of the player pictured.
function rarityTip(id){return `出现频率：${RARITY_LABELS[CARD_RARITY[id]]}`;}
function rarityGem(id){return CARD_RARITY[id]?`<span class="card-rarity" title="${rarityTip(id)}" aria-label="${rarityTip(id)}"></span>`:'';}
function rarityClass(id){return CARD_RARITY[id]?` rarity-${CARD_RARITY[id]}`:'';}
function rarityCaption(id){return CARD_RARITY[id]?`<p class="rarity-caption rarity-${CARD_RARITY[id]}" title="${rarityTip(id)}"><i aria-hidden="true"></i>${rarityTip(id)}</p>`:'';}
function face(c,instance=false){const t=CARDS[c.id],f=TACTICS[c.id],tag=t.zone==='exhaust'?'消耗':t.zone==='temporary'?'临时 · 消耗':t.zone==='exhaustEnd'?'回合末消耗':t.zone==='power'?'持续能力':t.id.startsWith('CU')?'跨比赛保留':c.up?'已训练':t.player?'选手牌':/^(CN|AM|EU|PA)T\d{2}$/.test(t.id)?'战术牌':'辅助牌';return `<span class="card-cost">${t.cost===null?'—':t.cost}</span>${rarityGem(c.id)}<span class="card-title">${esc(cardName(c))}</span><span class="card-portrait" aria-hidden="true">${cardArtwork(c.id)}<span class="portrait-role">${esc(t.player?t.role:t.id.startsWith('CU')?'隐患':/^(CN|AM|EU|PA)T\d{2}$/.test(t.id)?'战术':'行动')}</span></span><b class="card-tactic">${esc(f.title)}</b><span class="card-effect">${compactLines(c).map(line=>`<span>${highlightKeywords(esc(line).replace(/(\d+)/g,'<strong>$1</strong>'),true)}</span>`).join('')}</span><span class="card-foot"><b class="${['exhaust','temporary','exhaustEnd'].includes(t.zone)?'exhaust-tag':''}">${tag}</b>${instance?' · '+c.uid:''}</span>`;}
function card(c,options={}){const t=CARDS[c.id];return `<article tabindex="0" data-card-id="${c.id}" data-card-up="${!!c.up}" aria-label="${esc(cardName(c)+'，'+t.role+'，'+describe(c))}" class="card role-${t.player?t.role:t.id.slice(0,2)} ${c.up?'upgraded':''}${rarityClass(c.id)}"><div class="card-face">${face(c,options.instance)}</div>${options.rarity?rarityCaption(c.id):''}${options.upgrade?`<div class="upgrade-text"><strong>训练后</strong><p>${esc(describe({...c,up:true}))}</p></div>`:''}${options.action?`<div class="card-action">${button(options.label||'选择',options.action,'',options.disabled||'')}</div>`:''}</article>`;}
function heading(kicker,title,text=''){return `<div class="section-heading"><div class="eyebrow">${kicker}</div><h2 tabindex="-1" id="page-title">${title}</h2>${text?`<p>${text}</p>`:''}</div>`;}
function home(){
 const regions=Object.values(REGIONS);
 return `<main class="cover-screen">
 <section class="cover-hero" aria-label="游戏封面">
   <img src="/cover-wa.webp" alt="登峰赛季游戏封面：赛区地图与角色集结" class="cover-img">
   <div class="cover-overlay"></div>
   <div class="cover-content">
     <div class="eyebrow">四大赛区 · 卡牌肉鸽</div>
     <h1>登峰赛季</h1>
     <p class="cover-sub">把这支队伍，带到赛季最后一场。</p>
     <div class="cover-actions">
       ${saved?ui(`继续征程 · ${saved.mode==='season'?`第${saved.node}站`:'旧版第'+saved.node+'站'}`,'continue','primary'):''}
       <a class="primary cover-select-link" href="#cover-setup">选择赛区 ↓</a>
     </div>
   </div>
 </section>
 <section class="cover-setup" id="cover-setup">
   <h2 class="setup-title">选择赛区</h2>
   <div class="region-picker">
     <div class="region-tabs">${regions.map(r=>`<button class="region-tab ${region===r.id?'active':''}" data-ui="set-region-${r.id}">${esc(r.name)}<small>${esc(r.tagline)}</small></button>`).join('')}</div>
     <p class="region-note">${esc(regions.find(r=>r.id===region).tagline)} / 50 名选手 · 25 张战术 / 三幕征程</p>
   </div>
   <div class="region-extra">${regionExtra()}</div>
   <div class="setup-start">${ui('确认开赛','start-season','primary')}</div>
   <div class="button-row">
     ${ui('游戏规则','rules','text-button')}
     ${ui('卡牌总览','library','text-button')}
     <a class="text-button" href="/art-gallery.html" target="_blank" rel="noopener noreferrer">配图图鉴</a>
     <a class="text-button" href="/pvp/">好友PvP</a>
     <a class="text-button" href="/">选择版本</a>
     ${globalThis.DEMO_CONFIG?.newDemoEnabled === true ? `<a class="text-button" href="/new/">新demo</a>` : ''}
   </div>
   <p class="title-note">四大赛区 · 300 张赛区牌 · 三幕 × 15 站 + 决赛</p>
   ${saveError?`<p class="warning">${esc(saveError)}</p>`:''}
   <footer class="cover-footer">猪之家出品</footer>
 </section>
</main>`;
}
// Six equipment slots on the HUD; opens the equipment panel (sell from there).
function gearSlotsStrip(s){
 const cells=Array.from({length:GEAR_SLOTS},(_,i)=>{const id=s.skins[i],g=id&&GEAR[id];return g?`<i class="gear-cell rarity-${g.rarity}" title="${esc(g.name)}">${statusIcon(g.icon)}</i>`:'<i class="gear-cell empty"></i>';}).join('');
 return `<button class="gear-slots" data-ui="gear" aria-label="装备 ${s.skins.length}/${GEAR_SLOTS}，打开装备栏" title="装备 ${s.skins.length}/${GEAR_SLOTS}">${cells}</button>`;
}
function gearOfferRoom(){
 const s=state,g=GEAR[s.gearOffer];
 return `<main class="room-screen room-gear-offer"><div class="room-emblem">${statusIcon(g.icon)}</div>${heading('装备槽已满',`新装备：${esc(g.name)}`,`${RARITY[g.rarity]}装备 · ${g.text}`)}<p>选择替换其中一件（被替换的装备按品级折算资金），或放弃这件新装备。</p><div class="choices gear-offer">${s.skins.map((id,i)=>{const o=GEAR[id];return `<article class="choice rarity-${o.rarity}"><h3>${statusIcon(o.icon)}${esc(o.name)}</h3><p>${esc(o.text)}</p>${button(`替换（+${gearSellValue(id)} 资金）`,{type:'gearReplace',slot:i})}</article>`;}).join('')}</div><div class="page-footer">${button('放弃新装备 →',{type:'gearDecline'},'secondary')}</div></main>`;
}
function regionExtra(){
 const t=REGION_TRAITS[region],max=ascUnlocked(region),pick=chosenAsc(region);
 const levels=ASCENSION_LEVELS.map(l=>`<button class="asc-level ${l.level===pick?'active':''}" data-ui="set-asc-${l.level}" ${l.level>max?'disabled':''} aria-pressed="${l.level===pick}" title="${esc(l.level>max?`难度 ${l.level}：在难度 ${l.level-1} 赢下完整赛季后解锁`:`难度 ${l.level}：${l.text}`)}">${l.level}</button>`).join('');
 const rules=ASCENSION_LEVELS.filter(l=>l.level>=1&&l.level<=pick).map(l=>`<li><b>${l.level}</b>${esc(l.text)}</li>`).join('');
 return `<div class="region-trait">${statusIcon(t.icon)}<div><b>赛区特质 · ${esc(t.name)}</b><p>${esc(t.text)}</p></div></div>
 <div class="asc-picker"><div class="asc-head"><b>难度等级</b><small>已解锁 0–${max} · 在当前最高难度赢下完整赛季，解锁下一级</small></div><div class="asc-levels" role="group" aria-label="难度等级">${levels}</div>${pick?`<ol class="asc-rules">${rules}</ol>`:`<p class="asc-zero">${esc(ASCENSION_LEVELS[0].text)}</p>`}</div>`;
}
function header(){
 const actInfo=state.mode==='season'?ACTS[state.act-1]:null;
 const label=state.mode==='season'?`${actInfo?actInfo.name:'赛段'} · ${state.region}${R(state)&&state.ascension?` · 难度 ${state.ascension}`:''}`:'第一幕 · 大师赛征程';
 const extra=R(state)?`${gearSlotsStrip(state)}${ui(`补给 ${state.supplies.length}/${supplySlots(state)}`,'supplies','hud-link')}`:'';
 return `<header class="game-hud"><div class="brand">登峰赛季 <span>${esc(label)}</span></div><span class="header-links"><a href="/pvp/">好友PvP</a>${globalThis.DEMO_CONFIG?.newDemoEnabled === true ? `<a href="/new/">新demo</a>` : ''}</span><div class="hud-resources"><span class="hud-hp">${icon('shield')} <b>${state.hp}</b> / ${state.maxHp}</span><span class="hud-money">${icon('coin')} <b>${state.money}</b></span>${ui(`牌组 ${state.deck.length}`,'deck','hud-link')}${extra}</div><div class="hud-tools">${ui(screen==='map'?'路线图':'查看路线','map','hud-link')}${ui('记录','logs','hud-link')}${ui('规则','rules','hud-link')}${ui('菜单','menu','hud-link')}${soundToggleHtml()}</div></header>`;
}
function route(){
 if(state.mode==='season')return seasonRoute();
 // legacy route
 const nodes=routeNodes(state),current=nodes.filter(n=>n.status==='current'),lines=[];
 for(let step=1;step<9;step++)for(const from of nodes.filter(n=>n.step===step))for(const to of nodes.filter(n=>n.step===step+1)){
  const taken=from.status==='visited'&&['visited','current'].includes(to.status);
  lines.push(`<path class="${taken?'taken':''}" d="M ${from.x*7} ${from.y*7.5} C ${from.x*7} ${(from.y-5)*7.5}, ${to.x*7} ${(to.y+5)*7.5}, ${to.x*7} ${to.y*7.5}"/>`);
 }
 return `<main class="map-screen"><aside class="map-intro"><div class="eyebrow">ACT I / 中国赛区</div><h1>大师赛<br>征程</h1><p>从下方向上前进。<br>每次选择一站，走向冠军。</p><div class="map-progress"><b>${state.wins}</b><span> / 6 场胜利</span></div><div class="map-legend">${[['battle','比赛'],['elite','强敌'],['event','事件'],['shop','转会市场'],['rest','俱乐部活动'],['boss','大师赛决赛']].map(([k,t])=>`<span>${icon(k)}${t}</span>`).join('')}</div><p class="map-instruction">${current.length>1?'当前有两条路线可选。进入其中一条后，另一条会关闭。':'点击发亮的节点进入。暗色节点将在之后解锁。'}</p>${state.phase==='result'?ui('查看赛季结算','return-room','primary'):''}</aside><div class="map-scroll"><div class="map-board"><div class="map-watermark">CHAMPIONSHIP</div><svg class="map-paths" viewBox="0 0 700 750" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>${nodes.map(n=>`<div class="map-stop ${n.status} kind-${n.kind}" style="left:${n.x}%;top:${n.y}%"><button data-map="${n.key}" ${n.status==='current'?'':'disabled'} aria-label="${n.status==='current'?'进入':n.status==='visited'?'已完成':n.status==='bypassed'?'未选择':'未解锁'}：${n.name}">${icon(n.kind)}${n.status==='visited'?'<span class="visited-check">✓</span>':''}</button><span class="node-label">${n.name}</span>${n.status==='current'?'<small class="here-label">你的下一站</small>':''}</div>`).join('')}<span class="map-start">赛季启程</span></div></div><aside class="map-current"><span class="eyebrow">第 ${state.node} / 9 站</span><h3>${current.length>1?'决定下一步':current[0]?.name||'赛季已结束'}</h3><p>${state.node===5?'招募新选手，或为当前阵容安排一次活动。':state.node===6?'普通比赛更稳妥。强敌压力更大，但会掉落一件皮肤。':state.node===9?'最后一场。对手会随战斗时间增强，用你的整套牌组争取冠军。':state.node===7?'粉丝见面会、训练和团建，选择你现在最需要的一项。':'牌组和剩余声望会随你进入下一站。'}</p><div class="map-stamp">${state.phase==='combat'?'MATCH':state.phase==='activity'?'CLUB':'SEASON'}<strong>${String(state.node).padStart(2,'0')}</strong></div>${state.phase==='combat'&&state.battle.turn>1?ui('返回正在进行的比赛','return-room','secondary'):''}</aside></main>`;
}
const REVEALED={battle:'遭遇战',shop:'转会市场',crate:'补给箱',event:'事件'};
function seasonRoute(){
 const s=state,nodes=routeNodes(s),lookup=new Map(nodes.map(n=>[n.key,n])),choices=nodes.filter(n=>n.status==='current'),info=ACTS[s.act-1];
 const resume=!['map','result','intermission'].includes(s.phase);
 const done=nodes.filter(n=>n.status==='visited'&&n.kind!=='boss').length,floors=s.map.nodes.reduce((m,n)=>n.kind==='boss'?m:Math.max(m,n.step),0);
 const lines=s.map.edges.map(e=>{const a=lookup.get(e.from),b=lookup.get(e.to),taken=a.status==='visited'&&(b.status==='visited'||resume&&b.key===s.currentNode);return `<path class="${taken?'taken':a.key===s.currentNode&&b.status==='current'?'available':''}" d="M ${a.x*7} ${a.y*14} C ${a.x*7} ${(a.y-3)*14}, ${b.x*7} ${(b.y+3)*14}, ${b.x*7} ${b.y*14}"/>`;});
 const itinerary=`<ol class="season-itinerary">${ACTS.map(a=>`<li class="${a.id===s.act?'active':a.id<s.act?'complete':''}"><b>${a.id<s.act?'✓':a.id}</b><span>${a.name}<small>${a.bossName}</small></span></li>`).join('')}</ol>`;
 return `<main class="map-screen season-map"><aside class="map-intro"><div class="eyebrow">ACT ${['I','II','III'][s.act-1]} / ${esc(REGIONS[s.region].name)}</div><h1>${info.name}</h1>${itinerary}<div class="map-progress"><b>${done}</b><span> / ${floors} 站完成 · 之后是决赛</span></div><div class="map-legend">${[['battle','比赛'],['elite','强敌'],['event','未知'],['shop','转会市场'],['crate','补给箱'],['rest','俱乐部活动'],['boss','世界赛']].map(([k,t])=>`<span>${icon(k)}${t}</span>`).join('')}</div><p class="map-instruction">${resume?'比赛与奖励尚未完成，可查看后续路线，再返回当前节点。':s.currentNode===null?'四个起点任选其一。向上滑动地图，可先看决赛和后续路线。':'沿连线选择下一站。分叉会改变接下来的比赛和补强机会。'}</p>${s.phase!=='map'?ui(s.phase==='intermission'?'查看晋级与下一幕':s.phase==='result'?'查看赛季结算':'返回当前节点','return-room','primary'):''}</aside><div class="map-scroll"><div class="map-board season-board"><div class="map-watermark">ASCEND</div><svg class="map-paths" viewBox="0 0 700 1400" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>${nodes.map(n=>`<div class="map-stop ${n.status} kind-${n.kind}" style="left:${n.x}%;top:${n.y}%"><button data-map="${n.key}" ${n.status==='current'?'':'disabled'} aria-label="${n.status==='current'?(resume?'返回':'进入'):n.status==='visited'?'已完成':n.status==='bypassed'?'未选择':'未解锁'}：第 ${n.step} 站 ${esc(n.name)}${n.revealed?`（已揭晓：${REVEALED[n.revealed]}）`:''}">${icon(n.revealed||n.kind)}${n.status==='visited'?'<span class="visited-check">✓</span>':''}</button><span class="node-label">${esc(n.name)}</span>${n.status==='current'?`<small class="here-label">${resume?'正在进行':'可选下一站'}</small>`:''}</div>`).join('')}</div></div><aside class="map-current"><span class="eyebrow">赛季进度 ${s.node} / ${3*(floors+1)} 节点</span><h3>${s.phase==='intermission'?'世界赛晋级':s.phase==='result'?'赛季结束':resume?'完成当前节点':`可选 ${choices.length} 条路线`}</h3><p>本幕终点：${info.bossName}。<br>强敌提供装备；俱乐部活动可恢复声望或训练；市场可招募与移除牌${R(s)?'，并出售装备与补给品':''}；补给箱必得资金，常有装备。未知节点进入后揭晓，多半是事件，也可能是比赛、市场或补给箱。</p><p>节点内容与连线随赛季种子生成。已进入的节点不会因刷新而改变。</p>${s.phase!=='map'?ui('返回当前进度','return-room','secondary'):''}</aside></main>`;
}
function targetOf(c){return effects(c).some(e=>['hit','weak','vulnerable'].includes(e.type))?'enemy':'self';}
function handCard(c,i,n){const t=CARDS[c.id],reason=canPlay(state,c.uid),offset=i-(n-1)/2;return `<button class="hand-card role-${t.player?t.role:t.id.slice(0,2)} ${reason?'unplayable':''} ${c.up?'upgraded':''}${rarityClass(c.id)}" data-card-id="${c.id}" data-card-up="${!!c.up}" data-select="${c.uid}" draggable="false" style="--offset:${offset};--tilt:${offset*(n>6?1.6:3)}deg;--bend:${Math.abs(offset)*Math.abs(offset)*1.8}px;--order:${i}" aria-label="选择 ${esc(cardName(c))} · ${esc(TACTICS[c.id].title)}，${t.role}，${t.cost===null?'不能打出':t.cost+' 行动点'}，${esc(describe(c))}"><span class="card-face">${face(c)}</span><span class="card-key">${(i+1)%10}</span>${reason?`<span class="card-unavailable">${esc(reason)}</span>`:''}</button>`;}
function fighter(which){
 const own=which==='self',b=state.battle,e=ENEMIES[b.enemy],hp=own?state.hp:b.enemyHp,max=own?state.maxHp:enemyMaxHp(b),block=own?b.block:b.enemyBlock;
 const growth=e.growth??2;
 const badges=own?statusBadges([['block',b.block],['strength',b.selfStrength],['overload',b.overload],['weak',b.weak],['vuln',b.vulnerable]]):statusBadges([['block',b.enemyBlock],['strength',b.enemyStrength],['aim',b.aim],['burn',b.enemyBurn],['weak',b.enemyWeak],['vuln',b.enemyVulnerable]]);
 const deploys=own&&b.deployables?.length?`<span class="deploy-row">${b.deployables.map(d=>`<span class="deploy-chip" title="${d.kind==='turret'?`哨戒炮：回合结束时造成 ${d.n} 伤害`:`屏障无人机：回合结束时获得 ${d.n} 布防`}，剩余 ${d.turns} 回合">${statusIcon(d.kind==='turret'?'sentry':'block')}<b>${d.n}</b><small>×${d.turns}</small></span>`).join('')}</span>`:'';
 const trait=!own&&b.trait&&TRAITS[b.trait.id];
 const traitHtml=trait?`<div class="trait-row"><span class="trait-tag" tabindex="0" title="${esc(trait.text(b.trait.n))}">${statusIcon(trait.icon)}${esc(trait.name)}${b.trait.id==='tempo'?` ${b.tempoCount||0}/${b.trait.n}`:''}</span></div>`:own&&R(state)?regionTraitTag(state):'';
 const hidden=!own&&hasGear(state,'BX03');
 const look=e.look||(/E01$/.test(b.enemy)?'rookie':b.enemy);
 return `<section data-drop-target="${which}" class="fighter ${own?'ally':'enemy'}"${own?'':` data-character-variant="${esc(look)}"`}>${!own?`<div class="intent-bubble"><small>对手意图</small><strong>${hidden?'信息封锁：看不到对手意图':highlightKeywords(displayText(intentText(state)))}</strong>${e.boss?`<span>长战增伤 +${b.cycles*growth}</span>`:''}</div>`:'<div class="team-label">'+(state.region||'CN')+'俱乐部</div>'}<button class="combat-target" data-target="${which}" aria-label="${own?'我方俱乐部':'对手队伍'}，可作为出牌目标">${own?`<span class="crest">${icon('shield')}<b>${state.region||'CN'}</b></span>`:opponentArtwork(b.enemy)}<span class="target-caption">${own?'施放到我方':'施放到对手'}</span><span class="status-overlay">${badges}</span>${deploys}</button><h2>${own?(REGIONS[state.region]?.name||'新锐')+'俱乐部':e.name}</h2>${traitHtml}<div class="life-row"><span class="shield-value" title="布防：陷阱、墙与阻滞提供的伤害抵消；下次己方回合开始清空。" aria-label="布防 ${block}">${icon('shield')}<small>布防</small> ${block}</span><div class="life-bar ${own?'own':''}"><i style="width:${hp/max*100}%"></i><span>${hp} / ${max} ${own?'声望':'防线'}</span></div></div>${own?`<div class="active-powers">${b.powers.map(c=>`<span title="${esc(describe(c))}">${icon('power')}${esc(cardName(c))}</span>`).join('')}</div>`:''}</section>`;
}
// Region trait: icon + live counter + rule tooltip, shown like a starter item on our side.
function regionTraitTag(s){
 const t=REGION_TRAITS[s.region],b=s.battle,tt=b.tt||{},rt=b.rt||{},T=TRAIT_TUNING[s.region];
 let count='',state='';
 if(s.region==='CN'){count=tt.cnDone?'✓':`${(tt.roles||[]).length}/${T.roles}`;state=tt.cnDone?'本回合已触发':`本回合已打出定位：${(tt.roles||[]).join('、')||'无'}`;}
 if(s.region==='AM'){count=(tt.dmg||0)>=T.nth?'✓':`${tt.dmg||0}/${T.nth}`;state=`本回合已打出 ${tt.dmg||0} 张伤害牌`;}
 if(s.region==='EMEA'){const on=b.enemyWeak>0;count=`${on?'+'+T.block:'+0'} · ${tt.emeaDrew?'已抽':'抽'+T.draw}`;state=`${on?'对手压制中：布防额外 +'+T.block:'对手未被压制'}；本回合压制抽牌${tt.emeaDrew?'已用':'可用'}；本场额外布防 ${rt.extraBlock||0}`;}
 if(s.region==='PAC'){count=`${(rt.temps||0)%T.every}/${T.every}`;state=`本场已打出 ${rt.temps||0} 张临时牌；下回合加入 ${CARDS[rt.pacNext||'TK01'].name}`;}
 const tip=`${t.name}｜${t.text}｜${state}`;
 return `<div class="trait-row"><span class="trait-tag region-trait" tabindex="0" title="${esc(tip)}" aria-label="${esc(tip)}">${statusIcon(t.icon)}${esc(t.name)}<b class="trait-count">${esc(count)}</b></span></div>`;
}
function gearRack(s){
 if(!R(s))return s.skins.map(id=>`<span title="${esc(SKINS[id].text)}">${icon('power')}${SKINS[id].name}</span>`).join('')||'<span class="muted">暂无装备</span>';
 return s.skins.map(id=>{const g=GEAR[id],n=id==='GR21'?(s.counters?.cards||0)+'/10':id==='GR43'&&s.flags?.GR43?'已用':'';return `<span class="gear-chip rarity-${g.rarity}" tabindex="0" title="${esc(`${g.name}（${RARITY[g.rarity]}）：${g.text}`)}" aria-label="${esc(`${g.name}：${g.text}`)}">${statusIcon(g.icon)}<em>${esc(g.name)}</em>${n?`<small>${esc(n)}</small>`:''}</span>`;}).join('')||'<span class="muted">暂无装备</span>';
}
function supplyBar(s){
 if(!R(s))return '';
 const slots=Array.from({length:supplySlots(s)},(_,i)=>{const id=s.supplies[i];if(!id)return '<span class="supply-slot empty" aria-label="空补给栏">＋</span>';const p=SUPPLIES[id];return `<button class="supply-slot" data-action="${esc(JSON.stringify({type:'useSupply',slot:i,rev:s.rev}))}" title="${esc(`使用 ${p.name}：${p.text}`)}" aria-label="${esc(`使用补给品 ${p.name}：${p.text}`)}">${statusIcon(p.icon)}<small>${esc(p.name)}</small></button>`;}).join('');
 return `<div class="supply-bar" aria-label="补给品">${slots}</div>`;
}
function battle(){
 const b=state.battle,incoming=intent(state).filter(a=>a.type==='hit').reduce((n,a)=>n+a.n*a.times*(b.vulnerable>0?1.5:1),0),hurt=hasGear(state,'BX03')?'?':Math.max(0,Math.floor(incoming)-b.block),curse=b.hand.reduce((n,c)=>n+(CURSE_RULES[c.id]?.trigger==='endTurnLoseHp'?CURSE_RULES[c.id].n:0),0);
 const actInfo=state.mode==='season'?ACTS[state.act-1]:null;
 const battleLabel=state.mode==='season'?`第 ${state.act} 赛段 · ${actInfo?.name||''} ${actInfo?.bossName||''}`:'第 '+(state.wins+1)+' 场 / 6';
 const growth=ENEMIES[b.enemy]?.growth??2;
 const field=b.field&&FIELDS[b.field];
 return `<main class="combat-screen"><div class="arena-top"><span>${esc(battleLabel)} <b>·</b> 回合 ${b.turn}${ENEMIES[b.enemy]?.boss&&growth?` · 增长 ${growth}`:''}</span>${field?`<span class="battlefield-tag" tabindex="0" title="${esc(field.text)}">战场 <b>${esc(field.name)}</b> · ${esc(field.text)}</span>`:''}<div class="skin-rack gear-rack">${gearRack(state)}</div></div><section class="arena"><div class="arena-backdrop" aria-hidden="true"><i></i><i></i><i></i></div>${fighter('self')}<div class="arena-center"><span class="versus">VS</span>${echo?`<div class="played-echo">${icon(roleIcon[CARDS[echo.id].role]||'cards')}<span>已打出</span><strong>${esc(cardName(echo))} · ${esc(TACTICS[echo.id].title)}</strong></div>`:'<span class="arena-center-label">'+(state.mode==='season'?actInfo?.name||'赛季赛段':'大师赛资格赛')+'</span>'}<div id="target-hint" class="target-hint">先选一张手牌</div></div>${fighter('enemy')}<div class="arena-floor" aria-hidden="true"></div></section><div class="combat-controls">${supplyBar(state)}<div class="turn-warning">${curse?`<strong>舆论压力：回合末另失去 ${curse} 声望</strong>`:`结束回合预计失去 <b>${hurt}</b> 声望`}<small class="discard-reminder">未用手牌回合末弃置；回合末消耗牌除外</small></div><div id="selection-panel" class="selection-panel"></div>${button('结束回合',{type:'end'},'end-turn')}</div><section class="hand-dock"><div class="deck-console"><div class="energy-orb"><b>${b.energy}</b><span>行动点</span></div>${ui(`抽牌堆 ${b.draw.length}`,'pile-draw','pile-button draw-pile')}</div><div class="hand-fan" style="--slots:${Math.max(1,b.hand.length)}">${b.hand.length?b.hand.map((c,i)=>handCard(c,i,b.hand.length)).join(''):'<p class="empty-hand">手牌已空<br>结束回合后重新抽牌</p>'}</div><div class="discard-console">${ui(`弃牌堆 ${b.discard.length}`,'pile-discard','pile-button discard-pile')}${ui(`消耗 ${b.exhaust.length}`,'pile-exhaust','exhaust-link')}</div></section><div class="combat-bottom"><span>${b.hand.length} / 10 张手牌</span><span>${state.tutorial&&hints?'悬停看说明 · 点牌选目标 · 拖动出牌':'1–0 选牌 · Enter 打出 · Esc 取消 · E 结束回合'}</span>${state.tutorial&&hints?ui('隐藏提示','hide-hints','text-button'):ui('战斗记录','logs','text-button')}</div></main>`;
}
// Transfer market: an agent NPC at a booth, three contracts on the board, and a release desk.
function agentLine(s){
 const left=s.shop.slots.filter(Boolean).length,open=s.shop.slots.map((id,slot)=>id?shopPrice(s,slot):Infinity),cheapest=Math.min(40,...open),top=Math.max(90,...open.filter(Number.isFinite));
 if(s.shop.prices&&left&&s.money>=cheapest&&s.money<top&&s.shop.slots.some(id=>CARD_RARITY[id]==='rare'))return '稀有合同难得一见，攒够资金再来也不迟。';
 const lines=s.money<cheapest?['预算见底了？先解约一个不合拍的，阵容反而更顺。','没钱也能谈——先看看离队服务。']:left===0?['这批合同都被你签完了，下一站再见。']:s.money>=top?[s.shop.prices?'大手笔！越靠右的合同越难得。':'大手笔！顶薪合同在最右边。','预算够用，慢慢挑。']:['三份合同，三个价位。','刚谈下来的新人，签不签随你。','转会窗口不等人，想好了就签字。'];
 return lines[s.rev%lines.length];
}
function marketScene(s){
 // Season shops price each slot by how rarely the card is offered; legacy shops keep cost tiers.
 const byRarity=!!s.shop.prices,prices=s.shop.slots.map((_,slot)=>marketPrice(s,shopPrice(s,slot)));
 const labels=byRarity?s.shop.slots.map(id=>id&&CARD_RARITY[id]?`${RARITY_LABELS[CARD_RARITY[id]]}签约`:'签约'):['新秀合同','主力合同','顶薪合同'];
 const tier=(id,slot)=>byRarity?['common','uncommon','rare'].indexOf(CARD_RARITY[id]):slot;
 const board=s.shop.slots.map((id,slot)=>id?`<div class="contract-slot tier-${tier(id,slot)}"><div class="price-tag"><b>${prices[slot]}</b><span>资金</span></div><div class="contract-label">${labels[slot]}</div>${card({id,up:false},{rarity:byRarity,label:s.money<prices[slot]?'资金不足':CARDS[id].player?'签下合同':'购入战术',action:{type:'buy',slot},disabled:s.money<prices[slot]?'资金不足':''})}</div>`:`<div class="contract-slot signed"><div class="contract-label">${labels[slot]}</div><article class="card sold"><h3>已签约</h3><p>这份合同已经签下。</p></article></div>`).join('');
 return `<section class="shop-scene market-scene"><div class="shop-header"><div class="npc-booth"><div class="npc-stage" data-npc="agent" aria-hidden="true"></div><div class="npc-info"><div class="npc-name">转会经纪人 · 老K <small>转会市场</small></div><div class="npc-bubble">${esc(agentLine(s))}</div></div></div><div class="shop-wallet"><span>俱乐部资金</span><b>${s.money}</b></div></div><h3 class="shelf-title">转会名单</h3><div class="shop-shelf contract-board">${board}</div>${R(s)?marketExtras(s):''}<div class="shop-counter"><section class="counter-service"><h4>解约离队 · 永久移除一张牌</h4><p>${marketPrice(s,50)} 资金，每个市场限一次。可移除选手或隐患；至少保留 5 张选手牌及一张直接攻击牌。</p>${ui(s.shop.removed?'本次服务已使用':'选择移除对象','remove-target','secondary',s.shop.removed||s.money<marketPrice(s,50)?'disabled':'')}</section><section class="counter-service"><h4>市场规则</h4><p>签约与解约可以组合进行；离开后不能返回。空出的货位不会刷新。</p></section></div><div class="page-footer">${button('离开市场，继续赛程 →',{type:'leaveShop'})}</div></section>`;
}
function marketExtras(s){
 const full=s.supplies.length>=supplySlots(s),blocked=hasGear(s,'BX08');
 const gear=(s.shop.gear||[]).map((id,slot)=>{if(!id)return '<article class="market-item sold"><h4>已售出</h4></article>';const g=GEAR[id],price=marketPrice(s,GEAR_PRICES[g.rarity]);return `<article class="market-item rarity-${g.rarity}"><div class="price-tag"><b>${price}</b><span>资金</span></div><h4>${statusIcon(g.icon)}${esc(g.name)}</h4><small class="rarity-label">${RARITY[g.rarity]}装备</small><p>${esc(g.text)}</p>${button('购入装备',{type:'buyGear',slot},'',s.skins.length>=GEAR_SLOTS?'装备槽已满':s.money<price?'资金不足':'')}</article>`;}).join('');
 const supplies=(s.shop.supplies||[]).map((id,slot)=>{if(!id)return '<article class="market-item sold"><h4>已售出</h4></article>';const p=SUPPLIES[id],price=marketPrice(s,SUPPLY_PRICES[p.rarity]);return `<article class="market-item supply rarity-${p.rarity}"><div class="price-tag"><b>${price}</b><span>资金</span></div><h4>${statusIcon(p.icon)}${esc(p.name)}</h4><small class="rarity-label">${RARITY[p.rarity]}补给品</small><p>${esc(p.text)}</p>${button('购入补给品',{type:'buySupply',slot},'',blocked?'禁用补给协议':full?'补给栏位已满':s.money<price?'资金不足':'')}</article>`;}).join('');
 return `<h3 class="shelf-title">装备柜台</h3><div class="shop-shelf market-row">${gear}</div><h3 class="shelf-title">补给品货架 <small>栏位 ${s.supplies.length}/${supplySlots(s)}</small></h3><div class="shop-shelf market-row">${supplies}</div>`;
}
function rewardLoot(s){
 const r=s.reward,out=[];
 if(r.gear){const g=GEAR[r.gear];out.push(`<div class="loot-line rarity-${g.rarity}">${statusIcon(g.icon)}<div><b>强敌掉落装备 · ${esc(g.name)}</b><small>${RARITY[g.rarity]}</small><p>${esc(g.text)}</p></div></div>`);}
 if(r.supply){const p=SUPPLIES[r.supply],full=s.supplies.length>=supplySlots(s);
  const actions=full?s.supplies.map((id,i)=>button(`替换 ${SUPPLIES[id].name}`,{type:'takeSupply',replace:i},'secondary')).join(''):button('收下补给品',{type:'takeSupply'},'primary');
  out.push(`<div class="loot-line supply-loot">${statusIcon(p.icon)}<div><b>缴获补给品 · ${esc(p.name)}</b><p>${esc(p.text)}</p><p class="muted">${full?'补给栏位已满：可替换一个，或不领取。':'不领取则离开奖励后丢失。'}</p><div class="button-row">${actions}</div></div></div>`);}
 return out.length?`<div class="reward-loot">${out.join('')}</div>`:'';
}
function rewardMoney(s){return R(s)&&hasGear(s,'BX04')?0:(s.reward.elite?35:20)+(hasGear(s,'GR07')?8:0);}
function openingRoom(){
 const s=state,o=s.opening;
 if(s.phase==='openingPick'){
  const p=o.pending,title=OPENING_OPTIONS[p.id].title,back=p.back?`<div class="page-footer">${button('返回合同选择',{type:'openingBack'},'secondary')}</div>`:'';
  if(p.kind==='recruit')return `${heading('赞助商签约日',title,'选择一名选手加入牌组。')}<div class="cards reward-cards">${p.offers.map(id=>card({id,up:false},{action:{type:'openingPick',id},label:'签下这名选手'})).join('')}</div>${back}`;
  const remove=p.kind==='remove',list=s.deck.filter(c=>remove||CARDS[c.id].trainable&&!c.up);
  return `${heading('赞助商签约日',title,remove?'选择一张牌永久移除。':`选择要训练的牌（还需 ${p.left} 张）。`)}<div class="cards">${list.map(c=>card(c,{instance:true,upgrade:!remove,label:remove?'永久移除':'训练这张牌',action:{type:'openingPick',uid:c.uid},disabled:remove?removalReason(s,c.uid):''})).join('')}</div>${back}`;
 }
 const kinds={free:'免费',trade:'交换',basic:'常规'};
 const detail=x=>x.id==='recruit23'?`候选：${x.offers.map(id=>CARDS[id].name).join('、')}`:x.id==='curseForStar'?`隐患：${CARDS[x.curse].name}；候选：${x.offers.map(id=>CARDS[id].name).join('、')}`:x.id==='hpForGear'&&x.gear?`装备：${gearName(x.gear)}——${GEAR[x.gear].text}`:x.id==='trainRandom'&&x.uid?`训练对象：${cardName(s.deck.find(c=>c.uid===x.uid))}`:'';
 const legal=new Set(legalActions(s).filter(a=>a.type==='opening').map(a=>a.choice));
 return `${heading('赞助商签约日','选择一份开季合同','四份合同只能签下一份。签约后进入第一幕路线图。')}<div class="choices opening-choices">${o.options.map(x=>{const d=OPENING_OPTIONS[x.id],det=detail(x);return `<article class="choice opening-${d.kind}"><span class="choice-kind">${kinds[d.kind]}</span><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>${det?`<p class="choice-detail">${esc(det)}</p>`:''}${button('签下合同',{type:'opening',choice:x.id},'',legal.has(x.id)?'':'当前无法执行')}</article>`;}).join('')}</div>`;
}
function bossGearRoom(){
 const s=state;
 return `${heading(hasGear(s,'BX04')?'世界赛胜利':'世界赛胜利 · 资金 +50','选择一件 Boss 装备','每件都很强，也都带着代价。也可以放弃。')}<div class="choices">${s.reward.bossGear.map(id=>choice(`${statusIcon(GEAR[id].icon)}${esc(GEAR[id].name)}`,esc(GEAR[id].text),'领取装备',{type:'bossGear',id})).join('')}</div>${button('放弃装备 →',{type:'bossGear',id:null},'secondary')}`;
}
function choice(title,text,label,action,disabled=''){return `<article class="choice"><h3>${title}</h3><p>${text}</p>${button(label,action,'',disabled)}</article>`;}
function between(){
 const s=state;
 if(s.mode==='season'&&['event','eventUpgrade','eventCleanse','eventPick'].includes(s.phase))return seasonEventRoom();
 if(s.mode==='season'&&s.phase==='crate')return crateRoom();
 if(s.mode==='season'&&['opening','openingPick'].includes(s.phase))return openingRoom();
 if(s.mode==='season'&&s.phase==='bossGear')return bossGearRoom();
 if(s.mode==='season'){
  if(s.phase==='intermission'){
   const nextAct=ACTS[s.act];
   return `${heading('赛段完成','你的俱乐部晋级了。',`已完成第 ${s.act} 赛段。${s.waVersion ? '已举办晋级宣传：恢复全部声望至满。当前 ' + s.hp + '/' + s.maxHp + '。下一赛段：' : '已举办晋级宣传：恢复最大声望的 30%，本次实际 +' + (s.intermissionHeal??0) + '。当前 ' + s.hp + '/' + s.maxHp + '。下一赛段：'}${nextAct?nextAct.name+' · '+nextAct.bossName:'冠军赛'}`)}<div class="intermission-details"><p>牌组与资源将保留。</p><p><strong>当前声望</strong> ${s.hp}/${s.maxHp} <strong>资金</strong> ${s.money}</p></div><div class="page-footer">${button('进入下一赛段 →',{type:'nextAct'},'primary')}</div>`;
  }
  if(s.phase==='result')return `<section class="result">${heading(s.outcome==='win'?'赛季冠军':'赛季结束',s.outcome==='win'?'你赢得了最终赛段冠军。':'赛季暂告一段落。',s.outcome==='win'?'你带领所选赛区的阵容走过三幕，赢得冠军赛。':'调整思路，再来一季。')}${R(s)?`<p class="asc-result">难度 ${s.ascension||0}${s.ascensionNotice?` · ${esc(s.ascensionNotice)}`:''}</p>`:''}<div class="result-stats"><span><strong>${s.wins}</strong>场胜利</span><span><strong>${s.hp} / ${s.maxHp}</strong>剩余声望</span><span><strong>${s.deck.length}</strong>张赛季牌</span></div><div class="button-row">${ui('再开一个赛季','home','primary')}${ui('查看最终牌组','deck')}${ui('导出本局记录','export')}</div><p class="muted">种子：${esc(s.seed)} · ${s.actions.length} 次操作 · D0.2.0${R(s)?' · 规则 '+s.rules:''}</p></section>`;
 }
 if(s.phase==='reward')return `${heading('比赛胜利','补强，还是保持精简？',`已获得 ${rewardMoney(s)} 资金。招募一名选手加入牌组，也可以跳过。${s.mode==='season'?(s.reward.offers.some(id=>CARD_RARITY[id]==='rare')?'本次出现了稀有候选。':s.reward.elite?'强敌奖励更容易出现罕见与稀有候选。':''):''}`)}${R(s)?rewardLoot(s):''}<div class="cards reward-cards${s.mode==='season'&&s.reward.offers.some(id=>CARD_RARITY[id]==='rare')?' has-rare':''}">${s.reward.offers.map(id=>card({id,up:false},{rarity:s.mode==='season',action:{type:'recruit',id},label:CARDS[id].player?'招募选手':'加入战术'})).join('')}</div><div class="page-footer">${button('跳过招募 →',{type:'recruit',id:null},'secondary')}</div>`;
 if(s.phase==='skin')return `${heading(s.reward.boss?'世界赛胜利 · 资金 +50':'强敌奖励','选择一件装备','本赛季持续生效，不进入抽牌堆。')}<div class="choices">${s.reward.skins.map(id=>choice(SKINS[id].name,SKINS[id].text,'领取皮肤',{type:'skin',id})).join('')}</div>${button('跳过皮肤 →',{type:'skin',id:null},'secondary')}`;
 if(s.phase==='event')return `${heading('赛程外的机会','额外收益，也有额外代价。','商业活动与试训邀请同时送到了俱乐部。选择后返回路线图。')}<div class="choices">${choice('接受商业活动','资金 +70；加入一张舆论压力。以后每次在回合末留在手中，直接失去 2 声望。','拿 70 资金，承担舆论压力',{type:'event',choice:'money'})}${choice('安排紧急试训','从三名固定候选中招募一名，同时加入磨合不足。它会占用抽牌，不能打出。','查看试训候选',{type:'event',choice:'trial'},!s.eventOffers.length?'无可招募选手':'')}${choice('谢绝，保持训练','没有额外收益，也不增加负面牌。保留当前节奏。','继续赛程',{type:'event',choice:'skip'})}</div>`;
 if(s.phase==='trial')return `${heading('紧急试训','选择补强对象','确认招募时，会同时加入一张不能打出的磨合不足。返回不会刷新候选。')}<div class="cards reward-cards">${s.eventOffers.map(id=>card({id,up:false},{rarity:s.mode==='season',label:'招募，并加入磨合不足',action:{type:'trial',id}})).join('')}</div>${button('返回事件选择',{type:'trial',id:null},'secondary')}`;
 if(s.phase==='branch')return `${heading('赛程选择','为下一场，做一次准备。','两条路线只能选择一条。')}<div class="choices">${choice('转会市场','三名选手可供购买；也可花 50 资金永久移除一张牌。当前资金 '+s.money+'。','前往转会市场',{type:'branch',choice:'shop'})}${choice('俱乐部活动','粉丝见面会恢复声望、训练升级一张牌，或团建移除隐患。三选一。','安排俱乐部活动',{type:'branch',choice:'activity'})}</div>`;
 if(s.phase==='opponent')return `${heading('挑战选择','稳步晋级，还是争取更多？','强敌会带来更高压力，但能奖励一件本赛季皮肤。')}<div class="choices">${choice('防守反击队 · 普通','38 防线，擅长布防与反击。胜利获得 20 资金和一次招募。','选择普通比赛',{type:'opponent',id:'E04'})}${choice('高压强敌队 · 强敌','54 防线，多段攻击，并塞入疲劳与节奏受阻。胜利获得 35 资金、招募和一件皮肤。','挑战强敌',{type:'opponent',id:'EL01'})}</div>`;
 if(s.phase==='shop')return marketScene(s);
 if(s.phase==='activity'){const heal=restHeal(s),pct=R(s)&&s.ascension>=5?20:30;return `${heading('俱乐部活动','比赛之外，也有取舍。','选择一项活动，然后继续赛程。')}<div class="choices">${choice('粉丝见面会',`恢复最大声望的 ${pct}%，向上取整${hasGear(s,'GR25')?'，理疗枕额外 +10':''}。当前 ${s.hp}/${s.maxHp} → ${s.hp+heal}/${s.maxHp}，实际恢复 ${heal}。`,'举办粉丝见面会',{type:'activity',choice:'fans'},hasGear(s,'BX02')?'封闭训练协议：不能回复':s.hp===s.maxHp?'声望已满':'')}${choice('训练','升级一张选手或战术牌。费用不变，只改变这张牌的效果。','选择训练对象',{type:'activity',choice:'upgrade'},hasGear(s,'BX09')?'冻结训练计划：不能训练':!s.deck.some(c=>CARDS[c.id].trainable&&!c.up)?'没有可升级选手':'')}${choice('团建','永久移除一张俱乐部隐患。可以处理磨合不足或舆论压力。','处理俱乐部隐患',{type:'activity',choice:'cleanse'},!s.deck.some(c=>c.id.startsWith('CU'))?'没有俱乐部隐患':'')}${s.waVersion ? choice('体能集训', `提升体能上限：最大声望与当前声望各 +6。当前 ${s.hp}/${s.maxHp} → ${s.hp+6}/${s.maxHp+6}。消耗本次休整机会。`,'开始集训',{type:'activity',choice:'toughness'}) : ''}</div>${button('跳过活动 →',{type:'activity',choice:'skip'},'secondary')}`;}
 if(s.phase==='upgrade'||s.phase==='cleanse')return `${heading('俱乐部活动',s.phase==='upgrade'?'选择一张牌，进行训练。':'解决一项俱乐部隐患。',s.phase==='upgrade'?'展示升级前后效果；同名选手的其他牌不会一起升级。':'这张隐患将永久离开本次赛季牌组。')}<div class="cards">${s.deck.filter(c=>s.phase==='upgrade'?CARDS[c.id].trainable&&!c.up:c.id.startsWith('CU')).map(c=>card(c,{instance:true,upgrade:s.phase==='upgrade',label:s.phase==='upgrade'?'训练这张牌':'永久移除此隐患',action:{type:s.phase,uid:c.uid}})).join('')}</div><div class="page-footer">${button('返回活动选择',{type:'activityBack'},'secondary')}</div>`;
 if(s.phase==='result')return `<section class="result">${heading(s.outcome==='win'?'首幕通关':s.outcome==='loss'?'赛季结束':'本次试玩结束',s.outcome==='win'?'大师赛冠军，属于你的俱乐部。':s.outcome==='loss'?'声望耗尽，俱乐部暂别赛场。':'调整思路，再来一局。',s.outcome==='win'?'你已走完第一款 Demo 的完整流程。后两幕尚未制作，现在可以回顾牌组与记录。':'试着调整进攻、防守和招募的取舍。每次赛季都从全新的初始牌组开始。')}<div class="result-stats"><span><strong>${s.wins} / 6</strong>场比赛获胜</span><span><strong>${s.hp} / ${s.maxHp}</strong>剩余声望</span><span><strong>${s.deck.length}</strong>张赛季牌</span></div><div class="button-row">${ui('再开一个赛季','home','primary')}${ui('查看最终牌组','deck')}${ui('导出本局记录','export')}</div><p class="muted">种子：${esc(s.seed)} · ${s.actions.length} 次操作 · ${VERSION}</p></section>`;
 return '';
}
function seasonEventRoom(){
 const s=state,view=describeSeasonEvent(s);
 if(!view)return `${heading('未知事件','事件已结束','返回路线图继续赛程。')}`;
 if(view.pending){
  const verb={upgrade:'训练这张牌',remove:'永久移除',transform:'变换这张牌',duplicate:'复制这张牌',cleanse:'永久移除此隐患'}[view.pending.kind]||'选择';
  const cards=view.pending.candidates.map(uid=>s.deck.find(c=>c.uid===uid)).map(c=>card(c,{instance:true,upgrade:view.pending.kind==='upgrade',label:verb,action:{type:s.phase,uid:c.uid}})).join('');
  return `${heading(view.title,`${esc(view.pending.title)} · 选择一张牌`,`确认后生效：${esc(view.pending.effects)}。返回事件不付出任何代价。`)}<div class="cards">${cards}</div><div class="page-footer">${button('返回事件，不付出代价',{type:'eventBack'},'secondary')}</div>`;
 }
 const options=view.options.map(o=>choice(esc(o.title),esc(o.effects),o.pick?'选择目标牌':'就这么办',{type:'seasonEvent',choice:o.id},o.reason)).join('');
 return `${heading('未知 · 已揭晓',esc(view.title),'')}<p class="event-scene">${esc(view.scene)}</p><div class="choices event-choices">${options}</div><p class="event-status">声望 ${s.hp}/${s.maxHp} · 资金 ${s.money}</p><div class="page-footer">${button('谢绝，继续赛程 →',{type:'seasonEvent',choice:'skip'},'secondary')}</div>`;
}
function crateRoom(){
 const s=state,c=s.crate,r=c.result,names={small:'小型补给箱',medium:'中型补给箱',large:'大型补给箱'};
 const box=`<div class="crate-box crate-${c.size}${c.opened?' is-open':''}" aria-hidden="true"><span class="crate-lid"></span><span class="crate-body"></span></div>`;
 if(!c.opened)return `${heading('补给箱',names[c.size],'赛事物流送来的补给。越大的箱子越少见，资金越多，也越可能装着皮肤。')}${box}<div class="page-footer">${button('打开补给箱',{type:'crate',choice:'open'},'primary')}</div>`;
 const loot=`<div class="crate-loot"><div class="crate-loot-item"><b>+${r.money+r.bonusMoney}</b><span>资金${r.bonusMoney?`（含无皮肤补偿 ${r.bonusMoney}）`:''}</span></div>${r.skin?`<div class="crate-loot-item"><b>${esc(r.skin)}</b><span>${esc(Object.values(SKINS).find(k=>k.name===r.skin)?.text||'')}</span></div>`:`<div class="crate-loot-item"><span>${r.upgrade?'箱里没有皮肤，附赠一次免费训练：选择一张牌升级，或直接离开。':'箱里没有皮肤。'}</span></div>`}</div>`;
 const ups=r.upgrade?`<div class="cards">${s.deck.filter(x=>CARDS[x.id].trainable&&!x.up).map(x=>card(x,{instance:true,upgrade:true,label:'免费训练',action:{type:'crateUpgrade',uid:x.uid}})).join('')}</div>`:'';
 return `${heading('补给箱 · 已打开',names[c.size],'')}${box}${loot}${ups}<div class="page-footer">${button(r.upgrade?'不训练，继续赛程 →':'收好物资，继续赛程 →',{type:'crate',choice:'leave'},r.upgrade?'secondary':'primary')}</div>`;
}
function render(){
 clearCombatFx();
 document.querySelectorAll('.card-flight').forEach(el=>{el.getAnimations().forEach(a=>a.cancel());el.remove();});
 hideCardTip();
 if(atHome){app.innerHTML=home();document.body.className='home-mode';return;}
 const inMap=screen==='map';
 document.body.className=R(state)&&state.gearOffer?'room-mode':inMap?'map-mode':state.phase==='combat'?'combat-mode':'room-mode';
 const content=R(state)&&state.gearOffer?gearOfferRoom():inMap?route():state.phase==='combat'?battle():`<main class="room-screen room-${state.phase}"><div class="room-emblem">${icon(state.phase==='crate'?'crate':state.phase==='shop'?'shop':['activity','upgrade','cleanse'].includes(state.phase)?'rest':['event','trial','eventPick','eventUpgrade','eventCleanse'].includes(state.phase)?'event':state.phase==='result'||state.phase==='intermission'?'boss':'cards')}</div>${between()}</main>`;
 app.innerHTML=`${header()}${saveError?`<div class="warning">${esc(saveError)}</div>`:''}${content}`;
 refreshSelection();
 if(inMap)centerCurrentMap();
}
function centerCurrentMap(){const scroll=app.querySelector('.map-scroll'),node=app.querySelector('.map-stop.current');if(scroll&&node)scroll.scrollTo({top:Math.max(0,node.offsetTop-scroll.clientHeight*.72),behavior:'auto'});}
window.addEventListener('resize',()=>requestAnimationFrame(centerCurrentMap));
function refreshSelection(){
 const c=state?.battle?.hand.find(c=>c.uid===selected),panel=document.querySelector('#selection-panel');
 document.querySelectorAll('[data-select]').forEach(el=>{el.classList.toggle('selected',el.dataset.select===selected);el.setAttribute('aria-pressed',String(el.dataset.select===selected));});
 const target=c?targetOf(c):null;
 document.querySelectorAll('[data-target]').forEach(el=>el.classList.toggle('targetable',el.dataset.target===target&&!canPlay(state,selected)));
 if(!panel)return;
 if(!c){panel.innerHTML='<span class="selection-placeholder">从手牌中选择你的下一步</span>';if(document.querySelector('#target-hint'))document.querySelector('#target-hint').textContent='先选一张手牌';return;}
 const reason=canPlay(state,c.uid),p=reason?null:preview(state,c.uid),parts=[];
 if(p){if(p.damage||p.enemyBlock)parts.push(`防线 −${p.damage}${p.enemyBlock?' · 布防 −'+p.enemyBlock:''}`);if(p.block)parts.push(`布防 +${p.block}`);if(p.draw)parts.push(`抽 ${p.draw} 张${p.shuffle?'（洗牌）':''}`);if(p.wins)parts.push('可结束比赛');}
 panel.innerHTML=`<div><strong>${esc(cardName(c))} · ${esc(TACTICS[c.id].title)}</strong><small>${reason||parts.join(' / ')||'建立本场效果'}</small></div>${button('打出',{type:'play',uid:c.uid},'play-selected',reason)}${ui('详解','card-detail','text-button')}${ui('取消','deselect','text-button')}`;
 if(document.querySelector('#target-hint'))document.querySelector('#target-hint').textContent=reason||`点击${target==='enemy'?'对手':'我方'}出牌，或拖动卡牌`;
}
function commit(action){
 if(turnAnimating)return {error:'对手回合进行中'};
 const stage=captureCombatStage();
 const cardEl=action.type==='play'?document.querySelector(`[data-select="${action.uid}"]`):null;
 const flight=cardEl?{rect:cardEl.getBoundingClientRect(),html:cardEl.innerHTML,role:cardEl.className}:null;
 const before=state,played=action.type==='play'?state.battle?.hand.find(c=>c.uid===action.uid):null,r=act(state,action);
 if(r.error){notice(r.error);return r;}
 if(action.type==='end'&&before.phase==='combat'){
  turnAnimating=true;hideCardTip();
  const arena=document.querySelector('.arena');
  const banner=document.createElement('div');banner.className='enemy-turn-banner';banner.innerHTML='<strong>结束回合</strong><span>未用手牌进入弃牌堆</span>';
  arena?.append(banner);
  document.querySelector('.combat-screen')?.setAttribute('inert','');
  const oldHand=[...document.querySelectorAll('.hand-fan [data-select]')],exhausted=new Set(before.battle.hand.filter(c=>CARDS[c.id].zone==='exhaustEnd').map(c=>c.uid));
  Promise.all([flyCardsToPile(oldHand.filter(el=>!exhausted.has(el.dataset.select)),document.querySelector('.discard-pile'),{keepHidden:true}),flyCardsToPile(oldHand.filter(el=>exhausted.has(el.dataset.select)),document.querySelector('.exhaust-link'),{keepHidden:true})]).catch(()=>{});
  const enemyAt=reduceMotion()?220:Math.max(580,oldHand.length?440+(oldHand.length-1)*95:0);
  const events=combatEvents(before,r.state,action);
  waJuiceAction(before,r.state,action,played,enemyAt);
  setTimeout(()=>{banner.querySelector('strong').textContent='对手回合';banner.querySelector('span').textContent='攻击结算';playCombatFx(events,stage);globalThis.characterStages?.cueFromTransition('wa',before,r.state,action);},enemyAt);
  setTimeout(()=>{state=r.state;screen=nextScreen(before,state);selected=null;echo=null;dialog.close();persist();notice(saveError||'');render();if(before.node!==state.node||before.phase!==state.phase||before.act!==state.act)window.scrollTo(0,0);const drawn=[...document.querySelectorAll('.hand-fan [data-select]')];flyCardsFromPile(drawn,document.querySelector('.draw-pile')).finally(()=>{turnAnimating=false;});},enemyAt+(reduceMotion()?420:1100));
  return r;
 }
 waJuiceAction(before,r.state,action,played);
 state=r.state;screen=nextScreen(before,state);selected=null;echo=played||null;dialog.close();persist();notice(saveError||'');render();
 if(before.node!==state.node||before.phase!==state.phase||before.act!==state.act)window.scrollTo(0,0);
 animateResolution(before,state,played,flight,action);
 if(played)waSlam();
 playCombatFx(combatEvents(before,state,action),stage);
 globalThis.characterStages?.cueFromTransition('wa',before,state,action);
 return r;
}
function showModal(title,html){hideCardTip();modal.innerHTML=`<h2 tabindex="-1">${title}</h2>${html}`;if(!dialog.open)dialog.showModal();modal.querySelector('h2').focus({preventScroll:true});dialog.scrollTop=0;}
function showCards(title,cards,note=''){showModal(title,`${note?`<p>${note}</p>`:''}<div class="cards modal-cards">${cards.map(c=>card(c,{instance:!!c.uid})).join('')}</div>`);}
function libraryEntry(id){const f=TACTICS[id];return `<div class="library-entry">${card({id,up:false},{upgrade:CARDS[id].trainable})}<details><summary>战术说明与出处</summary>${artCredit(id)}<p>${esc(f.note)}</p>${f.source?`<a href="${esc(f.source)}" target="_blank" rel="noopener noreferrer">查看参考来源</a>`:'<p>原创比赛／团队场景。</p>'}</details></div>`;}

function showCardOverview(){
  const totalNonSkin=Object.keys(CARDS).length;
  const playerIds=Object.keys(CARDS).filter(id=>CARDS[id].player);
  const tacticIds=Object.keys(CARDS).filter(id=>/^(CN|AM|EU|PA)T\d{2}$/.test(id));
  const playerCount=playerIds.length;
  const stIds=Object.keys(CARDS).filter(id=>id.startsWith('ST'));
  const cuIds=Object.keys(CARDS).filter(id=>id.startsWith('CU'));
  const tkIds=Object.keys(CARDS).filter(id=>id.startsWith('TK'));
  const skinIds=Object.keys(SKINS);
  const skinCount=skinIds.length;
  const filterLabels={
    all:`全部卡牌 (${totalNonSkin})`,
    players:`选手牌 (${playerCount})`,
    tactics:`赛区战术 (${tacticIds.length})`,
    st:`比赛干扰 (${stIds.length})`,
    cu:`俱乐部隐患 (${cuIds.length})`,
    tk:`临时行动 (${tkIds.length})`,
    skins:`装备 (${Object.keys(GEAR).length})`,
    supplies:`补给品 (${Object.keys(SUPPLIES).length})`
  };
  const tabsHtml=Object.entries(filterLabels).map(([key,label])=>ui(label,`library-${key}`,libraryFilter===key?'primary':'secondary')).join('');
  let regionTabsHtml='';
  if(libraryFilter==='players'||libraryFilter==='tactics'){
    const regionPoolCounts = Object.values(REGIONS).map(r => {
      const count = REGIONS[r.id].pool.filter(id => CARDS[id] && (libraryFilter==='players'?CARDS[id].player:id.includes('T'))).length;
      return `${r.name} (${count})`;
    });
    regionTabsHtml=`<div class="region-filter-tabs">${ui('全部赛区','library-region-all',libraryRegionFilter==='all'?'primary':'secondary')}${Object.values(REGIONS).map((r,i)=>ui(regionPoolCounts[i],`library-region-${r.id}`,libraryRegionFilter===r.id?'primary':'secondary')).join('')}</div>`;
  }
  const rarityTabsHtml=['all','players','tactics'].includes(libraryFilter)?`<div class="rarity-filter-tabs" aria-label="按出现频率筛选">${[['all','全部频率'],['common','普通'],['uncommon','罕见'],['rare','稀有']].map(([key,label])=>ui(label,`library-rarity-${key}`,libraryRarityFilter===key?'primary':'secondary')).join('')}<small>出现频率只影响奖励与商店中出现的机会，不代表选手水平。</small></div>`:'';
  let contentHtml='';
  if(libraryFilter==='skins'){
    contentHtml=`<div class="skin-overview">${Object.entries(GEAR).map(([id,g])=>`<article class="skin-entry rarity-${g.rarity}"><h3>${statusIcon(g.icon)}${esc(g.name)}</h3><p class="skin-text">${esc(g.text)}</p><p class="skin-note">${RARITY[g.rarity]}装备 · 本赛季持续 · 不进入抽牌堆</p></article>`).join('')}</div>`;
  } else if(libraryFilter==='supplies'){
    contentHtml=`<div class="skin-overview">${Object.entries(SUPPLIES).map(([id,p])=>`<article class="skin-entry rarity-${p.rarity}"><h3>${statusIcon(p.icon)}${esc(p.name)}</h3><p class="skin-text">${esc(p.text)}</p><p class="skin-note">${RARITY[p.rarity]}补给品 · 一次性 · 比赛中使用</p></article>`).join('')}</div>`;
  } else {
    let ids=[];
    switch(libraryFilter){
      case 'all': ids=Object.keys(CARDS); break;
      case 'players': ids=playerIds; if(libraryRegionFilter!=='all') ids=ids.filter(id=>REGIONS[libraryRegionFilter].pool.includes(id)); break;
      case 'tactics': ids=tacticIds; if(libraryRegionFilter!=='all') ids=ids.filter(id=>REGIONS[libraryRegionFilter].pool.includes(id)); break;
      case 'st': ids=stIds; break;
      case 'cu': ids=cuIds; break;
      case 'tk': ids=tkIds; break;
      default: ids=[];
    }
    if(libraryRarityFilter!=='all')ids=ids.filter(id=>CARD_RARITY[id]===libraryRarityFilter);
    contentHtml=ids.length?`<div class="cards modal-cards overview-cards">${ids.map(libraryEntry).join('')}</div>`:`<p class="empty-overview">该分类暂无可展示的卡牌。</p>`;
  }
  const infoHtml=`<p class="overview-info">${totalNonSkin} 张卡牌 · 另含 ${Object.keys(GEAR).length} 件装备与 ${Object.keys(SUPPLIES).length} 种补给品（不占抽牌）。当前筛选：${libraryFilter === 'players' && libraryRegionFilter !== 'all' ? REGIONS[libraryRegionFilter].name + '（' + REGIONS[libraryRegionFilter].pool.filter(id => CARDS[id]?.player).length + '）' : filterLabels[libraryFilter]}${libraryRarityFilter!=='all'?` · 出现频率：${RARITY_LABELS[libraryRarityFilter]}`:''}</p>`;
  showModal('卡牌总览',`${infoHtml}<div class="overview-tabs">${tabsHtml}</div>${regionTabsHtml}${rarityTabsHtml}${contentHtml}`);
}
function start(tutorial,selectedRegion){
 const seed=`season-${crypto.randomUUID()}`;
 const r=selectedRegion||region;
 state=createSeason(seed,tutorial,r,{rules:1,ascension:chosenAsc(r)});
 atHome=false;screen=state.phase==='map'?'map':'room';selected=null;echo=null;dialog.close();persist();notice(state.phase==='opening'?'赞助商签约日：选择一份开季合同。':'选择路线图上发亮的节点，开始第一场比赛。');render();
}
function startLegacy(tutorial){const seed=`season-${crypto.randomUUID()}`;state=createRun(seed,tutorial);atHome=false;screen='map';selected=null;echo=null;dialog.close();persist();notice('选择路线图上发亮的节点，开始第一场比赛。');render();}
function handleUI(name){
 if(name.startsWith('set-region-')){region=name.slice('set-region-'.length);document.querySelectorAll('.region-tab').forEach(el=>el.classList.toggle('active',el.dataset.ui===name));const note=document.querySelector('.region-note');if(note)note.textContent=`${REGIONS[region].tagline} / 50 名选手 · 25 张战术 / 三幕征程`;const ex=document.querySelector('.region-extra');if(ex)ex.innerHTML=regionExtra();return;}
 if(name.startsWith('set-asc-')){const n=Number(name.slice('set-asc-'.length));if(Number.isInteger(n)&&n<=ascUnlocked(region)){ascChoice[region]=n;const ex=document.querySelector('.region-extra');if(ex)ex.innerHTML=regionExtra();}return;}
 if(name==='gear'){showModal(`俱乐部装备 ${state.skins.length}/${R(state)?GEAR_SLOTS:3}`,state.skins.length?`${R(state)?'<p>最多 6 件装备。可随时出售一件：普通 15、罕见 25、稀有 40、Boss 专属 50、市场专属 30 资金。</p>':''}<div class="gear-list">${state.skins.map((id,i)=>{const g=GEAR[id]||{name:SKINS[id]?.name,text:SKINS[id]?.text,rarity:'common',icon:'block'};return `<article class="gear-entry rarity-${g.rarity}">${statusIcon(g.icon)}<div><h3>${esc(g.name)} <small>${RARITY[g.rarity]}</small></h3><p>${esc(g.text)}</p>${id==='GR21'?`<p class="muted">当前累计 ${(state.counters?.cards||0)}/10</p>`:''}${id==='GR43'&&state.flags?.GR43?'<p class="muted">已触发</p>':''}${R(state)&&state.phase!=='result'&&!state.gearOffer?button(`出售（+${gearSellValue(id)} 资金）`,{type:'sellGear',slot:i},'text-button'):''}</div></article>`;}).join('')}</div>`:'<p>暂无装备。强敌胜利必得 1 件，Boss 胜利可三选一，转会市场也有出售。</p>');return;}
 if(name==='supplies'){showModal('补给品',`<p>栏位 ${state.supplies.length}/${supplySlots(state)}。补给品在比赛中点击使用，一次性；也可以随时丢弃。</p>${state.supplies.length?`<div class="gear-list">${state.supplies.map((id,i)=>{const p=SUPPLIES[id];return `<article class="gear-entry">${statusIcon(p.icon)}<div><h3>${esc(p.name)} <small>${RARITY[p.rarity]}</small></h3><p>${esc(p.text)}</p>${state.phase==='result'?'':button('丢弃',{type:'discardSupply',slot:i},'text-button')}</div></article>`;}).join('')}</div>`:'<p class="muted">当前没有补给品。</p>'}`);return;}
 if(name==='start-season'){
  if(saved&&saved.mode==='season'&&saved.phase!=='result'){
   showModal('开始新赛季',`<p>新赛季会覆盖当前的登峰赛季进度。</p><p>旧版存档会保留。</p><div class="button-row">${ui('确认开赛','confirm-season','primary')}${ui('继续上次赛季','continue')}</div>`);
  } else start(false,region);
  return;
 }
 if(name==='confirm-season'){start(false,region);return;}
 if(name.startsWith('confirm-start-')){const legacy=name.includes('legacy');if(legacy)startLegacy(true);else start(name.includes('tutorial'),region);return;}
 if(name==='continue'){
   if(!saved){saveError='没有可继续的存档。';render();return;}
   state=saved;let meta=null;try{const key=state.mode==='season'?VIEW:LEGACY_VIEW;meta=JSON.parse(localStorage.getItem(key));}catch{}
   atHome=false;selected=null;echo=null;dialog.close();
   screen=restoreScreen(state,meta);
   render();window.scrollTo(0,0);return;
 }
 if(name==='home'){atHome=true;dialog.close();render();return;}
 if(name==='map'){
  if(state.mode==='season'){
   if(state.phase==='map'||state.phase==='intermission'){screen='map';selected=null;saveView();render();notice('');return;}
   // if in room with unfinished current node, allow resume map?
  }
  screen='map';selected=null;saveView();render();notice('');return;
 }
 if(name==='return-room'){
  if(state.mode==='season'&&state.phase==='map'){screen='map';render();return;}
  if(state.mode==='season'&&state.phase==='intermission'){screen='room';}
  else screen=['branch','opponent'].includes(state.phase)?'map':'room';
  saveView();render();notice('');return;
 }
 if(name==='intermission-next'){commit({type:'nextAct',rev:state.rev});return;}
 if(name==='deselect'){selected=null;refreshSelection();return;}
 if(name==='card-detail'){
  const c=state?.battle?.hand.find(c=>c.uid===selected);
  if(c){const f=TACTICS[c.id];showModal(cardName(c)+' · '+f.title,`<div class="card-detail">${card(c,{upgrade:CARDS[c.id].trainable&&!c.up})}<div><p class="detail-scene">${esc(f.scene)}</p><p><strong>${esc(f.origin)}</strong></p><p>${esc(f.note)}</p><p>选手与技能搭配为本游戏的战术设定；赛区战术牌为原创设计。</p>${artCredit(c.id)}${f.source?`<a href="${esc(f.source)}" target="_blank" rel="noopener noreferrer">查看技能／赛事出处</a>`:''}</div></div>`);}
  return;
 }
 if(name==='deck'){showCards('赛季牌组',state.deck,'同名牌是不同的行动机会；实例编号用于区分升级。比赛干扰和临时行动不进入赛季牌组。');return;}
  if(name==='library'||name.startsWith('library-')){
    if(name==='library'){libraryFilter='all';libraryRegionFilter='all';libraryRarityFilter='all';showCardOverview();return;}
    if(name.startsWith('library-rarity-')){
      const key=name.slice('library-rarity-'.length);
      if(['all','common','uncommon','rare'].includes(key)){libraryRarityFilter=key;showCardOverview();}
      return;
    }
    const filterMap={
      'library-all':'all',
      'library-players':'players',
      'library-tactics':'tactics',
      'library-st':'st',
      'library-cu':'cu',
      'library-tk':'tk',
      'library-skins':'skins',
      'library-supplies':'supplies'
    };
    if(filterMap[name]){
      libraryFilter=filterMap[name];
      if(libraryFilter!=='players'&&libraryFilter!=='tactics')libraryRegionFilter='all';
      if(!['all','players','tactics'].includes(libraryFilter))libraryRarityFilter='all';
      showCardOverview();
      return;
    }
    if(name.startsWith('library-region-')){
      const regionId=name.slice('library-region-'.length);
      if(regionId==='all'){
        libraryRegionFilter='all';
        showCardOverview();
      } else if(REGIONS[regionId]){
        libraryRegionFilter=regionId;
        if(libraryFilter!=='players'&&libraryFilter!=='tactics')libraryFilter='players';
        showCardOverview();
      }
      return;
    }
    return;
  }
 if(name.startsWith('pile-')){
  const key=name.slice(5),list=[...state.battle[key]].sort((a,b)=>a.id.localeCompare(b.id)||a.uid.localeCompare(b.uid));
  showCards({draw:'抽牌堆',discard:'弃牌堆',exhaust:'消耗区'}[key],list,key==='draw'?'按卡牌编号展示，实际抽牌顺序隐藏。':'消耗只对本场生效，赛季牌组里的原牌下场会重新带入。');return;
 }
 if(name==='logs'){
  showModal('完整比赛记录',`<ol class="full-logs">${state.logs.map(l=>`<li><small>${l.node!==undefined?`节点 ${l.node} · 回合 ${l.turn}`:`回合 ${l.turn}`}</small> ${esc(displayText(l.text))}${l.text.startsWith('打出 ')?(()=>{const id=Object.keys(CARDS).find(id=>l.text.startsWith('打出 '+CARDS[id].name+'，')||l.text.startsWith('打出 '+CARDS[id].name+' +，'));return id?'<em class="log-tactic">'+esc(TACTICS[id].title+' · '+TACTICS[id].scene)+'</em>':'';})():''}</li>`).join('')}</ol>`);return;
 }
 if(name==='hide-hints'){hints=false;try{localStorage.setItem(HINTS,'off');}catch{}render();return;}
 if(name==='rules'){
  showModal('赛季规则',`<div class="rules"><p><strong>目标：</strong>对手防线降到 0 就赢得比赛；自己的声望降到 0，赛季失败。</p><p><strong>每回合：</strong>3 行动点、抽 5 张。按费用出牌，结束回合后对手按公开意图行动。资金与行动点是两种资源。</p><p><strong>布防：</strong>绊线、减速、墙体与掩护的共同收益；每点抵消 1 点攻击伤害。先抵消攻击，下个自己的回合开始清空。对手布防在对手下次行动开始时清空。</p><p><strong>牌堆：</strong>打出的普通牌进入弃牌堆；结束回合时，所有未打出的手牌也进入弃牌堆，不留到下回合。注明回合末消耗的牌改入消耗区。下回合重新抽 5 张，并结算额外抽牌能力；需要抽牌而抽牌堆为空时，将弃牌堆洗成新的抽牌堆。手牌最多 10 张。</p><p><strong>消耗：</strong>写着“打出后消耗”的牌，效果结算后进入消耗区，不进入弃牌堆，本场不再抽到；未打出时仍正常弃置，除非另写“回合末消耗”。消耗不等于永久删除，赛季牌组中的原牌下场恢复。临时牌和比赛干扰在赛后消失。</p><p><strong>能力：</strong>自由人牌打出后持续本场，不再洗回；多张可叠加，只影响之后的触发。</p><p><strong>压制：</strong>攻击伤害 ×0.75。<strong>易伤：</strong>受到攻击 ×1.5。每段伤害分别向下取整；回合数在受影响一方行动结束后减少。</p><p><strong>战术场景：</strong>卡上的特工技能转译成上述卡牌规则。腐坏逼退以压制结算，闪光接枪窗口以易伤结算；不另加持续伤害、硬控或隐藏触发。选牌后点“详解”可看说明。</p><p><strong>五个位置：</strong>决斗进攻，哨位布防，控场压制，先锋配合与抽牌，自由人建立持续能力。</p><p><strong>俱乐部活动：</strong>粉丝见面会恢复最大声望的 30%（向上取整、至多满声望）；训练升级一张选手或战术牌；团建移除一张隐患。每节点只能选一项。</p><p><strong>招募：</strong>可跳过。相同选手最多三张，升级前后合并计算。</p><p><strong>登峰赛季：</strong>四个赛区、三个赛段。每赛段 15 站，第 16 层为决赛，包含分支路线：第 1–2 站固定为比赛，第 7 站转会市场，第 9 站补给箱，第 15 站俱乐部活动；前 5 站不会出现强敌。前两幕 Boss 胜利各奖励 50 资金与 Boss 装备三选一（旧存档仍为皮肤选择，集齐后改得 20 资金）。之后晋级宣传恢复最大声望的 30%。冠军赛获胜即为赛季胜利。</p><h3>赛区特质</h3>${Object.entries(REGION_TRAITS).map(([id,t])=>`<p><strong>${esc(REGIONS[id].name)} · ${esc(t.name)}：</strong>${esc(t.text)}</p>`).join('')}<p>特质只在新规则赛季与好友 PvP 中生效，战斗界面左侧显示当前计数。</p><h3>赞助商签约日</h3><p>选择赛区后、进入路线图前，从 4 份合同中签下 1 份：两份免费的小奖励、一份有代价的交换、一份常规合同。选项由赛季种子决定。</p><h3>装备</h3><p>装备在本赛季持续生效，不进入抽牌堆，分普通、罕见、稀有、Boss 专属与市场专属。战胜强敌必得 1 件（普通／罕见／稀有约 50%／33%／17%，不重复）；Boss 胜利后可从 3 件 Boss 专属装备中选 1 件或放弃；转会市场出售 2 件装备与 1 件市场专属装备。原有三件皮肤归入普通装备。最多装备 6 件（Boss 专属装备与皮肤同样占槽）：槽满时获得新装备，需替换一件（被替换的按品级折算资金：普通 15、罕见 25、稀有 40、Boss 专属 50、市场专属 30）或放弃；任何时候都可在装备栏出售一件换同样资金。转会市场在槽满时不能购入装备。</p><h3>补给品</h3><p>一次性道具，默认 3 个栏位，比赛中点击使用，任何时候都可以丢弃。普通与强敌比赛胜利后按掉落率获得：初始 40%，掉落一次 -10%，未掉落 +10%。转会市场出售 3 个补给品；栏位满时需先丢弃或替换。</p><h3>难度等级</h3><ol>${ASCENSION_LEVELS.filter(l=>l.level).map(l=>`<li>${esc(l.text)}</li>`).join('')}</ol><p>难度逐级叠加。每个赛区单独解锁：在当前最高难度赢下完整三幕赛季，解锁下一级。好友 PvP 只显示难度，不改变对局规则；装备与补给品不带入 PvP。</p><p>选手头像暂用占位图。游玩无需联网，也不消耗模型额度。</p></div>`);return;
 }
 if(name==='menu'){
  showModal('赛季菜单',`<p>当前种子：${esc(state.seed)} · ${state.mode==='season'?'D0.2.0':VERSION}${state.mode==='season'?' · '+esc(state.region):''}${R(state)?' · 难度 '+(state.ascension||0):''}</p><div class="stack">${R(state)?ui(`查看装备（${state.skins.length}）`,'gear')+ui(`补给品（${state.supplies.length}/${supplySlots(state)}）`,'supplies'):''}${ui('导出本局记录','export')}${ui('返回开始页（保留进度）','home')}${state.phase!=='result'?ui('放弃本次赛季…','abandon','danger-button'):''}</div>`);return;
 }
 if(name==='abandon'){showModal('放弃本次赛季',`<p>本次将记录为主动放弃，不算声望耗尽。之后可以重新开始。</p>${button('确认放弃',{type:'abandon'},'danger-button')}`);return;}
 if(name==='export'){
  const s=state||saved;if(!s)return;
  const blob=new Blob([JSON.stringify({version:s.version,seed:s.seed,tutorial:s.tutorial,mode:s.mode,region:s.region,actions:s.actions,logs:s.logs,outcome:s.outcome||'in-progress',final:{node:s.node,hp:s.hp,money:s.money,deck:s.deck}},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`peak-season-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('对局记录已导出，可用于复现。');return;
 }
 if(name==='remove-target')showModal('支付 50 资金，永久移除一张牌',`<p>点击确认后立即扣费并移除，该市场只能使用一次。</p><div class="cards modal-cards">${state.deck.map(c=>card(c,{instance:true,label:'50 资金 · 永久移除',action:{type:'remove',uid:c.uid},disabled:removalReason(state,c.uid)})).join('')}</div>`);
}
// Explanations live outside card layout; the popover top layer also works over dialogs.
const cardTip=document.createElement('aside');
cardTip.id='card-tooltip';cardTip.setAttribute('popover','manual');cardTip.setAttribute('role','tooltip');
cardTip.hidden=true;document.body.append(cardTip);
const aim=document.createElementNS('http://www.w3.org/2000/svg','svg');
aim.classList.add('aim-guide');aim.innerHTML='<path/><circle r="7"/>';aim.setAttribute('hidden','');document.body.append(aim);
let tipAnchor=null,tipTimer=null;
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function hideCardTip(){clearTimeout(tipTimer);if(tipAnchor)tipAnchor.removeAttribute('aria-describedby');tipAnchor=null;if(cardTip.matches(':popover-open'))cardTip.hidePopover();cardTip.hidden=true;}
function showCardTip(el){
 clearTimeout(tipTimer);if(!el||!el.isConnected||dragging)return;
 const c={id:el.dataset.cardId,up:el.dataset.cardUp==='true'},t=CARDS[c.id],f=TACTICS[c.id];if(!t)return;
 hideCardTip();if(dialog.open)dialog.append(cardTip);else document.body.append(cardTip);tipAnchor=el;el.setAttribute('aria-describedby','card-tooltip');
 cardTip.innerHTML=`<header><span>${esc(cardName(c))}</span><b>${esc(f.title)}</b></header><p class="tip-effect">${esc(describe(c))}</p>${cardKeywords(c).map(([k,v])=>`<p class="tip-keyword"><strong>${esc(k)}</strong>${esc(v)}</p>`).join('')}<p class="tip-scene">${esc(f.scene)}<small>${esc(f.origin)}</small></p>${CARD_RARITY[c.id]?`<p class="tip-rarity rarity-${CARD_RARITY[c.id]}">${rarityTip(c.id)}<small>只表示这张牌作为奖励或商品出现的频率。</small></p>`:''}`;
 cardTip.hidden=false;if(cardTip.showPopover)cardTip.showPopover();else if(dialog.open)dialog.append(cardTip);else document.body.append(cardTip);
 const r=el.getBoundingClientRect(),w=cardTip.offsetWidth,h=cardTip.offsetHeight;
 let x=r.right+14,y=r.top;
 if(x+w>innerWidth-10)x=r.left-w-14;
 if(x<10){x=(innerWidth-w)/2;y=r.top-h-12;}
 cardTip.style.left=`${Math.max(10,Math.min(x,innerWidth-w-10))}px`;
 cardTip.style.top=`${Math.max(10,Math.min(y,innerHeight-h-10))}px`;
}
function scheduleTip(el){clearTimeout(tipTimer);if(!el||dragging)return;tipTimer=setTimeout(()=>showCardTip(el),120);}
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=e.target.closest('[data-card-id]');if(el&&!el.contains(e.relatedTarget))scheduleTip(el);});
document.addEventListener('pointerout',e=>{const el=e.target.closest('[data-card-id]');if(el&&!el.contains(e.relatedTarget)){clearTimeout(tipTimer);if(tipAnchor===el)hideCardTip();}});
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-card-id]');if(el)showCardTip(el);});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-card-id]'))hideCardTip();});
document.addEventListener('scroll',()=>{const el=tipAnchor;hideCardTip();if(el&&el.contains(document.activeElement))scheduleTip(el);},true);window.addEventListener('resize',hideCardTip);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideCardTip();});
function clearAim(){aim.setAttribute('hidden','');document.querySelectorAll('.drop-ready').forEach(el=>el.classList.remove('drop-ready'));}
// One opponent per fight: like Slay the Spire, releasing a dragged card anywhere
// above the hand plays it; the target is implied by the card itself.
function dragTargetAt(c,e,originY){
 const dock=document.querySelector('.hand-dock')?.getBoundingClientRect();
 if(e.clientY>originY-60||(dock&&e.clientY>dock.top+10))return null;
 return targetOf(c);
}
function updateAim(d,e){
 const c=state.battle.hand.find(c=>c.uid===d.uid);if(!c)return;
 aim.removeAttribute('hidden');aim.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
 aim.querySelector('path').setAttribute('d',`M${d.x},${d.y} Q${d.x},${e.clientY} ${e.clientX},${e.clientY}`);
 aim.querySelector('circle').setAttribute('cx',e.clientX);aim.querySelector('circle').setAttribute('cy',e.clientY);
 const target=dragTargetAt(c,e,d.y);
 document.querySelectorAll('[data-drop-target]').forEach(el=>el.classList.toggle('drop-ready',el.dataset.dropTarget===target));
}
function animateResolution(before,after,played,flight,action){
 if(reduceMotion())return;
 if(played&&flight){
  const zone=CARDS[played.id].zone,pile=document.querySelector(zone==='power'?'.active-powers':['exhaust','temporary'].includes(zone)?'.exhaust-link':'.discard-pile');
  const center=document.querySelector('.arena-center')?.getBoundingClientRect(),end=pile?.getBoundingClientRect();
  if(center){const rect=flight.rect,el=document.createElement('div');el.className='card-flight '+flight.role;el.setAttribute('aria-hidden','true');el.innerHTML=flight.html;Object.assign(el.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(el);const cx=center.left+center.width/2-rect.left-rect.width/2,cy=center.top+center.height/2-rect.top-rect.height/2,px=end?end.left+end.width/2-rect.left-rect.width/2:cx,py=end?end.top+end.height/2-rect.top-rect.height/2:cy;el.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${cx}px,${cy}px) scale(.7)`,opacity:1,offset:.38},{transform:`translate(${cx}px,${cy}px) scale(.7)`,opacity:1,offset:.56},{transform:`translate(${px}px,${py}px) scale(.2)`,opacity:0}],{duration:690,easing:'ease-in-out'}).finished.finally(()=>el.remove()).catch(()=>el.remove());}
  pile?.animate([{filter:'brightness(2)',transform:'scale(1.08)'},{filter:'brightness(1)',transform:'scale(1)'}],{duration:360});
 }
 const old=new Set(before.battle?.hand.map(c=>c.uid)||[]);
 const drawn=[...document.querySelectorAll('.hand-fan [data-select]')].filter(el=>!old.has(el.dataset.select));
 if(drawn.length&&!reduceMotion()){turnAnimating=true;flyCardsFromPile(drawn,document.querySelector('.draw-pile')).finally(()=>{turnAnimating=false;});}
 document.querySelector('.energy-orb')?.animate([{filter:'brightness(1.5)'},{filter:'brightness(1)'}],{duration:240});
 if(action.type==='end'&&after.phase==='combat')notice(`第 ${after.battle?.turn||1} 回合 · 重新抽牌`);
}
document.addEventListener('click',e=>{
 if(turnAnimating)return;
 if(suppressClick){suppressClick=false;e.preventDefault();return;}
 const btn=e.target.closest('button');if(!btn||btn.disabled)return;
 if(btn.dataset.select){selected=selected===btn.dataset.select?null:btn.dataset.select;refreshSelection();notice('');if(selected)showCardTip(btn);else hideCardTip();return;}
 if(btn.dataset.target){if(!selected){notice('先从底部选择一张牌，再点击目标。');return;}const c=state.battle.hand.find(c=>c.uid===selected);if(targetOf(c)!==btn.dataset.target){notice('这张牌的目标是'+(targetOf(c)==='enemy'?'对手':'我方')+'。');return;}commit({type:'play',uid:selected,rev:state.rev});return;}
 if(btn.dataset.map){
  if(state.mode==='season'){
   const a=mapEntry(state,btn.dataset.map);
   if(!a)return;
   if(a.type==='enter'){
    // if currently phase map, entering should go to room; if phase not map, it's a room return? mapEntry already handles
    screen='room';selected=null;echo=null;saveView();render();notice('');window.scrollTo(0,0);
   } else commit({...a,rev:state.rev});
  } else {
   const a=mapEntry(state,btn.dataset.map);if(!a)return;if(a.type==='enter'){screen='room';selected=null;echo=null;saveView();render();notice('');window.scrollTo(0,0);}else commit({...a,rev:state.rev});
  }
  return;
 }
 if(btn.dataset.ui){handleUI(btn.dataset.ui);return;}
 if(btn.dataset.action)commit(JSON.parse(btn.dataset.action));
});
// Pointer capture makes dragging work consistently with a mouse, touch or a pen.
app.addEventListener('dragstart',e=>e.preventDefault());
app.addEventListener('pointerdown',e=>{
 const el=e.target.closest('[data-select]');if(!el||e.button!==0||canPlay(state,el.dataset.select))return;
 pointerDrag={uid:el.dataset.select,x:e.clientX,y:e.clientY,el,active:false,pointerId:e.pointerId};
 el.setPointerCapture(e.pointerId);
});
app.addEventListener('pointermove',e=>{
 if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
 const d=pointerDrag;if(!d.active&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<8)return;
 if(!d.active){hideCardTip();d.active=true;dragging=d.uid;selected=d.uid;refreshSelection();d.el.classList.add('dragging-card');}
 updateAim(d,e);e.preventDefault();d.el.style.setProperty('--drag-x',`${e.clientX}px`);d.el.style.setProperty('--drag-y',`${e.clientY}px`);
});
function endDrag(e,cancel=false){
 if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
 const d=pointerDrag;pointerDrag=null;dragging=null;clearAim();
 if(d.el.hasPointerCapture(e.pointerId))d.el.releasePointerCapture(e.pointerId);
 if(!d.active)return;
 d.el.classList.remove('dragging-card');d.el.style.removeProperty('--drag-x');d.el.style.removeProperty('--drag-y');
 suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
 const c=state.battle?.hand.find(c=>c.uid===d.uid);
 if(!cancel&&c&&dragTargetAt(c,e,d.y))commit({type:'play',uid:d.uid,rev:state.rev});
 else{refreshSelection();if(!reduceMotion())d.el.animate([{filter:'brightness(1.4)'},{filter:'brightness(1)'}],{duration:220});notice('卡牌已放回手中。请拖向发亮的目标。');}
}
app.addEventListener('pointerup',e=>endDrag(e));
app.addEventListener('pointercancel',e=>endDrag(e,true));
document.addEventListener('keydown',e=>{
 if(turnAnimating||dialog.open||atHome||screen!=='room'||state?.phase!=='combat'||e.target.matches('input,textarea')||e.repeat)return;
 if(/^[0-9]$/.test(e.key)){const c=state.battle.hand[e.key==='0'?9:Number(e.key)-1];if(c){e.preventDefault();selected=c.uid;refreshSelection();showCardTip(document.querySelector(`[data-select="${c.uid}"]`));}}
 if(e.key==='Escape'){hideCardTip();selected=null;refreshSelection();}
 if(e.key==='Enter'&&selected&&!e.target.closest('button:not([data-select])')){e.preventDefault();commit({type:'play',uid:selected,rev:state.rev});}
 if(e.key.toLowerCase()==='e'){e.preventDefault();commit({type:'end',rev:state.rev});}
});
document.querySelector('#close-dialog').addEventListener('click',()=>{hideCardTip();dialog.close();});
dialog.addEventListener('close',hideCardTip);
window.baoDemo={observe:()=>state?observe(state):null,legalActions:()=>state?legalActions(state):[],dispatch:a=>{if(!state)return {error:'No active season'};const r=commit(a);return {error:r.error,observation:observe(state)};}};
render();
