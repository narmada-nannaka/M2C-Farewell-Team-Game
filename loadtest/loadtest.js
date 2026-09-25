/* =========================================================================
   Load test: spawns real Chromium pages that join, race and finish.
   Every page runs the real client, the real long-poll transport and the real
   canvas render loop. Bot pages append ?bot=1, which makes the client clear
   each minigame after a random think time of roughly 2 to 8 seconds and skip
   about one in ten. It does not solve the puzzles by hand, so this measures
   the server, the transport and the rendering, not human dexterity.

   Usage:
     node loadtest/loadtest.js --url http://localhost:3000 --players 12
     node loadtest/loadtest.js --url https://your-app.onrender.com --players 25 --rounds 2 --headed
   ========================================================================= */
'use strict';

const { chromium } = require('playwright');

// ------------------------------------------------------------------- args
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i === -1 ? fallback : argv[i + 1];
}
const flag = name => argv.includes('--' + name);

const URL_BASE = (arg('url', 'http://localhost:3000')).replace(/\/$/, '');
const PLAYERS = Number(arg('players', 12));
const ROUNDS = Number(arg('rounds', 1));
const HEADED = flag('headed');
const RAMP_MS = Number(arg('ramp', 120));
const TIMEOUT_MS = Number(arg('timeout', 240000));

const errors = [];
const netFails = [];

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }
function ms(n) { return (n / 1000).toFixed(2) + 's'; }

function instrument(page, who) {
  page.on('pageerror', e => errors.push(`${who}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${who} console: ${m.text()}`); });
  page.on('requestfailed', r => {
    const reason = r.failure() && r.failure().errorText;
    if (reason === 'net::ERR_ABORTED') return; // long polls torn down on navigation
    netFails.push(`${who}: ${r.url()} ${reason}`);
  });
}

async function waitFor(page, fn, label, timeout = TIMEOUT_MS) {
  try {
    await page.waitForFunction(fn, null, { timeout, polling: 250 });
  } catch (e) {
    throw new Error(`timed out waiting for ${label}`);
  }
}

// ------------------------------------------------------------------- main
(async () => {
  log(`target ${URL_BASE}, ${PLAYERS} players, ${ROUNDS} round(s)`);
  const t0 = Date.now();

  const browser = await chromium.launch({ headless: !HEADED, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  // ---- admin -------------------------------------------------------------
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const admin = await adminCtx.newPage();
  instrument(admin, 'admin');
  await admin.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
  await admin.waitForSelector('#name-input');
  await admin.click('body');
  await admin.keyboard.type('admin', { delay: 60 });
  try {
    await admin.waitForSelector('#admin-panel:not(.hidden)', { timeout: 8000 });
  } catch {
    // fallback: claim the helm by entering admin as the boat name
    await admin.fill('#name-input', 'admin');
    await admin.click('#name-go');
    await admin.waitForSelector('#admin-panel:not(.hidden)', { timeout: 8000 });
  }
  log('admin has the helm');

  // ---- players -----------------------------------------------------------
  const joinTimes = [];
  const pages = [];
  for (let i = 0; i < PLAYERS; i++) {
    const ctx = await browser.newContext({
      viewport: i % 2 ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: false
    });
    const page = await ctx.newPage();
    const name = `Crew${String(i + 1).padStart(2, '0')}`;
    instrument(page, name);
    const jt = Date.now();
    await page.goto(URL_BASE + '/?bot=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#name-input');
    await page.fill('#name-input', name);
    await page.click('#name-go');
    await page.waitForSelector('#waiting-panel:not(.hidden)');
    joinTimes.push(Date.now() - jt);
    pages.push({ page, ctx, name });
    if (RAMP_MS) await new Promise(r => setTimeout(r, RAMP_MS));
  }
  log(`${PLAYERS} boats aboard. join p50 ${ms(percentile(joinTimes, 50))}, p95 ${ms(percentile(joinTimes, 95))}`);

  await waitFor(admin, `document.querySelector('#player-count').textContent === '${PLAYERS}'`,
    'admin roster to show every player');
  log('admin roster agrees with the fleet');

  const roundReports = [];

  for (let round = 1; round <= ROUNDS; round++) {
    log(`--- round ${round} ---`);
    const rt = Date.now();
    await admin.click('#start-btn');
    await waitFor(admin, "!document.querySelector('#screen-race').classList.contains('hidden')", 'admin course view');
    await Promise.all(pages.map(p =>
      waitFor(p.page, "!document.querySelector('#screen-play').classList.contains('hidden')", `${p.name} to start playing`)));
    log(`all ${PLAYERS} players are playing (${ms(Date.now() - rt)} from start click)`);

    await Promise.all(pages.map(p => waitFor(p.page, 'window.__m2c && window.__m2c.finished()', `${p.name} to finish`)));
    const raceMs = Date.now() - rt;
    log(`fleet home in ${ms(raceMs)}`);

    await waitFor(admin, "!document.querySelector('#screen-score').classList.contains('hidden')", 'scoreboard');
    const standings = await admin.$$eval('.score-row', rows => rows.map(r => ({
      pos: r.querySelector('.pos').textContent.trim(),
      name: r.querySelector('.nm').childNodes[0].textContent.trim(),
      time: r.querySelector('.tm').textContent.trim()
    })));

    console.table(standings.slice(0, 5));
    if (standings.length !== PLAYERS) errors.push(`scoreboard listed ${standings.length} of ${PLAYERS} players`);

    // every player should be looking at the same scoreboard
    await Promise.all(pages.map(p =>
      waitFor(p.page, "!document.querySelector('#screen-score').classList.contains('hidden')", `${p.name} scoreboard`)));

    roundReports.push({ round, raceMs, standings });

    await admin.click('#end-btn-2');
    await waitFor(admin, "!document.querySelector('#screen-title').classList.contains('hidden')", 'return to title');
    await Promise.all(pages.map(p =>
      waitFor(p.page, "!document.querySelector('#screen-title').classList.contains('hidden')", `${p.name} back at title`)));
    log('everyone is back at the title screen');
  }

  // ---- verdict -----------------------------------------------------------
  console.log('\n================ load test summary ================');
  console.log(`target            ${URL_BASE}`);
  console.log(`players           ${PLAYERS}`);
  console.log(`rounds            ${ROUNDS}`);
  console.log(`join latency      p50 ${ms(percentile(joinTimes, 50))}  p95 ${ms(percentile(joinTimes, 95))}  max ${ms(Math.max(...joinTimes))}`);
  roundReports.forEach(r => console.log(`round ${r.round} wall time  ${ms(r.raceMs)}`));
  console.log(`page errors       ${errors.length}`);
  console.log(`network failures  ${netFails.length}`);
  console.log(`total elapsed     ${ms(Date.now() - t0)}`);
  if (errors.length) { console.log('\nerrors:'); errors.slice(0, 20).forEach(e => console.log('  ' + e)); }
  if (netFails.length) { console.log('\nnetwork:'); netFails.slice(0, 20).forEach(e => console.log('  ' + e)); }
  console.log('===================================================\n');

  await browser.close();
  process.exit(errors.length || netFails.length ? 1 : 0);
})().catch(async e => {
  console.error('\nLOAD TEST FAILED:', e.message);
  if (errors.length) errors.slice(0, 20).forEach(x => console.error('  ' + x));
  process.exit(1);
});

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
