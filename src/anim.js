import { gsap } from 'gsap';

const reduced =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const D = reduced ? 0.01 : 1; // global duration scale

/** Screen entrance: children rise and fade in with a stagger. */
export function enterScreen(root) {
  const items = root.querySelectorAll('[data-anim]');
  gsap.fromTo(
    root,
    { opacity: 0 },
    { opacity: 1, duration: 0.28 * D, ease: 'power2.out' },
  );
  if (!items.length) return;
  gsap.fromTo(
    items,
    { y: 26, opacity: 0, filter: 'blur(6px)' },
    {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 0.55 * D,
      ease: 'power3.out',
      stagger: 0.055 * D,
      clearProps: 'filter',
    },
  );
}

export function exitScreen(root) {
  return gsap.to(root, {
    opacity: 0,
    y: -14,
    duration: 0.2 * D,
    ease: 'power2.in',
  });
}

/** The "VS" slam used when a new matchup is revealed. */
export function slamMatch(card) {
  const sides = card.querySelectorAll('[data-side]');
  const vs = card.querySelector('[data-vs]');
  const tl = gsap.timeline();
  tl.fromTo(
    sides[0],
    { x: -90, opacity: 0, rotateY: -25 },
    { x: 0, opacity: 1, rotateY: 0, duration: 0.5 * D, ease: 'back.out(1.6)' },
    0,
  );
  if (sides[1]) {
    tl.fromTo(
      sides[1],
      { x: 90, opacity: 0, rotateY: 25 },
      { x: 0, opacity: 1, rotateY: 0, duration: 0.5 * D, ease: 'back.out(1.6)' },
      0,
    );
  }
  if (vs) {
    tl.fromTo(
      vs,
      { scale: 2.6, opacity: 0, rotate: -18 },
      { scale: 1, opacity: 1, rotate: 0, duration: 0.45 * D, ease: 'back.out(2.4)' },
      0.12,
    );
    tl.to(vs, { scale: 1.14, duration: 0.14 * D, yoyo: true, repeat: 1, ease: 'power2.inOut' }, '>-0.05');
  }
  return tl;
}

/** Winner celebration: loser dims, winner flares, confetti rains. */
export function celebrate(winnerEl, loserEl, colors) {
  const tl = gsap.timeline();
  if (loserEl) {
    tl.to(loserEl, { opacity: 0.32, scale: 0.94, filter: 'grayscale(0.8)', duration: 0.35 * D }, 0);
  }
  tl.to(winnerEl, { scale: 1.06, duration: 0.18 * D, ease: 'power2.out' }, 0)
    .to(winnerEl, { scale: 1, duration: 0.5 * D, ease: 'elastic.out(1, 0.45)' })
    .add(() => confetti(colors), 0.05);
  return tl;
}

export function confetti(colors = ['#c6ff2e', '#00e5b0', '#ffffff']) {
  if (reduced) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  document.body.appendChild(layer);

  const pieces = [];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.background = colors[i % colors.length];
    piece.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
    piece.style.top = '42%';
    piece.style.width = `${5 + Math.random() * 7}px`;
    piece.style.height = `${8 + Math.random() * 10}px`;
    piece.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
    layer.appendChild(piece);
    pieces.push(piece);
  }

  gsap.to(pieces, {
    x: () => (Math.random() - 0.5) * window.innerWidth * 1.1,
    y: () => window.innerHeight * (0.5 + Math.random() * 0.6),
    rotate: () => (Math.random() - 0.5) * 900,
    opacity: 0,
    duration: () => 1.1 + Math.random() * 0.9,
    ease: 'power2.out',
    onComplete: () => layer.remove(),
  });
}

/** Animated integer counter. */
export function countTo(node, value, duration = 0.7) {
  const obj = { v: Number(node.textContent) || 0 };
  gsap.to(obj, {
    v: value,
    duration: duration * D,
    ease: 'power2.out',
    onUpdate: () => {
      node.textContent = Math.round(obj.v);
    },
  });
}

export function growBars(root) {
  const bars = root.querySelectorAll('[data-bar]');
  gsap.fromTo(
    bars,
    { scaleX: 0 },
    {
      scaleX: 1,
      duration: 0.7 * D,
      ease: 'power3.out',
      stagger: 0.04 * D,
      transformOrigin: 'left center',
    },
  );
}

export function shake(node) {
  gsap.fromTo(
    node,
    { x: -8 },
    { x: 0, duration: 0.5 * D, ease: 'elastic.out(1.6, 0.35)' },
  );
}

export function pop(node) {
  gsap.fromTo(
    node,
    { scale: 0.86 },
    { scale: 1, duration: 0.42 * D, ease: 'back.out(2.6)' },
  );
}

export { gsap, reduced };
