# TeamPicker

A gamified matchup engine for pickleball, tennis, badminton, padel and table tennis. Enter your
roster, hit start, and it draws every game for you — keeping games-played equal for everyone and
rotating opponents (and partners) as it goes.

Built with vanilla JS + Vite, animated with **GSAP**, with a live **Three.js** background that
re-themes itself per sport.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm test         # scheduler test suite
```

## How a session runs

1. **Setup** — choose the sport, choose how teams are formed, and set the roster size.
2. **Roster** — type the names. `Autofill` drops in placeholder names if you just want to try it.
3. **Match** — one game on screen at a time. Tap **Winner** on the side that won (or press `A` / `B`)
   and the next matchup is drawn immediately.
4. **Standings** — games, wins, losses, win% and the full result log.

Everything is saved to `localStorage`, so a refresh or a dropped phone won't lose the session.

## The two modes

**Fixed Teams** — you name every pair. Partners stay together the whole session; only the opponents
change. Standings are per team.

**Shuffle Partners** — everyone goes into one pool and gets a new partner each game. Any pair that
wants to stay together can be locked with the *fixed partner* dropdown, and the rest keep shuffling
around them. Standings are per player.

## How the balancing works

The session length is unknown, so nothing is planned up front. Instead the **next** game is drawn
from live standings every time you record a result — which means the roster is balanced whenever
you decide to stop, not only at the end of some fixed schedule.

Each draw scores every legal foursome and picks the best one, in this priority order:

1. Everybody plays the same number of games.
2. Nobody plays the exact same matchup twice in a row.
3. New partners over repeat partners (shuffle mode).
4. New opponents over repeat opponents.
5. Whoever has been sitting out longest gets on court.

A locked pair is treated as one indivisible unit, so it is never split across sides and never
penalised for "repeating" its own partnership.

Measured over full simulated sessions, the games-played spread lands at 0–1 across every roster
shape tested — e.g. 17 players over 51 games all finish on exactly 12 games each. `npm test` asserts
this, along with the locked-pair and rotation invariants.

**Redraw this game** bans the matchup currently on screen and picks the next-best one, so it always
gives you something different (unless the roster genuinely has no alternative — two teams, say).
**Undo last result** rolls the last game back and re-queues it.

The `Up next` list is a preview of the following three games, simulated forward from the current
standings. It is provisional by design and gets redrawn after every result.

## Layout

```
index.html
src/
  main.js                  screen router + sport theming
  state.js                 session store, localStorage persistence
  scheduler.js             the matchup engine (no DOM, fully testable)
  sports.js                palettes, vocabulary and real court line geometry
  anim.js                  GSAP transitions, slam-in, confetti, counters
  dom.js                   small hyperscript helper
  styles.css
  three/background.js      animated 3D scene, re-themed per sport
  screens/                 setup · roster · match · standings
test/scheduler.test.mjs
```

`scheduler.js` is deliberately DOM-free and dependency-free — it is the part worth trusting, so it
is the part that is tested.

## Adding a sport

Add an entry to `SPORTS` in [`src/sports.js`](src/sports.js) with a palette, a court size in feet
and its line segments as `[x1, z1, x2, z2]`. Those same coordinates drive both the 3D background
court and the court glyph behind the match card — nothing else needs to change.

## Notes

- `prefers-reduced-motion` collapses every animation and skips the confetti.
- The 3D scene pauses when the tab is hidden and caps device pixel ratio at 2.
