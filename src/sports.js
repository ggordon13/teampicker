/**
 * Sport definitions: palette, vocabulary and real court line geometry.
 * Court lines are expressed in feet (x = width, z = length) and are used both
 * by the Three.js background and by the little court glyph on the match card.
 */

function rect(x, z) {
  return [
    [-x, -z, x, -z],
    [x, -z, x, z],
    [x, z, -x, z],
    [-x, z, -x, -z],
  ];
}

export const SPORTS = {
  pickleball: {
    id: 'pickleball',
    name: 'Pickleball',
    icon: '🥒',
    tagline: 'Dink, drive, dominate',
    accent: '#c6ff2e',
    accent2: '#00e5b0',
    ball: '#d8ff3d',
    court: '#0b3d5c',
    bg: '#04121c',
    size: { w: 20, l: 44 },
    lines: [
      ...rect(10, 22),
      [-10, 0, 10, 0], // net
      [-10, 7, 10, 7], // non-volley zone
      [-10, -7, 10, -7],
      [0, 7, 0, 22], // centre service lines
      [0, -7, 0, -22],
    ],
  },
  tennis: {
    id: 'tennis',
    name: 'Tennis',
    icon: '🎾',
    tagline: 'Advantage, everyone',
    accent: '#ccff00',
    accent2: '#ff7a1a',
    ball: '#e3ff4f',
    court: '#1b4d8f',
    bg: '#06101f',
    size: { w: 36, l: 78 },
    lines: [
      ...rect(18, 39),
      [-18, 0, 18, 0], // net
      [-13.5, -39, -13.5, 39], // singles sidelines
      [13.5, -39, 13.5, 39],
      [-13.5, 21, 13.5, 21], // service lines
      [-13.5, -21, 13.5, -21],
      [0, -21, 0, 21], // centre service line
    ],
  },
  badminton: {
    id: 'badminton',
    name: 'Badminton',
    icon: '🏸',
    tagline: 'Feathers and fury',
    accent: '#a78bfa',
    accent2: '#22d3ee',
    ball: '#f4f7ff',
    court: '#14584a',
    bg: '#050f12',
    size: { w: 20, l: 44 },
    lines: [
      ...rect(10, 22),
      [-10, 0, 10, 0], // net
      [-8.5, -22, -8.5, 22], // singles sidelines
      [8.5, -22, 8.5, 22],
      [-10, 6.5, 10, 6.5], // short service lines
      [-10, -6.5, 10, -6.5],
      [-10, 19.5, 10, 19.5], // doubles long service lines
      [-10, -19.5, 10, -19.5],
      [0, 6.5, 0, 22],
      [0, -6.5, 0, -22],
    ],
  },
  padel: {
    id: 'padel',
    name: 'Padel',
    icon: '🧱',
    tagline: 'Play the walls',
    accent: '#38bdf8',
    accent2: '#f472b6',
    ball: '#bff3ff',
    court: '#1e3a8a',
    bg: '#050c1a',
    size: { w: 20, l: 66 },
    lines: [
      ...rect(10, 33),
      [-10, 0, 10, 0], // net
      [-10, 10, 10, 10], // service lines
      [-10, -10, 10, -10],
      [0, 10, 0, 33],
      [0, -10, 0, -33],
    ],
  },
  tabletennis: {
    id: 'tabletennis',
    name: 'Table Tennis',
    icon: '🏓',
    tagline: 'Fast hands only',
    accent: '#ff8a3d',
    accent2: '#ff2d78',
    ball: '#ffb066',
    court: '#12309c',
    bg: '#060a1a',
    size: { w: 5, l: 9 },
    lines: [
      ...rect(2.5, 4.5),
      [-2.5, 0, 2.5, 0], // net
      [0, -4.5, 0, 4.5], // centre line
    ],
  },
};

export const SPORT_LIST = Object.values(SPORTS);

export function getSport(id) {
  return SPORTS[id] || SPORTS.pickleball;
}
