// Presentation-only routing. The underlying seeded game and its replays are unchanged.
import {availableNodes} from './season-map.js';

const layout = [
 ['n1',1,'基础试训','battle',48,91],['n2',2,'信息压制','battle',39,81],
 ['n3',3,'赛程外的机会','event',54,71],['n4',4,'双核突击','battle',44,61],
 ['shop',5,'转会市场','shop',29,51],['activity5',5,'俱乐部活动','rest',67,51],
 ['normal',6,'防守反击','battle',36,41],['elite',6,'高压强敌','elite',65,41],
 ['n7',7,'俱乐部活动','rest',49,31],['n8',8,'纪律控制','battle',57,21],
 ['n9',9,'大师赛决赛','boss',47,9],
];
export function branchChoice(s,step){
 const a=s.actions.find(a=>a.type===(step===5?'branch':'opponent'));
 return !a?null:step===5?(a.choice==='shop'?'shop':'activity5'):(a.id==='EL01'?'elite':'normal');
}
export function routeNodes(s){
 if(s.mode==='season'){
  const selectable=new Set(availableNodes(s).map(n=>n.key)),done=new Set(s.completed);
  const reachable=new Set(s.currentNode?[s.currentNode]:s.map.starts);
  for(const node of s.map.nodes.slice().sort((a,b)=>a.step-b.step))if(reachable.has(node.key))for(const e of s.map.edges)if(e.from===node.key)reachable.add(e.to);
  const resume=!['map','intermission','result'].includes(s.phase);
  return s.map.nodes.map(n=>({...n,status:done.has(n.key)?'visited':selectable.has(n.key)||(resume&&n.key===s.currentNode)?'current':reachable.has(n.key)?'locked':'bypassed'}));
 }
 return layout.map(([key,step,name,kind,x,y])=>{
 const chosen=[5,6].includes(step)?branchChoice(s,step):null;
 const bypassed=!!chosen&&chosen!==key;
 const status=bypassed?'bypassed':step<s.node?'visited':step>s.node?'locked':s.phase==='result'?'visited':'current';
 return {key,step,name,kind,x,y,status};
});}

export function mapEntry(s,key){
 if(s.mode==='season'){
  if(s.phase==='map')return availableNodes(s).some(n=>n.key===key)?{type:'chooseNode',key}:null;
  return key===s.currentNode&&!s.completed.includes(key)&&!['result','intermission'].includes(s.phase)?{type:'enter'}:null;
 }
 const node=routeNodes(s).find(n=>n.key===key);
 if(!node||node.status!=='current'||s.phase==='result')return null;
 if(s.phase==='branch')return {type:'branch',choice:key==='shop'?'shop':'activity'};
 if(s.phase==='opponent')return {type:'opponent',id:key==='elite'?'EL01':'E04'};
 return {type:'enter'};
}

export function nextScreen(before,after){
 if(after.phase==='result')return 'room';
 if(after.mode==='season'){
  if(after.phase==='map')return 'map';
  return 'room';
 }
 return before.node!==after.node||['branch','opponent'].includes(after.phase)?'map':'room';
}

export function restoreScreen(s,meta){
 if(s.mode==='season'){
  if(s.phase==='map')return 'map';
  if(['result','intermission'].includes(s.phase))return 'room';
  return meta?.seed===s.seed&&meta?.rev===s.rev&&meta?.mode==='season'&&meta?.region===s.region&&['room','map'].includes(meta.screen)?meta.screen:'room';
 }
 if(['branch','opponent'].includes(s.phase))return 'map';
 if(s.phase==='result')return 'room';
 return meta?.seed===s.seed&&meta?.rev===s.rev&&['room','map'].includes(meta.screen)?meta.screen:'room';
}
