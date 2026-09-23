import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const keyText = await readFile(process.env.DEEPSEEK_KEY_FILE, 'utf8');
const key = keyText.match(/sk-[A-Za-z0-9_-]+/)?.[0];
if (!key) throw Error('DeepSeek key unavailable');
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const modelsResponse = await fetch('https://api.deepseek.com/models', { headers, signal: AbortSignal.timeout(20000) });
if (!modelsResponse.ok) throw Error(`Models HTTP ${modelsResponse.status}`);
const models = (await modelsResponse.json()).data.map(item => item.id);
const model = ['deepseek-v4-pro', 'deepseek-reasoner', 'deepseek-chat', 'deepseek-flash'].find(id => models.includes(id));
if (!model) throw Error('No supported model');
const wa = await readFile(path.join(root, 'ui-source.js'), 'utf8');
const newer = await readFile(path.join(root, 'new-demo/ui.js'), 'utf8');
const input = [
  'Review the actual draw/discard animation paths in two browser card game demos. The user reports cards appear/disappear instantly. Return Chinese JSON with precise causes, code-level repairs, and a 5-step visual acceptance checklist. Do not claim you ran the UI. Account for mobile and reduced-motion. Focus on real card faces flying from draw pile into final hand slots, end-turn remaining cards flying to discard/exhaust, and card-draw effects during play. Keep mechanics unchanged.',
  'WA commit/render/timeline:\n' + wa.slice(wa.indexOf('function commit(action)'), wa.indexOf('function showModal(')),
  'WA animateResolution:\n' + wa.slice(wa.indexOf('function animateResolution('), wa.indexOf("document.addEventListener('click'")),
  'NEW dispatch:\n' + newer.slice(newer.indexOf('function dispatch(action)'), newer.indexOf('function delay(ms)')),
  'NEW end turn timeline:\n' + newer.slice(newer.indexOf('async function handleEndTurnTimeline('), newer.indexOf('function applyCombatFx(')),
  'NEW play timeline tail:\n' + newer.slice(newer.indexOf('async function handlePlayCardTimeline('), newer.indexOf('async function handleEndTurnTimeline(')).slice(-7500),
].join('\n\n');
const response = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'system', content: 'You are a senior browser animation engineer. Diagnose honestly and give implementable recommendations; no fabricated tests.' }, { role: 'user', content: input }], max_tokens: 4800, thinking: { type: 'disabled' }, response_format: { type: 'json_object' } }), signal: AbortSignal.timeout(150000) });
if (!response.ok) throw Error(`Completion HTTP ${response.status}`);
const body = await response.json();
const result = { model, usage: body.usage, finishReason: body.choices[0].finish_reason, audit: JSON.parse(body.choices[0].message.content) };
await writeFile(path.join(root, 'reports', 'deepseek-animation-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ model, usage: result.usage, finishReason: result.finishReason, report: 'reports/deepseek-animation-audit.json' }));
