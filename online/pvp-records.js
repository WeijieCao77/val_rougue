export const PVP_ACHIEVEMENTS = [
 {id:'debut',name:'初次交锋',text:'完成 1 场好友对战',key:'played',target:1},
 {id:'first-win',name:'首胜',text:'赢得 1 场对战',key:'wins',target:1},
 {id:'ten-wins',name:'十战告捷',text:'累计赢得 10 场',key:'wins',target:10},
 {id:'fifty-wins',name:'五十胜',text:'累计赢得 50 场',key:'wins',target:50},
 {id:'hundred-wins',name:'百胜',text:'累计赢得 100 场',key:'wins',target:100},
 {id:'veteran',name:'百战老兵',text:'累计完成 100 场对战',key:'played',target:100},
 {id:'streak-three',name:'三连胜',text:'取得 3 场连胜',key:'bestStreak',target:3},
 {id:'streak-five',name:'势不可挡',text:'取得 5 场连胜',key:'bestStreak',target:5}
];
export function pvpProgress(account) {
 return {wins:0,losses:0,draws:0,played:0,streak:0,bestStreak:0,achievements:{},records:[],...account.pvp};
}
// In the same SQLite transaction as the result. Room + round is the deduplication key.
export function recordPvpResult(t,room,at=Date.now()) {
 if(room.status!=='finished' || room.match?.status!=='finished' || room.members.length!==2 || room.recordedRound===(room.round||1))return;
 for(const me of room.members){
  const account=t.account(me.accountId);if(!account)continue;
  const foe=room.members.find(m=>m.seat!==me.seat), p=pvpProgress(account);
  const result=room.match.winner===null?'draw':room.match.winner===me.seat?'win':'loss';
  p.played++;p[result==='win'?'wins':result==='loss'?'losses':'draws']++;
  p.streak=result==='win'?p.streak+1:0;p.bestStreak=Math.max(p.bestStreak,p.streak);
  p.records.unshift({id:`${room.code}:${room.round||1}`,at,result,reason:room.match.endReason||'hp',opponent:foe.name||'玩家',opponentAvatar:foe.avatar||'pig-scout',act:me.archiveSnapshot.act,region:me.archiveSnapshot.region,archiveId:me.archiveId,archiveName:account.archives.find(a=>a.id===me.archiveId)?.name||`第${me.archiveSnapshot.act}幕构筑`,turns:room.match.turn,round:room.round||1});
  p.records=p.records.slice(0,50);
  for(const a of PVP_ACHIEVEMENTS)if(p[a.key]>=a.target && !p.achievements[a.id])p.achievements[a.id]=at;
  account.pvp=p;
 }
 room.recordedRound=room.round||1;
}
