// Wa demo glue for shared sound + hit feedback (bundled into app.js).
import {CARDS,effects} from './content.js';
import {playSfx,soundForAction,soundForCard} from './shared/sfx.js';
import {snapshotWa,diffCombat,playFeedback,cardSlam} from './shared/juice.js';

export function waCardType(card){
 if(!card||!CARDS[card.id])return 'skill';
 if(CARDS[card.id].zone==='power')return 'power';
 return effects(card).some(e=>e.type==='hit')?'attack':'skill';
}

// Called in commit() right after the engine accepts an action, before the screen re-renders.
// enemyAt: when the end-turn enemy attack plays (ms), so late stingers/kills line up with it.
export function waJuiceAction(before,after,action,played,enemyAt=0){
 try{
  if(action?.type==='play'&&played)playSfx(soundForCard(waCardType(played)));
  const name=soundForAction(action,{prevPhase:before?.phase,nextPhase:after?.phase,outcome:after?.outcome,hp:after?.hp});
  const late=before?.phase==='combat'&&['victory','defeat'].includes(name);
  if(name)playSfx(name,{delay:late?(action?.type==='end'?enemyAt+500:450):0});
  // A killing blow ends the match and the arena is re-rendered away: collapse a snapshot of the opponent now.
  if(before?.phase==='combat'&&after?.phase!=='combat'){
   const events=diffCombat(snapshotWa(before),snapshotWa(after)).filter(e=>e.target==='enemy'&&e.kind==='damage');
   const el=document.querySelector('.fighter.enemy .combat-target');
   const fire=()=>playFeedback(events,()=>el,{kill:'ghost'});
   if(events.length&&el){if(action?.type==='end')setTimeout(fire,enemyAt);else fire();}
  }
 }catch{}
}

// After render: stamp the played-card echo in the arena centre.
export function waSlam(){cardSlam(document.querySelector('.played-echo'));}

// Per-hit feedback from combat-fx (one call per attack/loss event).
export function waHit(el,side,amount){
 if(!el||!(amount>0))return;
 playFeedback([{kind:side==='enemy'?'damage':'hurt',target:side==='enemy'?'enemy':'player',id:'enemy',amount,big:amount>=15,anchor:.5}],()=>el,{kill:'none'});
}
