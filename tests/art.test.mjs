import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CARDS,ENEMIES} from '../content.js';
import {CARD_ART,ENEMY_ART} from '../art-data.js';
import {cardArtwork,opponentArtwork,artCredit} from '../art-ui.js';

test('every card and enemy has a real, local, decodable image format',async()=>{
 assert.deepEqual(Object.keys(CARD_ART).sort(),Object.keys(CARDS).sort());
 assert.deepEqual(Object.keys(ENEMY_ART).sort(),Object.keys(ENEMIES).sort());
 const hashes=[];
 for(const [id,a] of [...Object.entries(CARD_ART),...Object.entries(ENEMY_ART)]){
  assert.match(a.path,/^assets\/(players|special|opponents)\/[\w-]+\.(png|jpg|webp|svg)$/);
  const bytes=await readFile(new URL('../'+a.path,import.meta.url));assert.ok(bytes.length>100);
  if(a.path.endsWith('.svg')){const svg=bytes.toString();assert.match(svg,/<svg/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|\bon\w+=|\bhref=/i);}
  else assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes[0]===255&&bytes[1]===216||bytes.toString('ascii',8,12)==='WEBP');
  if(CARDS[id]?.player)hashes.push(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.length,72);assert.equal(new Set(hashes).size,72,'No repeated stock silhouette or accidental duplicate photos');
 assert.equal(new Set(['B01','A2_B01','A3_B01'].map(id=>ENEMY_ART[id].path)).size,3);
});

test('portrait provenance matches player names and art markup cannot become an action',async()=>{
 const sources=JSON.parse(await readFile(new URL('../assets/player-sources.json',import.meta.url),'utf8'));
 for(const a of sources.players){assert.equal(a.status,'ok');assert.equal(a.profileName.toLowerCase(),CARDS[a.id].name.toLowerCase());assert.match(a.profileUrl,/^https:\/\/www\.vlr\.gg\/player\/\d+\//);assert.match(a.sourceUrl,/^https:\/\/(owcdn\.net|wx3\.sinaimg\.cn)\//);}
 for(const id of Object.keys(CARDS)){const html=cardArtwork(id);assert.match(html,/<img /);assert.doesNotMatch(html,/data-action|onclick|https?:/);assert.match(html,/draggable="false"/);if(CARDS[id].player)assert.match(artCredit(id),/照片：/);}
 for(const id of Object.keys(ENEMIES))assert.match(opponentArtwork(id),/<img /);
});
