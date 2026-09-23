import { readFile, writeFile } from 'node:fs/promises';
import { CARD_ART } from '../art-data.js';
import { CARDS, REGIONS } from '../content.js';

const roleOf = Object.fromEntries(Object.entries({
  决斗: 'jett raze reyna phoenix yoru neon iso waylay',
  哨位: 'cypher killjoy sage chamber deadlock vyse veto',
  控场: 'brimstone viper omen astra harbor clove miks',
  先锋: 'sova breach skye kayo fade gekko tejo',
}).flatMap(([role, agents]) => agents.split(' ').map(agent => [agent, role])));
const rows = Object.values(REGIONS).flatMap(region => region.pool.filter(id => CARDS[id]?.player).map(id => ({ id, name: CARDS[id].name, region: region.name, currentRole: CARDS[id].role, profileUrl: CARD_ART[id]?.profileUrl || null })));
const previous = process.argv.includes('--retry') ? JSON.parse(await readFile(new URL('../reports/player-role-data-audit.json', import.meta.url), 'utf8')).rows : [];
const report = previous.filter(row => row.status === 'ok');
const queue = rows.filter(row => !report.some(done => done.id === row.id));
const recentOnly = process.argv.includes('--recent');
async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; local game roster audit)' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.text();
}
async function audit(row) {
  try {
    let profileUrl = row.profileUrl;
    if (!profileUrl) {
      const search = await fetchText(`https://www.vlr.gg/search/?q=${encodeURIComponent(row.name)}`);
      const matches = [...search.matchAll(/<a href="\/search\/r\/player\/(\d+)\/[^" ]+"[^>]*>([\s\S]*?)<\/a>/g)]
        .map(([, id, body]) => ({ id, alias: body.match(/<div class="search-item-title">\s*([^<]+)\s*<\/div>/)?.[1]?.trim() }))
        .filter(item => item.alias?.toLowerCase() === row.name.toLowerCase());
      if (matches.length !== 1) return { ...row, status: `search-exact-matches-${matches.length}` };
      profileUrl = `https://www.vlr.gg/player/${matches[0].id}/${encodeURIComponent(row.name)}`;
    }
    const html = await fetchText(`${profileUrl.split('?')[0]}?timespan=all`);
    const rounds = Object.fromEntries(['决斗', '哨位', '控场', '先锋'].map(role => [role, 0]));
    const unknown = [];
    for (const tr of html.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
      const agent = tr.match(/<img[^>]+alt="([^"]+)"/)?.[1]?.toLowerCase();
      const played = Number(tr.match(/class="mod-use">[^<]*<\/td>\s*<td>([\d,]+)<\/td>/)?.[1]?.replaceAll(',', ''));
      if (!agent || !Number.isFinite(played)) continue;
      if (roleOf[agent]) rounds[roleOf[agent]] += played;
      else unknown.push({ agent, rounds: played });
    }
    const ranked = Object.entries(rounds).sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, [, count]) => sum + count, 0);
    if (!total) return { ...row, profileUrl, status: 'no-agent-stats' };
    const dominant = ranked[0][0], share = ranked[0][1] / total;
    return { ...row, profileUrl, status: 'ok', rounds, unknown, dominant, dominantShare: Number(share.toFixed(3)), candidateMismatch: dominant !== row.currentRole && share >= .5 && ranked[0][1] - ranked[1][1] >= total * .2 };
  } catch (error) { return { ...row, status: error.message }; }
}
async function worker() {
  while (queue.length) {
    const row = queue.shift();
    report.push(await audit(row));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
if (recentOnly) {
  const existing = JSON.parse(await readFile(new URL('../reports/player-role-data-audit.json', import.meta.url), 'utf8')).rows;
  const recentQueue = existing.filter(row => row.candidateMismatch && row.profileUrl);
  async function recentWorker() {
    while (recentQueue.length) {
      const row = recentQueue.shift();
      try {
        const html = await fetchText(`${row.profileUrl.split('?')[0]}?timespan=90d`);
        const rounds = Object.fromEntries(['决斗', '哨位', '控场', '先锋'].map(role => [role, 0]));
        for (const tr of html.match(/<tr>[\s\S]*?<\/tr>/g) || []) {
          const agent = tr.match(/<img[^>]+alt="([^"]+)"/)?.[1]?.toLowerCase();
          const played = Number(tr.match(/class="mod-use">[^<]*<\/td>\s*<td>([\d,]+)<\/td>/)?.[1]?.replaceAll(',', ''));
          if (agent && roleOf[agent] && Number.isFinite(played)) rounds[roleOf[agent]] += played;
        }
        row.recentRounds = rounds;
        row.recentDominant = Object.entries(rounds).sort((a,b) => b[1]-a[1])[0][0];
      } catch (error) { row.recentStatus = error.message; }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  await Promise.all(Array.from({ length: 4 }, recentWorker));
  await writeFile(new URL('../reports/player-role-data-audit.json', import.meta.url), JSON.stringify({ method: 'VLR all-time and recent 90-day agent rounds; candidate mismatches require human review', rows: existing }, null, 2));
  console.log(JSON.stringify({ recentChecked: existing.filter(row => row.recentRounds).length }));
  process.exit(0);
}
await Promise.all(Array.from({ length: 4 }, worker));
report.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(new URL('../reports/player-role-data-audit.json', import.meta.url), JSON.stringify({ method: 'VLR all-time agent rounds, candidate mismatches require human review; not proof of current team position', rows: report }, null, 2));
console.log(JSON.stringify({ total: report.length, sourced: report.filter(row => row.status === 'ok').length, candidates: report.filter(row => row.candidateMismatch).length, errors: report.filter(row => row.status !== 'ok').length }));
