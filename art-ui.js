import {CARD_ART,ENEMY_ART} from './art-data.js';
import {weaponFrame} from './weapon-frame.js';
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localPath=p=>/^assets\/(players|special|opponents)\/[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/.test(p||'');
export function cardArtwork(id){
 const a=CARD_ART[id];
 return a&&localPath(a.path)?`<img class="portrait-image ${a.kind==='photo'?'player-photo':'tactic-art'}${a.fit==='cover'?' poster-photo':''}" src="/${escape(a.path)}" alt="" loading="lazy" decoding="async" draggable="false">`:'<span class="art-missing">暂无配图</span>';
}
export function opponentArtwork(id){
 const a=ENEMY_ART[id];
 return a&&localPath(a.path)?weaponFrame(a):'<span class="art-missing">对手队伍</span>';
}
export function artCredit(id){
 const a=CARD_ART[id];
 if(!a)return '';
 const link=a.photoPage||a.profileUrl;
 return a.kind==='photo'&&/^https:\/\/(www\.vlr\.gg\/player\/\d+\/|www\.sina\.cn\/news\/detail\/\d+\.html)/.test(link||'')?`<p class="art-credit">选手照片：<a href="${escape(link)}" target="_blank" rel="noopener noreferrer">${escape(a.photoCredit||a.name+' · VLR 资料页')}</a></p>`:a.concept?'<p class="art-credit">原创概念头像，非选手本人肖像。</p>':'<p class="art-credit">配图：原创战术插画。</p>';
}
