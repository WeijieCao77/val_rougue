import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const DATA_VERSION = 1;

function createEmptyData() {
  return { version: DATA_VERSION, accounts: {}, rooms: {} };
}

function normalizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return createEmptyData();
  const accounts = data.accounts && typeof data.accounts === 'object' && !Array.isArray(data.accounts) ? data.accounts : {};
  const rooms = data.rooms && typeof data.rooms === 'object' && !Array.isArray(data.rooms) ? data.rooms : {};
  return { version: DATA_VERSION, accounts, rooms };
}

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

class FileStore {
  constructor(dataDir, fsWrite = writeFile) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'online-data.json');
    this.mutex = Promise.resolve();
    this._writeFile = fsWrite;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    try {
      this.current = normalizeData(JSON.parse(await readFile(this.filePath, 'utf8')));
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.current = createEmptyData();
        await this.persist(this.current);
      } else {
        throw err;
      }
    }
  }

  async persist(nextData) {
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await this._writeFile(tmpPath, JSON.stringify(nextData), 'utf8');
    await rename(tmpPath, this.filePath);
  }

  async transaction(fn) {
    const run = async () => {
      const before = JSON.stringify(this.current);
      const data = normalizeData(JSON.parse(before));
      const result = await fn(data);
      const normalized = normalizeData(data);
      const after = JSON.stringify(normalized);
      if (after !== before) {
        await this.persist(normalized);
        this.current = normalized;
      }
      return result;
    };
    const p = this.mutex.then(run, run);
    this.mutex = p.catch(() => {});
    return p;
  }

  async close() {}
}

class PgStore {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.sql = postgres(databaseUrl, { max: 10 });
  }

  async init() {
    await this.sql`CREATE TABLE IF NOT EXISTS online_state (
      id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await this.sql`INSERT INTO online_state (id, data) VALUES (TRUE, ${this.sql.json(createEmptyData())}) ON CONFLICT (id) DO NOTHING`;
  }

  async transaction(fn) {
    return this.sql.begin(async (sql) => {
      const rows = await sql`SELECT data FROM online_state WHERE id = TRUE FOR UPDATE`;
      const data = normalizeData(rows[0]?.data);
      const result = await fn(data);
      const normalized = normalizeData(data);
      await sql`UPDATE online_state SET data = ${sql.json(normalized)}, updated_at = NOW() WHERE id = TRUE`;
      return result;
    });
  }

  async close() {
    await this.sql.end({ timeout: 5 });
  }
}

export async function openStore({
  databaseUrl = process.env.DATABASE_URL,
  dataDir = process.env.DATA_DIR,
  _fsWrite,
} = {}) {
  const isProduction = process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT_ID ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_NAME;

  if (databaseUrl) {
    const store = new PgStore(databaseUrl);
    await store.init();
    return {
      transaction: store.transaction.bind(store),
      close: store.close.bind(store),
      isPostgres: true,
    };
  }

  const explicitDataDir = dataDir !== undefined && dataDir !== '';
  if (isProduction && !explicitDataDir) {
    throw new Error('生产环境必须配置 DATABASE_URL 或 DATA_DIR 持久卷');
  }

  const finalDataDir = explicitDataDir ? dataDir : '.local-data';
  const store = new FileStore(finalDataDir, _fsWrite);
  await store.init();
  if (!isProduction) {
    console.warn('使用文件存储（仅限单进程开发）。生产环境请配置 DATABASE_URL 或 DATA_DIR。');
  }
  return {
    transaction: store.transaction.bind(store),
    close: store.close.bind(store),
    isPostgres: false,
    _fileStore: store,
  };
}
