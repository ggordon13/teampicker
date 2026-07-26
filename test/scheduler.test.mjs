import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStats,
  generateMatch,
  buildUnits,
  matchKey,
  substituteMatch,
} from '../src/scheduler.js';

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, lockedWith: null }));
}

function lockPairs(players, count) {
  for (let i = 0; i < count * 2; i += 2) {
    players[i].lockedWith = players[i + 1].id;
    players[i + 1].lockedWith = players[i].id;
  }
  return players;
}

/** Play a whole session, asserting the invariants that must hold every game. */
function playSession(players, games) {
  const history = [];
  let prev = null;
  for (let g = 0; g < games; g++) {
    const stats = computeStats(players, history);
    const match = generateMatch(players, stats, prev);
    assert.ok(match, `no match could be drawn at game ${g}`);

    const ids = [...match.a, ...match.b];
    assert.equal(new Set(ids).size, 4, 'a player appeared twice in one match');

    for (const unit of buildUnits(players)) {
      if (!unit.locked) continue;
      const [x, y] = unit.ids;
      const inA = match.a.includes(x) || match.a.includes(y);
      const inB = match.b.includes(x) || match.b.includes(y);
      assert.ok(!(inA && inB), 'a locked pair was split across sides');
    }

    history.push({ match, winner: g % 2 ? 'a' : 'b' });
    prev = match;
  }
  return { history, stats: computeStats(players, history) };
}

function spread(players, stats) {
  const counts = players.map((p) => stats.games[p.id]);
  return Math.max(...counts) - Math.min(...counts);
}

/* --------------------------------------------------------------- balance */

const BALANCE_CASES = [
  ['fixed: 4 teams, 20 games', () => lockPairs(makePlayers(8), 4), 20],
  ['fixed: 5 teams, 25 games', () => lockPairs(makePlayers(10), 5), 25],
  ['fixed: 7 teams, 40 games', () => lockPairs(makePlayers(14), 7), 40],
  ['fixed: 2 teams, 6 games', () => lockPairs(makePlayers(4), 2), 6],
  ['shuffle: 8 players, 24 games', () => makePlayers(8), 24],
  ['shuffle: 9 players, 27 games', () => makePlayers(9), 27],
  ['shuffle: 12 players, 36 games', () => makePlayers(12), 36],
  ['shuffle: 17 players, 51 games', () => makePlayers(17), 51],
  ['shuffle: 5 players, 15 games', () => makePlayers(5), 15],
  ['hybrid: 10 players / 2 locked pairs, 30 games', () => lockPairs(makePlayers(10), 2), 30],
  ['hybrid: 11 players / 3 locked pairs, 33 games', () => lockPairs(makePlayers(11), 3), 33],
];

for (const [label, build, games] of BALANCE_CASES) {
  test(`games stay balanced — ${label}`, () => {
    const players = build();
    const { stats } = playSession(players, games);
    assert.ok(
      spread(players, stats) <= 1,
      `spread was ${spread(players, stats)}, expected at most 1`,
    );
  });
}

/* ------------------------------------------------------------- rotation */

test('free agents rotate through many different partners', () => {
  const players = makePlayers(12);
  const { stats } = playSession(players, 36);
  const partnerships = Object.keys(stats.partner).length;
  assert.ok(partnerships >= 40, `only ${partnerships} distinct partnerships formed`);
  const worst = Math.max(...Object.values(stats.partner));
  assert.ok(worst <= 3, `one partnership repeated ${worst} times`);
});

test('opponents vary rather than repeating the same fixture', () => {
  const players = lockPairs(makePlayers(12), 6);
  const { stats } = playSession(players, 30);
  const worst = Math.max(...Object.values(stats.opponent));
  assert.ok(worst <= 5, `one fixture repeated ${worst} times`);
});

test('the same matchup is not drawn twice in a row', () => {
  const players = makePlayers(12);
  const { history } = playSession(players, 40);
  for (let i = 1; i < history.length; i++) {
    assert.notEqual(
      matchKey(history[i].match),
      matchKey(history[i - 1].match),
      `game ${i} repeated the previous matchup`,
    );
  }
});

/* ----------------------------------------------------------------- edges */

test('a roster of fewer than four players yields no match', () => {
  for (const n of [0, 1, 2, 3]) {
    const players = makePlayers(n);
    assert.equal(generateMatch(players, computeStats(players, []), null), null);
  }
});

test('exactly four players still produces a valid match', () => {
  const players = makePlayers(4);
  const match = generateMatch(players, computeStats(players, []), null);
  assert.equal(new Set([...match.a, ...match.b]).size, 4);
});

test('redraw returns a different matchup when one exists', () => {
  const players = makePlayers(8);
  const stats = computeStats(players, []);
  const first = generateMatch(players, stats, null);
  const second = generateMatch(players, stats, null, matchKey(first));
  assert.notEqual(matchKey(second), matchKey(first));
});

test('redraw falls back to the only matchup when there is no alternative', () => {
  // Two locked pairs can only ever meet each other.
  const players = lockPairs(makePlayers(4), 2);
  const stats = computeStats(players, []);
  const first = generateMatch(players, stats, null);
  const second = generateMatch(players, stats, null, matchKey(first));
  assert.ok(second, 'redraw should fall back rather than return nothing');
  assert.equal(matchKey(second), matchKey(first));
});

/* ---------------------------------------------------------- substitution */

test('substituting one player keeps the other three exactly where they were', () => {
  const players = makePlayers(8);
  const stats = computeStats(players, []);
  const match = generateMatch(players, stats, null);
  const out = match.a[0];

  const available = players.filter((p) => p.id !== out);
  const next = substituteMatch(available, stats, match, [out]);

  assert.ok(next, 'a bench of four should cover a single vacancy');
  assert.ok(!next.a.includes(out) && !next.b.includes(out), 'the rester stayed on court');
  assert.deepEqual(next.b, match.b, 'the far side should not have been touched');
  assert.deepEqual(next.a.slice(0, 1), match.a.slice(1), 'the remaining partner was moved');
  assert.equal(new Set([...next.a, ...next.b]).size, 4);
});

test('the substitute is drawn from the bench, never from thin air', () => {
  const players = makePlayers(9);
  const stats = computeStats(players, []);
  const match = generateMatch(players, stats, null);
  const out = match.b[1];
  const available = players.filter((p) => p.id !== out);

  const next = substituteMatch(available, stats, match, [out]);
  const incoming = [...next.a, ...next.b].filter(
    (id) => !match.a.includes(id) && !match.b.includes(id),
  );
  assert.equal(incoming.length, 1, 'exactly one new player should come on');
  assert.ok(
    available.some((p) => p.id === incoming[0]),
    'the substitute must be an available player',
  );
});

test('resting one half of a locked pair vacates both slots on that side', () => {
  const players = lockPairs(makePlayers(12), 6);
  const stats = computeStats(players, []);
  const match = generateMatch(players, stats, null);
  const [x, y] = match.a;

  const available = players.filter((p) => p.id !== x && p.id !== y);
  const next = substituteMatch(available, stats, match, [x, y]);

  assert.ok(next, 'four locked pairs remain on the bench');
  assert.deepEqual(next.b, match.b, 'the far side should not have been touched');
  for (const id of [x, y]) {
    assert.ok(![...next.a, ...next.b].includes(id), 'a rested player stayed on court');
  }
  // whoever came on must still be a whole locked pair
  const mate = available.find((p) => p.id === next.a[0]).lockedWith;
  assert.equal(mate, next.a[1], 'the incoming side is not an intact locked pair');
});

test('substitution returns null when the bench is empty', () => {
  const players = makePlayers(5);
  const stats = computeStats(players, []);
  const match = generateMatch(players, stats, null);
  const bench = players.find((p) => ![...match.a, ...match.b].includes(p.id));

  // rest the only bench player *and* someone on court: nobody is left to come on
  const available = players.filter((p) => p.id !== bench.id && p.id !== match.a[0]);
  assert.equal(substituteMatch(available, stats, match, [bench.id, match.a[0]]), null);
});

test('resting someone already off court leaves the pending match untouched', () => {
  const players = makePlayers(8);
  const stats = computeStats(players, []);
  const match = generateMatch(players, stats, null);
  const bench = players.find((p) => ![...match.a, ...match.b].includes(p.id));

  const available = players.filter((p) => p.id !== bench.id);
  assert.equal(substituteMatch(available, stats, match, [bench.id]), match);
});

test('play continues to balance across whoever is still available', () => {
  const players = makePlayers(10);
  const resting = new Set([players[0].id, players[1].id]);
  const available = players.filter((p) => !resting.has(p.id));

  const { history, stats } = playSession(available, 24);
  assert.ok(spread(available, stats) <= 1, 'available players fell out of balance');
  for (const { match } of history) {
    for (const id of [...match.a, ...match.b]) {
      assert.ok(!resting.has(id), 'a resting player was drawn into a match');
    }
  }
});

test('a one-sided link is ignored rather than treated as a pair', () => {
  const players = makePlayers(6);
  players[0].lockedWith = players[1].id; // not mirrored back
  const units = buildUnits(players);
  assert.ok(units.every((u) => !u.locked), 'a non-mutual link must not form a unit');
});

test('locked partners always play together, never against each other', () => {
  const players = lockPairs(makePlayers(9), 2);
  const { history } = playSession(players, 40);
  for (const { match } of history) {
    for (const [x, y] of [[players[0].id, players[1].id], [players[2].id, players[3].id]]) {
      const together =
        (match.a.includes(x) && match.a.includes(y)) ||
        (match.b.includes(x) && match.b.includes(y));
      const apart =
        (match.a.includes(x) && match.b.includes(y)) ||
        (match.b.includes(x) && match.a.includes(y));
      assert.ok(!apart, 'locked partners ended up on opposite sides');
      assert.ok(together || (!match.a.includes(x) && !match.b.includes(x)), 'partner played alone');
    }
  }
});
