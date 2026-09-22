// season-map.js
// Pure ES module for act metadata, enemy configs, and deterministic map generation.

export const ACTS = [
  { id: 1, name: '资格赛', bossName: '第一次大师赛', subtitle: '常规赛' },
  { id: 2, name: '晋级赛', bossName: '第二次大师赛', subtitle: '晋级赛' },
  { id: 3, name: '总决赛', bossName: '冠军赛', subtitle: '总决赛' }
];

export const EXTRA_ENEMIES = {
  A2_E01: { name: '第二幕基础进攻', hp: 48, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'hit', n: 12, times: 1 } ], [ { type: 'block', n: 6 }, { type: 'hit', n: 7, times: 1 } ] ], growth: 0 },
  A2_E02: { name: '第二幕信息压制', hp: 52, script: [ [ { type: 'hit', n: 10, times: 1 } ], [ { type: 'jam', id: 'ST01', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'hit', n: 13, times: 1 } ] ], growth: 0 },
  A2_E03: { name: '第二幕多段突击', hp: 56, script: [ [ { type: 'hit', n: 4, times: 3 } ], [ { type: 'hit', n: 11, times: 1 } ], [ { type: 'block', n: 7 }, { type: 'hit', n: 8, times: 1 } ] ], growth: 0 },
  A2_E04: { name: '第二幕防守反击', hp: 54, script: [ [ { type: 'block', n: 11 }, { type: 'hit', n: 5, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 1 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_E05: { name: '第二幕纪律控制', hp: 60, script: [ [ { type: 'weak', n: 1 } ], [ { type: 'hit', n: 14, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 9, times: 1 } ] ], growth: 0 },
  A2_EL01: { name: '第二幕强敌', hp: 72, elite: true, script: [ [ { type: 'hit', n: 11, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 14 }, { type: 'jam', id: 'ST02', n: 1 } ] ], growth: 0 },
  A2_B01: { name: '第二次大师赛', hp: 110, boss: true, script: [ [ { type: 'weak', n: 1 }, { type: 'hit', n: 8, times: 1 } ], [ { type: 'jam', id: 'ST02', n: 2 }, { type: 'block', n: 12 } ], [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 16, times: 1 } ] ], growth: 2 },

  A3_E01: { name: '第三幕基础进攻', hp: 64, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'hit', n: 16, times: 1 } ], [ { type: 'block', n: 8 }, { type: 'hit', n: 10, times: 1 } ] ], growth: 0 },
  A3_E02: { name: '第三幕信息压制', hp: 70, script: [ [ { type: 'hit', n: 13, times: 1 } ], [ { type: 'jam', id: 'ST01', n: 2 }, { type: 'hit', n: 11, times: 1 } ], [ { type: 'hit', n: 17, times: 1 } ] ], growth: 0 },
  A3_E03: { name: '第三幕多段突击', hp: 76, script: [ [ { type: 'hit', n: 5, times: 3 } ], [ { type: 'hit', n: 15, times: 1 } ], [ { type: 'block', n: 9 }, { type: 'hit', n: 11, times: 1 } ] ], growth: 0 },
  A3_E04: { name: '第三幕防守反击', hp: 72, script: [ [ { type: 'block', n: 14 }, { type: 'hit', n: 7, times: 1 } ], [ { type: 'hit', n: 20, times: 1 } ], [ { type: 'jam', id: 'ST03', n: 2 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_E05: { name: '第三幕纪律控制', hp: 82, script: [ [ { type: 'weak', n: 2 } ], [ { type: 'hit', n: 18, times: 1 } ], [ { type: 'block', n: 12 }, { type: 'hit', n: 12, times: 1 } ] ], growth: 0 },
  A3_EL01: { name: '第三幕强敌', hp: 96, elite: true, script: [ [ { type: 'hit', n: 14, times: 1 }, { type: 'jam', id: 'ST03', n: 2 } ], [ { type: 'hit', n: 6, times: 3 } ], [ { type: 'block', n: 18 }, { type: 'jam', id: 'ST02', n: 2 } ] ], growth: 0 },
  A3_B01: { name: '冠军赛', hp: 145, boss: true, script: [ [ { type: 'hit', n: 12, times: 1 }, { type: 'jam', id: 'ST03', n: 1 } ], [ { type: 'weak', n: 1 }, { type: 'hit', n: 5, times: 3 } ], [ { type: 'block', n: 16 }, { type: 'jam', id: 'ST01', n: 2 } ], [ { type: 'hit', n: 20, times: 1 } ] ], growth: 3 }
};

function seeded(text){let a=2166136261;for(const c of text)a=Math.imul(a^c.charCodeAt(0),16777619);return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const names={battle:'常规比赛',elite:'高压强敌',event:'未知事件',shop:'战术补给',rest:'战术休整'};
export function buildMap(seed,act){
 if(![1,2,3].includes(act))throw Error('未知赛段');
 const random=seeded(`${seed}|map|${act}`),pick=a=>a[Math.floor(random()*a.length)],nodes=[],edges=[],layers=[];
 const prefix=act===1?'':`A${act}_`;
 for(let step=1;step<=11;step++){
  const count=step===11?1:step===1?3:3+Math.floor(random()*2),layer=[];
  for(let lane=0;lane<count;lane++){
   const kind=step===11?'boss':step===10?'rest':[1,3,7].includes(step)?'battle':pick(['battle','battle','event','shop','rest',...(step>=4?['elite']:[])]);
   const x=count===1?50:count===3?18+lane*32:12+lane*76/3;
   const n={key:`a${act}-r${step}-c${lane}`,step,lane,x:x+(count===1?0:(random()-.5)*3),y:94-(step-1)*8.8,kind,name:names[kind]||ACTS[act-1].bossName};
   layer.push(n);nodes.push(n);
  }
  layers.push(layer);
 }
 const connect=(a,b)=>{if(!edges.some(e=>e.from===a.key&&e.to===b.key))edges.push({from:a.key,to:b.key});};
 for(let row=0;row<10;row++){
  const prev=layers[row],next=layers[row+1];
  if(next.length===1){for(const p of prev)connect(p,next[0]);continue;}
  const nearest=(n,list)=>list.reduce((best,x)=>Math.abs(x.x-n.x)<Math.abs(best.x-n.x)?x:best,list[0]);
  for(const p of prev)connect(p,nearest(p,next));
  for(const n of next)connect(nearest(n,prev),n);
  const candidates=prev.flatMap(p=>next.filter(n=>Math.abs(p.x-n.x)<38).map(n=>[p,n]));
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  let added=0;
  for(const [p,n] of candidates){
   if(edges.some(e=>e.from===p.key&&e.to===n.key))continue;
   const crosses=edges.filter(e=>prev.some(a=>a.key===e.from)).some(e=>{const a=prev.find(a=>a.key===e.from),b=next.find(b=>b.key===e.to);return (p.x-a.x)*(n.x-b.x)<0;});
   if(!crosses){connect(p,n);added++;if(added>=(random()<.55?1:2))break;}
  }
 }
 layers[1][Math.floor(random()*layers[1].length)].kind='event';
 layers[3][Math.floor(random()*layers[3].length)].kind='shop';
 layers[5][Math.floor(random()*layers[5].length)].kind='elite';
 const byKey=new Map(nodes.map(n=>[n.key,n]));
 for(const n of nodes){
  const parents=edges.filter(e=>e.to===n.key).map(e=>byKey.get(e.from));
  if(['elite','shop','rest'].includes(n.kind)&&n.step!==10&&parents.some(p=>p.kind===n.kind))n.kind='battle';
  if(n.kind==='battle'){
   const ids=n.step===1?['E01']:n.step<=3?['E01','E02']:['E01','E02','E03','E04','E05'];
   const fresh=ids.filter(id=>!parents.some(p=>p.enemy===prefix+id));n.enemy=prefix+pick(fresh.length?fresh:ids);
  }else if(n.kind==='elite')n.enemy=prefix+'EL01';else if(n.kind==='boss')n.enemy=prefix+'B01';
  n.name=n.kind==='boss'?ACTS[act-1].bossName:n.kind==='battle'?({'E01':'基础进攻','E02':'信息压制','E03':'多段突击','E04':'防守反击','E05':'纪律控制'}[n.enemy.replace(/^A[23]_/, '')]):names[n.kind];
 }
 return {act,nodes,edges,starts:layers[0].map(n=>n.key),bossId:layers[10][0].key};
}
export function availableNodes(s){
 if(s?.mode!=='season'||s.phase!=='map')return [];
 const keys=s.currentNode===null?s.map.starts:s.map.edges.filter(e=>e.from===s.currentNode).map(e=>e.to);
 return s.map.nodes.filter(n=>keys.includes(n.key)&&!s.completed.includes(n.key));
}
