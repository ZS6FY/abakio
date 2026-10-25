// Play screen for Maak 24.
// Tap a number, an operator and a second number: the two merge into the second
// number's place. Numbers never move or turn, so the card stays easy to read
// from every side.
//
// Two ways to play:
//   free play  – no horlosie; "Wys my"; a skipped card comes back later
//   Uitdaging  – the horlosie runs only while a card is face up and the rules are closed;
//                no "Wys my"; skipping deals a new card for SKIP_PENALTY_MS extra time
//                  5 / 10 cards: the round ends when that many cards are solved; total time counts
//                  ∞:           keep going until the first skip; count the solved cards

import { getProfile, getBest, setBest } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, esc, setPlaying, formatSeconds } from '../../ui/dom.js';
import { awardMake24Card, badgeName, badgeIcon } from '../practice/badges.js';
import { renderResults } from '../practice/play.js';
import { dealCard, easiest, isRanked } from './cards.js';

export const SKIP_PENALTY_MS = 10000;
const RECENT_MAX = 20;
const SKIP_RETURN_AFTER = 3; // free play: cards dealt before a skipped card comes back
const POSITIONS = ['top', 'right', 'bottom', 'left'];
const OPS = ['+', '−', '×', '÷'];
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
function combine(a, op, b) {
  if (op === '+') return { value: a + b };
  if (op === '×') return { value: a * b };
  if (op === '−') return a >= b ? { value: a - b } : { error: 'belowZero' };
  return b !== 0 && a % b === 0 ? { value: a / b } : { error: 'notExact' };
}

export function renderMake24Play(profileId, settings, mod) {
  if (!getProfile(profileId)) return;
  setPlaying(true);

  const isChallenge = settings.mode === 'challenge';
  const isStreak = isChallenge && settings.count === 'inf';
  const isTimed = isChallenge && !isStreak;
  const roundSize = isTimed ? Number(settings.count) : 0;
  const size = settings.big ? 'big' : 'small';

  const recent = [];  // last dealt cards, so the same card doesn't come straight back
  const skipped = []; // free play: { card, due } – come back once `dealt` reaches `due`
  let dealt = 0;

  let card = null;    // null while shuffling or when no card could be dealt
  let faceUp = false; // a new card shows its back first
  let values = [];    // one per position; null once merged into another number
  let history = [];   // { values, text } per step, for Ontdoen
  let from = null;    // position of the first tapped number
  let op = null;
  let phase = 'play'; // 'play' | 'won' | 'shown' | 'wrong'
  let hint = null;    // next step of the easiest solution while "Wys my" is running
  let usedHint = false;
  let note = '';
  let noteGood = false;
  let badgeNote = ''; // new badges, shown small under the main button
  let mainAction = null;
  let timer = null;
  let gone = false;

  // Uitdaging round
  let solved = 0;
  let streak = 0;
  let skips = 0;
  let penalty = 0;
  let roundOver = false;
  let rulesOpen = false;
  let cardRecord = null;      // best new one-card time set in this round
  const freshBadges = [];

  // The horlosie: `total` is the running time of the round, `card` of the current card.
  // `since` is set while the clock runs.
  const clock = { total: 0, card: 0, since: null };
  let timerId = null;

  const app = mount(`
    <section class="screen play make24-play">
      <div class="play-top">
        <button type="button" class="btn-icon" id="quit" aria-label="quit">✕</button>
        <button type="button" class="m24-rules-btn" id="rules-btn" data-i18n="make24.rulesBtn"></button>
        <span id="progress"></span>
        <span id="timer"></span>
      </div>
      <div class="m24-stage" id="stage"></div>
      <div class="seg m24-ops" id="ops">
        ${OPS.map((o) => `<button type="button" class="seg-btn" data-op="${o}">${o}</button>`).join('')}
      </div>
      <ol class="m24-steps" id="steps"></ol>
      <div class="feedback" id="feedback"></div>
      <button type="button" class="btn btn-primary" id="main" hidden></button>
      <div class="m24-badges" id="badges"></div>
      <div class="m24-actions${isChallenge ? ' three' : ''}" id="actions">
        <button type="button" class="btn" id="undo" data-i18n="make24.undo"></button>
        <button type="button" class="btn" id="restart" data-i18n="make24.restart"></button>
        <button type="button" class="btn" id="show" data-i18n="make24.show"${isChallenge ? ' hidden' : ''}></button>
        <button type="button" class="btn" id="skip" data-i18n="make24.skip"></button>
      </div>

      <div class="m24-rules" id="rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" hidden>
        <div class="m24-rules-card">
          <div class="m24-rules-head">
            <h2 id="rules-title" data-i18n="make24.rules.title"></h2>
            <button type="button" class="btn-icon" id="rules-x" aria-label="close">✕</button>
          </div>
          <ol>
            ${[1, 2, 3, 4, 5, 6, 7].map((n) =>
              `<li>${esc(t(`make24.rules.r${n}`, { n: SKIP_PENALTY_MS / 1000 }))}</li>`).join('')}
          </ol>
          <p data-i18n="make24.rules.dots"></p>
          <button type="button" class="btn btn-primary" id="rules-close" data-i18n="make24.rules.close"></button>
        </div>
      </div>
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);

  // ---- the horlosie ----
  function tick() {
    if (clock.since === null) return;
    const now = performance.now();
    clock.total += now - clock.since;
    clock.card += now - clock.since;
    clock.since = now;
  }

  // Runs only while a card is face up and being worked on, with the rules closed.
  function syncClock() {
    const run = isChallenge && card !== null && faceUp && !rulesOpen && (phase === 'play' || phase === 'wrong');
    if (run && clock.since === null) clock.since = performance.now();
    if (!run && clock.since !== null) { tick(); clock.since = null; }
  }

  const elapsed = () => { tick(); return clock.total + penalty; };
  const showTime = () => { if (isChallenge) el('timer').textContent = formatSeconds(elapsed()); };

  if (isChallenge) timerId = setInterval(showTime, 100);
  const onKey = (e) => { if (e.key === 'Escape' && rulesOpen) setRules(false); };
  document.addEventListener('keydown', onKey);
  onLeave(() => {
    gone = true;
    clearTimeout(timer);
    clearInterval(timerId);
    document.removeEventListener('keydown', onKey);
  });

  // ---- drawing ----
  // The card is built once per deal and then only updated, so Kio's picture never reloads.
  function buildCard() {
    const tiles = POSITIONS.map((pos, i) =>
      `<button type="button" class="m24-num m24-${pos}" data-i="${i}"><span></span></button>`).join('');
    const dots = ['c1', 'c2', 'c3', 'c4']
      .map((c) => `<span class="m24-dots ${c}" aria-hidden="true">${'<i></i>'.repeat(card.dots)}</span>`).join('');
    const wedges = WEDGES.map((d, i) => `<path class="w${i}" d="${d}"/>`).join('');
    el('stage').innerHTML = `
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

  function syncCard() {
    el('back').hidden = faceUp;
    const face = el('face');
    face.hidden = !faceUp;
    face.classList.toggle('won', phase === 'won');
    face.querySelectorAll('.m24-num').forEach((b, i) => {
      const v = values[i];
      const text = v === null ? '' : String(v);
      b.firstElementChild.textContent = text;
      b.dataset.len = text.length;
      b.classList.toggle('sel', i === from);
      b.classList.toggle('gone', v === null);
      b.disabled = v === null || phase !== 'play' || !faceUp;
    });
  }

  function progressText() {
    if (isTimed) return `${Math.min(solved + 1, roundSize)} / ${roundSize}`;
    if (isStreak) return `🔥 ${streak}`;
    return '';
  }

  function draw() {
    const live = card !== null;
    const playing = live && faceUp && !rulesOpen && (phase === 'play' || phase === 'wrong');

    syncClock();
    showTime();
    el('progress').textContent = progressText();
    if (live) syncCard();
    el('ops').querySelectorAll('[data-op]').forEach((b) => {
      b.classList.toggle('on', b.dataset.op === op);
      b.disabled = !live || !faceUp || phase !== 'play';
    });
    el('steps').innerHTML = history.map((h) => `<li>${h.text}</li>`).join('');

    el('feedback').textContent = note;
    el('feedback').classList.toggle('m24-ok', noteGood);
    el('badges').textContent = badgeNote;

    el('undo').disabled = !(playing && history.length);
    el('restart').disabled = !(playing && history.length);
    el('show').disabled = !playing;
    el('skip').disabled = !playing;

    const flipping = live && !faceUp;
    const main = el('main');
    main.hidden = !(flipping || phase !== 'play' || mainAction);
    // The four helpers are pointless while the card is face down, once it is solved, or
    // when it is missing; the main button then takes their place, so it stays on screen
    // on a small phone.
    el('actions').hidden = flipping || phase === 'won' || phase === 'shown' || (!live && Boolean(mainAction));
    if (!main.hidden) {
      main.textContent = t(flipping ? 'make24.flip'
        : phase === 'wrong' ? 'make24.tryAgain'
        : roundOver ? 'make24.seeResults'
        : card ? 'make24.nextCard' : 'make24.tryAgain');
    }
  }

  // ---- playing ----
  function reset() {
    values = [...card.numbers];
    history = [];
    from = null;
    op = null;
    phase = 'play';
    hint = null;
    mainAction = null;
    note = '';
    noteGood = false;
    badgeNote = '';
  }

  // Merge position a into position b. Returns false if the rules don't allow it.
  function doStep(a, o, b) {
    const result = combine(values[a], o, values[b]);
    if (result.error) {
      note = t(`make24.${result.error}`);
      noteGood = false;
      return false;
    }
    history.push({ values: [...values], text: `${values[a]} ${o} ${values[b]} = ${result.value}` });
    values[a] = null;
    values[b] = result.value;
    note = '';
    noteGood = false;

    const left = values.filter((v) => v !== null);
    if (left.length === 1) {
      phase = left[0] === 24 ? 'won' : 'wrong';
      note = phase === 'won' ? `⭐ ${t('make24.win')}` : t('make24.wrong', { n: left[0] });
      noteGood = phase === 'won';
      mainAction = phase === 'won' ? dealNext : restart;
    }
    return true;
  }

  // The learner solved the card themselves: stop the clock, count it, give records and badges.
  function onSolved() {
    syncClock(); // phase is 'won' now, so this stops the clock
    const ms = Math.round(clock.card);
    solved++;
    streak++;

    const fresh = awardMake24Card(profileId, {
      dots: card.dots,
      hasBig: card.numbers.some((n) => n > 9),
      usedHint,
      challenge: isChallenge,
      ms,
      streak: isStreak ? streak : 0
    });
    freshBadges.push(...fresh);

    const lines = [note];
    if (isChallenge) {
      // Fastest single card per level. The first time is stored quietly.
      const key = `make24|card|${settings.dots}|${size}`;
      const best = getBest(profileId, key);
      if (best === null || ms < best) {
        setBest(profileId, key, ms);
        if (best !== null) {
          cardRecord = cardRecord === null ? ms : Math.min(cardRecord, ms);
          lines.push(`🏆 ${t('make24.cardRecord', { t: formatSeconds(ms) })}`);
        }
      }
    }
    note = lines.join('\n');
    if (fresh.length) {
      badgeNote = `${t('results.newBadge')} ${fresh.map((id) => `${badgeIcon(id)} ${badgeName(id)}`).join(' · ')}`;
    }

    if (isTimed && solved >= roundSize) {
      roundOver = true;
      mainAction = finish;
    }
  }

  function tapNumber(i) {
    if (phase !== 'play' || values[i] === null) return;
    note = '';
    if (from === null) from = i;
    else if (i === from) from = null; // tap again to let go
    else if (op === null) from = i;   // no operator yet: switch the first number
    else {
      const a = from;
      const o = op;
      from = null;
      op = null;
      if (doStep(a, o, i)) {
        hint = null; // your own step ends a running "Wys my"
        if (phase === 'won') onSolved();
      }
    }
    draw();
  }

  function tapOp(o) {
    if (phase !== 'play') return;
    note = '';
    op = op === o ? null : o;
    draw();
  }

  function undo() {
    if (!history.length || phase === 'won' || phase === 'shown') return;
    values = history.pop().values;
    from = null;
    op = null;
    hint = null;
    phase = 'play';
    mainAction = null;
    note = '';
    noteGood = false;
    draw();
  }

  // Begin oor
  function restart() {
    if (!card) return;
    reset();
    draw();
  }

  // Wys my (free play only): start from the four numbers, then play one step of the
  // easiest solution per tap. A card finished this way does not count as solved.
  function showMe() {
    if (isChallenge || (phase !== 'play' && phase !== 'wrong')) return;
    const route = easiest(card.numbers);
    usedHint = true;
    if (hint === null) {
      reset();
      hint = 0;
    }
    const [a, o, b] = route[hint];
    const pa = values.findIndex((v) => v === a);
    const pb = values.findIndex((v, i) => v === b && i !== pa);
    doStep(pa, o, pb);
    hint++;
    if (phase === 'won') {
      phase = 'shown';
      note = t('make24.shown');
      noteGood = false;
      mainAction = dealNext;
    }
    draw();
  }

  // Slaan oor. Free play: the card comes back after a few other cards.
  // Uitdaging: 5 / 10 deal a new card for a time penalty, ∞ ends the round.
  function skip() {
    if (!faceUp || (phase !== 'play' && phase !== 'wrong')) return;
    if (isStreak) return finish();
    if (isTimed) {
      skips++;
      penalty += SKIP_PENALTY_MS;
      dealNext();
      note = t('make24.penalty', { n: SKIP_PENALTY_MS / 1000 });
      return draw();
    }
    skipped.push({ card, due: dealt + SKIP_RETURN_AFTER });
    dealNext();
  }

  // Draai om: show the face. In Uitdaging the clock starts here.
  function flip() {
    if (!card || faceUp) return;
    faceUp = true;
    mainAction = null;
    note = '';
    draw();
  }

  function setRules(open) {
    rulesOpen = open;
    el('rules').hidden = !open;
    draw(); // the clock follows rulesOpen
    if (open) el('rules-close').focus({ preventScroll: true }); // keep the top of the rules in view
  }

  // ---- dealing ----
  function showCard(next) {
    card = next;
    dealt++;
    faceUp = false;
    usedHint = false;
    clock.card = 0;
    reset();
    mainAction = flip;
    buildCard();
    draw();
  }

  function deal() {
    if (gone) return;
    // Lukraak: every card gets its own level, 1, 2 or 3 with equal chance. If a level has no
    // card left to deal (a long recent list), the other levels are tried before giving up.
    const first = Math.floor(Math.random() * 3);
    const levels = settings.dots === 'random'
      ? [1 + first, ...[1, 2, 3].filter((l) => l !== 1 + first)]
      : [settings.dots];
    let next = null;
    for (const dots of levels) {
      try {
        next = dealCard({ dots, bigNumbers: settings.big, recent });
        break;
      } catch {
        // try the next level
      }
    }
    if (!next) return noCard();
    recent.push(next);
    if (recent.length > RECENT_MAX) recent.shift();
    showCard(next);
  }

  // Calm fallback instead of breaking: let the learner try again (cards may then repeat).
  function noCard() {
    card = null;
    phase = 'play';
    el('stage').innerHTML = `<p class="m24-message">${t('make24.noCard')}</p>`;
    mainAction = () => { recent.length = 0; dealNext(); };
    note = '';
    draw();
  }

  function dealNext() {
    clearTimeout(timer);
    card = null;
    history = [];
    from = null;
    op = null;
    phase = 'play';
    mainAction = null;
    note = '';
    noteGood = false;
    badgeNote = '';

    if (skipped.length && dealt >= skipped[0].due) return showCard(skipped.shift().card);

    // The first deal of a deck ranks all its cards, which takes a moment on a phone.
    // Show a message first and give the browser time to paint it.
    if (!isRanked(settings.big)) {
      el('stage').innerHTML = `<p class="m24-message">${t('make24.shuffling')}</p>`;
      draw();
      timer = setTimeout(deal, 80);
    } else {
      deal();
    }
  }

  // ---- the end of an Uitdaging round ----
  function finish() {
    syncClock();
    clearInterval(timerId);
    const stars = isTimed
      ? (skips === 0 ? '⭐⭐⭐' : skips <= 2 ? '⭐⭐' : '⭐')
      : (streak >= 25 ? '⭐⭐⭐' : streak >= 10 ? '⭐⭐' : '⭐');
    const extraLines = [];
    if (isTimed && skips) extraLines.push(t('make24.skips', { n: skips }));
    if (cardRecord !== null) extraLines.push(t('make24.cardRecord', { t: formatSeconds(cardRecord) }));
    renderResults(profileId, settings, mod, {
      isLearn: false, isTimed, isStreak, total: elapsed(), streak, stars, extraLines, freshBadges
    });
  }

  el('stage').addEventListener('click', (e) => {
    if (e.target.closest('.m24-back')) return flip();
    const btn = e.target.closest('.m24-num');
    if (btn && !btn.disabled) tapNumber(Number(btn.dataset.i));
  });
  el('ops').querySelectorAll('[data-op]').forEach((b) =>
    b.addEventListener('click', () => tapOp(b.dataset.op)));
  el('undo').addEventListener('click', undo);
  el('restart').addEventListener('click', restart);
  el('show').addEventListener('click', showMe);
  el('skip').addEventListener('click', skip);
  el('main').addEventListener('click', () => mainAction?.());
  el('rules-btn').addEventListener('click', () => setRules(true));
  el('rules-close').addEventListener('click', () => setRules(false));
  el('rules-x').addEventListener('click', () => setRules(false));
  el('quit').addEventListener('click', () => {
    // A round in Uitdaging is worth keeping, so ask first (like the other modules).
    if (isChallenge && !confirm(t('play.quitConfirm'))) return;
    go(mod.setup, profileId, mod);
  });

  dealNext();
}
