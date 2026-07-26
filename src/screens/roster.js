import { h, $$, icon, ICONS } from '../dom.js';
import { shake } from '../anim.js';

const DEMO_NAMES = [
  'Ava', 'Ben', 'Cruz', 'Dee', 'Eli', 'Fern', 'Gio', 'Hana',
  'Iggy', 'Jo', 'Kai', 'Lux', 'Mika', 'Nino', 'Ola', 'Pip',
  'Quin', 'Rio', 'Sol', 'Tao', 'Uma', 'Vee', 'Wes', 'Xan',
  'Yuki', 'Zara', 'Ash', 'Bo', 'Cleo', 'Dax', 'Esme', 'Finn',
];

export default function rosterScreen(ctx) {
  const { store } = ctx;
  const s = store.state;
  const isFixed = s.mode === 'fixed';

  const body = isFixed ? fixedRoster(store) : shuffleRoster(store);

  const start = () => {
    // Blank names are fine — fill them in so the scoreboard always reads well.
    store.update((st) => {
      st.players.forEach((p, i) => {
        if (!p.name.trim()) p.name = `Player ${i + 1}`;
      });
    }, { silent: true });

    if (store.state.players.length < 4) {
      shake(document.querySelector('.roster-body'));
      return;
    }
    store.startSession();
  };

  return h(
    'section',
    { class: 'screen screen-roster' },
    h(
      'header',
      { class: 'screen-head', 'data-anim': '' },
      h(
        'button',
        {
          class: 'btn btn-icon',
          type: 'button',
          'aria-label': 'Back',
          onclick: () => store.update((st) => { st.screen = 'setup'; }),
        },
        icon(ICONS.back, 20),
      ),
      h(
        'div',
        {},
        h('h1', { class: 'screen-title' }, isFixed ? 'Name your teams' : 'Name your players'),
        h(
          'p',
          { class: 'screen-sub' },
          isFixed
            ? 'Two players per team. Partners stay locked together for the whole session.'
            : 'One pool, new partners every game. Lock a fixed partner if a pair wants to stay together.',
        ),
      ),
      h(
        'button',
        {
          class: 'btn btn-ghost',
          type: 'button',
          onclick: () => {
            store.update((st) => {
              st.players.forEach((p, i) => { p.name = DEMO_NAMES[i % DEMO_NAMES.length]; });
            });
          },
        },
        'Autofill',
      ),
    ),
    h('div', { class: 'roster-body', 'data-anim': '' }, body),
    h(
      'div',
      { class: 'actions actions-sticky', 'data-anim': '' },
      h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: start },
        'Start session',
        icon(ICONS.dice, 20)),
    ),
  );
}

/* ------------------------------------------------------------ fixed mode */

function fixedRoster(store) {
  const s = store.state;
  return h(
    'div',
    { class: 'team-grid' },
    s.teams.map((team, index) => {
      const members = s.players.filter((p) => p.teamId === team.id);
      return h(
        'article',
        { class: 'team-card', style: { '--team-hue': `${(index * 47) % 360}deg` } },
        h(
          'div',
          { class: 'team-card-head' },
          h('span', { class: 'team-index' }, String(index + 1).padStart(2, '0')),
          h('input', {
            class: 'input input-team',
            value: team.name,
            maxlength: 22,
            'aria-label': `Team ${index + 1} name`,
            oninput: (e) => store.renameTeam(team.id, e.target.value),
          }),
        ),
        h(
          'div',
          { class: 'team-players' },
          members.map((player, i) =>
            h('input', {
              class: 'input',
              value: player.name,
              placeholder: `Player ${i + 1}`,
              maxlength: 18,
              'aria-label': `${team.name} player ${i + 1}`,
              oninput: (e) => {
                store.update((st) => {
                  const target = st.players.find((p) => p.id === player.id);
                  if (target) target.name = e.target.value;
                }, { silent: true });
              },
            }),
          ),
        ),
      );
    }),
  );
}

/* ---------------------------------------------------------- shuffle mode */

function shuffleRoster(store) {
  const s = store.state;

  const list = h('div', { class: 'player-list' });

  const repaintSelects = () => {
    const state = store.state;
    $$('select[data-partner-for]', list).forEach((select) => {
      const ownerId = select.dataset.partnerFor;
      const owner = state.players.find((p) => p.id === ownerId);
      select.value = owner?.lockedWith || '';
      const row = select.closest('.player-row');
      row.classList.toggle('is-locked', Boolean(owner?.lockedWith));
      // refresh option labels so renames show up in the dropdowns
      [...select.options].forEach((opt) => {
        if (!opt.value) return;
        const other = state.players.find((p) => p.id === opt.value);
        const taken = other?.lockedWith && other.lockedWith !== ownerId;
        opt.textContent = `${other?.name || 'Player'}${taken ? ' (taken)' : ''}`;
      });
    });
  };

  s.players.forEach((player, index) => {
    const select = h(
      'select',
      {
        class: 'select',
        dataset: { partnerFor: player.id },
        'aria-label': `Fixed partner for player ${index + 1}`,
        onchange: (e) => {
          store.setPartner(player.id, e.target.value || null);
          repaintSelects();
        },
      },
      h('option', { value: '' }, 'No fixed partner'),
      s.players
        .filter((p) => p.id !== player.id)
        .map((p) => h('option', { value: p.id }, p.name || `Player ${s.players.indexOf(p) + 1}`)),
    );

    list.appendChild(
      h(
        'div',
        { class: `player-row${player.lockedWith ? ' is-locked' : ''}` },
        h('span', { class: 'player-index' }, String(index + 1).padStart(2, '0')),
        h('input', {
          class: 'input',
          value: player.name,
          placeholder: `Player ${index + 1}`,
          maxlength: 18,
          'aria-label': `Player ${index + 1} name`,
          oninput: (e) => {
            store.update((st) => {
              const target = st.players.find((p) => p.id === player.id);
              if (target) target.name = e.target.value;
            }, { silent: true });
            repaintSelects();
          },
        }),
        h('span', { class: 'lock-icon' }, icon(ICONS.link, 16)),
        select,
      ),
    );
  });

  // Set initial select values once the nodes exist.
  queueMicrotask(repaintSelects);

  return h(
    'div',
    {},
    h(
      'p',
      { class: 'callout' },
      'Everyone gets the same number of games. Lock a partner only if that pair wants to play together every time — everyone else gets shuffled.',
    ),
    list,
  );
}
