// Friend PvP: 再来一局 (rematch in the same room) and the server-enforced turn timer
// (auto end turn on expiry, lazy catch-up, AFK loss after repeated auto-ended turns).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore, sha256 } from '../online/store.mjs';
import { createOnlineHandler, PVP_TURN_MS, PVP_AFK_LIMIT } from '../online/api.mjs';
import { createMatch, applyCommand, viewFor } from '../online/duel.mjs';

const SNAP = {
  version: 'wa-pvp-1', runId: 'rm-run', act: 1, seed: 'rm-seed', region: 'CN',
  deck: [
    { uid: 'c1', id: 'CN01', up: true }, { uid: 'c2', id: 'CN07', up: false }, { uid: 'c3', id: 'CN14', up: true },
    { uid: 'c4', id: 'CN01', up: false }, { uid: 'c5', id: 'CN07', up: true }, { uid: 'c6', id: 'CN01', up: false },
    { uid: 'c7', id: 'CN07', up: false }, { uid: 'c8', id: 'CN14', up: false },
  ],
  skins: [], maxHp: 80, hp: 80, money: 0, actionsCount: 0,
};

async function request(handler, { method = 'GET', path: p = '/', token = null, body = null } = {}) {
  const req = {
    method, url: p, headers: {}, socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) {
      if (event === 'data' && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    },
  };
  if (token) req.headers.authorization = `Bearer ${token}`;
  const res = { statusCode: 0, body: '', writeHead(s) { this.statusCode = s; }, end(d) { this.body = d || ''; } };
  await handler(req, res, new URL(p, 'http://localhost'));
  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch {}
  return { status: res.statusCode, body: parsed };
}

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'wa-rm-'));
  const store = await openStore({ dataDir: dir });
  const clock = { t: 1_800_000_000_000 };
  const handler = createOnlineHandler(store, { now: () => clock.t, turnMs: PVP_TURN_MS });
  const account = async (archiveId) => {
    const token = (await request(handler, { method: 'POST', path: '/api/account' })).body.token;
    await store.transaction(async data => {
      const a = Object.values(data.accounts).find(x => x.tokenHash === sha256(token));
      a.archives.push({ id: archiveId, name: '测试', createdAt: clock.t, snapshot: { ...SNAP, runId: archiveId } });
    });
    return token;
  };
  const A = await account('arcA'), B = await account('arcB');
  const code = (await request(handler, { method: 'POST', path: '/api/rooms', token: A, body: { archiveId: 'arcA' } })).body.room.code;
  await request(handler, { method: 'POST', path: '/api/rooms/join', token: B, body: { code, archiveId: 'arcB' } });
  await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: A, body: { ready: true } });
  const started = await request(handler, { method: 'POST', path: `/api/rooms/${code}/ready`, token: B, body: { ready: true } });
  assert.equal(started.body.room.status, 'active');
  const get = tok => request(handler, { path: `/api/rooms/${code}`, token: tok });
  const post = (tok, what, body) => request(handler, { method: 'POST', path: `/api/rooms/${code}/${what}`, token: tok, body });
  const tokenOfSeat = seat => (seat === 0 ? A : B); // A created the room (seat 0)
  return { dir, store, handler, clock, A, B, code, get, post, tokenOfSeat, account, startedAt: clock.t };
}
const teardown = async ({ dir, store }) => { await store.close(); await rm(dir, { recursive: true, force: true }); };

async function finishByConcede(ctx, loserToken = ctx.A) {
  const r = (await ctx.get(loserToken)).body.room;
  const res = await ctx.post(loserToken, 'action', { requestId: 'cc' + r.match.rev + Math.random(), expectedRev: r.match.rev, command: { type: 'concede' } });
  assert.equal(res.body.room.status, 'finished');
  return res.body.room;
}

test('rematch: request, the other accepts, same room starts a new match and the other player goes first', async () => {
  const ctx = await setup();
  try {
    const before = (await ctx.get(ctx.A)).body.room;
    const firstBefore = before.match.active; // turn 1: the active seat opened
    assert.equal(before.round, 1);
    const store0 = await ctx.store.transaction(async d => structuredClone(d.rooms[ctx.code]));
    await finishByConcede(ctx);
    const firstRecord=(await request(ctx.handler,{path:'/api/account',token:ctx.B})).body.pvp;
    assert.equal(firstRecord.wins,1);
    assert.equal(firstRecord.records.length,1);

    const req = await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    assert.equal(req.status, 200);
    assert.equal(req.body.room.rematch.status, 'pending');
    assert.equal(req.body.room.rematch.from, 0);
    // Asking again is idempotent.
    const again = await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    assert.equal(again.body.room.rematch.status, 'pending');
    // The previous match (and its stats) stays visible until the new one starts.
    const seen = (await ctx.get(ctx.B)).body.room;
    assert.equal(seen.status, 'finished');
    assert.equal(seen.rematch.status, 'pending');
    assert.equal(seen.rematch.from, 0);
    assert.ok(seen.match.stats);

    const acc = await ctx.post(ctx.B, 'rematch', { op: 'accept', round: 1 });
    assert.equal(acc.status, 200);
    const room = acc.body.room;
    assert.equal(room.status, 'active');
    assert.equal(room.round, 2);
    const afterRematch=(await request(ctx.handler,{path:'/api/account',token:ctx.B})).body.pvp;
    assert.equal(afterRematch.wins,1,'starting a rematch must not count the previous round twice');
    assert.equal(room.rematch, null);
    assert.equal(room.match.rev, 0);
    assert.equal(room.match.turn, 1);
    assert.equal(room.match.active, 1 - firstBefore, 'the other player opens the rematch');
    assert.equal(room.match.you.hp, SNAP.maxHp);
    const stored = await ctx.store.transaction(async d => structuredClone(d.rooms[ctx.code]));
    assert.notEqual(stored.seed, store0.seed, 'a fresh server seed');
    assert.deepEqual(stored.members.map(m => m.archiveId), ['arcA', 'arcB']);
    assert.ok(stored.timer.endsAt, 'the new match is timed');

    // A late duplicate accept for round 1 does not start yet another match.
    const dup = await ctx.post(ctx.A, 'rematch', { op: 'accept', round: 1 });
    assert.equal(dup.status, 200);
    assert.equal(dup.body.room.round, 2);
    const stored2 = await ctx.store.transaction(async d => structuredClone(d.rooms[ctx.code]));
    assert.equal(stored2.seed, stored.seed);

    // Round 3 swaps back.
    await finishByConcede(ctx, ctx.B);
    const twoRounds=(await request(ctx.handler,{path:'/api/account',token:ctx.A})).body.pvp;
    assert.equal(twoRounds.played,2);
    assert.equal(twoRounds.records.length,2);
    assert.equal(twoRounds.records[0].round,2);
    await ctx.post(ctx.B, 'rematch', { op: 'request', round: 2 });
    const third = (await ctx.post(ctx.A, 'rematch', { op: 'request', round: 2 })).body.room;
    assert.equal(third.round, 3);
    assert.equal(third.match.active, firstBefore);
  } finally { await teardown(ctx); }
});

test('rematch: decline, cancel, expiry and re-request', async () => {
  const ctx = await setup();
  try {
    await finishByConcede(ctx);
    await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    const dec = await ctx.post(ctx.B, 'rematch', { op: 'decline', round: 1 });
    assert.equal(dec.body.room.rematch.status, 'declined');
    assert.equal((await ctx.get(ctx.A)).body.room.rematch.status, 'declined');
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'accept', round: 1 })).status, 409, 'nothing to accept');
    // Asking again after a refusal is allowed; the requester can cancel.
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 })).body.room.rematch.status, 'pending');
    assert.equal((await ctx.post(ctx.B, 'rematch', { op: 'cancel', round: 1 })).body.room.rematch.status, 'pending', 'only the requester cancels');
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'cancel', round: 1 })).body.room.rematch.status, 'cancelled');
    // An unanswered request lapses.
    await ctx.post(ctx.B, 'rematch', { op: 'request', round: 1 });
    ctx.clock.t += 61_000;
    const late = (await ctx.get(ctx.A)).body.room;
    assert.equal(late.rematch.status, 'expired');
    assert.equal(late.status, 'finished');
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'accept', round: 1 })).status, 409);
  } finally { await teardown(ctx); }
});

test('rematch: non-members, unfinished rooms, departed opponents and deleted archives are rejected', async () => {
  const ctx = await setup();
  try {
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 })).status, 409, 'match still running');
    await finishByConcede(ctx);
    const C = await ctx.account('arcC');
    assert.equal((await ctx.post(C, 'rematch', { op: 'request', round: 1 })).status, 403);
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'bogus', round: 1 })).status, 400);

    // Deleted archive.
    await ctx.store.transaction(async d => { Object.values(d.accounts).find(a => a.tokenHash === sha256(ctx.B)).archives = []; });
    const gone = await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    assert.equal(gone.status, 409);
    assert.match(gone.body.error, /构筑/);
    await ctx.store.transaction(async d => { Object.values(d.accounts).find(a => a.tokenHash === sha256(ctx.B)).archives = [{ id: 'arcB', name: 'x', createdAt: 1, snapshot: { ...SNAP, runId: 'arcB' } }]; });

    // Pending request, then the requester's opponent leaves: the requester is told.
    await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    const left = await ctx.post(ctx.B, 'leave', {});
    assert.equal(left.status, 200);
    const seen = (await ctx.get(ctx.A)).body.room;
    assert.equal(seen.rematch.status, 'left');
    assert.equal(seen.members[1].left, true);
    assert.equal((await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 })).status, 409);
    assert.equal((await ctx.post(ctx.B, 'rematch', { op: 'accept', round: 1 })).status, 409, 'left players cannot come back through rematch');
  } finally { await teardown(ctx); }
});

test('rematch: an opponent who moved to another room cannot be pulled back', async () => {
  const ctx = await setup();
  try {
    await finishByConcede(ctx);
    // B creates a new room from the finished one (新建房间 without pressing 返回 first).
    const created = await request(ctx.handler, { method: 'POST', path: '/api/rooms', token: ctx.B, body: { archiveId: 'arcB' } });
    assert.equal(created.status, 201);
    const res = await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    assert.equal(res.status, 409);
    assert.equal((await ctx.get(ctx.A)).body.room.members[1].left, true);
  } finally { await teardown(ctx); }
});

test('timer: the room tells the client when the turn ends and the server time', async () => {
  const ctx = await setup();
  try {
    const r = (await ctx.get(ctx.A)).body.room;
    assert.equal(r.now, ctx.clock.t);
    assert.equal(r.timer.endsAt, ctx.startedAt + PVP_TURN_MS);
    assert.equal(r.timer.seat, r.match.active);
    assert.equal(r.timer.limit, PVP_TURN_MS);
    assert.deepEqual(r.timer.afk, [0, 0]);
    assert.equal(r.timer.afkLimit, PVP_AFK_LIMIT);
    assert.equal(PVP_TURN_MS, 75000);
  } finally { await teardown(ctx); }
});

test('timer: an expired turn is ended by the server on the next poll, not lost', async () => {
  const ctx = await setup();
  try {
    const r0 = (await ctx.get(ctx.A)).body.room;
    const s = r0.match.active;
    ctx.clock.t = ctx.startedAt + PVP_TURN_MS - 1;
    assert.equal((await ctx.get(ctx.A)).body.room.match.rev, r0.match.rev, 'still running one ms before');
    ctx.clock.t = ctx.startedAt + PVP_TURN_MS;
    const r1 = (await ctx.get(ctx.B)).body.room;
    assert.equal(r1.status, 'active');
    assert.equal(r1.match.active, 1 - s);
    assert.equal(r1.match.turn, 2);
    const end = r1.match.history.find(e => e.kind === 'end');
    assert.equal(end.seat, s);
    assert.equal(end.auto, true);
    assert.equal(end.afk, 1);
    assert.equal(end.results.draw, 5, 'the normal end-turn path: next hand drawn at end of turn');
    assert.equal(r1.timer.endsAt, ctx.startedAt + 2 * PVP_TURN_MS, 'next turn starts when the last one expired');
    assert.equal(r1.timer.afk[s], 1);
    // A late command from the timed-out player fails on the revision.
    const late = await ctx.post(ctx.tokenOfSeat(s), 'action', { requestId: 'late', expectedRev: r0.match.rev, command: { type: 'end' } });
    assert.equal(late.status, 409);
    // A client cannot fake an auto end.
    const other = ctx.tokenOfSeat(1 - s);
    const manual = await ctx.post(other, 'action', { requestId: 'm1', expectedRev: r1.match.rev, command: { type: 'end', auto: true } });
    assert.equal(manual.status, 200);
    const mEnd = manual.body.room.match.history.filter(e => e.kind === 'end').at(-1);
    assert.equal(mEnd.seat, 1 - s);
    assert.equal(mEnd.auto, undefined);
    assert.equal(manual.body.room.timer.endsAt, ctx.clock.t + PVP_TURN_MS, 'a manual end restarts the clock from now');
  } finally { await teardown(ctx); }
});

test('timer: catches up over several expired turns in one request', async () => {
  const ctx = await setup();
  try {
    const s = (await ctx.get(ctx.A)).body.room.match.active;
    ctx.clock.t = ctx.startedAt + 2 * PVP_TURN_MS + 1000;
    const r = (await ctx.get(ctx.A)).body.room;
    assert.equal(r.status, 'active');
    assert.equal(r.match.turn, 3);
    assert.equal(r.match.active, s);
    const ends = r.match.history.filter(e => e.kind === 'end');
    assert.deepEqual(ends.map(e => [e.seat, e.auto, e.afk]), [[s, true, 1], [1 - s, true, 1]]);
    assert.equal(r.timer.endsAt, ctx.startedAt + 3 * PVP_TURN_MS);
    assert.deepEqual(r.timer.afk, [1, 1]);
  } finally { await teardown(ctx); }
});

test(`timer: ${PVP_AFK_LIMIT} auto-ended turns in a row lose by 超时判负; acting resets the count`, async () => {
  const ctx = await setup();
  try {
    const s = (await ctx.get(ctx.A)).body.room.match.active;
    // s: auto(1); other: acts itself (ends manually) -> its count stays 0.
    ctx.clock.t = ctx.startedAt + PVP_TURN_MS;
    let r = (await ctx.get(ctx.A)).body.room;
    const other = ctx.tokenOfSeat(1 - s);
    r = (await ctx.post(other, 'action', { requestId: 'o1', expectedRev: r.match.rev, command: { type: 'end' } })).body.room;
    assert.deepEqual([r.timer.afk[s], r.timer.afk[1 - s]], [1, 0]);
    // Now nobody touches the room: s auto(2), other auto(1), s auto(3) -> s loses.
    const t0 = ctx.clock.t;
    ctx.clock.t = t0 + 3 * PVP_TURN_MS;
    r = (await ctx.get(other)).body.room;
    assert.equal(r.status, 'finished');
    assert.equal(r.match.winner, 1 - s);
    assert.equal(r.match.endReason, 'timeout');
    const ends = r.match.history.filter(e => e.kind === 'end' && e.auto);
    assert.deepEqual(ends.map(e => [e.seat, e.afk]), [[s, 1], [s, 2], [1 - s, 1], [s, 3]]);
    assert.equal(r.match.history.at(-1).kind, 'result');
    assert.equal(r.timer, null);
    // Further time passing changes nothing.
    ctx.clock.t += 10 * PVP_TURN_MS;
    assert.equal((await ctx.get(other)).body.room.match.rev, r.match.rev);
  } finally { await teardown(ctx); }
});

test('timer: a match stored before the timer keeps working and is timed from its next turn', async () => {
  const ctx = await setup();
  try {
    await ctx.store.transaction(async d => { delete d.rooms[ctx.code].timer; delete d.rooms[ctx.code].firstSeat; delete d.rooms[ctx.code].round; });
    ctx.clock.t += 5 * PVP_TURN_MS; // long past a would-be deadline, still under the old 10-minute rule
    let r = (await ctx.get(ctx.A)).body.room;
    assert.equal(r.status, 'active');
    assert.equal(r.match.turn, 1, 'the untimed current turn is not auto-ended');
    assert.equal(r.timer.endsAt, null);
    assert.equal(r.round, 1);
    const s = r.match.active;
    r = (await ctx.post(ctx.tokenOfSeat(s), 'action', { requestId: 'e1', expectedRev: r.match.rev, command: { type: 'end' } })).body.room;
    assert.equal(r.timer.endsAt, ctx.clock.t + PVP_TURN_MS, 'the next turn is timed');
    ctx.clock.t += PVP_TURN_MS;
    r = (await ctx.get(ctx.A)).body.room;
    assert.equal(r.match.turn, 3);
    assert.equal(r.match.history.filter(e => e.auto).length, 1);
    // Rematch of an old room still works and swaps the opener found in its history.
    const opener = r.match.history.find(e => e.kind === 'turn').seat;
    await finishByConcede(ctx);
    await ctx.post(ctx.A, 'rematch', { op: 'request', round: 1 });
    const re = (await ctx.post(ctx.B, 'rematch', { op: 'accept', round: 1 })).body.room;
    assert.equal(re.match.active, 1 - opener);
  } finally { await teardown(ctx); }
});

test('timer: the old 10-minute inactivity rule still ends an untimed stored match', async () => {
  const ctx = await setup();
  try {
    await ctx.store.transaction(async d => { delete d.rooms[ctx.code].timer; });
    ctx.clock.t += 11 * 60 * 1000;
    const r = (await ctx.get(ctx.A)).body.room;
    assert.equal(r.status, 'finished');
    assert.equal(r.match.endReason, 'timeout');
  } finally { await teardown(ctx); }
});

// ------------------------------------------------ trait counter display
test('trait counter: a waiting seat shows its per-turn counter as it will be at its next turn start', () => {
  const snap = (runId) => ({ ...SNAP, runId });
  const m = createMatch(snap('P'), snap('Q'), 'trait-view');
  const s = m.active;
  m.players[s].tt = { roles: ['决斗', '哨位'], dmg: 2, cnDone: false, emeaDrew: false };
  assert.equal(viewFor(m, s).you.trait.roles, 2, 'live during my own turn');
  assert.equal(viewFor(m, 1 - s).opponent.trait.roles, 2);
  const next = applyCommand(m, s, { type: 'end' });
  assert.deepEqual(next.players[s].tt.roles, ['决斗', '哨位'], 'rules untouched: state resets only at turn start');
  const mine = viewFor(next, s).you.trait;
  assert.equal(mine.roles, 0);
  assert.match(mine.counter, /^0\//);
  assert.equal(viewFor(next, 1 - s).opponent.trait.roles, 0);
});
