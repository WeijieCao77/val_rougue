// SQLite-backed store for the online API (accounts, archives, PvP rooms) and progress sync.
//
// One DatabaseSync connection per process. Every request runs a short, fully
// synchronous unit of work (`store.tx(fn)`): it reads only the rows it needs, lets the
// API mutate plain objects, and on commit writes back only the rows whose JSON actually
// changed. Because node:sqlite is synchronous and the unit of work may not await, no
// other request can interleave inside a transaction, so no JS mutex is needed.
//
// Read-only requests (room poll, account GET) commit without writing anything unless
// the state really changed (e.g. a turn timer expired lazily).

// node:sqlite prints an ExperimentalWarning on load (Node 24). Silence exactly that one
// warning for the duration of the import; every other warning is untouched.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function filterSqliteWarning(warning, ...args) {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (type === 'ExperimentalWarning' && /SQLite/i.test(message || '')) return;
  return originalEmitWarning.call(process, warning, ...args);
};
let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} finally {
  process.emitWarning = originalEmitWarning;
}

const SCHEMA_VERSION = 2;

// Finished / closed rooms are kept for a week; waiting or active rooms that nobody has
// touched for two days are abandoned (their accounts are released).
const ROOM_KEEP_DONE_MS = 7 * 24 * 60 * 60 * 1000;
const ROOM_KEEP_IDLE_MS = 2 * 24 * 60 * 60 * 1000;

const ACCOUNT_KNOWN_KEYS = new Set(['accountId', 'tokenHash', 'archives', 'pending', 'roomCode', 'name', 'createdAt', 'processedCheckpoints']);

function accountRowPart(acct) {
  const extra = {};
  for (const key of Object.keys(acct)) {
    if (!ACCOUNT_KNOWN_KEYS.has(key)) extra[key] = acct[key];
  }
  return {
    tokenHash: acct.tokenHash,
    roomCode: acct.roomCode ?? null,
    name: acct.name ?? null,
    createdAt: acct.createdAt ?? null,
    pending: acct.pending ?? null,
    extra: Object.keys(extra).length ? extra : null,
  };
}

function roomWithoutRequests(room) {
  if (!room || !('requests' in room)) return room;
  const { requests, ...rest } = room;
  return rest;
}

function num(value) {
  return Number.isFinite(value) ? value : null;
}

export class SqliteStore {
  constructor(filename) {
    this.filename = filename;
    this.db = new DatabaseSync(filename);
    this.inTx = false;
    this._testHooks = {};
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.migrateSchema();
    this.prepare();
  }

  migrateSchema() {
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (
          account_id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          room_code TEXT,
          name TEXT,
          created_at INTEGER,
          pending TEXT,
          extra TEXT
        );
        CREATE INDEX IF NOT EXISTS accounts_room_code ON accounts(room_code) WHERE room_code IS NOT NULL;
        CREATE TABLE IF NOT EXISTS archives (
          account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
          pos INTEGER NOT NULL,
          archive_id TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (account_id, pos)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS checkpoints (
          account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
          checkpoint_id TEXT NOT NULL,
          decision TEXT NOT NULL,
          at INTEGER,
          PRIMARY KEY (account_id, checkpoint_id)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS rooms (
          code TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          created_at INTEGER,
          last_action_at INTEGER,
          data TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS rooms_status_age ON rooms(status, last_action_at);
        CREATE TABLE IF NOT EXISTS room_requests (
          room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
          request_key TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (room_code, request_key)
        ) WITHOUT ROWID;
        PRAGMA user_version = 1;
      `);
    }
    if (version < 2) {
      // Progress sync between devices (online/sync-api.mjs). Bundles are gzip BLOBs.
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sync_links (
          sync_id TEXT PRIMARY KEY,
          demo TEXT NOT NULL,
          secret_hash TEXT NOT NULL,
          rev INTEGER NOT NULL DEFAULT 0,
          saved_at INTEGER,
          device TEXT,
          bundle BLOB,
          bundle_bytes INTEGER NOT NULL DEFAULT 0,
          backup BLOB,
          backup_rev INTEGER,
          backup_saved_at INTEGER,
          backup_device TEXT,
          created_at INTEGER NOT NULL,
          touched_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sync_links_touched ON sync_links(touched_at);
        CREATE TABLE IF NOT EXISTS sync_codes (
          code TEXT PRIMARY KEY,
          demo TEXT NOT NULL,
          sync_id TEXT NOT NULL REFERENCES sync_links(sync_id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL
        ) WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS sync_codes_expiry ON sync_codes(expires_at);
        PRAGMA user_version = 2;
      `);
    }
    if (this.db.prepare('PRAGMA user_version').get().user_version !== SCHEMA_VERSION) {
      throw new Error('数据库结构版本不匹配');
    }
  }

  prepare() {
    const p = sql => this.db.prepare(sql);
    this.q = {
      accountByToken: p('SELECT account_id, token_hash, room_code, name, created_at FROM accounts WHERE token_hash = ?'),
      accountById: p('SELECT * FROM accounts WHERE account_id = ?'),
      archivesOf: p('SELECT data FROM archives WHERE account_id = ? ORDER BY pos'),
      insertAccount: p('INSERT INTO accounts (account_id, token_hash, room_code, name, created_at, pending, extra) VALUES (?, ?, ?, ?, ?, ?, ?)'),
      upsertAccount: p(`INSERT INTO accounts (account_id, token_hash, room_code, name, created_at, pending, extra) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET token_hash = excluded.token_hash, room_code = excluded.room_code, name = excluded.name,
        created_at = excluded.created_at, pending = excluded.pending, extra = excluded.extra`),
      deleteAccount: p('DELETE FROM accounts WHERE account_id = ?'),
      deleteArchives: p('DELETE FROM archives WHERE account_id = ?'),
      insertArchive: p('INSERT INTO archives (account_id, pos, archive_id, data) VALUES (?, ?, ?, ?)'),
      checkpoint: p('SELECT decision, at FROM checkpoints WHERE account_id = ? AND checkpoint_id = ?'),
      checkpointsOf: p('SELECT checkpoint_id, decision, at FROM checkpoints WHERE account_id = ?'),
      putCheckpoint: p(`INSERT INTO checkpoints (account_id, checkpoint_id, decision, at) VALUES (?, ?, ?, ?)
        ON CONFLICT(account_id, checkpoint_id) DO UPDATE SET decision = excluded.decision, at = excluded.at`),
      deleteCheckpoints: p('DELETE FROM checkpoints WHERE account_id = ?'),
      room: p('SELECT data FROM rooms WHERE code = ?'),
      roomExists: p('SELECT 1 AS x FROM rooms WHERE code = ?'),
      upsertRoom: p(`INSERT INTO rooms (code, status, created_at, last_action_at, data) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET status = excluded.status, created_at = excluded.created_at,
        last_action_at = excluded.last_action_at, data = excluded.data`),
      deleteRoom: p('DELETE FROM rooms WHERE code = ?'),
      request: p('SELECT data FROM room_requests WHERE room_code = ? AND request_key = ?'),
      requestsOf: p('SELECT request_key, data FROM room_requests WHERE room_code = ?'),
      putRequest: p('INSERT OR REPLACE INTO room_requests (room_code, request_key, data) VALUES (?, ?, ?)'),
      clearRequests: p('DELETE FROM room_requests WHERE room_code = ?'),
      allAccounts: p('SELECT * FROM accounts'),
      allRooms: p('SELECT code, data FROM rooms'),
      releaseRoomAccounts: p('UPDATE accounts SET room_code = NULL WHERE room_code = ?'),
      staleRooms: p(`SELECT code FROM rooms WHERE
        (status IN ('finished', 'closed') AND COALESCE(last_action_at, created_at, 0) < ?)
        OR (status IN ('waiting', 'active') AND COALESCE(last_action_at, created_at, 0) < ?)`),
      getMeta: p('SELECT value FROM meta WHERE key = ?'),
      setMeta: p('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
      syncLink: p(`SELECT sync_id, demo, secret_hash, rev, saved_at, device, bundle_bytes,
        backup IS NOT NULL AS has_backup, backup_rev, backup_saved_at, backup_device FROM sync_links WHERE sync_id = ?`),
      syncBundle: p('SELECT bundle FROM sync_links WHERE sync_id = ?'),
      syncBackup: p('SELECT backup, backup_rev, backup_saved_at, backup_device FROM sync_links WHERE sync_id = ?'),
      insertSyncLink: p(`INSERT INTO sync_links (sync_id, demo, secret_hash, rev, saved_at, device, bundle, bundle_bytes, created_at, touched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
      setSyncCurrent: p('UPDATE sync_links SET rev = ?, saved_at = ?, device = ?, bundle = ?, bundle_bytes = ?, touched_at = ? WHERE sync_id = ?'),
      setSyncBackup: p('UPDATE sync_links SET backup = ?, backup_rev = ?, backup_saved_at = ?, backup_device = ? WHERE sync_id = ?'),
      touchSyncLink: p('UPDATE sync_links SET touched_at = ? WHERE sync_id = ?'),
      setSyncSecrets: p('UPDATE sync_links SET secret_hash = ? WHERE sync_id = ?'),
      insertSyncCode: p('INSERT INTO sync_codes (code, demo, sync_id, expires_at) VALUES (?, ?, ?, ?)'),
      syncCode: p('SELECT code, demo, sync_id, expires_at FROM sync_codes WHERE code = ?'),
      deleteSyncCode: p('DELETE FROM sync_codes WHERE code = ?'),
      deleteSyncCodesOf: p('DELETE FROM sync_codes WHERE sync_id = ?'),
      purgeSyncCodes: p('DELETE FROM sync_codes WHERE expires_at < ?'),
      purgeSyncLinks: p('DELETE FROM sync_links WHERE touched_at < ?'),
    };
  }

  // ------------------------------------------------------------------ progress sync
  // Plain row access; callers wrap related calls in store.tx for atomicity.
  syncLink(syncId) {
    const row = this.q.syncLink.get(syncId);
    if (!row) return null;
    return {
      syncId: row.sync_id, demo: row.demo, secretHashes: String(row.secret_hash).split(' ').filter(Boolean), rev: row.rev, savedAt: row.saved_at,
      device: row.device, bytes: row.bundle_bytes,
      backup: row.has_backup ? { rev: row.backup_rev, savedAt: row.backup_saved_at, device: row.backup_device } : null,
    };
  }

  syncBundle(syncId) {
    return this.q.syncBundle.get(syncId)?.bundle ?? null;
  }

  syncBackup(syncId) {
    const row = this.q.syncBackup.get(syncId);
    return row?.backup ? { blob: row.backup, rev: row.backup_rev, savedAt: row.backup_saved_at, device: row.backup_device } : null;
  }

  createSyncLink({ syncId, demo, secretHash, rev, savedAt, device, blob, bytes, now }) {
    this.q.insertSyncLink.run(syncId, demo, secretHash, rev, num(savedAt), device ?? null, blob, bytes, now, now);
  }

  setSyncCurrent(syncId, { rev, savedAt, device, blob, bytes, now }) {
    this.q.setSyncCurrent.run(rev, num(savedAt), device ?? null, blob, bytes, now, syncId);
  }

  setSyncBackup(syncId, backup) {
    if (!backup) this.q.setSyncBackup.run(null, null, null, null, syncId);
    else this.q.setSyncBackup.run(backup.blob, num(backup.rev), num(backup.savedAt), backup.device ?? null, syncId);
  }

  // secret_hash holds the space-separated hashes of every linked device (newest last).
  addSyncSecret(syncId, secretHash) {
    const link = this.syncLink(syncId);
    const hashes = [...link.secretHashes, secretHash].slice(-8);
    this.q.setSyncSecrets.run(hashes.join(' '), syncId);
  }

  touchSyncLink(syncId, now) {
    this.q.touchSyncLink.run(now, syncId);
  }

  putSyncCode(code, demo, syncId, expiresAt) {
    this.q.insertSyncCode.run(code, demo, syncId, expiresAt);
  }

  syncCodeExists(code) {
    return !!this.q.syncCode.get(code);
  }

  // Single use: the code row is deleted whether or not it was still valid.
  takeSyncCode(code, now) {
    const row = this.q.syncCode.get(code);
    if (!row) return null;
    this.q.deleteSyncCode.run(code);
    if (row.expires_at < now) return null;
    return { code: row.code, demo: row.demo, syncId: row.sync_id, expiresAt: row.expires_at };
  }

  clearSyncCodes(syncId) {
    this.q.deleteSyncCodesOf.run(syncId);
  }

  purgeSync(nowTime, linkMaxIdleMs) {
    return this.tx(() => ({
      codes: Number(this.q.purgeSyncCodes.run(nowTime).changes),
      links: Number(this.q.purgeSyncLinks.run(nowTime - linkMaxIdleMs).changes),
    }));
  }

  // ------------------------------------------------------------------ transactions
  // Run `fn(t)` synchronously inside BEGIN IMMEDIATE … COMMIT. `fn` must not be async.
  tx(fn) {
    if (this.inTx) throw new Error('嵌套事务不受支持');
    this.inTx = true;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const unit = new UnitOfWork(this);
      const result = fn(unit);
      if (result && typeof result.then === 'function') throw new Error('存储事务函数必须是同步函数');
      unit.flush();
      this._testHooks.beforeCommit?.();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw err;
    } finally {
      this.inTx = false;
    }
  }

  getAccountByTokenHash(tokenHash) {
    const row = this.q.accountByToken.get(tokenHash);
    if (!row) return null;
    return { accountId: row.account_id, tokenHash: row.token_hash, roomCode: row.room_code, name: row.name ?? undefined, createdAt: row.created_at };
  }

  getMeta(key) {
    return this.q.getMeta.get(key)?.value ?? null;
  }

  setMeta(key, value) {
    this.q.setMeta.run(key, String(value));
  }

  // --------------------------------------------------------------- row <-> object
  loadAccountRow(row) {
    const acct = { accountId: row.account_id, tokenHash: row.token_hash };
    const extra = row.extra ? JSON.parse(row.extra) : null;
    if (extra) Object.assign(acct, extra);
    acct.archives = this.q.archivesOf.all(row.account_id).map(r => JSON.parse(r.data));
    acct.pending = row.pending ? JSON.parse(row.pending) : null;
    acct.roomCode = row.room_code ?? null;
    if (row.name != null) acct.name = row.name;
    acct.createdAt = row.created_at ?? undefined;
    return acct;
  }

  writeAccountRow(accountId, acct, upsert = true) {
    const part = accountRowPart(acct);
    (upsert ? this.q.upsertAccount : this.q.insertAccount).run(
      accountId, part.tokenHash, part.roomCode, part.name, num(part.createdAt),
      part.pending == null ? null : JSON.stringify(part.pending),
      part.extra == null ? null : JSON.stringify(part.extra),
    );
  }

  writeArchives(accountId, archives) {
    this.q.deleteArchives.run(accountId);
    (archives || []).forEach((archive, pos) => {
      this.q.insertArchive.run(accountId, pos, String(archive?.id ?? ''), JSON.stringify(archive));
    });
  }

  writeRoom(code, room, dataString = JSON.stringify(roomWithoutRequests(room))) {
    this.q.upsertRoom.run(code, String(room.status ?? 'waiting'), num(room.createdAt), num(room.lastActionAt ?? room.createdAt), dataString);
  }

  // ----------------------------------------------------------- whole-document API
  // The pre-SQLite API: `fn(data)` receives { version, accounts, rooms } with the whole
  // state and may mutate it; changed rows are written back. It reads every row, so it
  // is only for tests, the one-time JSON migration and the export tool — never for
  // request handling.
  loadAll() {
    const data = { version: 1, accounts: {}, rooms: {} };
    for (const row of this.q.allAccounts.all()) {
      const acct = this.loadAccountRow(row);
      const processed = Object.create(null);
      for (const cp of this.q.checkpointsOf.all(row.account_id)) processed[cp.checkpoint_id] = { decision: cp.decision, at: cp.at };
      acct.processedCheckpoints = processed;
      data.accounts[row.account_id] = acct;
    }
    for (const row of this.q.allRooms.all()) {
      const room = JSON.parse(row.data);
      const requests = Object.create(null);
      for (const r of this.q.requestsOf.all(row.code)) requests[r.request_key] = JSON.parse(r.data);
      room.requests = requests;
      data.rooms[row.code] = room;
    }
    return data;
  }

  fingerprint(data) {
    const accounts = new Map();
    for (const [id, acct] of Object.entries(data.accounts || {})) {
      if (!acct || typeof acct !== 'object') continue;
      accounts.set(id, {
        row: JSON.stringify(accountRowPart(acct)),
        archives: JSON.stringify(acct.archives || []),
        checkpoints: JSON.stringify(acct.processedCheckpoints || {}),
      });
    }
    const rooms = new Map();
    for (const [code, room] of Object.entries(data.rooms || {})) {
      if (!room || typeof room !== 'object') continue;
      rooms.set(code, { data: JSON.stringify(roomWithoutRequests(room)), requests: JSON.stringify(room.requests || {}) });
    }
    return { accounts, rooms };
  }

  // Write every entity of `data` that differs from `before` (a fingerprint); entities
  // missing from `data` but present in `before` are deleted. Must run inside a tx.
  writeDiff(data, before) {
    const after = this.fingerprint(data);
    for (const [id, fp] of after.accounts) {
      const acct = data.accounts[id];
      const old = before.accounts.get(id);
      if (!old || old.row !== fp.row) this.writeAccountRow(acct.accountId || id, acct);
      if (!old || old.archives !== fp.archives) this.writeArchives(acct.accountId || id, acct.archives);
      if (!old || old.checkpoints !== fp.checkpoints) {
        this.q.deleteCheckpoints.run(acct.accountId || id);
        for (const [cpId, cp] of Object.entries(acct.processedCheckpoints || {})) {
          this.q.putCheckpoint.run(acct.accountId || id, cpId, String(cp?.decision ?? ''), num(cp?.at));
        }
      }
    }
    for (const id of before.accounts.keys()) {
      if (!after.accounts.has(id)) this.q.deleteAccount.run(id);
    }
    for (const [code, fp] of after.rooms) {
      const room = data.rooms[code];
      const old = before.rooms.get(code);
      if (!old || old.data !== fp.data) this.writeRoom(code, room, fp.data);
      if (!old || old.requests !== fp.requests) {
        this.q.clearRequests.run(code);
        for (const [key, value] of Object.entries(room.requests || {})) this.q.putRequest.run(code, key, JSON.stringify(value));
      }
    }
    for (const code of before.rooms.keys()) {
      if (!after.rooms.has(code)) this.q.deleteRoom.run(code);
    }
  }

  async transaction(fn) {
    if (this.inTx) throw new Error('嵌套事务不受支持');
    const data = this.loadAll();
    const before = this.fingerprint(data);
    const result = await fn(data);
    this.tx(() => this.writeDiff(data, before));
    return result;
  }

  // Import a legacy online-data.json document (all or nothing).
  importLegacy(data) {
    const empty = { accounts: new Map(), rooms: new Map() };
    this.tx(() => {
      this.writeDiff({ accounts: data.accounts || {}, rooms: data.rooms || {} }, empty);
    });
  }

  counts() {
    const one = sql => this.db.prepare(sql).get().n;
    return {
      accounts: one('SELECT COUNT(*) AS n FROM accounts'),
      archives: one('SELECT COUNT(*) AS n FROM archives'),
      checkpoints: one('SELECT COUNT(*) AS n FROM checkpoints'),
      rooms: one('SELECT COUNT(*) AS n FROM rooms'),
      roomRequests: one('SELECT COUNT(*) AS n FROM room_requests'),
      syncLinks: one('SELECT COUNT(*) AS n FROM sync_links'),
      syncCodes: one('SELECT COUNT(*) AS n FROM sync_codes'),
    };
  }

  // ------------------------------------------------------------------- housekeeping
  purgeRooms(nowTime = Date.now()) {
    return this.tx(() => {
      const stale = this.q.staleRooms.all(nowTime - ROOM_KEEP_DONE_MS, nowTime - ROOM_KEEP_IDLE_MS);
      for (const { code } of stale) {
        this.q.releaseRoomAccounts.run(code);
        this.q.deleteRoom.run(code);
      }
      return stale.length;
    });
  }

  checkpointWal() {
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
  }

  close() {
    if (!this.db.isOpen) return;
    this.checkpointWal();
    this.db.close();
  }
}

// Per-transaction view: loads rows on demand, tracks the objects handed out and writes
// back only those whose serialized form changed.
class UnitOfWork {
  constructor(store) {
    this.s = store;
    this.q = store.q;
    this.accounts = new Map();
    this.rooms = new Map();
  }

  account(accountId) {
    if (this.accounts.has(accountId)) return this.accounts.get(accountId).obj;
    const row = this.q.accountById.get(accountId);
    if (!row) return null;
    const obj = this.s.loadAccountRow(row);
    this.accounts.set(accountId, { obj, row: JSON.stringify(accountRowPart(obj)), archives: JSON.stringify(obj.archives) });
    return obj;
  }

  createAccount(acct) {
    this.s.writeAccountRow(acct.accountId, acct, false);
    const archives = acct.archives || (acct.archives = []);
    if (archives.length) this.s.writeArchives(acct.accountId, archives);
    this.accounts.set(acct.accountId, { obj: acct, row: JSON.stringify(accountRowPart(acct)), archives: JSON.stringify(archives) });
    return acct;
  }

  checkpoint(accountId, checkpointId) {
    const row = this.q.checkpoint.get(accountId, checkpointId);
    return row ? { decision: row.decision, at: row.at } : null;
  }

  setCheckpoint(accountId, checkpointId, decision, at) {
    this.q.putCheckpoint.run(accountId, checkpointId, decision, num(at));
  }

  room(code) {
    if (this.rooms.has(code)) return this.rooms.get(code).obj;
    const row = this.q.room.get(code);
    if (!row) return null;
    const obj = JSON.parse(row.data);
    this.rooms.set(code, { obj, data: row.data });
    return obj;
  }

  roomExists(code) {
    return this.rooms.has(code) || !!this.q.roomExists.get(code);
  }

  insertRoom(room) {
    const data = JSON.stringify(roomWithoutRequests(room));
    this.s.writeRoom(room.code, room, data);
    this.rooms.set(room.code, { obj: room, data });
    return room;
  }

  deleteRoom(code) {
    this.rooms.delete(code);
    this.q.deleteRoom.run(code);
  }

  request(code, key) {
    const row = this.q.request.get(code, key);
    return row ? JSON.parse(row.data) : null;
  }

  putRequest(code, key, value) {
    this.q.putRequest.run(code, key, JSON.stringify(value));
  }

  clearRequests(code) {
    this.q.clearRequests.run(code);
  }

  flush() {
    for (const [id, entry] of this.accounts) {
      const row = JSON.stringify(accountRowPart(entry.obj));
      if (row !== entry.row) this.s.writeAccountRow(id, entry.obj);
      const archives = JSON.stringify(entry.obj.archives || []);
      if (archives !== entry.archives) this.s.writeArchives(id, entry.obj.archives);
    }
    for (const [code, entry] of this.rooms) {
      const data = JSON.stringify(roomWithoutRequests(entry.obj));
      if (data !== entry.data) this.s.writeRoom(code, entry.obj, data);
    }
  }
}
