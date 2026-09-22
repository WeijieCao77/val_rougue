// combat-events.js
export function combatEvents(before, after, action) {
  if (!before || !after || !action) return [];
  if (before.phase !== 'combat') return [];
  if (!(action.type === 'play' || action.type === 'end')) return [];
  if (!Array.isArray(before.logs) || !Array.isArray(after.logs)) return [];
  const newLogs = after.logs.slice(before.logs.length);
  if (newLogs.length === 0) return [];
  const events = [];
  let enemyHp = before.battle ? before.battle.enemyHp : 0;
  let allyHp = before.hp;
  const patterns = {
    attackEnemy: /^攻击 (\d+)：对手格挡抵消 (\d+)，防线减少 (\d+)，剩余 (\d+)。/,
    attackAlly: /^对手攻击 (\d+)：格挡抵消 (\d+)，失去 (\d+) 声望（剩余 (\d+)）。/,
    allyBlock: /^获得 (\d+) 格挡（现有 (\d+)）。/,
    enemyBlock: /^对手获得 (\d+) 格挡。$/,
    enemyWeak: /^对手虚弱 \+(\d+) 回合。$/,
    enemyVulnerable: /^对手易伤 \+(\d+) 回合。$/,
    allyWeak: /^我方虚弱 \+(\d+) 回合。$/,
    allyLoss: /^舆论压力：直接失去 (\d+) 声望。$/,
    allyPowerBlock: /^(?:Haodong 能力|团队协同 能力|守望涂层)：获得 (\d+) 格挡。$/
  };
  for (const log of newLogs) {
    const text = log.text;
    let m;
    m = text.match(patterns.attackAlly);
    if (m) {
      const absorbed = parseInt(m[2], 10);
      const actualLoss = parseInt(m[3], 10);
      const remainingHp = parseInt(m[4], 10);
      const actual = Math.min(actualLoss, allyHp);
      events.push({ kind: 'attack', source: 'enemy', target: 'ally', damage: actual, absorbed });
      allyHp = remainingHp;
      continue;
    }
    m = text.match(patterns.attackEnemy);
    if (m) {
      const absorbed = parseInt(m[2], 10);
      const actualDamageLog = parseInt(m[3], 10);
      const remainingEnemyHp = parseInt(m[4], 10);
      const actual = Math.min(actualDamageLog, enemyHp);
      events.push({ kind: 'attack', source: 'ally', target: 'enemy', damage: actual, absorbed });
      enemyHp = remainingEnemyHp;
      continue;
    }
    m = text.match(patterns.allyBlock);
    if (m) {
      events.push({ kind: 'defense', target: 'ally', amount: parseInt(m[1], 10) });
      continue;
    }
    m = text.match(patterns.enemyBlock);
    if (m) {
      events.push({ kind: 'defense', target: 'enemy', amount: parseInt(m[1], 10) });
      continue;
    }
    m = text.match(patterns.enemyWeak);
    if (m) {
      events.push({ kind: 'status', target: 'enemy', label: `压制 +${m[1]}` });
      continue;
    }
    m = text.match(patterns.enemyVulnerable);
    if (m) {
      events.push({ kind: 'status', target: 'enemy', label: `易伤 +${m[1]}` });
      continue;
    }
    m = text.match(patterns.allyWeak);
    if (m) {
      events.push({ kind: 'status', target: 'ally', label: `压制 +${m[1]}` });
      continue;
    }
    m = text.match(patterns.allyLoss);
    if (m) {
      const amount=Math.min(Number(m[1]),allyHp);
      allyHp-=amount;
      events.push({ kind: 'loss', target: 'ally', amount });
      continue;
    }
    m = text.match(patterns.allyPowerBlock);
    if (m) {
      events.push({ kind: 'defense', target: 'ally', amount: parseInt(m[1], 10) });
      continue;
    }
    if(text.endsWith(' 能力生效，离开普通循环。'))events.push({kind:'power',target:'ally'});
    if(text.endsWith(' 加入弃牌堆。'))events.push({kind:'status',target:'ally',label:'战术干扰'});
  }
  return events;
}
