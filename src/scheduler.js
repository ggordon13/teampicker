/**
 * Matchup engine.
 *
 * Everything is modelled as players. A "unit" is an indivisible group:
 *  - a locked pair (fixed teams mode, or a player who chose a fixed partner)
 *  - a single free-agent player (shuffle mode)
 *
 * The scheduler never plans a whole tournament up front — the session length is
 * unknown, so it picks the *next* game from live standings every time a result
 * is recorded. That keeps games-played balanced no matter when you stop.
 *
 * Priority order, highest first:
 *   1. Everybody plays the same number of games.
 *   2. Nobody plays the exact same matchup twice in a row.
 *   3. New partners (shuffle mode) over repeat partners.
 *   4. New opponents over repeat opponents.
 *   5. Whoever has been sitting out longest gets on court.
 */

const W_TOTAL_GAMES = 1000; // fairness dominates everything else
const W_MAX_GAMES = 420; // discourage pulling in someone already ahead
const W_PARTNER_REPEAT = 260;
const W_OPPONENT_REPEAT = 70;
const W_IDLE_BONUS = 6; // subtracted — rewards long benchwarmers
const W_INSTANT_REPEAT = 800;
const W_JITTER = 12;
const IDLE_CAP = 12;
const POOL_LIMIT = 10; // units considered per draw (keeps enumeration tiny)

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* ------------------------------------------------------------------ stats */

export function emptyStats(players) {
  const stats = {
    games: {},
    wins: {},
    losses: {},
    last: {},
    partner: {},
    opponent: {},
    played: 0,
  };
  for (const p of players) {
    stats.games[p.id] = 0;
    stats.wins[p.id] = 0;
    stats.losses[p.id] = 0;
    stats.last[p.id] = -1;
  }
  return stats;
}

export function cloneStats(stats) {
  return {
    games: { ...stats.games },
    wins: { ...stats.wins },
    losses: { ...stats.losses },
    last: { ...stats.last },
    partner: { ...stats.partner },
    opponent: { ...stats.opponent },
    played: stats.played,
  };
}

/** Fold a match into a stats object. `winner` may be 'a', 'b' or null. */
export function applyMatch(stats, match, winner = null) {
  const index = stats.played;
  for (const side of ['a', 'b']) {
    const ids = match[side];
    for (const id of ids) {
      if (stats.games[id] === undefined) continue;
      stats.games[id] += 1;
      stats.last[id] = index;
      if (winner) {
        if (winner === side) stats.wins[id] += 1;
        else stats.losses[id] += 1;
      }
    }
    const k = pairKey(ids[0], ids[1]);
    stats.partner[k] = (stats.partner[k] || 0) + 1;
  }
  for (const x of match.a) {
    for (const y of match.b) {
      const k = pairKey(x, y);
      stats.opponent[k] = (stats.opponent[k] || 0) + 1;
    }
  }
  stats.played = index + 1;
  return stats;
}

/** Rebuild stats from scratch — used after every result, and after undo. */
export function computeStats(players, history) {
  const stats = emptyStats(players);
  for (const game of history) applyMatch(stats, game.match, game.winner);
  return stats;
}

/* ------------------------------------------------------------------ units */

export function buildUnits(players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const seen = new Set();
  const units = [];
  for (const p of players) {
    if (seen.has(p.id)) continue;
    const mate = p.lockedWith && byId.get(p.lockedWith);
    // only trust the link if it is mutual and the partner is still in the roster
    if (mate && mate.lockedWith === p.id && !seen.has(mate.id)) {
      seen.add(p.id);
      seen.add(mate.id);
      units.push({ ids: [p.id, mate.id], size: 2, locked: true });
    } else {
      seen.add(p.id);
      units.push({ ids: [p.id], size: 1, locked: false });
    }
  }
  return units;
}

/* -------------------------------------------------------------- selection */

/** All sub-collections of units whose sizes total exactly four. */
function combosOfFour(units) {
  const out = [];
  const walk = (start, current, sum) => {
    if (sum === 4) {
      out.push(current.slice());
      return;
    }
    for (let i = start; i < units.length; i++) {
      if (sum + units[i].size > 4) continue;
      current.push(units[i]);
      walk(i + 1, current, sum + units[i].size);
      current.pop();
    }
  };
  walk(0, [], 0);
  return out;
}

const SPLITS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

/** Ways to split four players into two teams without breaking a locked pair. */
function validSplits(ids, lockedKeys) {
  const splits = [];
  for (const [l, r] of SPLITS) {
    const a = [ids[l[0]], ids[l[1]]];
    const b = [ids[r[0]], ids[r[1]]];
    // a locked pair must end up on the same side; if either side *is* a locked
    // pair that is fine, what we reject is a split that separates one.
    const brokenA = lockedKeys.has(pairKey(a[0], b[0])) || lockedKeys.has(pairKey(a[0], b[1]));
    const brokenB = lockedKeys.has(pairKey(a[1], b[0])) || lockedKeys.has(pairKey(a[1], b[1]));
    if (brokenA || brokenB) continue;
    splits.push({ a, b });
  }
  return splits;
}

function unitLoad(unit, stats) {
  let total = 0;
  for (const id of unit.ids) total += stats.games[id] ?? 0;
  return total / unit.ids.length;
}

function unitIdle(unit, stats) {
  let last = Infinity;
  for (const id of unit.ids) last = Math.min(last, stats.last[id] ?? -1);
  return stats.played - last;
}

/**
 * Pick the next match. Returns { a: [id,id], b: [id,id] } or null when there
 * are not enough players on the roster.
 *
 * `excludeKey` hard-bans one matchup — used by "redraw", where the whole point
 * is to get something other than what is on screen. Scoring is near
 * deterministic by design, so a soft penalty is not enough to shift it. If the
 * ban leaves nothing at all (e.g. a two-team session), it is lifted.
 */
export function generateMatch(players, stats, prevMatch = null, excludeKey = null) {
  const units = buildUnits(players);
  if (players.length < 4) return null;

  const lockedKeys = new Set(
    units.filter((u) => u.locked).map((u) => pairKey(u.ids[0], u.ids[1])),
  );

  const scored = units.map((u) => ({
    unit: u,
    load: unitLoad(u, stats),
    idle: unitIdle(u, stats),
    jitter: Math.random(),
  }));
  const minLoad = Math.min(...scored.map((s) => s.load));
  scored.sort((x, y) => x.load - y.load || y.idle - x.idle || x.jitter - y.jitter);

  // Always keep every least-played unit in contention, then top up the pool so
  // there is enough variety to actually form a interesting match.
  const mustKeep = scored.filter((s) => s.load === minLoad).length;
  let pool = scored.slice(0, Math.max(POOL_LIMIT, mustKeep)).map((s) => s.unit);
  if (pool.reduce((n, u) => n + u.size, 0) < 4) pool = scored.map((s) => s.unit);

  const prevKey = prevMatch ? matchKey(prevMatch) : null;

  let best = null;
  let bestScore = Infinity;

  for (const combo of combosOfFour(pool)) {
    const ids = combo.flatMap((u) => u.ids);
    for (const split of validSplits(ids, lockedKeys)) {
      if (excludeKey && matchKey(split) === excludeKey) continue;
      const score = scoreMatch(split, stats, prevKey, lockedKeys);
      if (score < bestScore) {
        bestScore = score;
        best = split;
      }
    }
  }

  // Nothing survived the ban — the roster simply has no other option.
  if (!best && excludeKey) return generateMatch(players, stats, prevMatch, null);
  return best;
}

function scoreMatch(match, stats, prevKey, lockedKeys) {
  const ids = [...match.a, ...match.b];
  let total = 0;
  let max = 0;
  let idle = 0;
  for (const id of ids) {
    const g = stats.games[id] ?? 0;
    total += g;
    max = Math.max(max, g);
    idle += Math.min(IDLE_CAP, stats.played - (stats.last[id] ?? -1));
  }

  let partnerRepeat = 0;
  for (const side of [match.a, match.b]) {
    const k = pairKey(side[0], side[1]);
    // a locked pair has no choice of partner, so it must not be penalised
    if (!lockedKeys.has(k)) partnerRepeat += stats.partner[k] || 0;
  }

  let opponentRepeat = 0;
  for (const x of match.a) {
    for (const y of match.b) opponentRepeat += stats.opponent[pairKey(x, y)] || 0;
  }

  const instantRepeat = prevKey && matchKey(match) === prevKey ? 1 : 0;

  return (
    W_TOTAL_GAMES * total +
    W_MAX_GAMES * max +
    W_PARTNER_REPEAT * partnerRepeat +
    W_OPPONENT_REPEAT * opponentRepeat +
    W_INSTANT_REPEAT * instantRepeat -
    W_IDLE_BONUS * idle +
    Math.random() * W_JITTER
  );
}

export function matchKey(match) {
  const side = (s) => [...s].sort().join('+');
  return [side(match.a), side(match.b)].sort().join(' vs ');
}

/**
 * Look ahead `count` games by simulating results-free play. Regenerated after
 * every recorded result so the queue always reflects the live standings.
 */
export function previewQueue(players, stats, current, count = 3) {
  const sim = cloneStats(stats);
  let prev = current;
  if (current) applyMatch(sim, current);
  const queue = [];
  for (let i = 0; i < count; i++) {
    const next = generateMatch(players, sim, prev);
    if (!next) break;
    queue.push(next);
    applyMatch(sim, next);
    prev = next;
  }
  return queue;
}

/** Spread between the busiest and quietest player — shown as the balance meter. */
export function balanceSpread(players, stats) {
  if (!players.length) return { min: 0, max: 0, spread: 0 };
  const counts = players.map((p) => stats.games[p.id] ?? 0);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return { min, max, spread: max - min };
}
