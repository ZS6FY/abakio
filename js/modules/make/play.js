// Play screen for Maak 'n getal.
// Same three ways to play as the other modules:
//   learn          – no horlosie, 10 questions; missed ones come back at the end
//   game (10/20/30) – horlosie; a mistake adds 3 s, then a calm pause with "Staan reg…"
//   game (∞)       – keep going until the first mistake

import { getProfile, recordAnswer } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, setPlaying, formatSeconds } from '../../ui/dom.js';
import { showPauseBar, clearPauseBar } from '../../ui/pause-bar.js';
import { renderResults, PENALTY_MS, MISTAKE_PAUSE_MS } from '../practice/play.js';
import { makeQuestion, makeRound, makeSpec, makes, cardSentence } from './questions.js';
import { pickStyles, frameHtml } from './shapes.js';

const LEARN_COUNT = 10;
const MAX_REVIEWS = 2;
const SIGN = { add: '+', sub: '−' };

export function renderMakePlay(profileId, settings, mod) {
  if (!getProfile(profileId)) return;
  setPlaying(true);

  const isLearn = settings.mode === 'learn';
  const isStreak = settings.mode === 'game' && settings.count === 'inf';
  const isTimed = settings.mode === 'game' && !isStreak;
  const pics = settings.pictures; // 'on' | 'help' | 'off'

  // Items are specs ({ step, op, target }) or, for a review, the exact question again.
  let round = isStreak ? [] : makeRound(settings, isLearn ? LEARN_COUNT : settings.count);
  let missed = [];
  let reviews = 0;
  let index = 0;
  let q = null;
  let lastSpec = null;
  let lastKey = '';
  let styles = [];
  let chosen = [];
  let locked = false;
  let correct = 0;
  let wrong = 0;
  let streak = 0;
  let penalty = 0;
  let qStart = 0;
  const startTime = performance.now();
  let pausedMs = 0;
  let pauseStart = null;
  let timerId = null;
  let pending = null;

  const app = mount(`
    <section class="screen play make-play">
      <div class="play-top">
        <button type="button" class="btn-icon" id="quit" aria-label="quit">✕</button>
        <span id="progress"></span>
        <span id="timer"></span>
      </div>
      <div class="task" id="task"></div>
      <div class="question" id="question"></div>
      <div class="picture" id="picture"></div>
      <div class="feedback" id="feedback"></div>
      <div class="pause-slot" id="pause"></div>
      <div class="answers three" id="answers"></div>
      <div class="cards" id="cards"></div>
      <button type="button" class="btn btn-primary" id="next" hidden data-i18n="play.next"></button>
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);
  const elapsed = () => (pauseStart ?? performance.now()) - startTime - pausedMs + penalty;
  const later = (fn, ms) => { pending = setTimeout(fn, ms); };

  if (isTimed) timerId = setInterval(() => { el('timer').textContent = formatSeconds(elapsed()); }, 100);
  onLeave(() => { clearInterval(timerId); clearTimeout(pending); });

  const showProgress = () => {
    el('progress').textContent = isStreak ? `🔥 ${streak}` : `${index + 1} / ${round.length}`;
  };

  function nextQuestion() {
    const item = isStreak ? makeSpec(settings, lastSpec) : round[index];
    if (item.kind) return item; // a review: the same question again
    lastSpec = item;
    let question = makeQuestion(item);
    for (let i = 0; i < 5 && question.full === lastKey; i++) question = makeQuestion(item);
    return question;
  }

  function ask(note = '') {
    q = nextQuestion();
    lastKey = q.full;
    locked = false;
    chosen = [];
    styles = pickStyles(q.kind === 'pick' ? q.cards.length : 2);

    el('question').classList.remove('reveal');
    el('feedback').textContent = note;
    el('next').hidden = true;
    clearPauseBar(el('pause'));
    el('answers').innerHTML = '';
    el('cards').innerHTML = '';
    el('picture').innerHTML = '';

    if (q.kind === 'choice') askChoice(); else askPick();
    showProgress();
    qStart = performance.now();
  }

  // ---- Tel saam / Wat bly oor and Maatjies: choose from 3 answers ----
  function askChoice() {
    el('task').textContent = '';
    el('question').textContent = q.display;
    if (pics !== 'off') {
      el('picture').innerHTML = frameHtml(q.parts, styles, 'big');
      el('picture').classList.toggle('hidden-pics', pics === 'help');
    }
    el('answers').innerHTML = q.options
      .map((n) => `<button type="button" class="ans" data-value="${n}">${n}</button>`).join('');
    el('answers').querySelectorAll('.ans').forEach((btn) =>
      btn.addEventListener('click', () => answerChoice(Number(btn.dataset.value), btn)));
  }

  function answerChoice(value, btn) {
    if (locked) return;
    locked = true;
    const ok = value === q.answer;
    recordAnswer(profileId, q.key, ok, performance.now() - qStart);
    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) el('answers').querySelector(`[data-value="${q.answer}"]`).classList.add('ok');
    el('question').textContent = q.full;
    el('question').classList.add('reveal');
    if (ok) return right();
    el('picture').classList.remove('hidden-pics'); // "Ná 'n fout": now the pictures help
    mistake('');
  }

  // ---- Kies twee / Kies drie: tap the cards that make the number ----
  function askPick() {
    el('task').textContent = t('make.make', { n: q.target });
    drawSlots();
    el('cards').innerHTML = q.cards.map((n, i) => `
      <button type="button" class="card" data-i="${i}">
        <span class="card-num">${n}</span>
        ${pics !== 'off' ? frameHtml([{ n, k: 'fill', s: i }], styles, 'mini') : ''}
      </button>`).join('');
    el('cards').classList.toggle('hidden-pics', pics === 'help');
    el('cards').classList.toggle('four', q.cards.length === 4);
    el('cards').querySelectorAll('.card').forEach((card) =>
      card.addEventListener('click', () => tapCard(Number(card.dataset.i), card)));
    el('feedback').textContent = el('feedback').textContent || t(`make.tap${q.need}`);
  }

  function drawSlots() {
    const slots = Array.from({ length: q.need }, (_, i) =>
      (chosen[i] !== undefined ? `<span class="slot filled">${q.cards[chosen[i]]}</span>` : '<span class="slot">&nbsp;</span>'));
    el('question').innerHTML = `<span class="slots">${slots.join(` ${SIGN[q.op]} `)} = ${q.target}</span>`;
  }

  function tapCard(i, card) {
    if (locked) return;
    if (chosen.includes(i)) chosen = chosen.filter((x) => x !== i);
    else chosen.push(i);
    card.classList.toggle('chosen', chosen.includes(i));
    drawSlots();
    if (chosen.length === q.need) {
      locked = true;
      later(checkPick, 350);
    }
  }

  function checkPick() {
    const values = chosen.map((i) => q.cards[i]);
    const made = makes(values, q.op);
    const ok = made === q.target;
    recordAnswer(profileId, q.key, ok, performance.now() - qStart);
    const cards = el('cards').querySelectorAll('.card');
    el('question').textContent = q.full;
    el('question').classList.add('reveal');
    if (ok) {
      chosen.forEach((i) => cards[i].classList.add('ok'));
      return right();
    }
    chosen.forEach((i) => cards[i].classList.add('bad'));
    q.solution.forEach((i) => { cards[i].classList.remove('bad'); cards[i].classList.add('ok'); });
    el('cards').classList.remove('hidden-pics');
    // Show what the chosen cards made, e.g. "4 + 7 = 11, nie 9 nie."
    mistake(t('make.made', { sum: cardSentence(values, q.op, made), target: q.target }));
  }

  // ---- shared by both kinds ----
  function right() {
    correct++;
    streak++;
    el('feedback').textContent = '';
    showProgress();
    later(next, isLearn ? 900 : 450);
  }

  function mistake(madeLine) {
    wrong++;
    const lines = madeLine ? [madeLine] : [];
    if (isLearn) {
      lines.push(t('play.almost'));
      el('feedback').textContent = lines.join('\n');
      if (!missed.includes(q)) missed.push(q);
      el('next').hidden = false;
    } else if (isTimed) {
      pauseStart = performance.now();
      penalty += PENALTY_MS;
      el('timer').textContent = formatSeconds(elapsed());
      lines.push(`${t('play.almost')}  ${t('play.penalty')}`);
      el('feedback').textContent = lines.join('\n');
      showPauseBar(el('pause'), MISTAKE_PAUSE_MS);
      later(() => {
        pausedMs += performance.now() - pauseStart;
        pauseStart = null;
        next();
      }, MISTAKE_PAUSE_MS);
    } else {
      lines.push(t('results.oops', { a: q.answerText }));
      el('feedback').textContent = lines.join('\n');
      later(finish, 2000);
    }
  }

  function next() {
    index++;
    if (isStreak || index < round.length) return ask();
    if (isLearn && missed.length && reviews < MAX_REVIEWS) {
      reviews++;
      round.push(...missed);
      missed = [];
      return ask(t('play.review'));
    }
    finish();
  }

  function finish() {
    clearInterval(timerId);
    renderResults(profileId, settings, mod, {
      correct, wrong, streak, total: elapsed(), isLearn, isTimed, isStreak
    });
  }

  el('next').addEventListener('click', next);
  el('quit').addEventListener('click', () => {
    if (confirm(t('play.quitConfirm'))) go(mod.setup, profileId, mod);
  });

  ask();
}
