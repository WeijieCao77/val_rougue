import { mountCharacterStage, playCharacterCue, clearCharacterStages } from '/character-stage.js';

let hosts = [];
let scheduled = false;

function targets() {
  // New demo: one ally slot plus one slot per living enemy (1-3). Dead enemies
  // keep their panel for layout but get no figure.
  if (document.querySelector('.battle')) return [
    { element: document.querySelector('.battle .ally-figure, .battle .ally-art-container'), side: 'ally', variant: 'tactical', block: Number(document.querySelector('.block-value')?.dataset.block || 0) > 0 },
    ...[...document.querySelectorAll('.battle .enemy-figure:not(.is-dead), .battle .enemy-art-container')].map(element => ({ element, side: 'enemy', variant: element.dataset.characterVariant || 'E01', block: false })),
  ];
  const npc = document.querySelector('.npc-stage[data-npc]');
  if (npc) return [{ element: npc, side: 'npc', variant: npc.dataset.npc, block: false }];
  if (document.querySelector('.combat-screen')) return [
    { element: document.querySelector('.fighter.ally .combat-target'), side: 'ally', variant: document.querySelector('.team-label')?.textContent || 'club', block: Number(document.querySelector('.fighter.ally .shield-value')?.textContent.replace(/\D/g, '') || 0) > 0 },
    { element: document.querySelector('.fighter.enemy .combat-target'), side: 'enemy', variant: document.querySelector('.fighter.enemy')?.dataset.characterVariant || document.querySelector('.fighter.enemy h2')?.textContent || 'rival', block: Number(document.querySelector('.fighter.enemy .shield-value')?.textContent.replace(/\D/g, '') || 0) > 0 },
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
  cue(side, cue) { refresh(); playCharacterCue(side, cue); },
  cueFromTransition(mode, previous, next, action) {
    refresh();
    if (action.type === 'end') { playCharacterCue('enemy', 'attack'); return; }
    if (action.type !== 'play') return;
    // New-demo battles may hold several enemies; compare roster totals.
    const roster = b => (Array.isArray(b?.enemies) ? b.enemies : null);
    const hpOf = b => roster(b) ? roster(b).reduce((s, e) => s + Math.max(0, e.hp), 0) : (b?.enemyHp ?? 0);
    const guardOf = b => roster(b) ? roster(b).reduce((s, e) => s + (e.statuses?.block || 0), 0) : (b?.statuses?.enemy?.block ?? 0);
    const enemyDamaged = hpOf(next.battle) < hpOf(previous.battle);
    const enemyGuardBroken = mode === 'wa'
      ? (next.battle?.enemyBlock ?? 0) < (previous.battle?.enemyBlock ?? 0)
      : guardOf(next.battle) < guardOf(previous.battle);
    const playerBlockGain = mode === 'wa'
      ? (next.battle?.block ?? 0) > (previous.battle?.block ?? 0)
      : (next.battle?.playerBlock ?? 0) > (previous.battle?.playerBlock ?? 0);
    if (enemyDamaged || enemyGuardBroken) playCharacterCue('ally', 'attack');
    else if (playerBlockGain) playCharacterCue('ally', 'defend');
  },
};
