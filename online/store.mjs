import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { SqliteStore } from './sqlite-store.mjs';

// Storage: a single SQLite file `${DATA_DIR}/online.db` (node:sqlite, WAL mode).
// Production (Railway) sets DATA_DIR to a persistent volume. Without DATA_DIR a
// development server uses `.local-data/online.db`; tests pass their own temp dir or
// `filename: ':memory:'`. The old whole-document stores (online-data.json FileStore and
// the single-row PostgreSQL store behind DATABASE_URL) were removed; a legacy
// online-data.json found in the data directory is imported once on boot (see
// migrateLegacyJson) and kept on disk as online-data.migrated-<timestamp>.json.

export const DB_FILE = 'online.db';
export const LEGACY_JSON_FILE = 'online-data.json';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function generateToken() {
  return randomBytes(32).toString('hex');
}

export function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[randomBytes(1)[0] % alphabet.length];
  }
  return code;
}

function normalizeLegacy(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('旧数据文件格式无效');
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return { accounts: obj(data.accounts), rooms: obj(data.rooms) };
}

function expectedCounts(data) {
  const accounts = Object.values(data.accounts).filter(a => a && typeof a === 'object');
  return {
    accounts: accounts.length,
    archives: accounts.reduce((n, a) => n + (Array.isArray(a.archives) ? a.archives.length : 0), 0),
    checkpoints: accounts.reduce((n, a) => n + Object.keys(a.processedCheckpoints || {}).length, 0),
    rooms: Object.values(data.rooms).filter(r => r && typeof r === 'object').length,
    roomRequests: Object.values(data.rooms).reduce((n, r) => n + Object.keys(r?.requests || {}).length, 0),
  };
}

// One-time import of the legacy whole-document JSON. Idempotent:
// - the import is one SQLite transaction (all or nothing) and records the file's
//   sha256 in `meta`;
// - after the counts are verified the JSON is renamed (never deleted) to
//   online-data.migrated-<timestamp>.json;
// - a crash between commit and rename is finished on the next boot (same sha256 →
//   rename only, no second import);
// - a different online-data.json appearing after a completed migration is left alone
//   with a warning instead of being merged over newer data.
export function migrateLegacyJson(store, dataDir, { log = console } = {}) {
  const jsonPath = path.join(dataDir, LEGACY_JSON_FILE);
  if (!existsSync(jsonPath)) return { status: 'none' };
  const raw = readFileSync(jsonPath);
  const hash = sha256(raw);
  const doneHash = store.getMeta('legacy_json_sha256');
  const keepPath = path.join(dataDir, `online-data.migrated-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  if (doneHash === hash) {
    renameSync(jsonPath, keepPath);
    return { status: 'renamed', keptAs: keepPath };
  }
  if (doneHash) {
    log.warn?.(`发现新的 ${LEGACY_JSON_FILE}，但数据库已完成过迁移；未导入，文件保持原样。`);
    return { status: 'skipped' };
  }
  const data = normalizeLegacy(JSON.parse(raw.toString('utf8')));
  const want = expectedCounts(data);
  const before = store.counts();
  store.importLegacy(data);
  const after = store.counts();
  for (const key of Object.keys(want)) {
    // Rows that already existed (same ids) are updated in place, so the database holds
    // at least what the file held and never more than the file plus prior rows.
    if (after[key] < want[key] || after[key] > want[key] + before[key]) {
      throw new Error(`迁移核对失败：${key} 期望 ${want[key]}，实际 ${after[key]}`);
    }
  }
  store.tx(() => {
    store.setMeta('legacy_json_sha256', hash);
    store.setMeta('legacy_json_migrated_at', new Date().toISOString());
    store.setMeta('legacy_json_counts', JSON.stringify(want));
  });
  renameSync(jsonPath, keepPath);
  log.log?.(`已把 ${LEGACY_JSON_FILE} 导入 SQLite（${want.accounts} 个账户、${want.archives} 个存档、${want.rooms} 个房间），原文件保留为 ${path.basename(keepPath)}`);
  return { status: 'migrated', counts: want, keptAs: keepPath };
}

// The inverse of the migration, for rolling back to a build that still reads
// online-data.json (tools/export-online-json.mjs). Sync data has no legacy form.
export function exportLegacyJson(store) {
  const data = store.loadAll();
  return JSON.stringify({ version: 1, accounts: data.accounts, rooms: data.rooms });
}

export async function openStore({
  dataDir = process.env.DATA_DIR,
  filename,
  log = console,
  housekeeping = true,
} = {}) {
  const isProduction = process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_NAME;

  if (filename === ':memory:') return wrap(new SqliteStore(':memory:'), null, housekeeping);

  const explicitDataDir = dataDir !== undefined && dataDir !== '';
  if (isProduction && !explicitDataDir && !filename) {
    throw new Error('生产环境必须配置 DATA_DIR 持久卷');
  }
  if (process.env.DATABASE_URL) {
    log.warn?.('DATABASE_URL 已不再使用：在线数据存放在 DATA_DIR 下的 SQLite 文件中。');
  }
  const finalDataDir = explicitDataDir ? dataDir : (filename ? path.dirname(filename) : '.local-data');
  mkdirSync(finalDataDir, { recursive: true });
  const store = new SqliteStore(filename || path.join(finalDataDir, DB_FILE));
  try {
    const migration = migrateLegacyJson(store, finalDataDir, { log });
    const wrapped = wrap(store, finalDataDir, housekeeping);
    wrapped.migration = migration;
    return wrapped;
  } catch (err) {
    store.close();
    throw err;
  }
}

function wrap(store, dataDir, housekeeping) {
  // Hourly housekeeping: drop long-finished / abandoned rooms.
  const purge = () => { try { store.purgeRooms(Date.now()); } catch (err) { console.error('清理房间失败:', err); } };
  const timer = housekeeping ? setInterval(purge, 60 * 60 * 1000) : null;
  if (timer) { purge(); timer.unref?.(); }
  store.dataDir = dataDir;
  const originalClose = store.close.bind(store);
  store.close = async () => { clearInterval(timer); originalClose(); };
  return store;
}
