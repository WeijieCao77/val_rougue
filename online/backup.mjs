// Automatic SQLite snapshots of `${DATA_DIR}/online.db` (docs/BACKUP-AND-MONITORING.md).
//
// - In-process scheduler, no external cron: ~2 minutes after boot (only if there is no
//   snapshot from the last 24 h) and then whenever the newest snapshot is ~a day old
//   (checked hourly).
// - `VACUUM INTO` writes a consistent, compacted copy while the server keeps serving
//   (WAL readers are not blocked; the event loop is busy only for the copy itself,
//   well under a second at the current database size). The copy is written to a
//   temporary name and renamed, so a half-written snapshot never looks valid.
// - Snapshots: `${DATA_DIR}/backups/online-YYYYMMDD-HHMM.db` (UTC). Rotation keeps the
//   newest snapshot of each of the last 7 days plus the newest of each of the last 4
//   Sundays (UTC); everything else is deleted.
// - `backups/latest.json`: file name, time, size and row counts per table (read back
//   from the snapshot itself, which also proves it opens).
import { mkdirSync, readdirSync, statSync, unlinkSync, renameSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const BACKUP_DIR_NAME = 'backups';
export const LATEST_FILE = 'latest.json';
export const KEEP_DAILY = 7;
export const KEEP_WEEKLY = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_RE = /^online-(\d{8})-(\d{4})\.db$/;

// node:sqlite prints an ExperimentalWarning on first load; filter exactly that one
// (same approach as sqlite-store.mjs) when this module is used on its own (tools).
let sqliteModule = null;
export async function loadSqlite() {
  if (sqliteModule) return sqliteModule;
  const original = process.emitWarning;
  process.emitWarning = function filterSqliteWarning(warning, ...args) {
    const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
    const message = typeof warning === 'string' ? warning : warning?.message;
    if (type === 'ExperimentalWarning' && /SQLite/i.test(message || '')) return;
    return original.call(process, warning, ...args);
  };
  try { sqliteModule = await import('node:sqlite'); } finally { process.emitWarning = original; }
  return sqliteModule;
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
export function snapshotName(time) {
  const d = new Date(time);
  return `online-${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}.db`;
}

export function snapshotTime(name) {
  const m = SNAPSHOT_RE.exec(name);
  if (!m) return null;
  const [, day, hm] = m;
  return Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8), +hm.slice(0, 2), +hm.slice(2, 4));
}

export function backupDirOf(dataDir) {
  return path.join(dataDir, BACKUP_DIR_NAME);
}

// Snapshot files in `dir`, newest first.
export function listSnapshots(dir) {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  return names.filter(n => SNAPSHOT_RE.test(n)).sort().reverse();
}

// Which snapshots to keep: newest per UTC day for the newest `daily` days, plus the
// newest per Sunday for the newest `weekly` Sundays. Pure, for tests.
export function planRotation(names, { daily = KEEP_DAILY, weekly = KEEP_WEEKLY } = {}) {
  const newestPerDay = new Map();
  for (const name of [...names].filter(n => SNAPSHOT_RE.test(n)).sort().reverse()) {
    const day = SNAPSHOT_RE.exec(name)[1];
    if (!newestPerDay.has(day)) newestPerDay.set(day, name);
  }
  const days = [...newestPerDay.keys()]; // newest first
  const keep = new Set(days.slice(0, daily).map(d => newestPerDay.get(d)));
  const sundays = days.filter(d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))).getUTCDay() === 0);
  for (const d of sundays.slice(0, weekly)) keep.add(newestPerDay.get(d));
  const remove = names.filter(n => SNAPSHOT_RE.test(n) && !keep.has(n));
  return { keep: [...keep].sort().reverse(), remove };
}

export function rotateSnapshots(dir, options) {
  const { keep, remove } = planRotation(listSnapshots(dir), options);
  for (const name of remove) {
    try { unlinkSync(path.join(dir, name)); } catch {}
  }
  return { keep, remove };
}

// Opens a snapshot read-only and returns { tables: {name: rows}, check: 'ok' | message }.
export async function inspectSnapshot(file) {
  const { DatabaseSync } = await loadSqlite();
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const check = db.prepare('PRAGMA quick_check').get().quick_check;
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    const tables = {};
    for (const name of names) tables[name] = db.prepare(`SELECT COUNT(*) AS n FROM "${name.replace(/"/g, '""')}"`).get().n;
    return { tables, check };
  } finally {
    db.close();
  }
}

export function readLatest(dataDir) {
  try { return JSON.parse(readFileSync(path.join(backupDirOf(dataDir), LATEST_FILE), 'utf8')); } catch { return null; }
}

// Writes one snapshot now. `db` is the live DatabaseSync (store.db).
export async function createSnapshot(db, dataDir, { now = Date.now(), log = console, rotate = true } = {}) {
  const dir = backupDirOf(dataDir);
  mkdirSync(dir, { recursive: true });
  const name = snapshotName(now);
  const final = path.join(dir, name);
  const tmp = path.join(dir, `.tmp-${name}`);
  try { unlinkSync(tmp); } catch {}
  const started = Date.now();
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  renameSync(tmp, final);
  const ms = Date.now() - started;
  const bytes = statSync(final).size;
  const { tables, check } = await inspectSnapshot(final);
  const latest = { file: name, time: new Date(now).toISOString(), bytes, ms, check, tables };
  const latestPath = path.join(dir, LATEST_FILE);
  writeFileSync(`${latestPath}.tmp`, JSON.stringify(latest, null, 2));
  renameSync(`${latestPath}.tmp`, latestPath);
  const rotation = rotate ? rotateSnapshots(dir) : { keep: listSnapshots(dir), remove: [] };
  log.log?.(`数据库备份完成：${name}（${(bytes / 1024).toFixed(1)} KB，${ms} ms，检查 ${check}，保留 ${rotation.keep.length} 份，删除 ${rotation.remove.length} 份）`);
  return { ...latest, path: final, removed: rotation.remove };
}

export function newestSnapshot(dataDir) {
  const dir = backupDirOf(dataDir);
  const [name] = listSnapshots(dir);
  return name ? { name, path: path.join(dir, name), time: snapshotTime(name) } : null;
}

// Starts the daily scheduler. Returns { stop(), runNow(), due() }.
export function startBackupScheduler(store, dataDir, {
  log = console,
  now = () => Date.now(),
  bootDelayMs = 2 * 60 * 1000,
  checkEveryMs = 60 * 60 * 1000,
  intervalMs = DAY_MS,
} = {}) {
  let running = false;
  let stopped = false;
  // A snapshot is due when none exists or the newest one is about a day old (30 min
  // slack so the hourly check does not drift a full hour later every day).
  const due = () => {
    const newest = newestSnapshot(dataDir);
    return !newest || now() - newest.time >= intervalMs - 30 * 60 * 1000;
  };
  const runNow = async () => {
    if (running || stopped || !store?.db?.isOpen) return null;
    running = true;
    try {
      return await createSnapshot(store.db, dataDir, { now: now(), log });
    } catch (err) {
      log.error?.('数据库备份失败:', err?.message || err);
      return null;
    } finally {
      running = false;
    }
  };
  const tick = () => { if (due()) runNow(); };
  const boot = setTimeout(tick, bootDelayMs);
  const timer = setInterval(tick, checkEveryMs);
  boot.unref?.();
  timer.unref?.();
  return {
    due,
    runNow,
    stop() { stopped = true; clearTimeout(boot); clearInterval(timer); },
  };
}

