import { mountCharacterStage, playCharacterCue, clearCharacterStages } from '/character-stage.js';

let hosts = [];
let scheduled = false;

function targets() {
  if (document.querySelector('.battle')) return [
    { element: document.querySelector('.battle .ally-art-container'), side: 'ally', variant: 'tactical', block: Number(document.querySelector('.block-value')?.dataset.block || 0) > 0 },
    { element: document.querySelector('.battle .enemy-art-container'), side: 'enemy', variant: document.querySelector('.enemy-name')?.textContent || 'rival', block: false },
  ];
  if (document.querySelector('.combat-screen')) return [
    { element: document.querySelector('.fighter.ally .combat-target'), side: 'ally', variant: document.querySelector('.team-label')?.textContent || 'club', block: Number(document.querySelector('.fighter.ally .shield-value')?.textContent.replace(/\D/g, '') || 0) > 0 },
    { element: document.querySelector('.fighter.enemy .combat-target'), side: 'enemy', variant: document.querySelector('.fighter.enemy h2')?.textContent || 'rival', block: Number(document.querySelector('.fighter.enemy .shield-value')?.textContent.replace(/\D/g, '') || 0) > 0 },
  ];
  return [];
}

function refresh() {
  const current = targets().filter(x => x.element);
  if (current.length === hosts.length && current.every((x, i) => x.element === hosts[i].element)) return;
  clearCharacterStages();
  hosts = current;
  for (const item of current) {
    const host = document.createElement('div');
    host.className = 'character-stage-host';
    host.setAttribute('aria-hidden', 'true');
    item.element.appendChild(host);
    try { mountCharacterStage(host, item); }
    catch (error) { console.warn('3D stage unavailable', error); host.remove(); }
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; refresh(); });
}

new MutationObserver(schedule).observe(document.getElementById('app'), { childList: true, subtree: true });
schedule();

globalThis.characterStages = {
  refresh,
  cueFromTransition(mode, previous, next, action) {
    refresh();
    if (mode === 'wa') {
      if (action.type === 'play') playCharacterCue('ally', 'attack');
      if (next.battle?.block > (previous.battle?.block || 0)) playCharacterCue('ally', 'defend');
      if (next.battle?.enemyBlock > (previous.battle?.enemyBlock || 0)) playCharacterCue('enemy', 'defend');
      if (next.hp < previous.hp) playCharacterCue('ally', 'hit');
      if (next.battle?.enemyHp < previous.battle?.enemyHp) playCharacterCue('enemy', 'hit');
    } else {
      if (action.type === 'play') playCharacterCue('ally', 'attack');
      if ((next.battle?.playerBlock || 0) > (previous.battle?.playerBlock || 0)) playCharacterCue('ally', 'defend');
      if (next.hp < previous.hp) playCharacterCue('ally', 'hit');
      if (next.battle?.enemyHp < previous.battle?.enemyHp) playCharacterCue('enemy', 'hit');
    }
  },
};
