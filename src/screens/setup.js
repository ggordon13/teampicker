import { h, $$, icon, ICONS } from '../dom.js';
import { SPORT_LIST, getSport } from '../sports.js';
import { pop } from '../anim.js';

const MODES = [
  {
    id: 'fixed',
    title: 'Fixed Teams',
    icon: ICONS.users,
    blurb: 'You name every pair. Partners stay together all session — only the opponents change.',
  },
  {
    id: 'shuffle',
    title: 'Shuffle Partners',
    icon: ICONS.shuffle,
    blurb: 'Everyone goes in one pool and gets a new partner each game. Fixed pairs can still be locked.',
  },
];

export default function setupScreen(ctx) {
  const { store } = ctx;
  const s = store.state;

  const sportGrid = h(
    'div',
    { class: 'sport-grid', 'data-anim': '' },
    SPORT_LIST.map((sport) =>
      h(
        'button',
        {
          class: `sport-tile${sport.id === s.sport ? ' is-active' : ''}`,
          type: 'button',
          dataset: { sport: sport.id },
          onclick: (e) => {
            store.update((st) => { st.sport = sport.id; }, { silent: true });
            $$('.sport-tile').forEach((t) => t.classList.toggle('is-active', t.dataset.sport === sport.id));
            ctx.applySport(sport.id);
            pop(e.currentTarget);
          },
        },
        h('span', { class: 'sport-emoji' }, sport.icon),
        h('span', { class: 'sport-name' }, sport.name),
        h('span', { class: 'sport-tag' }, sport.tagline),
      ),
    ),
  );

  const countRow = h('div', { class: 'stepper-row', 'data-anim': '' });
  const countLabel = h('span', { class: 'stepper-label' });
  const countValue = h('span', { class: 'stepper-value' });
  const countHint = h('p', { class: 'hint' });

  const clampCount = (value) => {
    const isFixed = store.state.mode === 'fixed';
    return Math.max(isFixed ? 2 : 4, Math.min(isFixed ? 16 : 32, value));
  };

  const paintCount = () => {
    const isFixed = store.state.mode === 'fixed';
    const count = isFixed ? store.state.teamCount : store.state.playerCount;
    countLabel.textContent = isFixed ? 'Number of teams' : 'Number of players';
    countValue.textContent = count;
    countHint.textContent = isFixed
      ? `${count} teams · ${count * 2} players on the sheet`
      : `${count} players · ${Math.floor(count / 4)} on court, ${count - Math.floor(count / 4) * 4} resting each game`;
  };

  const bump = (delta) => {
    store.update((st) => {
      if (st.mode === 'fixed') st.teamCount = clampCount(st.teamCount + delta);
      else st.playerCount = clampCount(st.playerCount + delta);
    }, { silent: true });
    paintCount();
    pop(countValue);
  };

  countRow.append(
    h('div', { class: 'stepper-copy' }, countLabel, countHint),
    h(
      'div',
      { class: 'stepper' },
      h('button', { class: 'step-btn', type: 'button', 'aria-label': 'Fewer', onclick: () => bump(-1) }, icon(ICONS.minus, 18)),
      countValue,
      h('button', { class: 'step-btn', type: 'button', 'aria-label': 'More', onclick: () => bump(1) }, icon(ICONS.plus, 18)),
    ),
  );

  const modeGrid = h(
    'div',
    { class: 'mode-grid', 'data-anim': '' },
    MODES.map((mode) =>
      h(
        'button',
        {
          class: `mode-card${mode.id === s.mode ? ' is-active' : ''}`,
          type: 'button',
          dataset: { mode: mode.id },
          onclick: (e) => {
            store.update((st) => { st.mode = mode.id; }, { silent: true });
            $$('.mode-card').forEach((c) => c.classList.toggle('is-active', c.dataset.mode === mode.id));
            paintCount();
            pop(e.currentTarget);
          },
        },
        h('span', { class: 'mode-icon' }, icon(mode.icon, 24)),
        h('h3', {}, mode.title),
        h('p', {}, mode.blurb),
      ),
    ),
  );

  paintCount();

  return h(
    'section',
    { class: 'screen screen-setup' },
    h(
      'header',
      { class: 'hero', 'data-anim': '' },
      h('p', { class: 'eyebrow' }, 'Matchup engine for racket sports'),
      h('h1', { class: 'title' }, 'TEAM', h('em', {}, 'PICKER')),
      h(
        'p',
        { class: 'lede' },
        'Set your roster, hit start, and every draw is balanced live — equal games for everyone, fresh opponents every time.',
      ),
    ),
    h('h2', { class: 'section-label', 'data-anim': '' }, '01 — Pick your sport'),
    sportGrid,
    h('h2', { class: 'section-label', 'data-anim': '' }, '02 — How are teams formed?'),
    modeGrid,
    h('h2', { class: 'section-label', 'data-anim': '' }, '03 — Roster size'),
    countRow,
    h(
      'div',
      { class: 'actions', 'data-anim': '' },
      h(
        'button',
        {
          class: 'btn btn-primary btn-lg',
          type: 'button',
          onclick: () => {
            store.syncRoster();
            store.update((st) => { st.screen = 'roster'; });
          },
        },
        'Name the roster',
        icon('<path d="M5 12h14M13 6l6 6-6 6"/>', 20),
      ),
      store.state.history.length
        ? h(
            'button',
            {
              class: 'btn btn-ghost',
              type: 'button',
              onclick: () => store.update((st) => { st.screen = 'match'; }),
            },
            `Resume session · game ${store.state.history.length + 1}`,
          )
        : null,
    ),
    h('p', { class: 'footnote', 'data-anim': '' }, `Currently themed for ${getSport(s.sport).name.toLowerCase()}.`),
  );
}
