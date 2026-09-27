// Export the SQLite online data (accounts, archives, rooms) back to the legacy
// online-data.json format, e.g. before rolling back to a build older than 2026-09-27.
//   node tools/export-online-json.mjs <DATA_DIR> [output file]
// Safe while the server runs (SQLite WAL readers do not block the writer).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { SqliteStore } from '../online/sqlite-store.mjs';
import { DB_FILE, exportLegacyJson } from '../online/store.mjs';

const [dataDir, out] = process.argv.slice(2);
if (!dataDir) {
  console.error('用法：node tools/export-online-json.mjs <DATA_DIR> [输出文件]');
  process.exit(1);
}
const target = out || path.join(dataDir, 'online-data.export.json');
const store = new SqliteStore(path.join(dataDir, DB_FILE));
try {
  const json = exportLegacyJson(store);
  writeFileSync(target, json);
  console.log(`已导出 ${JSON.stringify(store.counts())} → ${target}`);
} finally {
  store.db.close();
}
