import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStats,
  generateMatch,
  buildUnits,
  matchKey,
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
