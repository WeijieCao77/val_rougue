import { createHash, randomBytes } from 'node:crypto';
import { createMatch, applyCommand, viewFor, validateSnapshot } from './duel.mjs';
import { createWaSeason, waAct, extractCheckpoints } from '../wa-season.js';
import { generateToken, generateRoomCode, sha256 } from './store.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ACTIONS = 5000;
const MAX_ARCHIVES = 10;
const ROOM_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const ROOM_ACTIVE_TIMEOUT_MS = 10 * 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000;
const RATE_LIMIT_MAP_MAX_ENTRIES = 10000;
const ANON_CREATE_IP_LIMIT = 30;
const READ_TOKEN_LIMIT = 600;
const WRITE_TOKEN_LIMIT = 120;

function now() {
  return Date.now();
}

function clone(obj) {
  return obj == null ? obj : structuredClone(obj);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendError(res, err) {
  if (!(err instanceof HttpError)) {
    console.error('API内部错误:', err);
    err = new HttpError(500, '服务器内部错误');
  }
  sendJson(res, err.status, { error: err.message });
}

function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new HttpError(413, '请求体过大'));
        return;
      }
      if (!body) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpError(400, '请求体必须是对象'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, '无效的JSON请求体'));
      }
    });
    req.on('error', reject);
  });
}

function findAccount(data, tokenHash) {
  for (const accountId of Object.keys(data.accounts)) {
    const account = data.accounts[accountId];
    if (account.tokenHash === tokenHash) return account;
  }
  return null;
}

async function requireAccount(store, req) {
  const token = getBearerToken(req);
  if (!token) throw new HttpError(401, '缺少Bearer令牌');
  const tokenHash = sha256(token);
  let account;
  await store.transaction(async (data) => {
    account = findAccount(data, tokenHash);
    if (!account) throw new HttpError(401, '令牌无效');
  });
  return { account, tokenHash };
}

function findRoomByCode(data, code) {
  return data.rooms[code] || null;
}

function getAccountRoom(data, account) {
  if (!account.roomCode) return null;
  return data.rooms[account.roomCode] || null;
}

function getSeatInRoom(room, accountId) {
  return room.members.findIndex(m => m.accountId === accountId);
}

function generateUniqueRoomCode(data) {
  for (let i = 0; i < 100; i++) {
    const code = generateRoomCode();
    if (!data.rooms[code]) return code;
  }
  throw new HttpError(500, '无法生成房间码');
}

function cleanAccount(account) {
  return {
    accountId: account.accountId,
    archives: account.archives.map(archive => ({
      id: archive.id,
      name: archive.name,
      createdAt: archive.createdAt,
      snapshot: archive.snapshot,
    })),
    pending: account.pending ? clone(account.pending) : null,
    roomCode: account.roomCode || null,
  };
}

function publicRoom(room, forSeat) {
  if (!room || !Array.isArray(room.members) || room.members.length === 0 || room.members.length > 2) {
    throw new HttpError(500, '房间数据无效');
  }
  if (forSeat !== 0 && forSeat !== 1) throw new HttpError(400, '无效座位');
  const member = room.members[forSeat];
  if (!member) throw new HttpError(403, '非房间成员');

  let matchView = null;
  if (room.status === 'active' || room.status === 'finished') {
    matchView = viewFor(room.match, forSeat);
  }

  return {
    code: room.code,
    status: room.status,
    seat: forSeat,
    members: room.members.map(m => ({
      seat: m.seat,
      name: m.name || '玩家',
      ready: m.ready,
      act: m.archiveSnapshot ? m.archiveSnapshot.act : null,
      maxHp: m.archiveSnapshot ? m.archiveSnapshot.maxHp : null,
      deckCount: m.archiveSnapshot ? m.archiveSnapshot.deck.length : null,
    })),
    match: matchView,
  };
}

class RateLimiter {
  constructor() {
    this.map = new Map();
    this.timer = setInterval(() => this.cleanup(), RATE_LIMIT_CLEANUP_INTERVAL);
    this.timer.unref?.();
  }

  cleanup() {
    const cutoff = now() - 60 * 1000;
    for (const [key, item] of this.map) {
      if (item.startTime < cutoff) this.map.delete(key);
    }
  }

  check(key, limit) {
    const item = this.map.get(key);
    if (!item) {
      if (this.map.size >= RATE_LIMIT_MAP_MAX_ENTRIES) {
        // simple eviction: delete oldest
        const oldestKey = this.map.keys().next().value;
        this.map.delete(oldestKey);
      }
      this.map.set(key, { startTime: now(), count: 1 });
      return true;
    }
    if (now() - item.startTime > 60 * 1000) {
      item.startTime = now();
      item.count = 1;
      return true;
    }
    item.count++;
    return item.count <= limit;
  }

  close() {
    clearInterval(this.timer);
  }
}

function validateRunId(runId) {
  if (typeof runId !== 'string' || runId.length < 1 || runId.length > 100) {
    throw new HttpError(400, '无效的runId');
  }
}

function validateSeed(seed) {
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 100) {
    throw new HttpError(400, '无效的seed');
  }
}

function validateRegion(region) {
  if (typeof region !== 'string' || region.length < 1 || region.length > 20) {
    throw new HttpError(400, '无效的region');
  }
}

async function yieldToEventLoop() {
  await new Promise(resolve => setImmediate(resolve));
}

async function rebuildSnapshot(run, act) {
  if (!run || typeof run !== 'object') throw new HttpError(400, '无效的运行数据');
  validateRunId(run.runId);
  validateSeed(run.seed);
  validateRegion(run.region);
  if (!Array.isArray(run.actions) || run.actions.length > MAX_ACTIONS) {
    throw new HttpError(400, '无效的行动列表');
  }
  for (const action of run.actions) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      throw new HttpError(400, '无效的行动');
    }
    if (action.type === 'tutorial') {
      throw new HttpError(400, '教程行动不被允许');
    }
  }

  let state;
  try {
    state = createWaSeason(run.seed, false, run.region, run.runId);
  } catch {
    throw new HttpError(400, '无效的运行数据');
  }

  for (let i = 0; i < run.actions.length; i++) {
    if (i % 100 === 0) await yieldToEventLoop();
    const action = run.actions[i];
    try {
      const result = waAct(state, action);
      if (result.error) {
        throw new HttpError(400, '无效的行动序列');
      }
      state = result.state;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, '无效的行动序列');
    }
  }

  const checkpoints = extractCheckpoints(state);
  const checkpoint = checkpoints.find(cp => cp.act === act);
  if (!checkpoint) {
    throw new HttpError(400, '未找到指定幕的检查点');
  }
  return checkpoint;
}

function validateArchiveSnapshot(snapshot) {
  try {
    const validated = validateSnapshot(snapshot);
    validated.deckCount = validated.deck.length;
    return validated;
  } catch {
    throw new HttpError(400, '快照无效');
  }
}

function cleanRoomTimeouts(room, nowTime) {
  if (room.status === 'waiting') {
    if (nowTime - room.createdAt > ROOM_WAIT_TIMEOUT_MS) {
      room.status = 'closed';
      room.closedAt = nowTime;
      for (const member of room.members) {
        const account = this ? (this.accounts ? this.accounts[member.accountId] : null) : null;
        if (account) account.roomCode = null;
      }
      return 'closed';
    }
  } else if (room.status === 'active') {
    if (nowTime - room.lastActionAt > ROOM_ACTIVE_TIMEOUT_MS) {
      const activeSeat = room.match.active;
      room.match = applyCommand(room.match, activeSeat, { type: 'concede' });
      room.status = 'finished';
      room.lastActionAt = nowTime;
      return 'finished';
    }
  }
  return null;
}

function removeAccountFromRoom(account) {
  account.roomCode = null;
}

function isCheckpointProcessed(account, checkpointId) {
  return account.processedCheckpoints && account.processedCheckpoints[checkpointId];
}

function markCheckpointProcessed(account, checkpointId, decision) {
  if (!account.processedCheckpoints) {
    account.processedCheckpoints = Object.create(null);
  }
  account.processedCheckpoints[checkpointId] = { decision, at: now() };
}

function findArchiveById(account, archiveId) {
  return account.archives.find(a => a.id === archiveId);
}

function isArchiveLockedInRoom() {
  return false;
}

export function createOnlineHandler(store) {
  const limiter = new RateLimiter();

  return async function onlineHandler(req, res, url) {
    if (!url.pathname.startsWith('/api/')) {
      return false;
    }

    if (!checkSameOrigin(req)) {
      sendError(res, new HttpError(403, '跨源请求被禁止'));
      return true;
    }

    const clientIp = req.socket.remoteAddress || 'unknown';
    const pathname = url.pathname;
    const method = req.method;

    // Account creation: rate limit by IP (anonymous)
    if (pathname === '/api/account' && method === 'POST') {
      if (!limiter.check(`ip:${clientIp}`, ANON_CREATE_IP_LIMIT)) {
        sendError(res, new HttpError(429, '请求过于频繁'));
        return true;
      }
      try {
        const body = await readJsonBody(req);
        if (Object.keys(body).length !== 0) throw new HttpError(400, '意外的请求体');
        const token = generateToken();
        const tokenHash = sha256(token);
        const accountId = sha256(tokenHash).slice(0, 16);
        await store.transaction(async (data) => {
          data.accounts[accountId] = {
            accountId,
            tokenHash,
            archives: [],
            pending: null,
            processedCheckpoints: Object.create(null),
            roomCode: null,
            createdAt: now(),
          };
        });
        sendJson(res, 201, { token });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    // All other /api endpoints require auth
    let authResult;
    try {
      authResult = await requireAccount(store, req);
    } catch (err) {
      sendError(res, err);
      return true;
    }
    const { account, tokenHash } = authResult;

    // Rate limit authenticated requests by token
    const isRead = method === 'GET';
    const limit = isRead ? READ_TOKEN_LIMIT : WRITE_TOKEN_LIMIT;
    const rateKey = isRead ? `read:${tokenHash}` : `write:${tokenHash}`;
    if (!limiter.check(rateKey, limit)) {
      sendError(res, new HttpError(429, '请求过于频繁'));
      return true;
    }

    if (pathname === '/api/account' && method === 'GET') {
      try {
        let accountData;
        await store.transaction(async (data) => {
          const freshAccount = data.accounts[account.accountId];
          if (!freshAccount) throw new HttpError(401, '令牌无效');
          accountData = cleanAccount(freshAccount);
        });
        sendJson(res, 200, accountData);
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    if (pathname === '/api/archive/claim' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { run, act } = body;
        if (!run || !act) throw new HttpError(400, '缺少run或act');
        const snapshot = await rebuildSnapshot(run, act);
        const validated = validateArchiveSnapshot(snapshot);
        const archiveId = `${validated.runId}:${validated.act}`;

        let resultStatus;
        await store.transaction(async (data) => {
          const acct = data.accounts[account.accountId];
          if (!acct) throw new HttpError(401, '令牌无效');

          if (isCheckpointProcessed(acct, archiveId)) {
            const decision = acct.processedCheckpoints[archiveId].decision;
            resultStatus = decision;
            return;
          }

          if (acct.archives.length < MAX_ARCHIVES) {
            acct.archives.push({
              id: archiveId,
              name: `第${validated.act}幕存档`,
              createdAt: now(),
              snapshot: validated,
            });
            markCheckpointProcessed(acct, archiveId, 'saved');
            resultStatus = 'saved';
          } else {
            if (acct.pending) {
              if (acct.pending.id === archiveId) {
                markCheckpointProcessed(acct, archiveId, 'pending');
                resultStatus = 'pending';
                return;
              }
              throw new HttpError(409, '已有待处理的存档，请先解决');
            }
            acct.pending = {
              id: archiveId,
              name: `第${validated.act}幕存档`,
              createdAt: now(),
              snapshot: validated,
            };
            markCheckpointProcessed(acct, archiveId, 'pending');
            resultStatus = 'pending';
          }
        });

        sendJson(res, 200, { status: resultStatus });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    if (pathname === '/api/archive/resolve' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { decision, archiveId, expectedPendingId } = body;

        await store.transaction(async (data) => {
          const acct = data.accounts[account.accountId];
          if (!acct) throw new HttpError(401, '令牌无效');
          if (!acct.pending) throw new HttpError(409, '没有待处理的存档');
          if (!expectedPendingId || acct.pending.id !== expectedPendingId) {
            throw new HttpError(409, '待处理存档不匹配');
          }

          if (decision === 'discard') {
            acct.pending = null;
            markCheckpointProcessed(acct, expectedPendingId, 'discarded');
          } else if (decision === 'replace') {
            if (!archiveId) throw new HttpError(400, '缺少archiveId');
            const targetIndex = acct.archives.findIndex(a => a.id === archiveId);
            if (targetIndex === -1) throw new HttpError(404, '存档未找到');

            acct.archives[targetIndex] = {
              id: acct.pending.id,
              name: acct.pending.name,
              createdAt: acct.pending.createdAt,
              snapshot: acct.pending.snapshot,
            };
            acct.pending = null;
            markCheckpointProcessed(acct, expectedPendingId, 'replaced');
          } else {
            throw new HttpError(400, '无效的决策');
          }
        });

        sendJson(res, 200, { status: 'ok' });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    if (pathname === '/api/archive/rename' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { archiveId, name } = body;
        if (!archiveId || typeof name !== 'string' || name.length === 0 || name.length > 50) {
          throw new HttpError(400, '无效的archiveId或name');
        }

        await store.transaction(async (data) => {
          const acct = data.accounts[account.accountId];
          if (!acct) throw new HttpError(401, '令牌无效');
          const archive = findArchiveById(acct, archiveId);
          if (!archive) throw new HttpError(404, '存档未找到');
          archive.name = name;
        });

        sendJson(res, 200, { status: 'ok' });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    if (pathname === '/api/rooms' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { archiveId } = body;
        if (!archiveId) throw new HttpError(400, '缺少archiveId');

        let roomResult;
        await store.transaction(async (data) => {
          const acct = data.accounts[account.accountId];
          if (!acct) throw new HttpError(401, '令牌无效');
          const existingRoom = getAccountRoom(data, acct);
          if (existingRoom) {
            cleanRoomTimeouts(existingRoom, now());
            if (existingRoom.status !== 'finished' && existingRoom.status !== 'closed') {
              throw new HttpError(409, '账户已在房间中');
            }
            if (existingRoom.status === 'closed' || existingRoom.status === 'finished') {
              acct.roomCode = null;
            }
          }
          const archive = findArchiveById(acct, archiveId);
          if (!archive) throw new HttpError(404, '存档未找到');
          if (isArchiveLockedInRoom(archive.id)) throw new HttpError(409, '存档锁定中');

          const code = generateUniqueRoomCode(data);
          const validatedSnapshot = archive.snapshot;
          const room = {
            code,
            status: 'waiting',
            createdAt: now(),
            lastActionAt: now(),
            members: [
              {
                seat: 0,
                accountId: acct.accountId,
                name: acct.name || '玩家',
                ready: false,
                archiveId: archive.id,
                archiveSnapshot: clone(validatedSnapshot),
              },
            ],
            match: null,
            seed: null,
            requests: Object.create(null),
          };
          data.rooms[code] = room;
          acct.roomCode = code;
          roomResult = publicRoom(room, 0);
        });

        sendJson(res, 201, { room: roomResult });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    if (pathname === '/api/rooms/join' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { code, archiveId } = body;
        if (!code || !archiveId) throw new HttpError(400, '缺少code或archiveId');

        let roomResult;
        await store.transaction(async (data) => {
          const acct = data.accounts[account.accountId];
          if (!acct) throw new HttpError(401, '令牌无效');
          const existingRoom = getAccountRoom(data, acct);
          if (existingRoom) {
            cleanRoomTimeouts(existingRoom, now());
            if (existingRoom.status !== 'finished' && existingRoom.status !== 'closed') {
              throw new HttpError(409, '账户已在房间中');
            }
            if (existingRoom.status === 'closed' || existingRoom.status === 'finished') {
              acct.roomCode = null;
            }
          }
          const room = findRoomByCode(data, code);
          if (!room) throw new HttpError(404, '房间未找到');
          cleanRoomTimeouts(room, now());
          if (room.status !== 'waiting') throw new HttpError(409, '房间不在等待中');
          if (room.members.length >= 2) throw new HttpError(409, '房间已满');
          if (room.members.some(m => m.accountId === acct.accountId)) {
            throw new HttpError(409, '已在房间中');
          }

          const archive = findArchiveById(acct, archiveId);
          if (!archive) throw new HttpError(404, '存档未找到');
          if (isArchiveLockedInRoom(archive.id)) throw new HttpError(409, '存档锁定中');

          const hostSnapshot = room.members[0].archiveSnapshot;
          if (hostSnapshot.act !== archive.snapshot.act || hostSnapshot.version !== archive.snapshot.version) {
            throw new HttpError(409, '存档幕数或版本不匹配');
          }

          const seat = room.members.length;
          room.members.push({
            seat,
            accountId: acct.accountId,
            name: acct.name || '玩家',
            ready: false,
            archiveId: archive.id,
            archiveSnapshot: clone(archive.snapshot),
          });
          acct.roomCode = code;
          room.lastActionAt = now();
          roomResult = publicRoom(room, seat);
        });

        sendJson(res, 200, { room: roomResult });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    const roomMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]{6,8})$/);
    if (roomMatch && method === 'GET') {
      const code = roomMatch[1];
      try {
        let roomResponse;
        await store.transaction(async (data) => {
          const room = findRoomByCode(data, code);
          if (!room) throw new HttpError(404, '房间未找到');
          const seat = getSeatInRoom(room, account.accountId);
          if (seat === -1) throw new HttpError(403, '非房间成员');
          const timeoutResult = cleanRoomTimeouts(room, now());
          if (timeoutResult === 'closed') {
            throw new HttpError(404, '房间已关闭');
          }
          roomResponse = publicRoom(room, seat);
        });
        sendJson(res, 200, { room: roomResponse });
      } catch (err) {
        sendError(res, err);
      }
      return true;
    }

    const roomActionMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]{6,8})\/(ready|action|leave)$/);
    if (roomActionMatch && method === 'POST') {
      const code = roomActionMatch[1];
      const action = roomActionMatch[2];

      try {
        const body = await readJsonBody(req);

        if (action === 'ready') {
          const { ready } = body;
          if (typeof ready !== 'boolean') throw new HttpError(400, '无效的ready值');

          // Pre-clean target room in its own transaction so cleanup persists if later action fails
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (room) {
              cleanRoomTimeouts(room, now());
            }
          });

          let roomResponse;
          let errorResponse = null;
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (!room) throw new HttpError(404, '房间未找到');
            const seat = getSeatInRoom(room, account.accountId);
            if (seat === -1) throw new HttpError(403, '非房间成员');
            if (room.status === 'closed') {
              errorResponse = new HttpError(409, '房间已过期');
              return;
            }
            if (room.status === 'finished') {
              roomResponse = publicRoom(room, seat);
              return;
            }
            if (room.status !== 'waiting') throw new HttpError(409, '房间不在等待中');

            room.members[seat].ready = ready;
            room.lastActionAt = now();

            if (room.members.length === 2 && room.members.every(m => m.ready)) {
              room.seed = randomBytes(16).toString('hex');
              room.match = createMatch(
                room.members[0].archiveSnapshot,
                room.members[1].archiveSnapshot,
                room.seed
              );
              room.status = 'active';
              room.startedAt = now();
              room.lastActionAt = now();
            }
            roomResponse = publicRoom(room, seat);
          });

          if (errorResponse) {
            sendError(res, errorResponse);
          } else {
            sendJson(res, 200, { room: roomResponse });
          }
          return true;
        }

        if (action === 'action') {
          const { requestId, expectedRev, command } = body;

          // Pre-clean target room to persist cleanup even if action fails
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (room) {
              cleanRoomTimeouts(room, now());
            }
          });
          if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 100) {
            throw new HttpError(400, '无效的请求ID');
          }
          if (requestId === '__proto__' || requestId === 'constructor' || requestId === 'prototype') {
            throw new HttpError(400, '无效的请求ID');
          }
          if (typeof expectedRev !== 'number' || !Number.isInteger(expectedRev) || expectedRev < 0) {
            throw new HttpError(400, '无效的修订号');
          }
          if (!command || typeof command !== 'object') {
            throw new HttpError(400, '无效的命令');
          }

          let roomResponse;
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (!room) throw new HttpError(404, '房间未找到');
            const seat = getSeatInRoom(room, account.accountId);
            if (seat === -1) throw new HttpError(403, '非房间成员');

            const requestKey = `${account.accountId}:${seat}:${requestId}`;
            if (room.requests[requestKey]) {
              if (JSON.stringify(room.requests[requestKey].command) !== JSON.stringify(command)) {
                throw new HttpError(409, '请求ID已被使用');
              }
              roomResponse = publicRoom(room, seat);
              return;
            }

            if (room.status === 'closed') {
              throw new HttpError(404, '房间已关闭');
            }
            if (room.status === 'finished') {
              roomResponse = publicRoom(room, seat);
              return;
            }
            if (room.status !== 'active') {
              throw new HttpError(409, '房间不在对战中');
            }

            if (room.match.rev !== expectedRev) {
              throw new HttpError(409, '修订号不匹配');
            }

            let newMatch;
            try {
              newMatch = applyCommand(room.match, seat, command);
            } catch (err) {
              throw new HttpError(400, err.message || '无效的操作');
            }
            room.match = newMatch;
            room.requests[requestKey] = { command: clone(command), rev: newMatch.rev };
            room.lastActionAt = now();
            if (newMatch.status === 'finished') {
              room.status = 'finished';
            }
            roomResponse = publicRoom(room, seat);
          });

          sendJson(res, 200, { room: roomResponse });
          return true;
        }

        if (action === 'leave') {
          // Pre-clean target room to persist cleanup even if leave fails
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (room) {
              cleanRoomTimeouts(room, now());
            }
          });

          let roomResponse;
          await store.transaction(async (data) => {
            const room = findRoomByCode(data, code);
            if (!room) throw new HttpError(404, '房间未找到');
            const seat = getSeatInRoom(room, account.accountId);
            if (seat === -1) throw new HttpError(403, '非房间成员');
            const acct = data.accounts[account.accountId];
            if (!acct) throw new HttpError(401, '令牌无效');

            if (room.status === 'waiting') {
              room.members.splice(seat, 1);
              room.members.forEach((m, idx) => { m.seat = idx; });
              acct.roomCode = null;
              if (room.members.length === 0) {
                delete data.rooms[code];
                roomResponse = null;
              } else {
                roomResponse = publicRoom(room, room.members[0].seat);
              }
            } else if (room.status === 'active') {
              room.match = applyCommand(room.match, seat, { type: 'concede' });
              room.status = 'finished';
              room.lastActionAt = now();
              acct.roomCode = null;
              roomResponse = publicRoom(room, seat);
            } else {
              roomResponse = publicRoom(room, seat);
              acct.roomCode = null;
            }
          });

          if (roomResponse) {
            sendJson(res, 200, { room: roomResponse });
          } else {
            sendJson(res, 200, { room: null });
          }
          return true;
        }
      } catch (err) {
        sendError(res, err);
        return true;
      }
    }

    sendError(res, new HttpError(404, '接口未找到'));
    return true;
  };
}
