// One-time 2026-09-23 review: recognizable career role with >=70% of at least
// 1000 logged rounds; recent agent usage was checked for role shifts.
// PA07/t3xture is handled separately, including its effects.
import { readFile, writeFile } from 'node:fs/promises';

const corrections = {
  AM09: ['BABYBAY', '哨位', '决斗'],
  AM26: ['reduxx', '哨位', '决斗'],
  AM31: ['silentzz', '哨位', '决斗'],
  AM33: ['blowz', '控场', '先锋'],
  AM38: ['pANcada', '哨位', '控场'],
  AM49: ['brawk', '哨位', '先锋'],
  AM50: ['skuba', '自由人', '控场'],
  CN25: ['whzy', '哨位', '决斗'],
  CN27: ['rushia', '先锋', '控场'],
  CN29: ['Nicc', '决斗', '先锋'],
  CN30: ['Flex1n', '哨位', '控场'],
  CN31: ['Akeman', '控场', '决斗'],
  CN32: ['sScary', '先锋', '控场'],
  CN35: ['NoMan', '哨位', '决斗'],
  CN39: ['OBONE', '决斗', '控场'],
  EU21: ['PROFEK', '哨位', '控场'],
  EU22: ['UNFAKE', '哨位', '先锋'],
  EU24: ['MiniBoo', '先锋', '决斗'],
  EU41: ['bipo', '自由人', '决斗'],
  EU50: ['Filu', '自由人', '决斗'],
  PA09: ['Raxcal', '哨位', '决斗'],
  PA16: ['Jinggg', '自由人', '决斗'],
  PA17: ['something', '自由人', '决斗'],
  PA21: ['stax', '控场', '先锋'],
  PA26: ['Lakia', '控场', '先锋'],
  PA33: ['SSeeS', '决斗', '控场'],
  PA41: ['crazyguy', '自由人', '先锋'],
  PA43: ['Kushy', '控场', '先锋'],
  PA49: ['JessieVash', '哨位', '先锋'],
};
const applied = new Set();
for (const file of ['regions.js', 'regional-expansion.js']) {
  let source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const [id, [name, oldRole, newRole]] of Object.entries(corrections)) {
    const exact = `    "${id}",\n    "${name}",\n    "${oldRole}",`;
    const updated = `    "${id}",\n    "${name}",\n    "${newRole}",`;
    if (source.includes(exact)) { source = source.replace(exact, updated); applied.add(id); }
    else if (source.includes(updated)) applied.add(id);
  }
  await writeFile(new URL(`../${file}`, import.meta.url), source);
}
if (applied.size !== Object.keys(corrections).length) throw Error(`Unapplied roles: ${Object.keys(corrections).filter(id => !applied.has(id))}`);
const fixturePath = new URL('../tests/fixtures/roster-roles.json', import.meta.url);
let fixture = await readFile(fixturePath, 'utf8');
for (const [id, [name, oldRole, newRole]] of Object.entries(corrections)) {
  const region = id.startsWith('PA') ? '太平洋' : id.startsWith('AM') ? '美洲' : id.startsWith('EU') ? 'EMEA' : '中国';
  const oldLabel = oldRole === '自由人' ? '跨位置候选' : oldRole === '控场' ? '控场／烟位' : oldRole;
  const newLabel = newRole === '控场' ? '控场／烟位' : newRole;
  const before = `"${region}/${name}": "${oldLabel}"`;
  if (fixture.includes(before)) fixture = fixture.replace(before, `"${region}/${name}": "${newLabel}"`);
}
await writeFile(fixturePath, fixture);
console.log(`Reviewed role corrections: ${Object.keys(corrections).length}`);
