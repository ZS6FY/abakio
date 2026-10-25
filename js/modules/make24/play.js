// Play screen for Maak 24 – solo free play.
// Tap a number, an operator and a second number: the two merge into the second
// number's place. Numbers never move or turn, so the card stays easy to read
// from every side.

import { getProfile } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, setPlaying } from '../../ui/dom.js';
import { dealCard, easiest, isRanked } from './cards.js';

const RECENT_MAX = 20;
const SKIP_RETURN_AFTER = 3; // cards dealt before a skipped card comes back
const POSITIONS = ['top', 'right', 'bottom', 'left'];
const OPS = ['+', '−', '×', '÷'];

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

  const recent = [];  // last dealt cards, so the same card doesn't come straight back
  const skipped = []; // { card, due } – come back once `dealt` reaches `due`
  let dealt = 0;

  let card = null;    // null while shuffling or when no card could be dealt
  let values = [];    // one per position; null once merged into another number
  let history = [];   // { values, text } per step, for Ontdoen
  let from = null;    // position of the first tapped number
  let op = null;
  let phase = 'play'; // 'play' | 'won' | 'shown' | 'wrong'
  let hint = null;    // next step of the easiest solution while "Wys my" is running
  let note = '';
  let noteGood = false;
  let mainAction = null;
  let timer = null;

  const app = mount(`
    <section class="screen play make24-play">
      <div class="play-top">
        <button type="button" class="btn-icon" id="quit" aria-label="quit">✕</button>
        <span></span>
        <span></span>
      </div>
      <div class="m24-stage" id="stage"></div>
      <div class="seg m24-ops" id="ops">
        ${OPS.map((o) => `<button type="button" class="seg-btn" data-op="${o}">${o}</button>`).join('')}
      </div>
      <ol class="m24-steps" id="steps"></ol>
      <div class="feedback" id="feedback"></div>
      <button type="button" class="btn btn-primary" id="main" hidden></button>
      <div class="m24-actions" id="actions">
        <button type="button" class="btn" id="undo" data-i18n="make24.undo"></button>
        <button type="button" class="btn" id="restart" data-i18n="make24.restart"></button>
        <button type="button" class="btn" id="show" data-i18n="make24.show"></button>
        <button type="button" class="btn" id="skip" data-i18n="make24.skip"></button>
      </div>
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);
  let gone = false;
  onLeave(() => { gone = true; clearTimeout(timer); });

  // ---- drawing ----
  const dotsHtml = (cls) => `<span class="m24-dots ${cls}" aria-hidden="true">${'<i></i>'.repeat(card.dots)}</span>`;

  function cardHtml() {
    const tiles = values.map((v, i) => {
      const text = v === null ? '' : String(v);
      // 6 and 9 look alike upside down, so any number with one of them is underlined.
      const under = /[69]/.test(text) ? ' u' : '';
      const sel = i === from ? ' sel' : '';
      const off = v === null || phase !== 'play' ? ' disabled' : '';
      return `<button type="button" class="m24-num m24-${POSITIONS[i]}${sel}${under}" data-i="${i}" data-len="${text.length}"${off}><span>${text}</span></button>`;
    }).join('');
    return `
      <div class="m24-card${phase === 'won' ? ' won' : ''}">
        <svg class="m24-lines" viewBox="0 0 100 100" aria-hidden="true">
          <line x1="0" y1="0" x2="100" y2="100"/><line x1="100" y1="0" x2="0" y2="100"/>
        </svg>
        ${dotsHtml('c1')}${dotsHtml('c2')}${dotsHtml('c3')}${dotsHtml('c4')}
        ${tiles}
      </div>`;
  }

  function draw() {
    const live = card !== null;
    const playing = live && (phase === 'play' || phase === 'wrong');

    if (live) el('stage').innerHTML = cardHtml();
    el('ops').querySelectorAll('[data-op]').forEach((b) => {
      b.classList.toggle('on', b.dataset.op === op);
      b.disabled = !live || phase !== 'play';
    });
    el('steps').innerHTML = history.map((h) => `<li>${h.text}</li>`).join('');

    el('feedback').textContent = note;
    el('feedback').classList.toggle('m24-ok', noteGood);

    el('undo').disabled = !(playing && history.length);
    el('restart').disabled = !(playing && history.length);
    el('show').disabled = !playing;
    el('skip').disabled = !playing;

    const main = el('main');
    main.hidden = !(phase !== 'play' || mainAction);
    // The four helpers are pointless once the card is solved (or missing), and the main
    // button then takes their place, so it stays on screen on a small phone.
    el('actions').hidden = phase === 'won' || phase === 'shown' || (!live && Boolean(mainAction));
    if (!main.hidden) {
      main.textContent = t(phase === 'wrong' ? 'make24.tryAgain' : card ? 'make24.nextCard' : 'make24.tryAgain');
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
      if (doStep(a, o, i)) hint = null; // your own step ends a running "Wys my"
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
    mainAction = null;
    draw();
  }

  // Wys my: start from the four numbers, then play one step of the easiest solution per tap.
  function showMe() {
    if (phase !== 'play' && phase !== 'wrong') return;
    const route = easiest(card.numbers);
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

  // Slaan oor: the card goes away and comes back after a few other cards.
  function skip() {
    if (phase !== 'play' && phase !== 'wrong') return;
    skipped.push({ card, due: dealt + SKIP_RETURN_AFTER });
    dealNext();
  }

  // ---- dealing ----
  function showCard(next) {
    card = next;
    dealt++;
    reset();
    mainAction = null;
    draw();
  }

  function deal() {
    if (gone) return;
    let next;
    try {
      next = dealCard({ dots: settings.dots, bigNumbers: settings.big, recent });
    } catch {
      return noCard();
    }
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

  el('stage').addEventListener('click', (e) => {
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
  el('quit').addEventListener('click', () => go(mod.setup, profileId, mod));

  dealNext();
}
