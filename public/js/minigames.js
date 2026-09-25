/* =========================================================================
   M2C Integration Boat Trip Challenge Extravaganza — minigame pack
   30 games. Every one is finishable with a single finger on a phone or a
   mouse on a laptop. No keyboard required anywhere.

   Contract:  mount(stage, done, ctx)
     stage  the DOM node to fill
     done() call once when the player has cleared it
     ctx    { after, every, frame }  timers that are auto-cancelled on teardown
   ========================================================================= */
(function (global) {
  'use strict';

  // ------------------------------------------------------------ utilities
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function pick(a) { return a[ri(0, a.length - 1)]; }
  function sample(a, n) { return shuffle(a).slice(0, n); }

  function tile(text, cls) {
    const t = el('button', 'tile' + (cls ? ' ' + cls : ''), text);
    t.type = 'button';
    return t;
  }

  function stack(stage) {
    const c = el('div', 'mg-col');
    stage.appendChild(c);
    return c;
  }

  function note(parent, text) {
    const n = el('p', 'mg-note', text);
    parent.appendChild(n);
    return n;
  }

  function grid(parent, cols, gap) {
    const g = el('div', 'mg-grid');
    g.style.gridTemplateColumns = `repeat(${cols}, minmax(0,1fr))`;
    if (gap) g.style.gap = gap;
    parent.appendChild(g);
    return g;
  }

  function canvasIn(parent, ctx) {
    const wrap = el('div');
    wrap.style.cssText = 'width:100%;flex:1;min-height:250px;position:relative';
    parent.appendChild(wrap);
    const cv = el('canvas', 'mg-canvas');
    wrap.appendChild(cv);
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth || 320;
    const h = wrap.clientHeight || 260;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    return { cv, g, w, h };
  }

  function pointerPos(cv, ev) {
    const r = cv.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  const COL = { bolt: '#2e9bff', pale: '#7df9ff', lime: '#39ff6a', amber: '#ffc21a', coral: '#ff4d5e', hair: '#1d2b52', dim: '#8fa4cc' };

  // Word bank kept firmly on-theme and inoffensive.
  const WORDS = ['KRAKEN', 'ADAPTER', 'PAYLOAD', 'ANCHOR', 'HARBOUR', 'COMPASS', 'LIFEBOAT', 'SEAGULL', 'CURRENT', 'MIDDLEWARE',
                 'INTERFACE', 'DOLPHIN', 'LIGHTHOUSE', 'PONTOON', 'MIGRATION', 'SCHEDULE', 'ESTUARY', 'STARBOARD'];

  const SEA = ['🐙', '🐟', '🐬', '🦀', '🐚', '🦑', '🐠', '🌊', '🦞', '🐳', '⚓', '⛵'];
  const LAND = ['🚗', '🌵', '🎸', '🍕', '🚲', '🏠', '📚', '🎈', '🪴', '🧦'];

  // ------------------------------------------------------------- the games
  const games = [];
  function G(title, instruction, mount) { games.push({ id: games.length, title, instruction, mount }); }

  /* 1 */ G('Tap the Kraken', 'Five krakens surface one at a time. Tap each before it dives.', (stage, done, ctx) => {
    const c = stack(stage);
    const area = el('div');
    area.style.cssText = 'position:relative;width:100%;flex:1;min-height:250px';
    c.appendChild(area);
    let hits = 0;
    const label = note(c, 'Krakens tapped: 0 / 5');
    function spawn() {
      if (hits >= 5) return;
      const k = tile('🐙', 'big');
      k.style.cssText += 'position:absolute;width:76px;height:76px';
      k.style.left = ri(0, Math.max(0, area.clientWidth - 80)) + 'px';
      k.style.top = ri(0, Math.max(0, area.clientHeight - 80)) + 'px';
      k.onclick = () => { k.remove(); hits++; label.textContent = `Krakens tapped: ${hits} / 5`; if (hits >= 5) done(); else spawn(); };
      area.appendChild(k);
      ctx.after(1400, () => { if (k.isConnected) { k.remove(); spawn(); } });
    }
    spawn();
  });

  /* 2 */ G('Bolt Order', 'Tap the lightning bolts in number order, one to six.', (stage, done, ctx) => {
    const c = stack(stage);
    const g = grid(c, 3);
    let next = 1;
    shuffle([1, 2, 3, 4, 5, 6]).forEach(n => {
      const t = tile('⚡' + n, 'big');
      t.onclick = () => {
        if (n === next) { t.classList.add('hit'); next++; if (next > 6) done(); }
        else { t.classList.add('miss'); ctx.after(260, () => t.classList.remove('miss')); }
      };
      g.appendChild(t);
    });
  });

  /* 3 */ G('Anchor Drop', 'Stop the anchor inside the green water. Three good drops.', (stage, done, ctx) => {
    const c = stack(stage);
    const bar = el('div');
    bar.style.cssText = 'position:relative;width:100%;height:64px;border:2px solid ' + COL.hair + ';border-radius:12px;background:#0a1225;overflow:hidden';
    const zone = el('div');
    zone.style.cssText = 'position:absolute;top:0;bottom:0;background:#39ff6a33;border-left:2px solid ' + COL.lime + ';border-right:2px solid ' + COL.lime;
    const head = el('div');
    head.style.cssText = 'position:absolute;top:0;bottom:0;width:6px;background:' + COL.amber + ';box-shadow:0 0 14px ' + COL.amber;
    bar.append(zone, head); c.appendChild(bar);
    const btn = tile('⚓  Drop', 'wide'); c.appendChild(btn);
    const label = note(c, 'Good drops: 0 / 3');

    let hits = 0, x = 0, dir = 1, zStart = 40, zWidth = 22;
    function reseed() { zWidth = 22 - hits * 4; zStart = ri(10, 90 - zWidth); zone.style.left = zStart + '%'; zone.style.width = zWidth + '%'; }
    reseed();
    ctx.frame(dt => {
      x += dir * dt * 0.055 * (1 + hits * 0.25);
      if (x > 100) { x = 100; dir = -1; } if (x < 0) { x = 0; dir = 1; }
      head.style.left = `calc(${x}% - 3px)`;
    });
    btn.onclick = () => {
      if (x >= zStart && x <= zStart + zWidth) {
        hits++; label.textContent = `Good drops: ${hits} / 3`;
        if (hits >= 3) return done();
        reseed();
      } else { btn.classList.add('miss'); ctx.after(250, () => btn.classList.remove('miss')); }
    };
  });

  /* 4 */ G('Odd Buoy Out', 'One of these is not like the others. Tap it. Three rounds.', (stage, done, ctx) => {
    const c = stack(stage);
    const g = grid(c, 4);
    const label = note(c, 'Round 1 of 3');
    let round = 0;
    function deal() {
      g.innerHTML = '';
      const base = pick(SEA);
      let odd = pick(SEA); while (odd === base) odd = pick(SEA);
      const n = 12, oddAt = ri(0, n - 1);
      for (let i = 0; i < n; i++) {
        const t = tile(i === oddAt ? odd : base, 'big');
        t.onclick = () => {
          if (i === oddAt) { round++; if (round >= 3) return done(); label.textContent = `Round ${round + 1} of 3`; deal(); }
          else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
        };
        g.appendChild(t);
      }
    }
    deal();
  });

  /* 5 */ G('Signal Colours', 'Tap the swatch that matches the WORD, not the ink it is printed in.', (stage, done, ctx) => {
    const c = stack(stage);
    const word = el('div');
    word.style.cssText = 'font-family:Anton,sans-serif;font-size:clamp(40px,13vw,72px);letter-spacing:2px';
    c.appendChild(word);
    const g = grid(c, 4);
    const label = note(c, 'Correct: 0 / 4');
    const cols = [['RED', '#ff4d5e'], ['BLUE', '#2e9bff'], ['GREEN', '#39ff6a'], ['GOLD', '#ffc21a']];
    let got = 0;
    function deal() {
      g.innerHTML = '';
      const target = pick(cols);
      let inkPick = pick(cols); while (inkPick[0] === target[0]) inkPick = pick(cols);
      word.textContent = target[0]; word.style.color = inkPick[1];
      shuffle(cols).forEach(cc => {
        const t = tile('', 'big');
        t.style.background = cc[1]; t.style.borderColor = cc[1];
        t.setAttribute('aria-label', cc[0]);
        t.onclick = () => {
          if (cc[0] === target[0]) { got++; label.textContent = `Correct: ${got} / 4`; if (got >= 4) return done(); deal(); }
          else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
        };
        g.appendChild(t);
      });
    }
    deal();
  });

  /* 6 */ G('Cargo Count', 'How many crates went past? Watch, then pick the number.', (stage, done, ctx) => {
    const c = stack(stage);
    const board = el('div');
    board.style.cssText = 'font-size:34px;line-height:1.5;text-align:center;min-height:120px';
    c.appendChild(board);
    const n = ri(5, 12);
    board.textContent = '📦'.repeat(n);
    const g = grid(c, 4); g.style.display = 'none';
    const label = note(c, 'Counting...');
    ctx.after(2200, () => {
      board.textContent = '🌊🌊🌊';
      label.textContent = 'How many crates?';
      g.style.display = 'grid';
      const opts = shuffle([n, n + 1, Math.max(1, n - 1), n + 2]);
      opts.forEach(v => {
        const t = tile(String(v), 'big');
        t.onclick = () => { if (v === n) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
        g.appendChild(t);
      });
    });
  });

  /* 7 */ G('Haul the Rope', 'Drag along the rope from the anchor to the cleat without letting go.', (stage, done, ctx) => {
    const c = stack(stage);
    const { cv, g, w, h } = canvasIn(c, ctx);
    const pts = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: 30 + (w - 60) * (i / steps), y: h / 2 + Math.sin(i * 1.1) * (h / 4 - 10) });
    }
    let idx = 0, dragging = false;
    function draw() {
      g.clearRect(0, 0, w, h);
      g.lineWidth = 16; g.lineCap = 'round'; g.strokeStyle = '#16233f';
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
      g.lineWidth = 10; g.strokeStyle = COL.lime;
      g.beginPath(); for (let i = 0; i <= idx; i++) { i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y); } g.stroke();
      const t = pts[Math.min(idx, pts.length - 1)];
      g.fillStyle = COL.amber; g.beginPath(); g.arc(t.x, t.y, 15, 0, 7); g.fill();
      g.font = '22px sans-serif'; g.textAlign = 'center';
      g.fillText('⚓', pts[0].x, pts[0].y - 26);
      g.fillText('🪝', pts[pts.length - 1].x, pts[pts.length - 1].y - 26);
    }
    draw();
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); dragging = true; });
    cv.addEventListener('pointerup', () => { dragging = false; });
    cv.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = pointerPos(cv, e), nxt = pts[Math.min(idx + 1, pts.length - 1)];
      if (Math.hypot(p.x - nxt.x, p.y - nxt.y) < 46) {
        idx++; draw();
        if (idx >= pts.length - 1) done();
      }
    });
  });

  /* 8 */ G('Signal Flags', 'Memorise the flag run, then tap it back in the same order.', (stage, done, ctx) => {
    const c = stack(stage);
    const show = el('div');
    show.style.cssText = 'font-size:44px;letter-spacing:8px;min-height:64px;text-align:center';
    c.appendChild(show);
    const flags = ['🟥', '🟦', '🟨', '🟩'];
    const seq = Array.from({ length: 4 }, () => pick(flags));
    show.textContent = seq.join('');
    const label = note(c, 'Memorise...');
    const g = grid(c, 4); g.style.display = 'none';
    ctx.after(2600, () => {
      show.textContent = '⬛⬛⬛⬛';
      label.textContent = 'Tap them back in order';
      g.style.display = 'grid';
      let i = 0;
      flags.forEach(f => {
        const t = tile(f, 'big');
        t.onclick = () => {
          if (f === seq[i]) {
            i++; show.textContent = seq.slice(0, i).join('') + '⬛'.repeat(4 - i);
            if (i >= 4) done();
          } else { i = 0; show.textContent = '⬛⬛⬛⬛'; t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
        };
        g.appendChild(t);
      });
    });
  });

  /* 9 */ G('Unscramble the Payload', 'The letters came through out of order. Tap them back into the right word.', (stage, done, ctx) => {
    const c = stack(stage);
    const word = pick(WORDS);
    const hint = note(c, 'Hint: ' + word.length + ' letters');
    const out = el('div');
    out.style.cssText = 'font-family:Anton,sans-serif;font-size:clamp(24px,7vw,40px);letter-spacing:4px;min-height:50px;color:' + COL.lime;
    c.appendChild(out);
    const g = grid(c, Math.min(word.length, 6), '8px');
    let i = 0;
    const letters = shuffle(word.split(''));
    letters.forEach(ch => {
      const t = tile(ch);
      t.onclick = () => {
        if (t.classList.contains('gone')) return;
        if (ch === word[i]) {
          t.classList.add('gone'); i++;
          out.textContent = word.slice(0, i);
          if (i >= word.length) done();
        } else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
      };
      g.appendChild(t);
    });
    hint.textContent = 'Hint: it is a ' + word.length + ' letter word you hear on this programme';
  });

  /* 10 */ G('Fill the Gap', 'Pick the word that completes the line.', (stage, done, ctx) => {
    const bank = [
      ['Middleware moves the ____ between two systems.', 'payload', ['schedule', 'harbour', 'seagull']],
      ['Every interface needs an ____ at the far end.', 'adapter', ['anchor', 'iceberg', 'paddle']],
      ['Before you sail you check the ____.', 'forecast', ['invoice', 'payload', 'ballast']],
      ['A boat is tied up at the ____.', 'jetty', ['gateway', 'cluster', 'router']],
      ['The ____ keeps the boat pointing where you want it.', 'rudder', ['cargo', 'sail', 'lantern']],
      ['Data that will not move is stuck in the ____.', 'queue', ['galley', 'lagoon', 'mast']]
    ];
    const q = pick(bank);
    const c = stack(stage);
    const line = el('div');
    line.style.cssText = 'font-size:clamp(19px,5.4vw,26px);text-align:center;line-height:1.4';
    line.textContent = q[0]; c.appendChild(line);
    const g = grid(c, 2);
    shuffle([q[1], ...q[2]]).forEach(w => {
      const t = tile(w, 'wide');
      t.onclick = () => { if (w === q[1]) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
      g.appendChild(t);
    });
  });

  /* 11 */ G('Bail Her Out', 'Water is coming in. Tap the bucket fast until the boat is dry.', (stage, done, ctx) => {
    const c = stack(stage);
    const bar = el('div');
    bar.style.cssText = 'width:100%;height:30px;border:2px solid ' + COL.hair + ';border-radius:99px;background:#0a1225;overflow:hidden';
    const fill = el('div');
    fill.style.cssText = 'height:100%;width:0;background:linear-gradient(90deg,' + COL.bolt + ',' + COL.lime + ');transition:width .08s';
    bar.appendChild(fill); c.appendChild(bar);
    const btn = tile('🪣  Bail', 'big wide'); btn.style.minWidth = '180px'; c.appendChild(btn);
    const label = note(c, '0 / 20');
    let n = 0;
    btn.onclick = () => {
      n++; fill.style.width = Math.min(100, n * 5) + '%'; label.textContent = `${n} / 20`;
      if (n >= 20) done();
    };
    ctx.every(700, () => { if (n > 0) { n = Math.max(0, n - 1); fill.style.width = n * 5 + '%'; label.textContent = `${n} / 20`; } });
  });

  /* 12 */ G('Hold the Helm', 'The wheel keeps drifting. Drag to keep the needle in the green for three seconds.', (stage, done, ctx) => {
    const c = stack(stage);
    const wrap = el('div');
    wrap.style.cssText = 'position:relative;width:100%;height:70px;border:2px solid ' + COL.hair + ';border-radius:12px;background:#0a1225;overflow:hidden';
    const zone = el('div');
    zone.style.cssText = 'position:absolute;left:42%;width:16%;top:0;bottom:0;background:#39ff6a26;border-left:2px solid ' + COL.lime + ';border-right:2px solid ' + COL.lime;
    const needle = el('div');
    needle.style.cssText = 'position:absolute;top:0;bottom:0;width:8px;background:' + COL.amber + ';box-shadow:0 0 14px ' + COL.amber;
    wrap.append(zone, needle); c.appendChild(wrap);
    const slider = el('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = '50';
    slider.style.cssText = 'width:100%;height:48px;accent-color:' + COL.bolt;
    c.appendChild(slider);
    const label = note(c, 'Steady for 3.0s');
    let pos = 50, drift = (Math.random() > .5 ? 1 : -1) * 0.02, held = 0;
    ctx.frame(dt => {
      if (Math.random() < 0.02) drift = (Math.random() - 0.5) * 0.06;
      pos += drift * dt;
      const target = Number(slider.value);
      pos += (target - pos) * 0.12;
      pos = Math.max(0, Math.min(100, pos));
      needle.style.left = `calc(${pos}% - 4px)`;
      const inZone = pos >= 42 && pos <= 58;
      if (inZone) { held += dt; needle.style.background = COL.lime; } else { held = Math.max(0, held - dt * 0.6); needle.style.background = COL.amber; }
      label.textContent = 'Steady for ' + Math.max(0, (3000 - held) / 1000).toFixed(1) + 's';
      if (held >= 3000) done();
    });
  });

  /* 13 */ G('Matching Pairs', 'Flip the cards and find all three matching pairs.', (stage, done, ctx) => {
    const c = stack(stage);
    const faces = sample(SEA, 3);
    const deck = shuffle([...faces, ...faces]);
    const g = grid(c, 3);
    let open = [], found = 0, lock = false;
    deck.forEach(f => {
      const t = tile('❔', 'big');
      t.dataset.face = f;
      t.onclick = () => {
        if (lock || t.classList.contains('hit') || open.includes(t)) return;
        t.textContent = f; t.classList.add('lit'); open.push(t);
        if (open.length === 2) {
          lock = true;
          const [a, b] = open;
          if (a.dataset.face === b.dataset.face) {
            ctx.after(320, () => {
              a.classList.remove('lit'); b.classList.remove('lit');
              a.classList.add('hit'); b.classList.add('hit');
              open = []; lock = false; found++;
              if (found >= 3) done();
            });
          } else {
            ctx.after(700, () => {
              a.textContent = '❔'; b.textContent = '❔';
              a.classList.remove('lit'); b.classList.remove('lit');
              open = []; lock = false;
            });
          }
        }
      };
      g.appendChild(t);
    });
  });

  /* 14 */ G('Read the Compass', 'Which way is the bow pointing?', (stage, done, ctx) => {
    const c = stack(stage);
    const dirs = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]];
    const target = pick(dirs);
    const dial = el('div');
    dial.style.cssText = 'font-size:clamp(70px,22vw,120px);line-height:1;transform:rotate(' + target[1] + 'deg)';
    dial.textContent = '⬆️';
    c.appendChild(dial);
    note(c, 'North is straight up');
    const g = grid(c, 4);
    shuffle(dirs).forEach(d => {
      const t = tile(d[0]);
      t.onclick = () => { if (d[0] === target[0]) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
      g.appendChild(t);
    });
  });

  /* 15 */ G('Spot the Difference', 'Two charts of the same reef. Tap the square that does not match.', (stage, done, ctx) => {
    const c = stack(stage);
    const n = 12, base = Array.from({ length: n }, () => pick(SEA));
    const oddAt = ri(0, n - 1);
    const copy = base.slice();
    let swap = pick(SEA); while (swap === base[oddAt]) swap = pick(SEA);
    copy[oddAt] = swap;
    const row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%';
    c.appendChild(row);
    [base, copy].forEach((arr, side) => {
      const box = el('div'); box.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px';
      arr.forEach((f, i) => {
        const t = tile(f);
        t.style.minHeight = '46px'; t.style.minWidth = '0'; t.style.fontSize = '22px';
        t.onclick = () => { if (i === oddAt) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
        box.appendChild(t);
      });
      row.appendChild(box);
    });
  });

  /* 16 */ G('Clear the Queue', 'Messages are backed up. Send them smallest first.', (stage, done, ctx) => {
    const c = stack(stage);
    const sizes = sample([12, 47, 88, 134, 209, 356, 512, 740], 5).sort(() => Math.random() - .5);
    const order = sizes.slice().sort((a, b) => a - b);
    const g = grid(c, 1);
    let i = 0;
    sizes.forEach(s => {
      const t = tile(s + ' kb', 'wide'); t.style.minHeight = '46px';
      t.onclick = () => {
        if (t.classList.contains('hit')) return;
        if (s === order[i]) { t.classList.add('hit'); i++; if (i >= order.length) done(); }
        else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
      };
      g.appendChild(t);
    });
    note(c, 'Smallest payload first');
  });

  /* 17 */ G('Dodge the Jellyfish', 'Drag your boat left and right. Keep clear for eight seconds.', (stage, done, ctx) => {
    const c = stack(stage);
    const { cv, g, w, h } = canvasIn(c, ctx);
    const label = note(c, '8.0s');
    let bx = w / 2, jellies = [], t = 0, spawnT = 0, alive = true;
    function track(e) { bx = Math.max(22, Math.min(w - 22, pointerPos(cv, e).x)); }
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); track(e); });
    cv.addEventListener('pointermove', track);
    ctx.frame(dt => {
      if (!alive) return;
      t += dt; spawnT += dt;
      if (spawnT > 420) { spawnT = 0; jellies.push({ x: ri(20, w - 20), y: -20, v: 0.13 + Math.random() * 0.1 }); }
      jellies.forEach(j => j.y += j.v * dt);
      jellies = jellies.filter(j => j.y < h + 30);
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#061021'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#0f1d3a'; g.lineWidth = 2;
      for (let y = 20; y < h; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.font = '30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      jellies.forEach(j => g.fillText('🪼', j.x, j.y));
      g.font = '34px sans-serif'; g.fillText('⛵', bx, h - 30);
      const hit = jellies.some(j => Math.abs(j.x - bx) < 24 && Math.abs(j.y - (h - 30)) < 24);
      if (hit) { t = Math.max(0, t - 1200); jellies = jellies.filter(j => Math.abs(j.y - (h - 30)) > 60); }
      label.textContent = Math.max(0, (8000 - t) / 1000).toFixed(1) + 's';
      if (t >= 8000) { alive = false; done(); }
    });
  });

  /* 18 */ G('Reel It In', 'Something big is on the line. Pull left, right, left, right.', (stage, done, ctx) => {
    const c = stack(stage);
    const bar = el('div');
    bar.style.cssText = 'width:100%;height:28px;border:2px solid ' + COL.hair + ';border-radius:99px;background:#0a1225;overflow:hidden';
    const fill = el('div'); fill.style.cssText = 'height:100%;width:0;background:' + COL.lime + ';transition:width .1s';
    bar.appendChild(fill); c.appendChild(bar);
    const row = el('div', 'mg-row'); c.appendChild(row);
    const L = tile('◀ Pull', 'big wide'), R = tile('Pull ▶', 'big wide');
    row.append(L, R);
    const label = note(c, '0 / 14');
    let n = 0, want = 'L';
    function paint() { L.classList.toggle('lit', want === 'L'); R.classList.toggle('lit', want === 'R'); }
    paint();
    function hit(side) {
      if (side !== want) return;
      n++; want = want === 'L' ? 'R' : 'L'; paint();
      fill.style.width = (n / 14 * 100) + '%'; label.textContent = `${n} / 14`;
      if (n >= 14) done();
    }
    L.onclick = () => hit('L'); R.onclick = () => hit('R');
  });

  /* 19 */ G('Bolt Code', 'The lighthouse sent a code. Tap it back, short and long.', (stage, done, ctx) => {
    const c = stack(stage);
    const seq = Array.from({ length: 5 }, () => (Math.random() > .5 ? '•' : '—'));
    const show = el('div');
    show.style.cssText = 'font-family:Anton,sans-serif;font-size:clamp(34px,10vw,58px);letter-spacing:10px;color:' + COL.amber;
    show.textContent = seq.join(' ');
    c.appendChild(show);
    const prog = el('div');
    prog.style.cssText = 'font-family:Anton,sans-serif;font-size:28px;letter-spacing:10px;color:' + COL.lime + ';min-height:36px';
    c.appendChild(prog);
    const row = el('div', 'mg-row'); c.appendChild(row);
    const S = tile('•  Short', 'big wide'), Lg = tile('—  Long', 'big wide');
    row.append(S, Lg);
    let i = 0;
    function tap(sym) {
      if (sym === seq[i]) { i++; prog.textContent = seq.slice(0, i).join(' '); if (i >= seq.length) done(); }
      else { i = 0; prog.textContent = ''; show.classList.add('miss'); ctx.after(250, () => show.classList.remove('miss')); }
    }
    S.onclick = () => tap('•'); Lg.onclick = () => tap('—');
  });

  /* 20 */ G('Wave Rhythm', 'Watch the swell, then repeat the pattern.', (stage, done, ctx) => {
    const c = stack(stage);
    const g = grid(c, 2);
    const label = note(c, 'Watch...');
    const pads = ['🌊', '⚡', '⚓', '🐙'].map((f, i) => {
      const t = tile(f, 'big'); t.style.minHeight = '84px';
      t.dataset.i = i; g.appendChild(t); return t;
    });
    // No pad twice in a row, otherwise two flashes read as one long one.
    const seq = [];
    while (seq.length < 4) {
      const n = ri(0, 3);
      if (seq[seq.length - 1] !== n) seq.push(n);
    }
    let accepting = false, i = 0;
    seq.forEach((s, k) => {
      ctx.after(500 + k * 760, () => { pads[s].classList.add('lit'); });
      ctx.after(500 + k * 760 + 400, () => { pads[s].classList.remove('lit'); });
    });
    ctx.after(500 + seq.length * 760 + 200, () => { accepting = true; label.textContent = 'Your turn'; });
    pads.forEach((p, idx) => {
      p.onclick = () => {
        if (!accepting) return;
        p.classList.add('lit'); ctx.after(160, () => p.classList.remove('lit'));
        if (idx === seq[i]) { i++; if (i >= seq.length) done(); }
        else { i = 0; label.textContent = 'Start again'; }
      };
    });
  });

  /* 21 */ G('Plot the Course', 'Tap the waypoints in order to lay in the route.', (stage, done, ctx) => {
    const c = stack(stage);
    const area = el('div');
    area.style.cssText = 'position:relative;width:100%;flex:1;min-height:250px;border:2px solid ' + COL.hair + ';border-radius:12px;background:#061021';
    c.appendChild(area);
    const n = 5;
    const spots = [];
    for (let i = 0; i < n; i++) {
      let p, tries = 0;
      do {
        p = { x: ri(8, 82), y: ri(8, 78) };
        tries++;
      } while (tries < 40 && spots.some(s => Math.hypot(s.x - p.x, s.y - p.y) < 24));
      spots.push(p);
    }
    let next = 0;
    spots.forEach((s, i) => {
      const t = tile(String(i + 1), 'big');
      t.style.cssText += `position:absolute;left:${s.x}%;top:${s.y}%;width:62px;height:62px;border-radius:50%`;
      t.onclick = () => {
        if (i === next) { t.classList.add('hit'); next++; if (next >= n) done(); }
        else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
      };
      area.appendChild(t);
    });
  });

  /* 22 */ G('Balance the Cargo', 'The boat is listing. Add crates to the light side until both sides match.', (stage, done, ctx) => {
    const c = stack(stage);
    const left = ri(4, 12);
    let right = ri(4, 12);
    while (right === left) right = ri(4, 12);
    const heavy = Math.max(left, right);
    const startLow = Math.min(left, right);
    let low = startLow;
    const disp = el('div');
    disp.style.cssText = 'font-family:Anton,sans-serif;font-size:clamp(28px,8vw,46px);text-align:center;line-height:1.3';
    c.appendChild(disp);
    const row = el('div', 'mg-row'); c.appendChild(row);
    const add = tile('＋ crate', 'big wide'), rem = tile('－ crate', 'big wide');
    row.append(rem, add);
    const label = note(c, 'Match both sides');
    function paint() {
      disp.innerHTML = '';
      const a = el('span', null, `Port ${low}`); a.style.color = low === heavy ? COL.lime : COL.amber;
      const b = el('span', null, `  ⚖  Starboard ${heavy}`); b.style.color = COL.pale;
      disp.append(a, b);
      if (low === heavy) { label.textContent = 'Level'; done(); }
    }
    add.onclick = () => { low++; paint(); };
    rem.onclick = () => { low = Math.max(0, low - 1); paint(); };
    paint();
  });

  /* 23 */ G('Find the Fault', 'One line in the log went wrong. Tap it.', (stage, done, ctx) => {
    const ok = ['message accepted', 'handshake complete', 'payload delivered', 'route confirmed', 'batch acknowledged', 'connection healthy'];
    const bad = ['timeout waiting for reply', 'payload rejected', 'route not found', 'connection refused', 'checksum mismatch'];
    const c = stack(stage);
    const lines = sample(ok, 3);
    const faulty = pick(bad);
    const all = shuffle([...lines.map(t => ['OK', t]), ['FAIL', faulty]]);
    const g = grid(c, 1, '8px');
    all.forEach(([kind, text]) => {
      const t = tile((kind === 'FAIL' ? '' : '') + text, 'wide');
      t.style.cssText += 'min-height:52px;font-family:var(--body);font-weight:600;font-size:17px;justify-content:flex-start;padding:0 14px;text-align:left';
      t.onclick = () => { if (kind === 'FAIL') done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
      g.appendChild(t);
    });
  });

  /* 24 */ G('Lighthouse Sweep', 'Tap when the beam lands on your boat. Three times.', (stage, done, ctx) => {
    const c = stack(stage);
    const { cv, g, w, h } = canvasIn(c, ctx);
    const btn = tile('Signal', 'big wide'); c.appendChild(btn);
    const label = note(c, 'Signals: 0 / 3');
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 24;
    let ang = 0, boatAng = Math.random() * Math.PI * 2, hits = 0;
    ctx.frame(dt => {
      ang = (ang + dt * 0.0022) % (Math.PI * 2);
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#061021'; g.fillRect(0, 0, w, h);
      g.strokeStyle = COL.hair; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      const grd = g.createLinearGradient(cx, cy, cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      grd.addColorStop(0, '#ffc21acc'); grd.addColorStop(1, '#ffc21a00');
      g.strokeStyle = grd; g.lineWidth = 14; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); g.stroke();
      g.font = '28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🗼', cx, cy);
      g.fillText('⛵', cx + Math.cos(boatAng) * R, cy + Math.sin(boatAng) * R);
    });
    btn.onclick = () => {
      let d = Math.abs(ang - boatAng) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < 0.32) {
        hits++; label.textContent = `Signals: ${hits} / 3`;
        boatAng = Math.random() * Math.PI * 2;
        if (hits >= 3) done();
      } else { btn.classList.add('miss'); ctx.after(250, () => btn.classList.remove('miss')); }
    };
  });

  /* 25 */ G('Sea or Not', 'Tap only the things you would actually find in the ocean.', (stage, done, ctx) => {
    const c = stack(stage);
    const seaOnes = sample(SEA, 5), landOnes = sample(LAND, 4);
    const board = shuffle([...seaOnes.map(x => [1, x]), ...landOnes.map(x => [0, x])]);
    const g = grid(c, 3);
    const label = note(c, 'Found: 0 / 5');
    let found = 0;
    board.forEach(([isSea, ch]) => {
      const t = tile(ch, 'big');
      t.onclick = () => {
        if (t.classList.contains('hit')) return;
        if (isSea) { t.classList.add('hit'); found++; label.textContent = `Found: ${found} / 5`; if (found >= 5) done(); }
        else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); }
      };
      g.appendChild(t);
    });
  });

  /* 26 */ G('Roll Call', 'Watch the crew list. Tap the moment the kraken shows up. Three times.', (stage, done, ctx) => {
    const c = stack(stage);
    const win = el('div');
    win.style.cssText = 'font-size:clamp(48px,16vw,84px);min-height:120px;display:flex;align-items:center;justify-content:center';
    c.appendChild(win);
    const btn = tile('Call it', 'big wide'); c.appendChild(btn);
    const label = note(c, 'Spotted: 0 / 3');
    let showing = '', hits = 0;
    ctx.every(620, () => {
      showing = Math.random() < 0.32 ? '🐙' : pick(['🐟', '🐬', '🦀', '🐚', '⚓', '⛵']);
      win.textContent = showing;
    });
    btn.onclick = () => {
      if (showing === '🐙') {
        hits++; label.textContent = `Spotted: ${hits} / 3`; showing = '✅'; win.textContent = '✅';
        if (hits >= 3) done();
      } else { btn.classList.add('miss'); ctx.after(220, () => btn.classList.remove('miss')); }
    };
  });

  /* 27 */ G('Radio Static', 'Half the word got lost in the noise. What was it?', (stage, done, ctx) => {
    const c = stack(stage);
    const word = pick(WORDS);
    const masked = word.split('').map((ch, i) => (i % 2 === 1 ? '_' : ch)).join(' ');
    const show = el('div');
    show.style.cssText = 'font-family:Anton,sans-serif;font-size:clamp(24px,7vw,42px);letter-spacing:4px;color:' + COL.amber + ';text-align:center';
    show.textContent = masked; c.appendChild(show);
    const wrong = sample(WORDS.filter(w => w !== word), 3);
    const g = grid(c, 2);
    shuffle([word, ...wrong]).forEach(w => {
      const t = tile(w, 'wide');
      t.onclick = () => { if (w === word) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
      g.appendChild(t);
    });
  });

  /* 28 */ G('Stack the Containers', 'Tap to drop each container on the stack. Three clean landings.', (stage, done, ctx) => {
    const c = stack(stage);
    const { cv, g, w, h } = canvasIn(c, ctx);
    const btn = tile('Drop', 'big wide'); c.appendChild(btn);
    const label = note(c, 'Landed: 0 / 3');
    const bw = 88, bh = 30;
    let x = 0, dir = 1, landed = 0, stackX = (w - bw) / 2, speed = 0.19;
    ctx.frame(dt => {
      x += dir * speed * dt;
      if (x > w - bw) { x = w - bw; dir = -1; } if (x < 0) { x = 0; dir = 1; }
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#061021'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#12306b'; g.fillRect(stackX, h - 24, bw, 18);
      for (let i = 0; i < landed; i++) {
        g.fillStyle = COL.lime; g.fillRect(stackX, h - 24 - (i + 1) * bh, bw, bh - 4);
      }
      g.fillStyle = COL.amber; g.fillRect(x, 20, bw, bh - 4);
    });
    btn.onclick = () => {
      if (Math.abs(x - stackX) < 26) {
        landed++; label.textContent = `Landed: ${landed} / 3`; speed += 0.07;
        if (landed >= 3) done();
      } else { btn.classList.add('miss'); ctx.after(250, () => btn.classList.remove('miss')); }
    };
  });

  /* 29 */ G('Weather Window', 'Only one day is safe to sail: wind under 20 and swell under 2. Pick it.', (stage, done, ctx) => {
    const c = stack(stage);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const safeAt = ri(0, 4);
    const g = grid(c, 5, '8px');
    days.forEach((d, i) => {
      const wind = i === safeAt ? ri(6, 19) : ri(21, 42);
      const swell = i === safeAt ? (ri(4, 19) / 10) : (ri(21, 45) / 10);
      const t = tile('', 'wide');
      t.style.cssText += 'flex-direction:column;min-height:110px;gap:2px;font-size:15px;padding:8px 4px';
      const a = el('div', null, d); a.style.cssText = 'font-family:Anton,sans-serif;font-size:19px;color:' + COL.pale;
      const b = el('div', null, wind + ' kn'); b.style.color = '#eef4ff';
      const s = el('div', null, swell.toFixed(1) + ' m'); s.style.color = COL.dim;
      t.append(a, b, s);
      t.onclick = () => { if (i === safeAt) done(); else { t.classList.add('miss'); ctx.after(250, () => t.classList.remove('miss')); } };
      g.appendChild(t);
    });
  });

  /* 30 */ G('Tie It Off', 'Drag all the way around the loop to finish the knot.', (stage, done, ctx) => {
    const c = stack(stage);
    const { cv, g, w, h } = canvasIn(c, ctx);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 34;
    const N = 16;
    const pts = Array.from({ length: N }, (_, i) => {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
    let idx = 0, dragging = false;
    function draw() {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#061021'; g.fillRect(0, 0, w, h);
      g.lineWidth = 16; g.strokeStyle = '#16233f'; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      g.strokeStyle = COL.lime; g.lineWidth = 11;
      g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (idx / N) * Math.PI * 2); g.stroke();
      const t = pts[idx % N];
      g.fillStyle = COL.amber; g.beginPath(); g.arc(t.x, t.y, 16, 0, 7); g.fill();
      g.font = '26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COL.pale; g.fillText('🪢', cx, cy);
    }
    draw();
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); dragging = true; });
    cv.addEventListener('pointerup', () => { dragging = false; });
    cv.addEventListener('pointermove', e => {
      if (!dragging) return;
      const p = pointerPos(cv, e), nxt = pts[(idx + 1) % N];
      if (Math.hypot(p.x - nxt.x, p.y - nxt.y) < 44) {
        idx++; draw();
        if (idx >= N) done();
      }
    });
  });

  // --------------------------------------------------------------- runner
  function run(id, stage, onDone) {
    const game = games[id] || games[0];
    stage.innerHTML = '';

    const timers = [], intervals = [];
    let rafId = null, last = 0, finished = false;

    const ctx = {
      after(ms, fn) { timers.push(setTimeout(fn, ms)); },
      every(ms, fn) { intervals.push(setInterval(fn, ms)); },
      frame(fn) {
        last = performance.now();
        const step = now => {
          const dt = Math.min(64, now - last); last = now;
          fn(dt);
          if (!finished) rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);
      }
    };

    function done() {
      if (finished) return;
      finished = true;
      stop();
      onDone();
    }
    function stop() {
      finished = true;
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      if (rafId) cancelAnimationFrame(rafId);
    }

    game.mount(stage, done, ctx);
    return { stop, meta: game };
  }

  global.MiniGames = { games, run, count: games.length };
})(window);
