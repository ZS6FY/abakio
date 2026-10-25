// Maak 24 – Saamspeel: 2 to 4 players around one device.
//
// Join screen: each player taps a corner (or presses a key) to join.
// Game: a spin picks who turns over the first card; after each card the turn passes to the
// next joined player in number order. When the face shows, the corner blocks are locked for
// LOCK_MS so everyone looks first. The first press claims the card; later presses queue up.
// The claimer builds the answer within CLAIM_MS. Right: they win the card and score its dots.
// Wrong, "Gee op" or time up: the card goes back to the next player in the queue, or to
// everyone if the queue is empty.
// Each card has a clock. After CARD_TIME_MS "Nog tyd?" (once per card) and "Slaan oor" (a vote
// of all players) appear. A card that runs out of time or is skipped goes to the bonus pile;
// the MAX_SKIPS-th skip ends the GAME_CARDS part. Then an optional bonus round with the pile,
// for double points. Players are just "Speler 1–4": nothing is stored.

import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, esc, setPlaying } from '../../ui/dom.js';
import { isRanked } from './cards.js';
import {
  CLAIM_MS, GAME_CARDS, CARD_TIME_MS, NOG_TYD_PROMPT_MS, EXTRA_TIME_MS, MAX_SKIPS,
  OPS, combine, dealAtLevel, cardMarkup, syncCard, rulesMarkup, wireRules
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

const seatByKey = (key) => SEATS.find((s) => s.key === key.toLowerCase())?.n ?? null;
const player = (n) => t('make24.together.player', { n });

// The next joined player in number order: 1 → 2 → 3 → 4 → 1 (joined is sorted).
function nextInOrder(seat, joined) {
  return joined.find((n) => n > seat) ?? joined[0];
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

  // state: 'deal' | 'spin' | 'back' | 'locked' | 'open' | 'claimed' | 'won' | 'bonusAsk'
  let state = 'deal';
  let card = null;
  let played = 0;        // cards of the 12-card part that are finished (won, timed out or skipped)
  let skips = 0;         // skips in the 12-card part
  const bonusPile = [];  // cards put aside for the bonus round
  let bonusRound = false;
  let bonusIndex = 0;    // bonus cards finished
  let turnSeat = null;   // who turns over the card
  let spinSeat = null;   // highlighted during the spin
  let claimer = null;
  let queue = [];        // later presses, in order
  let winner = null;     // who won the current card
  let claimLeft = 0;     // ms the claimer has left
  let cardMs = 0;        // the card clock: face up, nobody building, rules closed, no vote
  let extendedAt = null; // card clock reading when "Nog tyd?" was tapped
  let votes = null;      // a Set of seats while a skip vote is running
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
    <section class="screen play make24-play m24-together${joined.some((n) => n > 2) ? ' has-top' : ''}">
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
          <span class="seat-mark" id="mark${s.n}"></span>
          <span class="seat-tick" aria-hidden="true">✓</span>`) : `<span class="m24-seat-empty ${s.corner}"></span>`)).join('')}
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
            <div class="m24-later" id="later">
              <button type="button" class="btn btn-primary" id="nogtyd"></button>
              <button type="button" class="btn" id="skip" data-i18n="make24.skip"></button>
            </div>
            <div class="m24-later" id="yesno">
              <button type="button" class="btn btn-primary" id="yes" data-i18n="make24.yes"></button>
              <button type="button" class="btn" id="no" data-i18n="make24.no"></button>
            </div>
            <button type="button" class="btn" id="cancel" data-i18n="make24.together.cancel"></button>
          </div>
          <div class="m24-hint" id="skipsleft"></div>
        </div>
      </div>
      ${rulesMarkup()}
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);
  const rules = wireRules(app, () => draw());

  // ---- clocks ----
  // One interval drives both: the claimer's countdown, and the card clock with its
  // "Nog tyd?" prompt and extra time. Neither runs while the rules are open.
  const cardClockRuns = () => (state === 'open' || state === 'locked') && !votes && !rules.isOpen();
  const asking = () => state === 'open' && !votes && extendedAt === null && cardMs >= CARD_TIME_MS;
  const canSkip = () => state === 'open' && !votes && cardMs >= CARD_TIME_MS && (bonusRound || skips < MAX_SKIPS);

  let last = performance.now();
  const tickId = setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (rules.isOpen()) return;
    if (state === 'claimed') {
      claimLeft -= dt;
      if (claimLeft <= 0) return fail('time');
      return showCountdown();
    }
    if (!cardClockRuns()) return;
    const before = cardMs;
    cardMs += dt;
    const outOfTime = extendedAt === null
      ? cardMs >= CARD_TIME_MS + NOG_TYD_PROMPT_MS
      : cardMs >= extendedAt + EXTRA_TIME_MS;
    if (outOfTime) return putAside('time');
    // Redraw when the 2-minute mark passes or a shown countdown changes its seconds.
    if (before < CARD_TIME_MS && cardMs >= CARD_TIME_MS) draw();
    else if (cardMs >= CARD_TIME_MS || extendedAt !== null) showCountdown();
  }, 250);

  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = seatByKey(e.key);
    if (n) press(n, true);
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
  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function showCountdown() {
    let text = '';
    if (state === 'claimed') text = mmss(claimLeft);
    else if (state === 'open' && extendedAt !== null) text = t('make24.together.extraLeft', { t: mmss(extendedAt + EXTRA_TIME_MS - cardMs) });
    el('countdown').textContent = text;
    if (asking()) {
      const s = Math.max(0, Math.ceil((CARD_TIME_MS + NOG_TYD_PROMPT_MS - cardMs) / 1000));
      el('nogtyd').textContent = t('make24.together.nogTyd', { s });
    }
  }

  function statusText() {
    switch (state) {
      case 'spin': return t('make24.together.whoStarts');
      case 'back': return t('make24.together.turn', { n: turnSeat });
      case 'locked': return t('make24.together.look');
      case 'open': return votes ? t('make24.together.vote') : t('make24.together.open');
      case 'claimed': return t('make24.together.building', { n: claimer });
      default: return '';
    }
  }

  function scoreLine() {
    return [...joined].sort((x, y) => scores[y] - scores[x] || x - y)
      .map((n) => `${player(n)}: ${scores[n]}`).join(' · ');
  }

  function progressText() {
    if (bonusRound) return t('make24.together.bonusCard', { n: Math.min(bonusIndex + 1, bonusPile.length), total: bonusPile.length });
    return t('make24.together.card', { n: Math.min(played + 1, GAME_CARDS), total: GAME_CARDS });
  }

  function draw() {
    const building = state === 'claimed';
    const faceUp = card !== null && !['deal', 'spin', 'back'].includes(state);

    el('progress').textContent = state === 'bonusAsk' ? '' : progressText();
    for (const n of joined) {
      const block = app.querySelector(`[data-seat="${n}"]`);
      block.classList.toggle('spin', state === 'spin' && n === spinSeat);
      block.classList.toggle('turn', state === 'back' && n === turnSeat);
      block.classList.toggle('locked', state === 'locked');
      block.classList.toggle('claim', building && n === claimer);
      block.classList.toggle('won', state === 'won' && n === winner);
      block.classList.toggle('voted', Boolean(votes?.has(n)));
      const place = queue.indexOf(n);
      el(`mark${n}`).textContent = building && place >= 0 ? t(`make24.together.q${place + 2}`) : '';
      el(`score${n}`).textContent = scores[n];
    }

    if (card) syncCard(app, { values, from, faceUp, won: state === 'won', active: building });
    el('status').textContent = statusText();

    el('ops').classList.toggle('is-off', !building);
    el('ops').querySelectorAll('[data-op]').forEach((b) => {
      b.classList.toggle('on', b.dataset.op === op);
      b.disabled = !building;
    });
    el('steps').innerHTML = history.map((h) => `<li>${h.text}</li>`).join('');
    el('feedback').textContent = note;
    el('feedback').classList.toggle('m24-ok', noteGood);
    el('scoreline').textContent = state === 'won' || state === 'bonusAsk' ? scoreLine() : '';

    // One thing at a time in the controls slot.
    el('actions').hidden = !building;
    el('undo').disabled = !history.length;
    el('restart').disabled = !history.length;
    el('later').hidden = !(asking() || canSkip());
    el('nogtyd').hidden = !asking();
    el('skip').hidden = !canSkip();
    el('later').classList.toggle('single', asking() !== canSkip());
    el('cancel').hidden = !votes;
    el('yesno').hidden = state !== 'bonusAsk';
    el('skipsleft').textContent = canSkip() && !bonusRound ? t('make24.together.skipsLeft', { n: MAX_SKIPS - skips }) : '';
    const main = el('main');
    main.hidden = !mainAction;
    if (mainAction) {
      main.textContent = t(state === 'back' ? 'make24.flip'
        : state === 'won' ? wonLabel()
        : 'make24.tryAgain');
    }
    showCountdown();
  }

  // ---- presses ----
  // viaKey: on a laptop a player's key also answers "Nog tyd?" while it shows.
  function press(n, viaKey = false) {
    if (!joined.includes(n) || rules.isOpen()) return;
    if (votes) {
      votes.add(n);
      return votes.size === joined.length ? putAside('skip') : draw();
    }
    if (viaKey && asking()) return extend();
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

  // ---- how a card ends ----
  // Is this the last card of the part being played (the 12 cards, or the bonus pile)?
  const partDone = () => (bonusRound ? bonusIndex >= bonusPile.length : played >= GAME_CARDS || skips >= MAX_SKIPS);

  function wonLabel() {
    if (!partDone()) return 'make24.nextCard';
    return !bonusRound && bonusPile.length ? 'make24.together.continue' : 'make24.together.seeScores';
  }

  function win() {
    winner = claimer;
    const points = card.dots * (bonusRound ? 2 : 1); // bonus cards count double
    scores[winner] += points;
    if (bonusRound) bonusIndex++; else played++;
    state = 'won';
    claimer = null;
    queue = [];
    note = `⭐ ${t('make24.together.winCard', { n: winner, p: points })}`;
    noteGood = true;
    mainAction = () => afterCard('');
    draw();
  }

  // Wrong, "Gee op" or claim time up: a calm message, and the card goes back.
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

  // "Nog tyd?": once per card, 2 more minutes from now.
  function extend() {
    if (!asking()) return;
    extendedAt = cardMs;
    draw();
  }

  // Out of time, or skipped by everyone: in the 12-card part the card goes to the bonus pile
  // (only a skip counts as a skip); in the bonus round it is simply gone.
  function putAside(reason) {
    votes = null;
    const lines = [];
    if (bonusRound) {
      bonusIndex++;
      lines.push(t('make24.together.gone'));
    } else {
      played++;
      bonusPile.push(card);
      if (reason === 'skip') {
        skips++;
        lines.push(t('make24.together.skipped'));
      }
      lines.push(t('make24.together.toBonus'));
      if (reason === 'skip') {
        lines.push(skips >= MAX_SKIPS ? t('make24.together.lastSkip') : t('make24.together.skipsLeft', { n: MAX_SKIPS - skips }));
      }
    }
    afterCard(lines.join('\n'));
  }

  function afterCard(message) {
    if (partDone()) return bonusRound ? finish() : endMain(message);
    turnSeat = nextInOrder(turnSeat, joined);
    const then = () => {
      toBack();
      note = message;
      draw();
    };
    if (bonusRound) {
      showCard(bonusPile[bonusIndex]);
      then();
    } else {
      deal(then);
    }
  }

  // The 12 cards are done (or the last skip was used): offer a bonus round if there are cards for it.
  function endMain(message) {
    if (!bonusPile.length) return finish();
    state = 'bonusAsk';
    card = null;
    mainAction = null;
    note = message;
    noteGood = false;
    el('stage').innerHTML = `
      <div class="m24-message m24-bonus-ask">
        <h2>${esc(t('make24.together.bonusAsk'))}</h2>
        <p>${esc(t('make24.together.bonusInfo', { n: bonusPile.length }))}</p>
      </div>`;
    draw();
  }

  function startBonus() {
    bonusRound = true;
    bonusIndex = 0;
    note = '';
    turnSeat = nextInOrder(turnSeat, joined);
    showCard(bonusPile[0]);
    toBack();
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
    winner = null;
    cardMs = 0;
    extendedAt = null;
    votes = null;
    resetCard();
    el('stage').innerHTML = cardMarkup(card);
  }

  // Deal a new card; the first deal of a deck ranks all its cards, so say so while it works.
  function deal(then) {
    const run = () => {
      if (gone) return;
      const next = dealAtLevel(settings.dots, settings.big, recent);
      if (!next) return noCard(then);
      recent.push(next);
      if (recent.length > RECENT_MAX) recent.shift();
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

  // The spin: light the corners in turn, slowing down, and stop on one at random.
  function spin() {
    state = 'spin';
    const startAt = Math.floor(Math.random() * joined.length);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? 0 : joined.length * 2 + Math.floor(Math.random() * joined.length);
    let k = 0;
    const stepOnce = () => {
      if (gone) return;
      spinSeat = joined[(startAt + k) % joined.length];
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

  // Through go(), so this screen's clean-up runs (its timer and keys stop).
  function finish() {
    go(renderFinal, profileId, settings, mod, joined, scores);
  }

  el('stage').addEventListener('click', (e) => {
    if (e.target.closest('.m24-back')) return flip();
    const btn = e.target.closest('.m24-num');
    if (btn && !btn.disabled) tapNumber(Number(btn.dataset.i));
  });
  onSeatPress(app.querySelector('.m24-table'), (n) => press(n));
  el('ops').querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => tapOp(b.dataset.op)));
  el('undo').addEventListener('click', undo);
  el('restart').addEventListener('click', restart);
  el('giveup').addEventListener('click', () => { if (state === 'claimed') fail('giveUp'); });
  el('nogtyd').addEventListener('click', extend);
  el('skip').addEventListener('click', () => { if (canSkip()) { votes = new Set(); draw(); } });
  el('cancel').addEventListener('click', () => { votes = null; draw(); });
  el('yes').addEventListener('click', () => { if (state === 'bonusAsk') startBonus(); });
  el('no').addEventListener('click', () => { if (state === 'bonusAsk') finish(); });
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
