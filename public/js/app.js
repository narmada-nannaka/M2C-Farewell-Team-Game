/* =========================================================================
   Client controller.
   One long-polled GET is always in flight. Everything else is a POST that
   returns the fresh snapshot, so the player never waits for the next poll to
   see their own action land.
   ========================================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const BOT = params.has('bot');

  // Host link support. /?key=xyz reserves the helm, /?admin claims it when no
  // ADMIN_KEY is configured. The value is stashed for this tab and stripped from
  // the address bar, so a screen share never puts your host link on the projector
  // and a refresh still gets you the helm back.
  let helmKey = params.has('key') ? params.get('key') : (params.has('admin') ? '' : null);
  if (helmKey !== null) {
    sessionStorage.setItem('m2c-helm', helmKey);
    params.delete('key'); params.delete('admin');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
  } else {
    const stored = sessionStorage.getItem('m2c-helm');
    if (stored !== null) helmKey = stored;
  }

  const $ = sel => document.querySelector(sel);
  const screens = {
    title: $('#screen-title'),
    play: $('#screen-play'),
    race: $('#screen-race'),
    score: $('#screen-score')
  };

  let playerId = sessionStorage.getItem('m2c-id') || null;
  let version = 0;
  let snap = null;
  let clockOffset = 0;
  let activeGame = null;      // { stop, id }
  let mountedGameId = null;
  let polling = false;

  // ------------------------------------------------------------------ net
  async function join() {
    const r = await fetch('/api/join', { method: 'POST' });
    const data = await r.json();
    playerId = data.id;
    sessionStorage.setItem('m2c-id', playerId);
    apply(data.snapshot);
  }

  async function act(body) {
    if (!playerId) return;
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ id: playerId }, body))
      });
      if (r.status === 409) { await join(); return; }
      apply(await r.json());
    } catch (e) { /* the poll loop will resync */ }
  }

  async function pollLoop() {
    if (polling) return;
    polling = true;
    for (;;) {
      if (!playerId) { await join(); continue; }
      const ac = new AbortController();
      const kill = setTimeout(() => ac.abort(), 40000);
      try {
        const r = await fetch(`/api/state?id=${encodeURIComponent(playerId)}&v=${version}`, { signal: ac.signal });
        clearTimeout(kill);
        if (r.status === 409) { sessionStorage.removeItem('m2c-id'); playerId = null; version = 0; continue; }
        apply(await r.json());
      } catch (e) {
        clearTimeout(kill);
        await new Promise(res => setTimeout(res, 900));
      }
    }
  }

  // ------------------------------------------------------------- rendering
  let helmTries = 0, helmLastTry = 0, helmLastPhase = null;

  function maybeClaimHelm() {
    if (helmKey === null || !snap || !snap.you) return;
    if (snap.you.role === 'admin') { helmTries = 0; return; }
    if (snap.phase === 'RACING' && snap.you.inRound) return;
    if (helmTries >= 5 || Date.now() - helmLastTry < 2500) return;
    helmTries++; helmLastTry = Date.now();
    act({ type: 'claimAdmin', key: helmKey });
  }

  function apply(s) {
    if (!s || !s.v) return;
    version = s.v;
    clockOffset = s.serverTime - Date.now();
    snap = s;
    if (s.phase !== helmLastPhase) { helmLastPhase = s.phase; helmTries = 0; }
    render();
    maybeClaimHelm();
  }

  function show(name) {
    for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
    if (name === 'race') { Course.resize(); Course.start(); } else Course.stop();
  }

  function render() {
    if (!snap) return;
    const you = snap.you;
    if (!you) return;

    renderLobbyBits();

    if (snap.phase === 'LOBBY') {
      teardownGame();
      show('title');
      return;
    }

    if (snap.phase === 'RACING') {
      if (you.role === 'player' && you.inRound) {
        show('play');
        renderPlay();
      } else {
        teardownGame();
        show('race');
        renderCourse();
      }
      return;
    }

    if (snap.phase === 'SCOREBOARD') {
      teardownGame();
      show('score');
      renderScore();
    }
  }

  // ---- title ---------------------------------------------------------
  function renderLobbyBits() {
    const you = snap.you;
    const named = !!you.name;
    const admin = you.role === 'admin';

    $('#join-panel').classList.toggle('hidden', named || admin);
    $('#admin-panel').classList.toggle('hidden', !admin);
    $('#waiting-panel').classList.toggle('hidden', !named || admin);
    if (named) $('#my-name').textContent = you.name;

    $('#join-hint').classList.toggle('hidden', snap.adminTaken || snap.helmLocked);

    const ready = snap.readyCount;
    const listed = snap.players.length;
    $('#start-btn').disabled = ready === 0;
    $('#start-hint').textContent =
      ready === 0 && listed === 0
        ? 'Nobody aboard yet. The button unlocks when the first boat arrives.'
        : ready === 0
          ? `${listed} boat${listed === 1 ? '' : 's'} listed but none connected. Ask the crew to reload the page.`
          : `${ready} boat${ready === 1 ? '' : 's'} ready. Each one plays 20 of ${snap.totalGames} challenges.`;

    $('#player-count').textContent = String(snap.playerCount);
    $('#race-count').textContent = String(snap.playerCount);

    const list = $('#fleet-list');
    list.innerHTML = '';
    snap.players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'boat-card' + (p.online ? '' : ' offline');
      card.innerHTML = '<svg viewBox="0 0 100 60"><use href="#boat"/></svg>';
      card.querySelector('svg').style.fill = hullColour(p.id);
      const nm = document.createElement('span');
      nm.className = 'bn';
      nm.textContent = p.name;
      card.appendChild(nm);
      list.appendChild(card);
    });
    $('#fleet-empty').classList.toggle('hidden', snap.players.length > 0);
  }

  const HULLS = ['#2e9bff', '#39ff6a', '#ffc21a', '#c46bff', '#ff4d5e', '#7df9ff', '#ff9d4d', '#6bffd5', '#ff6bb5', '#9db4ff'];
  function hullColour(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return HULLS[Math.abs(h) % HULLS.length];
  }

  // ---- play ----------------------------------------------------------
  function renderPlay() {
    const you = snap.you;
    const total = snap.gamesToFinish;

    $('#pp-fill').style.width = (you.completed / total * 100) + '%';
    $('#pp-label').textContent = `${you.completed} / ${total}`;

    const done = you.finished;
    $('#finished-card').classList.toggle('hidden', !done);
    document.querySelector('.game-frame').classList.toggle('hidden', done);
    document.querySelector('.play-foot').classList.toggle('hidden', done);

    if (done) {
      teardownGame();
      $('#finished-time').textContent = fmt(you.timeMs);
      return;
    }

    if (you.current != null && you.current !== mountedGameId) mountGame(you.current);
  }

  function mountGame(id) {
    teardownGame();
    mountedGameId = id;
    const stage = $('#game-stage');
    const handle = MiniGames.run(id, stage, () => {
      act({ type: 'complete', gameId: id });
    });
    activeGame = handle;
    $('#game-title').textContent = handle.meta.title;
    $('#game-instruction').textContent = handle.meta.instruction;
    if (BOT) botPlay(id);
  }

  function teardownGame() {
    if (activeGame) { activeGame.stop(); activeGame = null; }
    mountedGameId = null;
    const stage = $('#game-stage');
    if (stage) stage.innerHTML = '';
  }

  // ---- course --------------------------------------------------------
  function renderCourse() {
    Course.setPlayers(snap.players, snap.gamesToFinish);
    const admin = snap.you.role === 'admin';
    $('#end-btn').classList.toggle('hidden', !admin);
    $('#spectator-note').classList.toggle('hidden', admin);
    $('#spectator-note').textContent = snap.adminTaken
      ? 'Round in progress. You will join the next one.'
      : 'Nobody is on the helm. Type admin to take it.';
  }

  // ---- scoreboard ----------------------------------------------------
  function renderScore() {
    const list = $('#score-list');
    list.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    snap.results.forEach(r => {
      const row = document.createElement('div');
      row.className = 'score-row' + (r.position <= 3 && r.finished ? ' p' + r.position : '') +
        (r.id === snap.you.id ? ' me' : '') + (r.finished ? '' : ' dnf');

      const pos = document.createElement('div');
      pos.className = 'pos';
      pos.textContent = r.finished && r.position <= 3 ? medals[r.position - 1] : String(r.position);

      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = r.name;
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = r.finished
        ? `${r.completed} challenges cleared${r.skipped ? `, ${r.skipped} skipped` : ''}`
        : `stopped at ${r.completed} of ${snap.gamesToFinish}`;
      nm.appendChild(sub);

      const tm = document.createElement('div');
      tm.className = 'tm';
      tm.textContent = r.finished ? fmt(r.timeMs) : 'no finish';

      row.append(pos, nm, tm);
      list.appendChild(row);
    });

    const admin = snap.you.role === 'admin';
    $('#end-btn-2').classList.toggle('hidden', !admin);
    $('#score-wait').classList.toggle('hidden', admin);
    $('#score-wait').textContent = snap.adminTaken
      ? 'Waiting for the admin to reset the course.'
      : 'Nobody is on the helm. Type admin to take it and reset the course.';
  }

  // ------------------------------------------------------------- clocks
  function fmt(ms) {
    if (ms == null) return '—';
    const s = Math.round(ms / 100) / 10;
    const m = Math.floor(s / 60);
    const rest = (s - m * 60).toFixed(1);
    return m > 0 ? `${m}:${rest.padStart(4, '0')}` : `${rest}s`;
  }

  setInterval(() => {
    if (!snap || snap.phase !== 'RACING' || !snap.roundStartedAt) return;
    const elapsed = (Date.now() + clockOffset) - snap.roundStartedAt;
    const s = Math.floor(elapsed / 1000);
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('#race-clock').textContent = txt;
    $('#play-clock').textContent = txt;
  }, 250);

  // ---------------------------------------------------------------- wiring
  $('#name-go').addEventListener('click', submitName);
  $('#name-input').addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });
  function submitName() {
    const v = $('#name-input').value.trim();
    if (!v) { $('#name-input').focus(); return; }
    localStorage.setItem('m2c-name', v);
    act({ type: 'setName', name: v });
  }

  $('#start-btn').addEventListener('click', () => act({ type: 'startGame' }));
  $('#end-btn').addEventListener('click', () => act({ type: 'endGame' }));
  $('#end-btn-2').addEventListener('click', () => act({ type: 'endGame' }));
  $('#skip-btn').addEventListener('click', () => {
    if (mountedGameId == null) return;
    act({ type: 'skip', gameId: mountedGameId });
  });

  // Desktop: type "admin" anywhere on the title screen.
  let buf = '';
  document.addEventListener('keydown', e => {
    if (!snap || !snap.you) return;
    if (snap.phase === 'RACING' && snap.you.inRound) return; // racers keep racing
    if (document.activeElement === $('#name-input')) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-5);
    if (buf === 'admin') { buf = ''; act({ type: 'claimAdmin' }); }
  });

  window.addEventListener('beforeunload', () => {
    if (helmKey === null && snap && snap.you && snap.you.role === 'admin' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/action', new Blob(
        [JSON.stringify({ id: playerId, type: 'releaseAdmin' })],
        { type: 'application/json' }
      ));
    }
  });

  // ---------------------------------------------------------------- bots
  // Only reachable with ?bot=1. Exercises the real page, real transport and
  // real render loop; it does not pretend to solve dexterity puzzles by hand.
  function botPlay(id) {
    const think = 1800 + Math.random() * 6000;
    setTimeout(() => {
      if (mountedGameId !== id) return;
      if (Math.random() < 0.1) act({ type: 'skip', gameId: id });
      else act({ type: 'complete', gameId: id });
    }, think);
  }

  if (BOT) {
    window.__m2c = {
      ready: () => !!snap,
      phase: () => snap && snap.phase,
      role: () => snap && snap.you && snap.you.role,
      completed: () => snap && snap.you && snap.you.completed,
      finished: () => !!(snap && snap.you && snap.you.finished)
    };
  }

  // ---------------------------------------------------------------- boot
  Course.attach($('#course'));
  const saved = localStorage.getItem('m2c-name');
  if (saved) $('#name-input').value = saved;
  pollLoop();
})();
