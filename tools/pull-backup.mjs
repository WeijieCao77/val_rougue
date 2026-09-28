#!/usr/bin/env node
// Off-site copy of the newest server snapshot (docs/BACKUP-AND-MONITORING.md).
//
//   node tools/pull-backup.mjs --dest D:\backups\val [--url https://…] [--token-file path] [--keep 30]
//
// Token: --token-file <path>, else env VAL_ADMIN_TOKEN, else env ADMIN_TOKEN. Never stored
// in the repo and never printed. Saves <dest>/online-YYYYMMDD.db.gz (local date; a second
// pull on the same day replaces that day's file), checks it is a complete gzip, keeps the
// newest --keep files and exits non-zero on any failure.
import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_URL = 'https://valrougue-production.up.railway.app';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) throw new Error(`无法识别的参数：${argv[i]}`);
    out[m[1]] = m[2] ?? argv[++i];
  }
  return out;
}

const pad = n => String(n).padStart(2, '0');

export async function pullBackup({ url = DEFAULT_URL, dest, token, keep = 30, now = new Date(), log = console } = {}) {
  if (!dest) throw new Error('缺少 --dest 目标文件夹');
  if (!token) throw new Error('缺少令牌：用 --token-file 或环境变量 VAL_ADMIN_TOKEN / ADMIN_TOKEN');
  mkdirSync(dest, { recursive: true });
  const name = `online-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.db.gz`;
  const final = path.join(dest, name);
  const tmp = `${final}.part`;
  const endpoint = new URL('/api/admin/backup/latest', url);
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok || !res.body) throw new Error(`下载失败：HTTP ${res.status}`);
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    const size = statSync(tmp).size;
    if (size < 20) throw new Error(`文件过小（${size} 字节）`);
    // Full integrity check: the gzip must decompress to the end, and hold an SQLite file.
    let head = null;
    let raw = 0;
    await pipeline(createReadStream(tmp), createGunzip(), new Writable({
      write(chunk, _enc, cb) { if (!head) head = chunk.subarray(0, 16); raw += chunk.length; cb(); },
    }));
    if (!head || head.toString('latin1') !== 'SQLite format 3\u0000') throw new Error('解压后不是 SQLite 数据库');
    renameSync(tmp, final);
    const files = readdirSync(dest).filter(f => /^online-\d{8}\.db\.gz$/.test(f)).sort().reverse();
    const removed = files.slice(keep);
    for (const f of removed) unlinkSync(path.join(dest, f));
    log.log?.(`已保存 ${final}（压缩 ${(size / 1024).toFixed(1)} KB，原始 ${(raw / 1024).toFixed(1)} KB，服务器文件 ${res.headers.get('x-backup-file') || '?'}），保留 ${Math.min(files.length, keep)} 份，删除 ${removed.length} 份`);
    return { file: final, bytes: size, rawBytes: raw, removed };
  } catch (err) {
    try { unlinkSync(tmp); } catch {}
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const a = args(process.argv.slice(2));
    const token = (a['token-file'] ? readFileSync(a['token-file'], 'utf8') : process.env.VAL_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim();
    await pullBackup({ url: a.url || DEFAULT_URL, dest: a.dest, token, keep: Number(a.keep) || 30 });
  } catch (err) {
    console.error(`备份拉取失败：${err.message}`);
    process.exit(1);
  }
}
