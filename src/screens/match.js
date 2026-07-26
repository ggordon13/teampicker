import { h, icon, ICONS, clear } from '../dom.js';
import { getSport } from '../sports.js';
import { slamMatch, celebrate, countTo, pop } from '../anim.js';

export default function matchScreen(ctx) {
  const { store } = ctx;
  const s = store.state;
  const sport = getSport(s.sport);
  const stats = store.stats;
  const balance = store.balance;
  const gameNo = s.history.length + 1;

  if (!s.current) {
    return h(
      'section',
      { class: 'screen screen-match' },
      h(
        'div',
        { class: 'empty-state', 'data-anim': '' },
        h('h1', {}, 'Not enough players'),
        h('p', {}, 'A doubles match needs at least four players on the roster.'),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => store.update((st) => { st.screen = 'setup'; }),
        }, 'Back to setup'),
      ),
    );
  }

  let locked = false;
  const scores = { a: null, b: null };

  const card = h('div', { class: 'match-card', 'data-anim': '' });

  const declare = (side) => {
    if (locked) return;
    locked = true;
    clearPick();
    const winnerEl = card.querySelector(`[data-side="${side}"]`);
    const loserEl = card.querySelector(`[data-side="${side === 'a' ? 'b' : 'a'}"]`);
    ctx.bg.pulse(side === 'a' ? sport.accent : sport.accent2);
    celebrate(winnerEl, loserEl, [sport.accent, sport.accent2, '#ffffff']).eventCallback(
      'onComplete',
      () => store.recordResult(side, scores.a, scores.b),
    );
  };

  /* Tap a name on court to offer them a breather. Selection lives purely in the
     DOM — a store update would repaint the whole screen and lose it. */
  const subBar = h('div', { class: 'sub-bar', hidden: true });
  let picked = null;

  const clearPick = () => {
    picked = null;
    subBar.hidden = true;
    clear(subBar);
    for (const el of card.querySelectorAll('.pchip.is-picked')) {
      el.classList.remove('is-picked');
      el.setAttribute('aria-pressed', 'false');
    }
  };

  const pickPlayer = (id, el) => {
    if (locked) return; // a result is already being celebrated
    const wasPicked = picked === id;
    clearPick();
    if (wasPicked) return; // tapping the same name again closes the prompt
    picked = id;
    el.classList.add('is-picked');
    el.setAttribute('aria-pressed', 'true');
    subBar.hidden = false;
    subBar.append(...subPrompt(store, id, clearPick));
    pop(subBar);
  };

  card.append(
    courtGlyph(sport),
    sidePanel(ctx, 'a', s.current.a, stats, scores, declare, pickPlayer),
    h('div', { class: 'vs-badge', 'data-vs': '' }, 'VS'),
    sidePanel(ctx, 'b', s.current.b, stats, scores, declare, pickPlayer),
  );

  const resting = store.resting(s.current);
  const upcoming = store.upcoming;

  const screen = h(
    'section',
    { class: 'screen screen-match' },
    h(
      'header',
      { class: 'match-head', 'data-anim': '' },
      h(
        'div',
        { class: 'match-head-left' },
        h('span', { class: 'chip chip-sport' }, sport.icon, ' ', sport.name),
        h('span', { class: 'chip' }, s.mode === 'fixed' ? 'Fixed teams' : 'Shuffle partners'),
      ),
      h('div', { class: 'game-counter' }, h('span', { class: 'game-counter-label' }, 'Game'), h('strong', {}, gameNo)),
      h(
        'div',
        { class: 'match-head-right' },
        h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            onclick: () => store.update((st) => { st.screen = 'standings'; }),
          },
          icon(ICONS.chart, 18),
          'Standings',
        ),
      ),
    ),
    card,
    subBar,
    balanceMeter(balance, store.available.length),
    h(
      'div',
      { class: 'match-tools', 'data-anim': '' },
      h(
        'button',
        { class: 'btn btn-ghost', type: 'button', onclick: () => store.reroll() },
        icon(ICONS.dice, 18),
        'Redraw this game',
      ),
      s.history.length
        ? h(
            'button',
            { class: 'btn btn-ghost', type: 'button', onclick: () => store.undoLast() },
            icon(ICONS.undo, 18),
            'Undo last result',
          )
        : null,
    ),
    upcoming.length ? upNext(store, upcoming) : null,
    resting.length ? restingRow(store, resting, stats) : null,
  );

  // Slam the matchup in after the screen has mounted.
  queueMicrotask(() => slamMatch(card));
  return screen;
}

/* ------------------------------------------------------------- fragments */

/**
 * The prompt that drops in under the card once a name is tapped: who would sit
 * out, and the button that actually does it.
 */
function subPrompt(store, id, cancel) {
  const unit = store.restUnit(id);
  const who = unit.map((x) => store.playerName(x)).join(' & ');
  const blocked = !store.canRest(id);

  return [
    h(
      'span',
      { class: 'sub-who' },
      unit.length > 1
        ? `${who} are a locked pair — both would sit out`
        : `${who} sits out until they tap back in`,
    ),
    blocked
      ? h(
          'span',
          { class: 'sub-warn' },
          `Only ${store.available.length} available — a match needs four on court.`,
        )
      : h(
          'button',
          {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            onclick: () => store.rest(id),
          },
          icon(ICONS.swap, 18),
          'Redraw for substitution',
        ),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: cancel }, 'Cancel'),
  ];
}

function sidePanel(ctx, side, ids, stats, scores, declare, pickPlayer) {
  const { store } = ctx;
  const label = store.sideLabel(ids);
  const isFixed = store.state.mode === 'fixed';

  const wins = ids.reduce((n, id) => n + (stats.wins[id] ?? 0), 0);
  const losses = ids.reduce((n, id) => n + (stats.losses[id] ?? 0), 0);

  const scoreValue = h('span', { class: 'score-value' }, '0');
  let score = 0;
  const setScore = (delta) => {
    score = Math.max(0, Math.min(99, score + delta));
    scores[side] = score;
    countTo(scoreValue, score, 0.25);
  };

  return h(
    'article',
    { class: `side side-${side}`, dataset: { side } },
    h('span', { class: 'side-tag' }, side === 'a' ? 'Side A' : 'Side B'),
    h('h2', { class: 'side-name' }, label),
    h(
      'ul',
      { class: 'side-players' },
      ids.map((id) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              class: 'pchip',
              type: 'button',
              'aria-pressed': 'false',
              title: `Tap to rest ${store.playerName(id)}`,
              onclick: (e) => pickPlayer(id, e.currentTarget),
            },
            h('span', { class: 'dot' }),
            h('span', { class: 'pname' }, store.playerName(id)),
            h('span', { class: 'pgames' }, `${stats.games[id] ?? 0}G`),
          ),
        ),
      ),
    ),
    isFixed
      ? h('p', { class: 'side-record' }, `${Math.round(wins / 2)}W · ${Math.round(losses / 2)}L`)
      : null,
    h(
      'div',
      { class: 'score-box' },
      h('button', { class: 'step-btn', type: 'button', 'aria-label': 'Decrease score', onclick: () => setScore(-1) }, icon(ICONS.minus, 16)),
      scoreValue,
      h('button', { class: 'step-btn', type: 'button', 'aria-label': 'Increase score', onclick: () => setScore(1) }, icon(ICONS.plus, 16)),
    ),
    h(
      'button',
      { class: 'btn btn-win', type: 'button', onclick: () => declare(side) },
      icon(ICONS.trophy, 18),
      'Winner',
    ),
  );
}

function balanceMeter(balance, playerCount) {
  const even = balance.spread <= 1;
  return h(
    'div',
    { class: `balance${even ? ' is-even' : ''}`, 'data-anim': '' },
    h('span', { class: 'balance-dot' }),
    h(
      'span',
      { class: 'balance-text' },
      even
        ? `Balanced — everyone is on ${balance.min}${balance.max > balance.min ? `–${balance.max}` : ''} games`
        : `Evening out — ${balance.min} to ${balance.max} games across ${playerCount} players`,
    ),
  );
}

function upNext(store, upcoming) {
  return h(
    'div',
    { class: 'up-next', 'data-anim': '' },
    h('h3', { class: 'section-label' }, 'Up next'),
    h(
      'ol',
      { class: 'queue' },
      upcoming.slice(0, 3).map((match, i) =>
        h(
          'li',
          { class: 'queue-row' },
          h('span', { class: 'queue-index' }, `+${i + 1}`),
          h('span', { class: 'queue-team' }, store.sideLabel(match.a)),
          h('span', { class: 'queue-vs' }, 'vs'),
          h('span', { class: 'queue-team' }, store.sideLabel(match.b)),
        ),
      ),
    ),
    h('p', { class: 'hint' }, 'Provisional — the queue is redrawn from live standings after every result.'),
  );
}

/**
 * Two different kinds of "not playing": rotated off for this game, and taking
 * a deliberate break. Only the second is something you tap to undo.
 */
function restingRow(store, resting, stats) {
  const onBreak = resting.filter((p) => p.resting);
  const waiting = resting.filter((p) => !p.resting);

  return h(
    'div',
    { class: 'resting', 'data-anim': '' },
    waiting.length
      ? [
          h('h3', { class: 'section-label' }, `Sitting out · ${waiting.length}`),
          h(
            'div',
            { class: 'rest-chips' },
            waiting.map((p) =>
              h('span', { class: 'chip chip-rest' }, p.name, h('em', {}, `${stats.games[p.id] ?? 0}G`)),
            ),
          ),
        ]
      : null,
    onBreak.length
      ? [
          h('h3', { class: 'section-label' }, `On a break · ${onBreak.length}`),
          h(
            'div',
            { class: 'rest-chips' },
            onBreak.map((p) =>
              h(
                'button',
                {
                  class: 'chip chip-rest chip-break',
                  type: 'button',
                  title: `Put ${p.name} back in the draw`,
                  onclick: () => store.unrest(p.id),
                },
                p.name,
                h('em', {}, 'tap to return'),
              ),
            ),
          ),
        ]
      : null,
  );
}

/** Faint to-scale court behind the match card, drawn from real line geometry. */
function courtGlyph(sport) {
  const { w, l } = sport.size;
  const pad = Math.max(w, l) * 0.06;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'court-glyph');
  // swapped axes so the court reads landscape, net down the middle
  svg.setAttribute('viewBox', `${-l / 2 - pad} ${-w / 2 - pad} ${l + pad * 2} ${w + pad * 2}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const [x1, z1, x2, z2] of sport.lines) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', z1);
    line.setAttribute('y1', x1);
    line.setAttribute('x2', z2);
    line.setAttribute('y2', x2);
    svg.appendChild(line);
  }
  return svg;
}
