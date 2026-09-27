// Worker thread for online/replay-pool.mjs: runs the same claim verification as the
// in-process path and posts back either the validated snapshot or the HttpError status
// and message. Receives only plain JSON ({ id, run, act }). Server-only file: never
// served to browsers (not in the server.mjs whitelist).
import { parentPort } from 'node:worker_threads';
import { verifyClaim } from './claim-verify.mjs';
import { HttpError } from './http-error.mjs';

parentPort.on('message', async ({ id, run, act }) => {
  try {
    const snapshot = await verifyClaim(run, act, { yieldEvery: 0 });
    parentPort.postMessage({ id, ok: true, snapshot });
  } catch (err) {
    if (err instanceof HttpError) parentPort.postMessage({ id, ok: false, status: err.status, message: err.message });
    else parentPort.postMessage({ id, ok: false, internal: String(err?.stack || err) });
  }
});
