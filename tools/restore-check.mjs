#!/usr/bin/env node
// Verifies a backup: node tools/restore-check.mjs <online-….db | online-….db.gz>
// Opens the snapshot read-only (a .gz is first unpacked to a temp file), runs
// PRAGMA quick_check and prints the row count of every table. Exit code 1 when the
// file cannot be opened or the check is not "ok".
import { mkdtempSync, rmSync, createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectSnapshot } from '../online/backup.mjs';

const file = process.argv[2];
if (!file) {
  console.error('用法：node tools/restore-check.mjs <备份文件.db 或 .db.gz>');
  process.exit(2);
}
let tempDir = null;
try {
  let dbFile = file;
  if (/\.gz$/i.test(file)) {
    tempDir = mkdtempSync(path.join(tmpdir(), 'restore-check-'));
    dbFile = path.join(tempDir, path.basename(file).replace(/\.gz$/i, ''));
    await pipeline(createReadStream(file), createGunzip(), createWriteStream(dbFile));
  }
  const { tables, check } = await inspectSnapshot(dbFile);
  console.log(`文件：${file}`);
  console.log(`完整性检查：${check}`);
  for (const [name, n] of Object.entries(tables)) console.log(`  ${name.padEnd(16)} ${n}`);
  if (check !== 'ok') process.exitCode = 1;
} catch (err) {
  console.error(`无法读取备份：${err.message}`);
  process.exitCode = 1;
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}
