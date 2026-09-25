/* =========================================================================
   Race course renderer — top down ocean, one lane per boat.
   Progress arrives as a 0..1 value per player; the boat eases toward it so
   the screen never jumps when a long poll lands.
   ========================================================================= */
(function (global) {
  'use strict';

  const HULLS = ['#2e9bff', '#39ff6a', '#ffc21a', '#c46bff', '#ff4d5e', '#7df9ff', '#ff9d4d', '#6bffd5', '#ff6bb5', '#9db4ff'];

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  const Course = {
    cv: null, g: null, w: 0, h: 0, dpr: 1,
    players: [], shown: new Map(),
    t: 0, raf: null, gamesToFinish: 20,

    attach(canvas) {
      this.cv = canvas;
      this.g = canvas.getContext('2d');
      this.resize();
      global.addEventListener('resize', () => this.resize());
    },

    resize() {
      if (!this.cv) return;
      const rect = this.cv.getBoundingClientRect();
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);
      this.w = Math.max(320, rect.width);
      this.h = Math.max(220, rect.height);
      this.cv.width = this.w * this.dpr;
      this.cv.height = this.h * this.dpr;
      this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    setPlayers(list, gamesToFinish) {
      this.players = list;
      if (gamesToFinish) this.gamesToFinish = gamesToFinish;
      const ids = new Set(list.map(p => p.id));
      for (const k of [...this.shown.keys()]) if (!ids.has(k)) this.shown.delete(k);
    },

    start() {
      if (this.raf) return;
      let last = performance.now();
      const loop = now => {
        const dt = Math.min(64, now - last); last = now;
        this.t += dt;
        this.draw(dt);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
    },

    // ---------------------------------------------------------------- paint
    draw(dt) {
      const g = this.g, w = this.w, h = this.h;
      if (!g) return;

      // water
      const sea = g.createLinearGradient(0, 0, 0, h);
      sea.addColorStop(0, '#04203f');
      sea.addColorStop(0.5, '#052a52');
      sea.addColorStop(1, '#031a34');
      g.fillStyle = sea; g.fillRect(0, 0, w, h);

      // swell
      g.strokeStyle = 'rgba(125,249,255,0.07)'; g.lineWidth = 2;
      for (let y = 18; y < h; y += 26) {
        g.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const yy = y + Math.sin((x * 0.018) + this.t * 0.0013 + y) * 4;
          x ? g.lineTo(x, yy) : g.moveTo(x, yy);
        }
        g.stroke();
      }

      const padT = 54, padB = 46, padL = 78, padR = 94;
      const laneTop = padT, laneBottom = h - padB;
      const startX = padL, finishX = w - padR;

      this.decorate(g, w, h, startX, finishX, padT, padB);

      // start line
      g.fillStyle = 'rgba(255,255,255,0.14)';
      for (let y = laneTop; y < laneBottom; y += 16) {
        g.fillRect(startX - 12, y, 6, 8);
        g.fillRect(startX - 6, y + 8, 6, 8);
      }
      // finish line
      for (let y = laneTop; y < laneBottom; y += 16) {
        g.fillStyle = ((y / 16) | 0) % 2 ? '#ffffff30' : '#ffffff70';
        g.fillRect(finishX + 6, y, 14, 16);
      }
      g.font = 'italic 700 15px Barlow Semi Condensed, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#8fa4cc';
      g.fillText('START', startX - 34, h / 2);
      g.fillStyle = '#ffc21a';
      g.fillText('FINISH', finishX + 50, h / 2);

      const n = Math.max(this.players.length, 1);
      const laneH = (laneBottom - laneTop) / n;
      const boatH = Math.max(14, Math.min(40, laneH * 0.62));

      this.players.forEach((p, i) => {
        const y = laneTop + laneH * (i + 0.5);

        // lane rule
        if (i > 0) {
          g.strokeStyle = 'rgba(46,155,255,0.10)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(startX - 14, laneTop + laneH * i); g.lineTo(finishX + 20, laneTop + laneH * i); g.stroke();
        }

        const target = Math.max(0, Math.min(1, p.progress || 0));
        const cur = this.shown.get(p.id);
        const nextVal = cur == null ? target : cur + (target - cur) * Math.min(1, dt / 260);
        this.shown.set(p.id, nextVal);

        const x = startX + (finishX - startX) * nextVal;
        const bob = Math.sin(this.t * 0.004 + i * 1.3) * (boatH * 0.09);
        const colour = HULLS[hash(p.id) % HULLS.length];

        this.drawBoat(g, x, y + bob, boatH, colour, !!p.finished, p.online === false);
        this.drawName(g, x, y + bob, boatH, p, colour);
      });

      // leaderboard rail down the right
      g.textAlign = 'left';
    },

    drawBoat(g, x, y, s, colour, finished, offline) {
      g.save();
      g.translate(x, y);
      g.globalAlpha = offline ? 0.35 : 1;

      // wake
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.moveTo(-s * 0.7, 0);
      g.lineTo(-s * 2.6, -s * 0.34);
      g.lineTo(-s * 2.6, s * 0.34);
      g.closePath(); g.fill();

      // hull
      g.fillStyle = colour;
      g.beginPath();
      g.moveTo(s * 0.95, 0);
      g.lineTo(-s * 0.55, -s * 0.46);
      g.lineTo(-s * 0.35, 0);
      g.lineTo(-s * 0.55, s * 0.46);
      g.closePath();
      g.shadowColor = colour; g.shadowBlur = finished ? 22 : 10;
      g.fill();
      g.shadowBlur = 0;

      // deck stripe
      g.fillStyle = 'rgba(4,8,20,0.55)';
      g.fillRect(-s * 0.3, -s * 0.12, s * 0.7, s * 0.24);

      if (finished) {
        g.font = `${Math.round(s * 0.7)}px sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🏁', 0, -s * 0.9);
      }
      g.restore();
    },

    drawName(g, x, y, s, p, colour) {
      const label = p.name || '';
      const size = Math.max(11, Math.min(17, s * 0.5));
      g.font = `700 ${size}px Barlow Semi Condensed, sans-serif`;
      g.textAlign = 'left'; g.textBaseline = 'middle';
      const tw = g.measureText(label).width;
      const bx = x + s * 1.15, by = y - size * 0.82;

      g.fillStyle = 'rgba(4,8,20,0.72)';
      g.strokeStyle = colour; g.lineWidth = 1.5;
      const rw = tw + 16, rh = size * 1.65;
      g.beginPath();
      if (g.roundRect) g.roundRect(bx, by, rw, rh, 5);
      else g.rect(bx, by, rw, rh);
      g.fill(); g.stroke();

      g.fillStyle = p.online === false ? '#5b6b8c' : '#eef4ff';
      g.fillText(label, bx + 8, by + rh / 2 + 1);

      g.font = `600 ${Math.max(10, size * 0.8)}px Barlow Semi Condensed, sans-serif`;
      g.fillStyle = colour;
      g.fillText(`${p.completed || 0}/${this.gamesToFinish}`, bx + 2, by + rh + size * 0.72);
    },

    decorate(g, w, h, startX, finishX, padT, padB) {
      // buoys along both boundaries
      const span = finishX - startX;
      const count = Math.max(4, Math.round(span / 150));
      for (let i = 0; i <= count; i++) {
        const x = startX + (span * i) / count;
        this.buoy(g, x, padT - 24 + Math.sin(this.t * 0.003 + i) * 3);
        this.buoy(g, x, h - padB + 24 + Math.cos(this.t * 0.003 + i) * 3);
      }

      g.textAlign = 'center'; g.textBaseline = 'middle';

      // kraken lurking in the top left, the team mascot
      g.save();
      g.globalAlpha = 0.28;
      g.font = `${Math.round(Math.min(w, h) * 0.16)}px sans-serif`;
      g.fillText('🐙', startX * 0.5, h * 0.22 + Math.sin(this.t * 0.0016) * 6);
      g.globalAlpha = 0.22;
      g.font = `${Math.round(Math.min(w, h) * 0.1)}px sans-serif`;
      g.fillText('🏝️', finishX + 46, h - padB - 20);
      g.fillText('🐬', startX + span * 0.34, padT - 34);
      g.fillText('🌊', startX + span * 0.66, h - padB + 34);
      g.restore();
    },

    buoy(g, x, y) {
      g.fillStyle = '#ff4d5e';
      g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 6, y + 6); g.lineTo(x - 6, y + 6); g.closePath();
      g.shadowColor = '#ff4d5e'; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#ffffff55'; g.fillRect(x - 6, y + 6, 12, 3);
    }
  };

  global.Course = Course;
})(window);
