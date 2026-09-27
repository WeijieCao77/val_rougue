// Worker pool for claim verification (node:worker_threads, no dependencies).
// A claim replays a whole Wa season act (~0.4 s CPU); running it here keeps the main
// thread free for PvP polling and every other request.
//
// - size: min(available CPUs - 1, 4), at least 1. Workers start on demand and are
//   terminated after `idleMs` without work, so a quiet server holds no extra heaps.
// - Bounded queue: when every worker is busy and `maxQueue` jobs are already waiting,
//   verify() rejects at once with 503 服务器繁忙，请稍后再试 + Retry-After.
// - Per-job timeout (counted from the moment a worker picks the job up): the worker is
//   terminated and replaced, the job answers 503 (same message).
// - A crashed worker is replaced; its job fails with a plain Error, so the API answers
//   500 服务器内部错误 exactly as an unexpected in-process exception would.
// - close() rejects waiting jobs and terminates all workers (SIGTERM on deploy).
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { HttpError } from './http-error.mjs';

export const BUSY_MESSAGE = '服务器繁忙，请稍后再试';

export function defaultPoolSize() {
  return Math.max(1, Math.min(availableParallelism() - 1, 4));
}

export function createReplayPool({
  size = defaultPoolSize(),
  maxQueue = 50,
  timeoutMs = 15000,
  retryAfterSec = 5,
  idleMs = 60000,
  workerUrl = new URL('./replay-worker.mjs', import.meta.url),
  // Caps each worker's heap so a hostile payload cannot take the whole instance down.
  resourceLimits = { maxOldGenerationSizeMb: 256 },
} = {}) {
  const slots = new Set();
  const queue = [];
  let nextId = 1;
  let closed = false;
  const stats = { completed: 0, rejectedBusy: 0, timeouts: 0, crashes: 0 };
  const busy = () => new HttpError(503, BUSY_MESSAGE, { 'Retry-After': String(retryAfterSec) });
  const idleSlot = () => [...slots].find(s => !s.job && !s.dead);

  function spawn() {
    const slot = { worker: new Worker(workerUrl, { resourceLimits }), job: null, timer: null, dead: false };
    const { worker } = slot;
    worker.unref(); // idle workers never keep the process alive; ref()'d while busy
    worker.on('message', msg => {
      const job = slot.job;
      if (!job || msg?.id !== job.id) return;
      release(slot);
      stats.completed++;
      if (msg.ok) job.resolve(msg.snapshot);
      else if (msg.internal !== undefined) job.reject(new Error(`replay worker: ${msg.internal}`));
      else job.reject(new HttpError(msg.status, msg.message));
      pump();
    });
    const onDeath = reason => {
      if (slot.dead) return;
      slot.dead = true;
      slots.delete(slot);
      const job = slot.job;
      if (job) {
        clearTimeout(slot.timer);
        slot.job = null;
        if (job.timedOut) job.reject(busy());
        else {
          stats.crashes++;
          job.reject(new Error(`replay worker died: ${reason?.message || reason}`));
        }
      }
      if (!closed) pump();
    };
    worker.on('error', onDeath);
    worker.on('exit', code => onDeath(`exit code ${code}`));
    slots.add(slot);
    return slot;
  }

  function release(slot) {
    clearTimeout(slot.timer);
    slot.timer = null;
    slot.job = null;
    slot.worker.unref();
    // An idle worker holds ~100 MB (its own V8 heap); give it back after a quiet spell.
    slot.idleTimer = setTimeout(() => {
      if (slot.job || slot.dead) return;
      slot.dead = true;
      slots.delete(slot);
      slot.worker.terminate();
    }, idleMs);
    slot.idleTimer.unref();
  }

  function dispatch(slot, job) {
    clearTimeout(slot.idleTimer);
    slot.job = job;
    slot.worker.ref();
    slot.timer = setTimeout(() => {
      job.timedOut = true;
      stats.timeouts++;
      slot.worker.terminate(); // 'exit' rejects the job; a fresh worker takes the queue
    }, timeoutMs);
    slot.worker.postMessage({ id: job.id, run: job.run, act: job.act });
  }

  function pump() {
    while (queue.length) {
      const slot = idleSlot() || (slots.size < size ? spawn() : null);
      if (!slot) return;
      dispatch(slot, queue.shift());
    }
  }

  function verify(run, act) {
    if (closed) return Promise.reject(busy());
    const canStart = idleSlot() || slots.size < size;
    if (!canStart && queue.length >= maxQueue) {
      stats.rejectedBusy++;
      return Promise.reject(busy());
    }
    return new Promise((resolve, reject) => {
      queue.push({ id: nextId++, run, act, resolve, reject, timedOut: false });
      pump();
    });
  }

  async function close() {
    closed = true;
    for (const s of slots) clearTimeout(s.idleTimer);
    for (const job of queue.splice(0)) job.reject(busy());
    await Promise.all([...slots].map(s => s.worker.terminate()));
  }

  return {
    verify,
    close,
    get size() { return size; },
    get workers() { return slots.size; },
    get queued() { return queue.length; },
    stats,
  };
}
