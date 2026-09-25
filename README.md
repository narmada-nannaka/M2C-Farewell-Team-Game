# M2C Integration Boat Trip Challenge Extravaganza

A browser party race for the integration team. One person runs the course on a shared
screen, everyone else plays on whatever device is in their hand. Twenty challenges
each, drawn from a pool of thirty, first boat to the finish line wins.

No install for players. They open a link and they are in.

---

## Run it locally

You need Node 18 or newer. Nothing else. The server has zero dependencies, so there
is no `npm install` step and nothing to go wrong five minutes before the session.

PowerShell or Command Prompt, from the project folder:

```
node server.js
```

Then open `http://localhost:3000`. To test with a few players on your own machine,
open extra tabs. Each tab is a separate player, because identity is held in
`sessionStorage`.

To run on a different port:

```powershell
# PowerShell
$env:PORT=8080; node server.js
```

```
REM Command Prompt
set PORT=8080 && node server.js
```

---

## Get a link you can share

Pick whichever of these fits how your team works.

### Render (simplest, free tier is fine)

1. Push this folder to a GitHub repo.
2. In Render, create a **Web Service** and point it at the repo.
3. Build command: leave empty. Start command: `node server.js`.
4. Health check path: `/healthz`.

`render.yaml` is included, so Render will pick up those settings on its own.

Free instances sleep after idle. Open the link yourself two minutes before the
session so the first player does not eat a cold start.

### Railway or Fly.io

Both detect a Node app and run `npm start`. No config needed beyond that.

### Azure App Service

```powershell
az webapp up --runtime "NODE:22-lts" --sku B1 --name m2c-boat-trip
```

Set the startup command to `node server.js` in Configuration.

### Docker, anywhere

```powershell
docker build -t m2c-boat-trip .
docker run -p 3000:3000 m2c-boat-trip
```

### Just need it for the next hour

Run it locally and tunnel it:

```
npx localtunnel --port 3000
```

### One deployment rule

**Run a single instance.** Game state lives in memory on purpose. Two instances behind
a load balancer means two separate races and a confused fleet. Set replicas to 1 and
turn off autoscaling. For a dozen people on a call this costs you nothing.

---

## Running a session

**You, on the shared screen or the video call:**

1. Open the link.
2. Type `admin` — on a laptop just type it anywhere on the title screen, on a phone
   enter `admin` as your boat name. The first person to do this gets the helm.
3. Share your screen. You will see the fleet arriving on the title screen.
4. When everyone is aboard, press **Start the race**. Your screen switches to the
   course, and that is the view everyone watches.
5. **End game** is always there if you need to stop early. Press it again on the
   scoreboard to send everyone back to the title screen for another round.

**Everyone else:**

1. Open the link, enter a name, press **Board the boat**.
2. Wait. When the race starts the challenges appear one at a time.
3. Stuck or something looks broken? Press **Skip this one**. It costs you progress but
   the game comes back around later, after you have seen everything else.
4. Twenty cleared challenges and you are across the line.

**Latecomers.** Anyone who arrives mid-round sees the course as a spectator with no
controls, and joins the next round automatically. Nobody gets dropped into a race
that has already started.

**If the admin's laptop dies mid-round**, the helm goes vacant and any spectator can
type `admin` to take it and stop the race. A racer cannot, because that would mean
abandoning their own race. If a scoreboard is left with nobody on the helm, the
server returns everyone to the lobby after ninety seconds on its own.

---

## The thirty challenges

Every one works with a single finger on a phone or a mouse on a laptop. No keyboard is
needed anywhere. None run longer than about twenty seconds.

1. **Tap the Kraken** — Five krakens surface one at a time. Tap each before it dives.
2. **Bolt Order** — Tap the lightning bolts in number order, one to six.
3. **Anchor Drop** — Stop the anchor inside the green water. Three good drops.
4. **Odd Buoy Out** — One of these is not like the others. Tap it. Three rounds.
5. **Signal Colours** — Tap the swatch that matches the WORD, not the ink it is printed in.
6. **Cargo Count** — How many crates went past? Watch, then pick the number.
7. **Haul the Rope** — Drag along the rope from the anchor to the cleat without letting go.
8. **Signal Flags** — Memorise the flag run, then tap it back in the same order.
9. **Unscramble the Payload** — The letters came through out of order. Tap them back into the right word.
10. **Fill the Gap** — Pick the word that completes the line.
11. **Bail Her Out** — Water is coming in. Tap the bucket fast until the boat is dry.
12. **Hold the Helm** — The wheel keeps drifting. Drag to keep the needle in the green for three seconds.
13. **Matching Pairs** — Flip the cards and find all three matching pairs.
14. **Read the Compass** — Which way is the bow pointing?
15. **Spot the Difference** — Two charts of the same reef. Tap the square that does not match.
16. **Clear the Queue** — Messages are backed up. Send them smallest first.
17. **Dodge the Jellyfish** — Drag your boat left and right. Keep clear for eight seconds.
18. **Reel It In** — Something big is on the line. Pull left, right, left, right.
19. **Bolt Code** — The lighthouse sent a code. Tap it back, short and long.
20. **Wave Rhythm** — Watch the swell, then repeat the pattern.
21. **Plot the Course** — Tap the waypoints in order to lay in the route.
22. **Balance the Cargo** — The boat is listing. Add crates to the light side until both sides match.
23. **Find the Fault** — One line in the log went wrong. Tap it.
24. **Lighthouse Sweep** — Tap when the beam lands on your boat. Three times.
25. **Sea or Not** — Tap only the things you would actually find in the ocean.
26. **Roll Call** — Watch the crew list. Tap the moment the kraken shows up. Three times.
27. **Radio Static** — Half the word got lost in the noise. What was it?
28. **Stack the Containers** — Tap to drop each container on the stack. Three clean landings.
29. **Weather Window** — Only one day is safe to sail: wind under 20 and swell under 2. Pick it.
30. **Tie It Off** — Drag all the way around the loop to finish the knot.

---

## Load testing

The harness lives in its own package so the deployed app stays dependency free.

```powershell
cd loadtest
npm install          # pulls Playwright and downloads Chromium
cd ..
node loadtest\loadtest.js --url http://localhost:3000 --players 12
```

Useful flags:

| Flag | Default | What it does |
|---|---|---|
| `--url` | `http://localhost:3000` | Target. Point it at your deployed link. |
| `--players` | `12` | Boats to spawn, on top of one admin page. |
| `--rounds` | `1` | Full lobby to scoreboard to lobby cycles. |
| `--headed` | off | Watch the browsers work. Slow but convincing. |
| `--ramp` | `120` | Milliseconds between player joins. `0` for a thundering herd. |

What it actually does: launches real Chromium pages, half of them at phone viewport
size, joins them properly through the UI, waits for the admin roster to agree with the
fleet, starts a round, waits for every boat to finish, reads the scoreboard off the
admin's DOM, checks that every player's screen also switched to the scoreboard, resets,
and repeats. It reports join latency percentiles, round wall time, page errors and
failed network requests, and exits non-zero if anything went wrong.

**One honest limitation.** Bot pages load with `?bot=1`, which makes the client clear
each challenge after a random think time of roughly two to eight seconds and skip about
one in ten. It does not solve dexterity puzzles by hand. So the harness stresses the
server, the transport, the state machine and the render loop, which is what actually
breaks under load. It is not a test of whether the puzzles are winnable. That is covered
separately, see below.

### Testing the puzzles themselves

Every one of the thirty games was mounted headlessly against a DOM shim, exercised, and
torn down with no exceptions. The eleven that cannot be cleared by blind clicking, the
timing and memory ones, have targeted solvers proving they are completable. That work
caught a real bug: Wave Rhythm could flash the same pad twice in a row with too small a
gap to read, so the sequence now never repeats a pad back to back.

---

## Architecture, and why

**Zero dependencies on the server.** Plain Node `http`, no Express, no Socket.IO. Fewer
moving parts, nothing to install on the host, nothing to patch.

**HTTP long-polling, not WebSockets.** Each client holds one open `GET /api/state?v=N`.
The server parks it and releases it the instant the state version changes, so updates
land in single-digit milliseconds. Every action is a `POST` that returns a fresh
snapshot, so you see your own move land immediately rather than waiting for a poll.

This is the deliberate call. Your players are on corporate laptops, guest wifi and
mobile data, watching through a video call. WebSocket upgrades are the first thing a
proxy kills. A held XHR is understood by everything between here and 1999. For a dozen
players the traffic is irrelevant either way.

**In-memory state, single instance.** A party game does not need a database. It does need
you to not run two copies. See the deployment rule above.

**Server-authoritative everything.** Decks, progress, timing and rankings are all decided
server side. A client can only say "I finished the challenge you dealt me", and the
server checks the ID matches what it dealt. Nobody wins by opening devtools.

**The deck.** Each player gets all thirty games shuffled and draws from the front. A skip
pushes that game to the back, so it only reappears after everything else has been through.
Twenty completions crosses the line. Dealing exactly twenty would have made the skip rule
collide with the finish condition.

**Presence.** Every poll is a heartbeat. Twelve seconds of silence shows a boat as offline,
thirty-five seconds removes it. If every racer disappears the round ends rather than
hanging.

### Files

```
server.js              game state, long-poll transport, static serving
public/index.html      the four screens
public/css/style.css   the whole look
public/js/minigames.js the thirty games plus the runner
public/js/course.js    the race course canvas
public/js/app.js       joining, polling, screen routing
loadtest/loadtest.js   Playwright harness
loadtest/domshim.js    headless DOM used to test the game pack
Dockerfile, render.yaml
```

---

## Changing things

**Challenges per round.** `GAMES_TO_FINISH` at the top of `server.js`. Twenty takes most
people four to six minutes.

**Adding a game.** Append a `G(title, instruction, mount)` call in `minigames.js`. The
server reads the pool size from `TOTAL_GAMES`, so bump that to match. Your `mount` gets
the stage element, a `done()` to call when the player clears it, and a `ctx` whose
`after`, `every` and `frame` timers are cancelled automatically on teardown. Use `.tile`
for anything tappable and it will look native.

**Colours.** The CSS variables at the top of `style.css`. They are lifted from the team
poster: storm black ground, electric blue, lime, amber, coral, violet.

---

## Known limits

- One instance only. State is in memory by design.
- Free-tier hosts sleep. Warm the link up before you need it.
- Emoji render differently across Windows, macOS, iOS and Android. Nothing breaks, but
  the kraken has a different haircut depending on the device.
- Fonts load from Google Fonts. If your network blocks that, the fallback stack takes
  over and it still looks right, just less sharp.
- Refreshing mid-race keeps your identity and your progress, but the challenge you were
  on is re-dealt from the start.
