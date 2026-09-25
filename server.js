'use strict';

/**
 * M2C Integration Boat Trip Challenge Extravaganza
 * Zero-dependency Node HTTP server.
 *
 * Transport: HTTP long-polling. One held GET /api/state per client, released the
 * instant the authoritative state version changes. No WebSocket upgrade, so this
 * survives corporate proxies, guest wifi and mobile networks without special config.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Optional. Set ADMIN_KEY and the helm is reserved for whoever holds that key,
// reachable at /?key=<value>. Leave it unset and the old behaviour stands:
// first person to type "admin" takes the helm.
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const TOTAL_GAMES = 30;      // size of the minigame pool
const GAMES_TO_FINISH = 20;  // completions required to cross the finish line

// Presence invariant: PRESENCE_GRACE_MS must comfortably exceed POLL_TIMEOUT_MS.
// A client parked in a long poll sends nothing while it waits, so a grace period
// shorter than the poll hold marks connected players as gone.
const POLL_TIMEOUT_MS = 20000;   // how long a poll is parked before returning
const PRESENCE_GRACE_MS = 30000; // no contact for this long => shown as offline
const DROP_AFTER_MS = 75000;     // no contact for this long => removed entirely

if (PRESENCE_GRACE_MS <= POLL_TIMEOUT_MS) {
  throw new Error('PRESENCE_GRACE_MS must be greater than POLL_TIMEOUT_MS');
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  version: 1,
  phase: 'LOBBY',          // LOBBY | RACING | SCOREBOARD
  adminId: null,
  roundStartedAt: null,
  roundEndedAt: null,
  results: [],
  players: new Map()
};

let waiters = [];

function releaseWaiter(w, send) {
  if (w.released) return;
  w.released = true;
  clearTimeout(w.timer);
  const p = state.players.get(w.playerId);
  if (p && p.parked > 0) p.parked--;
  if (send) {
    try { sendJson(w.res, 200, snapshotFor(w.playerId)); }
    catch (_) { /* client vanished */ }
  }
}

function bump() {
  state.version++;
  const due = waiters;
  waiters = [];
  for (const w of due) releaseWaiter(w, true);
}

function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createPlayer() {
  return {
    id: newId(),
    name: '',
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    parked: 0,
    inRound: false,
    deck: [],
    current: null,
    completed: 0,
    skipped: 0,
    finishedAt: null,
    rank: null
  };
}

function isAdmin(p) {
  return !!p && state.adminId === p.id;
}

function racers() {
  return [...state.players.values()].filter(p => p.inRound);
}

function online(p) {
  if (!p) return false;
  if (p.parked > 0) return true;                       // holding an open long poll
  return Date.now() - p.lastSeen < PRESENCE_GRACE_MS;
}

// ---------------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------------

function startRound() {
  if (state.phase !== 'LOBBY') return;

  const eligible = [...state.players.values()]
    .filter(p => p.name && !isAdmin(p) && online(p));

  if (eligible.length === 0) return;

  for (const p of state.players.values()) {
    p.inRound = false;
    p.deck = [];
    p.current = null;
    p.completed = 0;
    p.skipped = 0;
    p.finishedAt = null;
    p.rank = null;
  }

  for (const p of eligible) {
    p.inRound = true;
    p.deck = shuffled(TOTAL_GAMES);
    p.current = p.deck.shift();
  }

  state.phase = 'RACING';
  state.roundStartedAt = Date.now();
  state.roundEndedAt = null;
  state.results = [];
  bump();
}

function finishRound() {
  if (state.phase !== 'RACING') return;
  state.phase = 'SCOREBOARD';
  state.roundEndedAt = Date.now();

  const field = racers().slice().sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt;
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    if (b.completed !== a.completed) return b.completed - a.completed;
    return a.joinedAt - b.joinedAt;
  });

  state.results = field.map((p, i) => ({
    id: p.id,
    name: p.name,
    position: i + 1,
    finished: !!p.finishedAt,
    completed: p.completed,
    skipped: p.skipped,
    timeMs: p.finishedAt ? p.finishedAt - state.roundStartedAt : null
  }));

  bump();
}

function resetToLobby() {
  state.phase = 'LOBBY';
  state.roundStartedAt = null;
  state.roundEndedAt = null;
  state.results = [];
  for (const p of state.players.values()) {
    p.inRound = false;
    p.deck = [];
    p.current = null;
    p.completed = 0;
    p.skipped = 0;
    p.finishedAt = null;
    p.rank = null;
  }
  bump();
}

function maybeFinish() {
  const field = racers();
  if (field.length === 0) return finishRound();
  const live = field.filter(p => !p.finishedAt && online(p));
  if (live.length === 0) finishRound();
}

function drawNext(p) {
  if (p.deck.length === 0) p.deck = shuffled(TOTAL_GAMES);
  p.current = p.deck.shift();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function applyAction(p, body) {
  const type = body && body.type;

  switch (type) {
    case 'setName': {
      if (state.phase !== 'LOBBY') return;
      const raw = String(body.name || '').trim().slice(0, 18);
      if (!raw) return;
      if (raw.toLowerCase() === 'admin' && claimAdmin(p, body.key)) return;
      p.name = raw;
      bump();
      return;
    }

    case 'claimAdmin':
      claimAdmin(p, body.key);
      return;

    case 'releaseAdmin':
      if (isAdmin(p)) { state.adminId = null; bump(); }
      return;

    case 'startGame':
      if (isAdmin(p)) startRound();
      return;

    case 'endGame':
      if (!isAdmin(p)) return;
      if (state.phase === 'RACING') finishRound();
      else if (state.phase === 'SCOREBOARD') resetToLobby();
      return;

    case 'complete':
    case 'skip': {
      if (state.phase !== 'RACING' || !p.inRound || p.finishedAt) return;
      if (typeof body.gameId !== 'number' || body.gameId !== p.current) return;

      if (type === 'skip') {
        p.skipped++;
        p.deck.push(p.current);
        drawNext(p);
      } else {
        p.completed++;
        if (p.completed >= GAMES_TO_FINISH) {
          p.finishedAt = Date.now();
          p.current = null;
        } else {
          drawNext(p);
        }
      }
      bump();
      maybeFinish();
      return;
    }

    default:
      return;
  }
}

function claimAdmin(p, key) {
  if (state.phase === 'RACING' && p.inRound) return false; // racers cannot abandon their own race

  if (ADMIN_KEY) {
    // Helm is reserved. Only the key holder gets it, and they can take it back
    // after a refresh or a browser crash without racing anyone for it.
    if (key !== ADMIN_KEY) return false;
  } else {
    const current = state.adminId ? state.players.get(state.adminId) : null;
    if (current && online(current) && current.id !== p.id) return false;
  }

  state.adminId = p.id;
  p.name = '';
  p.inRound = false;
  bump();
  return true;
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

function snapshotFor(playerId) {
  const me = state.players.get(playerId) || null;

  const roster = [...state.players.values()]
    .filter(p => p.name && !isAdmin(p))
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(p => ({
      id: p.id,
      name: p.name,
      inRound: p.inRound,
      completed: p.completed,
      progress: p.completed / GAMES_TO_FINISH,
      finished: !!p.finishedAt,
      timeMs: p.finishedAt && state.roundStartedAt ? p.finishedAt - state.roundStartedAt : null,
      online: online(p)
    }));

  let role = 'player';
  if (me && isAdmin(me)) role = 'admin';
  else if (me && state.phase === 'RACING' && !me.inRound) role = 'spectator';
  else if (me && state.phase === 'SCOREBOARD' && !me.inRound) role = 'spectator';

  const readyCount = [...state.players.values()]
    .filter(p => p.name && !isAdmin(p) && online(p)).length;

  return {
    v: state.version,
    phase: state.phase,
    readyCount,
    helmLocked: !!ADMIN_KEY,
    serverTime: Date.now(),
    roundStartedAt: state.roundStartedAt,
    gamesToFinish: GAMES_TO_FINISH,
    totalGames: TOTAL_GAMES,
    adminTaken: !!(state.adminId && state.players.get(state.adminId) && online(state.players.get(state.adminId))),
    playerCount: roster.length,
    players: roster,
    results: state.results,
    you: me ? {
      id: me.id,
      name: me.name,
      role,
      inRound: me.inRound,
      current: me.current,
      completed: me.completed,
      skipped: me.skipped,
      finished: !!me.finishedAt,
      timeMs: me.finishedAt && state.roundStartedAt ? me.finishedAt - state.roundStartedAt : null
    } : null
  };
}

// ---------------------------------------------------------------------------
// Presence sweeper
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const [id, p] of state.players) {
    if (p.parked === 0 && now - p.lastSeen > DROP_AFTER_MS) {
      state.players.delete(id);
      if (state.adminId === id) state.adminId = null;
      changed = true;
    }
  }

  if (state.adminId && !state.players.has(state.adminId)) {
    state.adminId = null;
    changed = true;
  }

  // Safety net: a scoreboard with nobody on the helm would otherwise sit there
  // forever. Hand the course back to the lobby so the session can carry on.
  const adminHere = state.adminId && state.players.has(state.adminId) && online(state.players.get(state.adminId));
  if (state.phase === 'SCOREBOARD' && !adminHere && state.roundEndedAt && now - state.roundEndedAt > 90000) {
    resetToLobby();
    changed = false;
  }

  if (changed) {
    bump();
    if (state.phase === 'RACING') maybeFinish();
  }
}, 4000);

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no'
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8192) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(target, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/healthz') return sendJson(res, 200, { ok: true, phase: state.phase, players: state.players.size });

  // --- join -----------------------------------------------------------------
  if (pathname === '/api/join' && req.method === 'POST') {
    const p = createPlayer();
    state.players.set(p.id, p);
    bump();
    return sendJson(res, 200, { id: p.id, snapshot: snapshotFor(p.id) });
  }

  // --- action ---------------------------------------------------------------
  if (pathname === '/api/action' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'bad body' }); }
    const p = state.players.get(body.id);
    if (!p) return sendJson(res, 409, { error: 'unknown player' });
    p.lastSeen = Date.now();
    applyAction(p, body);
    return sendJson(res, 200, snapshotFor(p.id));
  }

  // --- long-polled state ----------------------------------------------------
  if (pathname === '/api/state' && req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    const since = Number(url.searchParams.get('v') || 0);
    const p = state.players.get(id);
    if (!p) return sendJson(res, 409, { error: 'unknown player' });
    p.lastSeen = Date.now();

    if (state.version > since) return sendJson(res, 200, snapshotFor(id));

    const waiter = { res, playerId: id, timer: null, released: false };
    p.parked++;

    waiter.timer = setTimeout(() => {
      waiters = waiters.filter(w => w !== waiter);
      releaseWaiter(waiter, true);
    }, POLL_TIMEOUT_MS);

    req.on('close', () => {
      waiters = waiters.filter(w => w !== waiter);
      releaseWaiter(waiter, false);
    });

    waiters.push(waiter);
    return;
  }

  if (req.method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405);
  res.end('Method not allowed');
});

server.headersTimeout = 60000;
server.requestTimeout = 0;
server.keepAliveTimeout = 65000;

server.listen(PORT, () => {
  console.log(`M2C Integration Boat Trip Challenge Extravaganza listening on :${PORT}`);
  console.log(ADMIN_KEY
    ? 'Helm reserved. Host link: /?key=<your ADMIN_KEY>'
    : 'Helm open. First person to type "admin" takes it. Set ADMIN_KEY to reserve it.');
});
