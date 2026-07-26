import { h, icon, ICONS } from '../dom.js';
import { growBars } from '../anim.js';

export default function standingsScreen(ctx) {
  const { store } = ctx;
  const s = store.state;
  const stats = store.stats;
  const isFixed = s.mode === 'fixed';

  const rows = isFixed ? teamRows(store, stats) : playerRows(store, stats);
  const maxGames = Math.max(1, ...rows.map((r) => r.games));

  const screen = h(
    'section',
    { class: 'screen screen-standings' },
    h(
      'header',
      { class: 'screen-head', 'data-anim': '' },
      h(
        'button',
        {
          class: 'btn btn-icon',
          type: 'button',
          'aria-label': 'Back to the match',
          onclick: () => store.update((st) => { st.screen = 'match'; }),
        },
        icon(ICONS.back, 20),
      ),
      h(
        'div',
        {},
        h('h1', { class: 'screen-title' }, 'Standings'),
        h(
          'p',
          { class: 'screen-sub' },
          `${s.history.length} game${s.history.length === 1 ? '' : 's'} played · ${
            store.balance.spread <= 1 ? 'roster is balanced' : `spread of ${store.balance.spread} games`
          }`,
        ),
      ),
    ),
    h(
      'div',
      { class: 'table', 'data-anim': '' },
      h(
        'div',
        { class: 'table-head' },
        h('span', {}, '#'),
        h('span', {}, isFixed ? 'Team' : 'Player'),
        h('span', { class: 'num' }, 'G'),
        h('span', { class: 'num' }, 'W'),
        h('span', { class: 'num' }, 'L'),
        h('span', { class: 'num' }, 'Win%'),
      ),
      rows.map((row, i) =>
        h(
          'div',
          { class: `table-row${i === 0 && row.games ? ' is-leader' : ''}` },
          h('span', { class: 'rank' }, i + 1),
          h(
            'span',
            { class: 'cell-name' },
            h('span', {}, row.name),
            row.sub ? h('em', {}, row.sub) : null,
            h('span', {
              class: 'load-bar',
              'data-bar': '',
              style: { width: `${(row.games / maxGames) * 100}%` },
            }),
          ),
          h('span', { class: 'num' }, row.games),
          h('span', { class: 'num num-win' }, row.wins),
          h('span', { class: 'num' }, row.losses),
          h('span', { class: 'num' }, row.games ? `${Math.round((row.wins / row.games) * 100)}%` : '—'),
        ),
      ),
    ),
    s.history.length ? historyLog(store) : null,
    h(
      'div',
      { class: 'actions', 'data-anim': '' },
      h(
        'button',
        {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => store.update((st) => { st.screen = 'match'; }),
        },
        'Back to game',
      ),
      h(
        'button',
        {
          class: 'btn btn-ghost',
          type: 'button',
          onclick: () => {
            if (confirm('Clear all results and restart the session with the same roster?')) {
              store.resetKeepRoster();
            }
          },
        },
        'Restart session',
      ),
      h(
        'button',
        {
          class: 'btn btn-ghost btn-danger',
          type: 'button',
          onclick: () => {
            if (confirm('Discard the roster and all results?')) store.reset();
          },
        },
        'New roster',
      ),
    ),
  );

  queueMicrotask(() => growBars(screen));
  return screen;
}

function playerRows(store, stats) {
  return store.state.players
    .map((p) => ({
      name: p.name,
      sub: p.lockedWith ? `locked with ${store.playerName(p.lockedWith)}` : null,
      games: stats.games[p.id] ?? 0,
      wins: stats.wins[p.id] ?? 0,
      losses: stats.losses[p.id] ?? 0,
    }))
    .sort(rank);
}

function teamRows(store, stats) {
  return store.state.teams
    .map((team) => {
      const members = store.state.players.filter((p) => p.teamId === team.id);
      const anchor = members[0];
      return {
        name: team.name,
        sub: members.map((m) => m.name).join(' & '),
        games: anchor ? stats.games[anchor.id] ?? 0 : 0,
        wins: anchor ? stats.wins[anchor.id] ?? 0 : 0,
        losses: anchor ? stats.losses[anchor.id] ?? 0 : 0,
      };
    })
    .sort(rank);
}

function rank(a, b) {
  const pctA = a.games ? a.wins / a.games : -1;
  const pctB = b.games ? b.wins / b.games : -1;
  return b.wins - a.wins || pctB - pctA || a.games - b.games || a.name.localeCompare(b.name);
}

function historyLog(store) {
  const games = [...store.state.history].reverse();
  return h(
    'div',
    { class: 'history', 'data-anim': '' },
    h('h2', { class: 'section-label' }, 'Results'),
    h(
      'ol',
      { class: 'history-list' },
      games.map((game, i) => {
        const number = games.length - i;
        const scored = game.scoreA !== null && game.scoreB !== null && (game.scoreA || game.scoreB);
        return h(
          'li',
          { class: 'history-row' },
          h('span', { class: 'history-index' }, number),
          h(
            'span',
            { class: `history-team${game.winner === 'a' ? ' is-winner' : ''}` },
            store.sideLabel(game.match.a),
          ),
          h('span', { class: 'history-score' }, scored ? `${game.scoreA}–${game.scoreB}` : 'vs'),
          h(
            'span',
            { class: `history-team${game.winner === 'b' ? ' is-winner' : ''}` },
            store.sideLabel(game.match.b),
          ),
        );
      }),
    ),
  );
}
