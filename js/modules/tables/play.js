// Tables module: the question screen and the results screen.
//
// Three ways to play:
//   learn          – no timer; the tables in order (1 × 2, 2 × 2, 3 × 2 …);
//                    missed facts are practised again at the end of the round
//   game (10/20/30) – shuffled, stopwatch; a wrong answer adds 3 seconds; fastest time wins
//   game (∞)       – shuffled, keep going until the first wrong answer; longest streak wins

import { getProfile, recordAnswer, getBest, setBest } from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import { go, onLeave } from '../../core/router.js';
import { mount, setPlaying, formatSeconds } from '../../ui/dom.js';
import { renderLearnerMenu } from '../../ui/learner-menu.js';
import { renderTablesSetup } from './setup.js';
import {
  buildPool, buildRound, buildLearnRound, randomFact, withTurn, makeQuestion, factKey
} from './questions.js';

const PENALTY_MS = 3000;
const MAX_REVIEWS = 2; // learn mode: missed facts come back at most twice

export function renderPlay(profileId, settings) {
  const profile = getProfile(profileId);
  if (!profile) return;
  setPlaying(true);

  const isLearn = settings.mode === 'learn';
  const isStreak = settings.mode === 'game' && settings.count === 'inf';
  const isTimed = settings.mode === 'game' && !isStreak;

  const turn = settings.turnaround;
  const pool = buildPool(settings.tables, settings.op);
  let round;
  if (isLearn) round = buildLearnRound(settings.tables, settings.op, turn);
  else if (isStreak) round = [];
  else round = buildRound(pool, settings.count).map((f) => withTurn(f, turn));

  let missed = [];
  let reviews = 0;
  let index = 0;
  let q = null;
  let lastFact = null;
  let locked = false;
  let correct = 0;
  let wrong = 0;
  let streak = 0;
  let penalty = 0;
  let qStart = 0;
  const startTime = performance.now();
  let timerId = null;
  let pending = null;

  const app = mount(`
    <section class="screen play">
      <div class="play-top">
        <button type="button" class="btn-icon" id="quit" aria-label="quit">✕</button>
        <span id="progress"></span>
        <span id="timer"></span>
      </div>
      <div class="question" id="question"></div>
      <div class="feedback" id="feedback"></div>
      <div class="answers" id="answers"></div>
      <button type="button" class="btn btn-primary" id="next" hidden data-i18n="play.next"></button>
    </section>`);

  const el = (id) => app.querySelector(`#${id}`);

  const elapsed = () => performance.now() - startTime + penalty;

  if (isTimed) {
    timerId = setInterval(() => { el('timer').textContent = formatSeconds(elapsed()); }, 100);
  }

  onLeave(() => {
    clearInterval(timerId);
    clearTimeout(pending);
  });

  const later = (fn, ms) => { pending = setTimeout(fn, ms); };

  function showProgress() {
    el('progress').textContent = isStreak ? `🔥 ${streak}` : `${index + 1} / ${round.length}`;
  }

  function ask(note = '') {
    const fact = isStreak ? withTurn(randomFact(pool, lastFact), turn) : round[index];
    lastFact = fact;
    q = makeQuestion(fact);
    locked = false;

    el('question').textContent = `${q.text} = ?`;
    el('feedback').textContent = note;
    el('next').hidden = true;
    el('answers').innerHTML = q.options
      .map((n) => `<button type="button" class="ans" data-value="${n}">${n}</button>`)
      .join('');
    el('answers').querySelectorAll('.ans').forEach((btn) =>
      btn.addEventListener('click', () => answer(Number(btn.dataset.value), btn)));

    showProgress();
    qStart = performance.now();
  }

  function answer(value, btn) {
    if (locked) return;
    locked = true;

    const ok = value === q.answer;
    recordAnswer(profileId, q.key, ok, performance.now() - qStart);

    btn.classList.add(ok ? 'ok' : 'bad');
    if (!ok) {
      el('answers').querySelector(`[data-value="${q.answer}"]`).classList.add('ok');
    }

    if (ok) {
      correct++;
      streak++;
      showProgress();
      later(next, isLearn ? 600 : 250);
      return;
    }

    wrong++;
    if (isLearn) {
      // Show the full fact, keep it for the review at the end, wait for "Next".
      el('feedback').textContent = `${q.text} = ${q.answer}`;
      if (!missed.some((f) => factKey(f) === q.key)) missed.push(q.fact);
      el('next').hidden = false;
    } else if (isTimed) {
      penalty += PENALTY_MS;
      el('feedback').textContent = t('play.penalty');
      later(next, 900);
    } else {
      // Unlimited round ends on the first mistake.
      el('feedback').textContent = t('results.oops', { a: q.answer });
      later(finish, 1500);
    }
  }

  function next() {
    index++;
    if (isStreak || index < round.length) return ask();

    // Learn mode: practise the missed facts again before finishing.
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
    renderResults(profileId, settings, {
      correct, wrong, streak, total: elapsed(), isLearn, isTimed, isStreak
    });
  }

  el('next').addEventListener('click', next);
  el('quit').addEventListener('click', () => {
    if (confirm(t('play.quitConfirm'))) go(renderTablesSetup, profileId);
  });

  ask();
}

function bestKey(s) {
  return `tables|${s.mode}|${s.op}|${s.count}|${s.turnaround ? 'turn' : 'fixed'}|${s.tables.join(',')}`;
}

function renderResults(profileId, settings, r) {
  setPlaying(false);
  const lines = [];
  let stars = '';
  let record = false;

  if (r.isLearn) {
    stars = r.wrong === 0 ? '⭐⭐⭐' : r.wrong <= 2 ? '⭐⭐' : '⭐';
    lines.push(t('results.correct', { n: r.correct }));
    lines.push(t('results.wrong', { n: r.wrong }));
  } else if (r.isTimed) {
    const key = bestKey(settings);
    const best = getBest(profileId, key);
    record = best === null || r.total < best;
    if (record) setBest(profileId, key, Math.round(r.total));
    stars = r.wrong === 0 ? '⭐⭐⭐' : r.wrong <= 2 ? '⭐⭐' : '⭐';
    lines.push(t('results.time', { t: formatSeconds(r.total) }));
    lines.push(t('results.wrong', { n: r.wrong }));
    if (!record) lines.push(t('results.best', { t: formatSeconds(best) }));
  } else {
    const key = bestKey(settings);
    const best = getBest(profileId, key);
    record = r.streak > 0 && (best === null || r.streak > best);
    if (record) setBest(profileId, key, r.streak);
    stars = r.streak >= 30 ? '⭐⭐⭐' : r.streak >= 15 ? '⭐⭐' : '⭐';
    lines.push(t('results.streak', { n: r.streak }));
    if (!record && best !== null) lines.push(t('results.bestStreak', { n: best }));
  }

  const app = mount(`
    <section class="screen results">
      <img class="mascot small" src="assets/icons/icon-512.png" alt="" width="120" height="120">
      <h2 data-i18n="results.wellDone"></h2>
      <div class="stars">${stars}</div>
      ${record ? '<p class="record" data-i18n="results.newRecord"></p>' : ''}
      <div class="result-lines">${lines.map((l) => `<p>${l}</p>`).join('')}</div>
      <button type="button" class="btn btn-primary" id="again" data-i18n="results.again"></button>
      <button type="button" class="btn" id="settings" data-i18n="results.settings"></button>
      <button type="button" class="btn" id="menu" data-i18n="results.menu"></button>
    </section>`);

  app.querySelector('#again').addEventListener('click', () => go(renderPlay, profileId, settings));
  app.querySelector('#settings').addEventListener('click', () => go(renderTablesSetup, profileId));
  app.querySelector('#menu').addEventListener('click', () => go(renderLearnerMenu, profileId));
}
