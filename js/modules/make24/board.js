// Maak 24 pieces shared by the solo screen (play.js) and Saamspeel (together.js):
// the constants, the step rules, dealing (with Lukraak), the card and the Reëls window.

import { t } from '../../core/i18n.js';
import { esc } from '../../ui/dom.js';
import { dealCard } from './cards.js';

export const SKIP_PENALTY_MS = 10000;   // Uitdaging: time added for "Slaan oor"
export const CLAIM_MS = 5 * 60 * 1000;  // Saamspeel: time the claimer has to build the answer
export const GAME_CARDS = 12;           // Saamspeel: cards in one game

export const POSITIONS = ['top', 'right', 'bottom', 'left'];
export const OPS = ['+', '−', '×', '÷'];
const KIO = 'assets/kio/kio-pose-wave.svg';

// The four wedges of the wheel behind the numbers: top, right, bottom, left.
// Corner points sit on the diagonals of a circle of radius 46 around (50, 50).
const WEDGES = [
  'M50 50 L17.5 17.5 A46 46 0 0 1 82.5 17.5 Z',
  'M50 50 L82.5 17.5 A46 46 0 0 1 82.5 82.5 Z',
  'M50 50 L82.5 82.5 A46 46 0 0 1 17.5 82.5 Z',
  'M50 50 L17.5 82.5 A46 46 0 0 1 17.5 17.5 Z'
];

// Whole numbers only, the same rules as the solver.
export function combine(a, op, b) {
  if (op === '+') return { value: a + b };
  if (op === '×') return { value: a * b };
  if (op === '−') return a >= b ? { value: a - b } : { error: 'belowZero' };
  return b !== 0 && a % b === 0 ? { value: a / b } : { error: 'notExact' };
}

// Deal one card, or null if none is left. Lukraak ('random'): every card gets its own level,
// 1, 2 or 3 with equal chance; if a level has no card left to deal (a long recent list),
// the other levels are tried before giving up.
export function dealAtLevel(dots, bigNumbers, recent) {
  const first = 1 + Math.floor(Math.random() * 3);
  const levels = dots === 'random' ? [first, ...[1, 2, 3].filter((l) => l !== first)] : [dots];
  for (const level of levels) {
    try {
      return dealCard({ dots: level, bigNumbers, recent });
    } catch {
      // try the next level
    }
  }
  return null;
}

// The back (Kio waving) and the face of a card. Built once per deal and then only
// updated with syncCard, so Kio's picture never reloads.
export function cardMarkup(card) {
  const tiles = POSITIONS.map((pos, i) =>
    `<button type="button" class="m24-num m24-${pos}" data-i="${i}"><span></span></button>`).join('');
  const dots = ['c1', 'c2', 'c3', 'c4']
    .map((c) => `<span class="m24-dots ${c}" aria-hidden="true">${'<i></i>'.repeat(card.dots)}</span>`).join('');
  const wedges = WEDGES.map((d, i) => `<path class="w${i}" d="${d}"/>`).join('');
  return `
    <button type="button" class="m24-back" id="back" aria-label="${esc(t('make24.flip'))}">
      <img src="${KIO}" alt="" draggable="false">
    </button>
    <div class="m24-card lv${card.dots}" id="face" hidden>
      <svg class="m24-wheel" viewBox="0 0 100 100" aria-hidden="true">${wedges}</svg>
      ${dots}
      <span class="m24-kio" aria-hidden="true"><img src="${KIO}" alt="" draggable="false"></span>
      ${tiles}
    </div>`;
}

// values: one per position (null once merged away); from: the first tapped number;
// active: whether the numbers may be tapped right now.
export function syncCard(root, { values, from, faceUp, won, active }) {
  root.querySelector('#back').hidden = faceUp;
  const face = root.querySelector('#face');
  face.hidden = !faceUp;
  face.classList.toggle('won', won);
  face.querySelectorAll('.m24-num').forEach((b, i) => {
    const v = values[i];
    const text = v === null ? '' : String(v);
    b.firstElementChild.textContent = text;
    b.dataset.len = text.length;
    b.classList.toggle('sel', i === from);
    b.classList.toggle('gone', v === null);
    b.disabled = v === null || !active;
  });
}

// ---- the Reëls window ----

export function rulesMarkup() {
  const list = (prefix, count, vars) => Array.from({ length: count }, (_, i) =>
    `<li>${esc(t(`${prefix}${i + 1}`, vars))}</li>`).join('');
  return `
    <div class="m24-rules" id="rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" hidden>
      <div class="m24-rules-card">
        <div class="m24-rules-head">
          <h2 id="rules-title" data-i18n="make24.rules.title"></h2>
          <button type="button" class="btn-icon" id="rules-x" aria-label="close">✕</button>
        </div>
        <ol>${list('make24.rules.r', 7, { n: SKIP_PENALTY_MS / 1000 })}</ol>
        <p data-i18n="make24.rules.dots"></p>
        <h3 data-i18n="make24.rules.together.title"></h3>
        <ol>${list('make24.rules.together.r', 5, { n: CLAIM_MS / 60000, cards: GAME_CARDS })}</ol>
        <button type="button" class="btn btn-primary" id="rules-close" data-i18n="make24.rules.close"></button>
      </div>
    </div>`;
}

// Wire the Reëls button, the window's close buttons and Escape. onChange runs after the
// window opens or closes (a screen pauses its clocks while the rules are open).
export function wireRules(root, onChange) {
  let open = false;
  const set = (value) => {
    open = value;
    root.querySelector('#rules').hidden = !open;
    onChange();
    if (open) root.querySelector('#rules-close').focus({ preventScroll: true }); // keep the top in view
  };
  const onKey = (e) => { if (e.key === 'Escape' && open) set(false); };
  root.querySelector('#rules-btn').addEventListener('click', () => set(true));
  root.querySelector('#rules-close').addEventListener('click', () => set(false));
  root.querySelector('#rules-x').addEventListener('click', () => set(false));
  document.addEventListener('keydown', onKey);
  return {
    isOpen: () => open,
    dispose: () => document.removeEventListener('keydown', onKey)
  };
}
