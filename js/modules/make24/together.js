// Maak 24 – Saamspeel: 2 to 4 players around one device.
//
// Join screen: each player taps a corner (or presses a key) to join.
// Game: a spin picks who turns over the first card; after each card the turn passes clockwise.
// When the face shows, the corner blocks are locked for LOCK_MS so everyone looks first.
// The first press claims the card; later presses queue up. The claimer builds the answer
// within CLAIM_MS. Right: they win the card and score its dots. Wrong, "Gee op" or time up:
// the card goes back to the next player in the queue, or to everyone if the queue is empty.
// After GAME_CARDS cards the most points wins. Players are just "Speler 1–4": nothing is stored.

import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, esc, setPlaying } from '../../ui/dom.js';
import { isRanked } from './cards.js';
import {
  CLAIM_MS, GAME_CARDS, OPS, combine, dealAtLevel, cardMarkup, syncCard, rulesMarkup, wireRules
} from './board.js';

const LOCK_MS = 1000;
const RECENT_MAX = 20;

// Seats: 1 bottom-left, 2 bottom-right, 3 top-right, 4 top-left, with a key each for laptops.
const SEATS = [
  { n: 1, corner: 'bl', key: 'z' },
  { n: 2, corner: 'br', key: 'm' },
  { n: 3, corner: 'tr', key: 'p' },
  { n: 4, corner: 'tl', key: 'q' }
];
// Going clockwise round the screen: bottom-left → top-left → top-right → bottom-right.
const CLOCKWISE = [1, 4, 3, 2];

const seatByKey = (key) => SEATS.find((s) => s.key === key.toLowerCase())?.n ?? null;
const player = (n) => t('make24.together.player', { n });

function nextClockwise(seat, joined) {
  const start = CLOCKWISE.indexOf(seat);
  for (let i = 1; i <= CLOCKWISE.length; i++) {
    const next = CLOCKWISE[(start + i) % CLOCKWISE.length];
    if (joined.includes(next)) return next;
  }
  return seat;
}

// One corner block. Unjoined corners in a game are just empty space.
function seatHtml(s, inner) {
  return `<button type="button" class="m24-seat ${s.corner} s${s.n}" data-seat="${s.n}">${inner}</button>`;
}

// Presses: pointerdown answers at once and works with several fingers at the same time
// (the first one registered wins). A keyboard "click" on a focused block counts too.
function onSeatPress(root, handler) {
  root.addEventListener('pointerdown', (e) => {
    const block = e.target.closest('[data-seat]');
    if (!block) return;
    e.preventDefault();
    handler(Number(block.dataset.seat));
  });
  root.addEventListener('click', (e) => {
    const block = e.target.closest('[data-seat]');
    if (block && e.detail === 0) handler(Number(block.dataset.seat));
  });
}

// ---- join screen ----

export function renderMake24Join(profileId, settings, mod, seats = []) {
  setPlaying(true);
  const joined = new Set(seats);

  const app = mount(`
    <section class="screen m24-together m24-join">
      <div class="m24-table">
        <div class="m24-bar">
          <button type="button" class="btn-icon" id="quit" aria-label="back">←</button>
          <button type="button" class="m24-rules-btn" id="rules-btn" data-i18n="make24.rulesBtn"></button>
        </div>
        ${SEATS.map((s) => seatHtml(s, `
          <span class="seat-name">${esc(player(s.n))}</span>
          <span class="seat-key">${s.key.toUpperCase()}</span>
          <span class="seat-tick" aria-hidden="true">✓</span>`)).join('')}
        <div class="m24-mid">
          <h2 data-i18n="make24.together.joinTitle"></h2>
          <p class="m24-hint" data-i18n="make24.together.joinHint"></p>
          <p class="m24-hint" id="need" data-i18n="make24.together.needTwo"></p>
          <button type="button" class="btn btn-primary" id="begin" data-i18n="tables.start"></button>
        </div>
      </div>
      ${rulesMarkup()}
    </section>`);

  const rules = wireRules(app, () => {});
  const draw = () => {
    app.querySelectorAll('[data-seat]').forEach((b) => {
      const on = joined.has(Number(b.dataset.seat));
      b.classList.toggle('joined', on);
      b.setAttribute('aria-pressed', String(on));
    });
    app.querySelector('#begin').disabled = joined.size < 2;
    app.querySelector('#need').hidden = joined.size >= 2;
  };
  const toggle = (n) => {
    if (rules.isOpen()) return;
    if (joined.has(n)) joined.delete(n); else joined.add(n);
    draw();
  };

  // Listen on the table, not on #app: #app outlives this screen.
  onSeatPress(app.querySelector('.m24-table'), toggle);
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = seatByKey(e.key);
    if (n) toggle(n);
  };
  document.addEventListener('keydown', onKey);
  onLeave(() => { document.removeEventListener('keydown', onKey); rules.dispose(); });

  app.querySelector('#quit').addEventListener('click', () => go(mod.setup, profileId, mod));
  app.querySelector('#begin').addEventListener('click', () => {
    if (joined.size >= 2) go(renderMake24Together, profileId, settings, mod, [...joined].sort());
  });
  draw();
}

// ---- the game ----

export function renderMake24Together(profileId, settings, mod, seats) {
  setPlaying(true);
  const joined = [...seats];
  const scores = Object.fromEntries(joined.map((n) => [n, 0]));
  const recent = [];

  // state: 'deal' | 'spin' | 'back' | 'locked' | 'open' | 'claimed' | 'won'
  let state = 'deal';
  let card = null;
  let done = 0;          // cards won so far
  let turnSeat = null;   // who turns over the card
  let spinSeat = null;   // highlighted during the spin
  let claimer = null;
  let queue = [];        // later presses, in order
  let winner = null;     // who won the current card
  let claimLeft = 0;     // ms the claimer has left
  let values = [];
  let history = [];
  let from = null;
  let op = null;
  let note = '';
  let noteGood = false;
  let mainAction = null;
  let timer = null;
  let gone = false;

  const app = mount(`
    <section class="screen play make24-play m24-together">
      <div class="m24-table">
        <div class="m24-bar">
          <button type="button" class="btn-icon" id="quit" aria-label="quit">✕</button>
          <button type="button" class="m24-rules-btn" id="rules-btn" data-i18n="make24.rulesBtn"></button>
          <span class="m24-progress" id="progress"></span>
        </div>
        ${SEATS.map((s) => (joined.includes(s.n) ? seatHtml(s, `
          <span class="seat-name">${esc(player(s.n))}</span>
          <span class="seat-key">${s.key.toUpperCase()}</span>
          <span class="seat-score" id="score${s.n}">0</span>
          <span class="seat-mark" id="mark${s.n}"></span>`) : `<span class="m24-seat-empty ${s.corner}"></span>`)).join('')}
        <div class="m24-mid">
          <div class="m24-stage" id="stage"></div>
          <div class="m24-status"><span id="status"></span> <span class="m24-countdown" id="countdown"></span></div>
          <div class="seg m24-ops" id="ops">
            ${OPS.map((o) => `<button type="button" class="seg-btn" data-op="${o}">${o}</button>`).join('')}
          </div>
          <ol class="m24-steps" id="steps"></ol>
          <div class="feedback" id="feedback"></div>
          <div class="m24-badges" id="scoreline"></div>
          <div class="m24-controls">
            <button type="button" class="btn btn-primary" id="main" hidden></button>
            <div class="m24-actions three-across" id="actions">
              <button type="button" class="btn" id="undo" data-i18n="make24.undo"></button>
              <button type="button" class="btn" id="restart" data-i18n="make24.restart"></button>
              <button type="button" class="btn" id="giveup" data-i18n="make24.together.giveUp"></button>
            </div>
          </div>
        </div>
      </div>
      ${rulesMarkup()}
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);
  const rules = wireRules(app, () => draw());

  // The claim countdown only runs while the rules are closed.
  let last = performance.now();
  const tickId = setInterval(() => {
    const now = performance.now();
    if (state === 'claimed' && !rules.isOpen()) {
      claimLeft -= now - last;
      if (claimLeft <= 0) fail('time');
      else showCountdown();
    }
    last = now;
  }, 250);

  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = seatByKey(e.key);
    if (n) press(n);
  };
  document.addEventListener('keydown', onKey);
  onLeave(() => {
    gone = true;
    clearTimeout(timer);
    clearInterval(tickId);
    document.removeEventListener('keydown', onKey);
    rules.dispose();
  });

  // ---- drawing ----
  function showCountdown() {
    const s = Math.max(0, Math.ceil(claimLeft / 1000));
    el('countdown').textContent = state === 'claimed' ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
  }

  function statusText() {
    switch (state) {
      case 'spin': return t('make24.together.whoStarts');
      case 'back': return t('make24.together.turn', { n: turnSeat });
      case 'locked': return t('make24.together.look');
      case 'open': return t('make24.together.open');
      case 'claimed': return t('make24.together.building', { n: claimer });
      default: return '';
    }
  }

  function scoreLine() {
    return [...joined].sort((x, y) => scores[y] - scores[x] || x - y)
      .map((n) => `${player(n)}: ${scores[n]}`).join(' · ');
  }

  function draw() {
    const building = state === 'claimed';
    const faceUp = card !== null && !['deal', 'spin', 'back'].includes(state);

    el('progress').textContent = t('make24.together.card', { n: Math.min(done + 1, GAME_CARDS), total: GAME_CARDS });
    for (const n of joined) {
      const block = app.querySelector(`[data-seat="${n}"]`);
      block.classList.toggle('spin', state === 'spin' && n === spinSeat);
      block.classList.toggle('turn', state === 'back' && n === turnSeat);
      block.classList.toggle('locked', state === 'locked');
      block.classList.toggle('claim', building && n === claimer);
      block.classList.toggle('won', state === 'won' && n === winner);
      const place = queue.indexOf(n);
      el(`mark${n}`).textContent = building && place >= 0 ? t(`make24.together.q${place + 2}`) : '';
      el(`score${n}`).textContent = scores[n];
    }

    if (card) syncCard(app, { values, from, faceUp, won: state === 'won', active: building });
    el('status').textContent = statusText();
    showCountdown();

    el('ops').classList.toggle('is-off', !building);
    el('ops').querySelectorAll('[data-op]').forEach((b) => {
      b.classList.toggle('on', b.dataset.op === op);
      b.disabled = !building;
    });
    el('steps').innerHTML = history.map((h) => `<li>${h.text}</li>`).join('');
    el('feedback').textContent = note;
    el('feedback').classList.toggle('m24-ok', noteGood);
    el('scoreline').textContent = state === 'won' ? scoreLine() : '';

    el('actions').hidden = !building;
    el('undo').disabled = !history.length;
    el('restart').disabled = !history.length;
    const main = el('main');
    main.hidden = !mainAction;
    if (mainAction) {
      main.textContent = t(state === 'back' ? 'make24.flip'
        : state === 'won' ? (done >= GAME_CARDS ? 'make24.together.seeScores' : 'make24.nextCard')
        : 'make24.tryAgain');
    }
  }

  // ---- presses ----
  function press(n) {
    if (!joined.includes(n) || rules.isOpen()) return;
    if (state === 'open') return claim(n);
    if (state === 'claimed' && n !== claimer && !queue.includes(n)) {
      queue.push(n);
      draw();
    }
  }

  function claim(n) {
    claimer = n;
    state = 'claimed';
    claimLeft = CLAIM_MS;
    resetCard();
    draw();
  }

  // ---- building the answer (same rules as solo) ----
  function resetCard() {
    values = [...card.numbers];
    history = [];
    from = null;
    op = null;
  }

  function tapNumber(i) {
    if (state !== 'claimed' || values[i] === null) return;
    note = '';
    if (from === null) from = i;
    else if (i === from) from = null;
    else if (op === null) from = i;
    else {
      const a = from;
      const o = op;
      from = null;
      op = null;
      const result = combine(values[a], o, values[i]);
      if (result.error) {
        note = t(`make24.${result.error}`);
      } else {
        history.push({ values: [...values], text: `${values[a]} ${o} ${values[i]} = ${result.value}` });
        values[a] = null;
        values[i] = result.value;
        const left = values.filter((v) => v !== null);
        if (left.length === 1) return left[0] === 24 ? win() : fail('wrong', left[0]);
      }
    }
    draw();
  }

  function tapOp(o) {
    if (state !== 'claimed') return;
    note = '';
    op = op === o ? null : o;
    draw();
  }

  function undo() {
    if (state !== 'claimed' || !history.length) return;
    values = history.pop().values;
    from = null;
    op = null;
    note = '';
    draw();
  }

  function restart() {
    if (state !== 'claimed') return;
    resetCard();
    note = '';
    draw();
  }

  function win() {
    winner = claimer;
    scores[winner] += card.dots;
    done++;
    state = 'won';
    claimer = null;
    queue = [];
    note = `⭐ ${t('make24.together.winCard', { n: winner, p: card.dots })}`;
    noteGood = true;
    mainAction = done >= GAME_CARDS ? finish : nextCard;
    draw();
  }

  // Wrong, "Gee op" or time up: a calm message, and the card goes back.
  function fail(reason, value) {
    const lines = [
      reason === 'wrong' ? t('make24.wrong', { n: value })
        : reason === 'giveUp' ? t('make24.together.gaveUp', { n: claimer })
        : t('make24.together.timeUp')
    ];
    const next = queue.shift();
    if (next) {
      claim(next);
      lines.push(t('make24.together.nextChance', { n: next }));
    } else {
      claimer = null;
      state = 'open';
      resetCard();
      lines.push(t('make24.together.allOpen'));
    }
    note = lines.join('\n');
    noteGood = false;
    draw();
  }

  // ---- cards ----
  function flip() {
    if (state !== 'back') return;
    state = 'locked';
    mainAction = null;
    note = '';
    resetCard();
    draw();
    timer = setTimeout(() => { state = 'open'; draw(); }, LOCK_MS);
  }

  function showCard(next) {
    card = next;
    recent.push(next);
    if (recent.length > RECENT_MAX) recent.shift();
    winner = null;
    resetCard();
    el('stage').innerHTML = cardMarkup(card);
  }

  // Deal a card; the first deal of a deck ranks all its cards, so say so while it works.
  function deal(then) {
    const run = () => {
      if (gone) return;
      const next = dealAtLevel(settings.dots, settings.big, recent);
      if (!next) return noCard(then);
      showCard(next);
      then();
    };
    state = 'deal';
    mainAction = null;
    if (isRanked(settings.big)) return run();
    card = null;
    el('stage').innerHTML = `<p class="m24-message">${t('make24.shuffling')}</p>`;
    draw();
    timer = setTimeout(run, 80);
  }

  function noCard(then) {
    card = null;
    el('stage').innerHTML = `<p class="m24-message">${t('make24.noCard')}</p>`;
    mainAction = () => { recent.length = 0; deal(then); };
    draw();
  }

  function toBack() {
    state = 'back';
    note = '';
    noteGood = false;
    mainAction = flip;
    draw();
  }

  function nextCard() {
    turnSeat = nextClockwise(turnSeat, joined);
    deal(toBack);
  }

  // The spin: light the corners in turn (clockwise), slowing down, and stop on one at random.
  function spin() {
    state = 'spin';
    const order = CLOCKWISE.filter((n) => joined.includes(n));
    const startAt = Math.floor(Math.random() * order.length);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 0 : order.length * 2 + Math.floor(Math.random() * order.length);
    let k = 0;
    const stepOnce = () => {
      if (gone) return;
      spinSeat = order[(startAt + k) % order.length];
      draw();
      if (k >= steps) {
        turnSeat = spinSeat;
        timer = setTimeout(toBack, reduce ? 0 : 500);
        return;
      }
      k++;
      timer = setTimeout(stepOnce, 70 + 260 * (k / Math.max(steps, 1)) ** 2);
    };
    stepOnce();
  }

  function finish() {
    renderFinal(profileId, settings, mod, joined, scores);
  }

  el('stage').addEventListener('click', (e) => {
    if (e.target.closest('.m24-back')) return flip();
    const btn = e.target.closest('.m24-num');
    if (btn && !btn.disabled) tapNumber(Number(btn.dataset.i));
  });
  onSeatPress(app.querySelector('.m24-table'), press);
  el('ops').querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => tapOp(b.dataset.op)));
  el('undo').addEventListener('click', undo);
  el('restart').addEventListener('click', restart);
  el('giveup').addEventListener('click', () => { if (state === 'claimed') fail('giveUp'); });
  el('main').addEventListener('click', () => mainAction?.());
  el('quit').addEventListener('click', () => {
    if (confirm(t('play.quitConfirm'))) go(mod.setup, profileId, mod);
  });

  deal(spin);
}

// ---- final scoreboard (nothing is saved) ----

function renderFinal(profileId, settings, mod, joined, scores) {
  setPlaying(false);
  const ranked = [...joined].sort((x, y) => scores[y] - scores[x] || x - y);
  const top = scores[ranked[0]];
  const winners = ranked.filter((n) => scores[n] === top);
  const names = winners.map(player);
  const headline = winners.length === 1
    ? t('make24.together.winner', { n: winners[0] })
    : t('make24.together.tie', {
      names: `${names.slice(0, -1).join(', ')} ${t('make24.together.and')} ${names[names.length - 1]}`
    });
  const pts = (n) => (n === 1 ? t('make24.together.point') : t('make24.together.points', { n }));

  const app = mount(`
    <section class="screen results m24-final">
      <img class="mascot small" src="assets/icons/icon-512.png" alt="" width="120" height="120">
      <h2 data-i18n="make24.together.finalTitle"></h2>
      <p class="record">${esc(headline)}</p>
      <ol class="m24-scores">
        ${ranked.map((n) => `
          <li class="${scores[n] === top ? 'top' : ''}">
            <span>${scores[n] === top ? '🏆 ' : ''}${esc(player(n))}</span>
            <strong>${esc(pts(scores[n]))}</strong>
          </li>`).join('')}
      </ol>
      <button type="button" class="btn btn-primary" id="again" data-i18n="results.again"></button>
      <button type="button" class="btn" id="back" data-i18n="make24.together.back"></button>
    </section>`);

  app.querySelector('#again').addEventListener('click', () => go(renderMake24Together, profileId, settings, mod, joined));
  app.querySelector('#back').addEventListener('click', () => go(mod.setup, profileId, mod));
}
