import { GEAR } from './wa-rules.js';
export { GEAR };
export const PVP_GEAR = new Set(['SK01','SK02','SK03','GR02','GR04','GR05','GR06','GR08','GR09','GR10','GR11','GR20','GR21','GR22','GR23','GR24','GR40','GR41','GR42','GR43','GR44','GR45','GR46','BX01','BX05','BX06','BX10','BX11']);
export function gearStatus(id) {
  if(PVP_GEAR.has(id)) return {active:true,label:'PvP 生效',text:GEAR[id]?.text};
  if(id==='GR01') return {active:false,label:'成长已继承',text:'最大声望提升已包含在构筑中，不重复增加。'};
  return {active:false,label:'仅故事模式',text:id.startsWith('BX')?'该装备的代价依赖故事模式，PvP 中收益与代价均不生效。':GEAR[id]?.text || '不参与本场对战。'};
}
export const equipmentOf = snapshot => snapshot.gear || snapshot.skins || [];
