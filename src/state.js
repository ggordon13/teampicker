import {
  computeStats,
  generateMatch,
  previewQueue,
  balanceSpread,
  matchKey,
} from './scheduler.js';

const STORAGE_KEY = 'teampicker.session.v1';

let uid = 0;
export const nextId = (prefix = 'p') => `${prefix}${Date.now().toString(36)}${(uid++).toString(36)}`;

function blankState() {
  return {
    screen: 'setup', // setup | roster | match | standings
    sport: 'pickleball',
    mode: 'fixed', // fixed | shuffle
    teamCount: 4,
    playerCount: 8,
    players: [], // { id, name, teamId, teamName, lockedWith }
    teams: [], // { id, name } — fixed mode only
    history: [], // { id, match, winner, scoreA, scoreB, at }
    current: null, // match
    startedAt: null,
  };
}

class Store {
  constructor() {
    this.state = load() || blankState();
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Mutate through a callback, then persist and notify. */
  update(fn, { silent = false } = {}) {
    fn(this.state);
    save(this.state);
    if (!silent) this.emit();
  }

  emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  /* ------------------------------------------------------------- derived */

  get stats() {
    return computeStats(this.state.players, this.state.history);
  }

  get upcoming() {
    return previewQueue(this.state.players, this.stats, this.state.current, 3);
  }

  get balance() {
    return balanceSpread(this.state.players, this.stats);
  }

  player(id) {
    return this.state.players.find((p) => p.id === id);
  }

  playerName(id) {
    return this.player(id)?.name || '—';
  }

  /** Team display name for a side: the fixed team name, or "Ana & Ben". */
  sideLabel(ids) {
    if (this.state.mode === 'fixed') {
      const p = this.player(ids[0]);
      if (p?.teamName) return p.teamName;
    }
    return ids.map((id) => this.playerName(id)).join(' & ');
  }

  /** Everyone not on court right now, busiest last. */
  resting(match) {
    if (!match) return [];
    const playing = new Set([...match.a, ...match.b]);
    const stats = this.stats;
    return this.state.players
      .filter((p) => !playing.has(p.id))
      .sort((a, b) => (stats.games[a.id] ?? 0) - (stats.games[b.id] ?? 0));
  }

  /* -------------------------------------------------------------- actions */

  /**
   * Build (or resize) the roster to match the chosen mode and count, keeping
   * any names that were already typed in.
   *
   * If the shape already matches, the existing roster is left completely
   * untouched — that keeps player ids (and therefore results and locked
   * partners) alive when someone dips back into setup to fix a typo.
   */
  syncRoster() {
    const s = this.state;
    const alreadyShaped =
      s.mode === 'fixed'
        ? s.teams.length === s.teamCount && s.players.length === s.teamCount * 2
        : s.teams.length === 0 && s.players.length === s.playerCount;
    if (alreadyShaped) return;

    this.update((s) => {
      const kept = s.players.map((p) => p.name);
      // Rebuilding creates new player ids, so past results no longer refer to
      // anyone real — drop them rather than show a corrupted scoreboard.
      s.history = [];
      s.current = null;
      if (s.mode === 'fixed') {
        const teams = [];
        const players = [];
        for (let t = 0; t < s.teamCount; t++) {
          const old = s.teams[t];
          const team = { id: old?.id ?? nextId('t'), name: old?.name ?? `Team ${t + 1}` };
          teams.push(team);
          const a = { id: nextId('p'), name: kept[t * 2] ?? '', teamId: team.id, teamName: team.name, lockedWith: null };
          const b = { id: nextId('p'), name: kept[t * 2 + 1] ?? '', teamId: team.id, teamName: team.name, lockedWith: null };
          a.lockedWith = b.id;
          b.lockedWith = a.id;
          players.push(a, b);
        }
        s.teams = teams;
        s.players = players;
      } else {
        const players = [];
        for (let i = 0; i < s.playerCount; i++) {
          players.push({
            id: nextId('p'),
            name: kept[i] ?? '',
            teamId: null,
            teamName: null,
            lockedWith: null,
          });
        }
        s.teams = [];
        s.players = players;
      }
    });
  }

  /** Rename a fixed team and keep its players' cached label in sync. */
  renameTeam(teamId, name) {
    this.update(
      (s) => {
        const team = s.teams.find((t) => t.id === teamId);
        if (team) team.name = name;
        for (const p of s.players) if (p.teamId === teamId) p.teamName = name;
      },
      { silent: true },
    );
  }

  /**
   * Mutually lock (or clear) a fixed partner in shuffle mode. Silent: the
   * roster screen repaints the affected rows itself so typing isn't disturbed.
   */
  setPartner(playerId, partnerId) {
    this.update((s) => {
      const find = (id) => s.players.find((p) => p.id === id);
      const player = find(playerId);
      if (!player) return;
      const detach = (p) => {
        if (!p?.lockedWith) return;
        const mate = find(p.lockedWith);
        if (mate) mate.lockedWith = null;
        p.lockedWith = null;
      };
      detach(player);
      if (!partnerId) return;
      const partner = find(partnerId);
      if (!partner || partner.id === player.id) return;
      detach(partner);
      player.lockedWith = partner.id;
      partner.lockedWith = player.id;
    }, { silent: true });
  }

  startSession() {
    this.update((s) => {
      s.history = [];
      s.startedAt = Date.now();
      s.current = generateMatch(s.players, computeStats(s.players, []), null);
      s.screen = 'match';
    });
  }

  recordResult(winner, scoreA = null, scoreB = null) {
    this.update((s) => {
      if (!s.current) return;
      s.history.push({
        id: nextId('g'),
        match: s.current,
        winner,
        scoreA,
        scoreB,
        at: Date.now(),
      });
      const stats = computeStats(s.players, s.history);
      s.current = generateMatch(s.players, stats, s.current);
    });
  }

  undoLast() {
    this.update((s) => {
      const last = s.history.pop();
      if (!last) return;
      s.current = last.match; // replay the game that was just recorded
    });
  }

  /** Throw away the pending match and draw a genuinely different one. */
  reroll() {
    this.update((s) => {
      const stats = computeStats(s.players, s.history);
      const prev = s.history.length ? s.history[s.history.length - 1].match : null;
      const banned = s.current ? matchKey(s.current) : null;
      s.current = generateMatch(s.players, stats, prev, banned);
    });
  }

  reset() {
    this.update((s) => {
      Object.assign(s, blankState());
    });
  }

  resetKeepRoster() {
    this.update((s) => {
      s.history = [];
      s.startedAt = Date.now();
      s.current = generateMatch(s.players, computeStats(s.players, []), null);
      s.screen = 'match';
    });
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — the app still works, it just won't survive reload */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...blankState(), ...parsed } : null;
  } catch {
    return null;
  }
}

export const store = new Store();
