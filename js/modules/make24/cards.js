// Maak 24 card engine: solver, difficulty rating and dealing. Pure logic, no DOM.
//
// A solution is a list of steps [left, op, right, result], e.g. [[3, '×', 5, 15], [15, '−', 7, 8], [8, '×', 3, 24]].
// Two numbers are combined at a time, the same way the player will build an answer by tapping.

import { shuffle } from '../tables/questions.js';

const TARGET = 24;

// Rating knobs – tune these after play-testing. A solution's score starts at 0; lower is easier.
const CHAIN_COST = 1;               // each step builds on the last, instead of two pairs joined at the end
const DIVIDE_COST = 2;              // uses ÷
const ABOVE_TARGET_COST = 1;        // per in-between number above 24 …
const HUGE_LIMIT = 50;
const ABOVE_HUGE_COST = 2;          // … or above 50 instead
const ADD_SUBTRACT_ONLY_BONUS = -1; // uses only + and −
const FEW_SOLUTIONS_MAX = 2;        // a card with this many distinct solutions or fewer …
const FEW_SOLUTIONS_COST = 1;       // … costs this much extra
const ONLY_TRICKS_COST = 1;         // every solution needs a trick step (n − n, + 0, n ÷ n)

// Dots go by rank within a deck: the easiest share gets 1 dot, the next share 2, the rest 3.
const ONE_DOT_SHARE = 0.40;
const TWO_DOT_SHARE = 0.35;

// Every whole-number result of combining a and b. Subtraction is always larger minus smaller
// and division must be exact, so no step ever needs a negative number or a fraction.
// With want set, only results equal to want are built – the last step only needs 24s,
// and skipping the rest makes ranking a whole deck much faster.
function combine(a, b, want) {
  const hi = Math.max(a.value, b.value);
  const lo = Math.min(a.value, b.value);
  const big = a.value >= b.value ? a : b;
  const small = big === a ? b : a;
  const out = [];
  const add = (op, left, right, value) => {
    if (want === undefined || value === want) out.push({ op, left, right, value });
  };
  add('+', big, small, hi + lo);
  add('×', big, small, hi * lo);
  add('−', big, small, hi - lo);
  if (lo !== 0 && hi % lo === 0) add('÷', big, small, hi / lo);
  if (hi !== lo && hi !== 0 && lo % hi === 0) add('÷', small, big, lo / hi);
  return out;
}

// a + b and b + a get the same key (children sorted), so swapped answers count once.
// Built only for finished answers, because building it for every try made ranking slow.
function swapKey(item) {
  if (!item.op) return String(item.value);
  const keys = [swapKey(item.left), swapKey(item.right)];
  if (item.op === '+' || item.op === '×') keys.sort();
  return `(${keys[0]}${item.op}${keys[1]})`;
}

// Turn an expression tree into the steps in tapping order (inner steps first).
function toSteps(item, steps = []) {
  if (!item.op) return steps;
  toSteps(item.left, steps);
  toSteps(item.right, steps);
  steps.push([item.left.value, item.op, item.right.value, item.value]);
  return steps;
}

export function solve(numbers) {
  return solveTrees(numbers).map((item) => toSteps(item));
}

function solveTrees(numbers) {
  const found = new Map();

  function search(items) {
    if (items.length === 2) {
      for (const made of combine(items[0], items[1], TARGET)) found.set(swapKey(made), made);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const next = items.filter((_, k) => k !== i && k !== j);
        next.push(null);
        for (const made of combine(items[i], items[j])) {
          next[next.length - 1] = made;
          search(next);
        }
      }
    }
  }

  search(numbers.map((n) => ({ value: n })));
  return [...found.values()];
}

// Key that ignores grouping as well as swapping: (5 + 7) + 9 and 5 + (7 + 9) both become
// the sum of 5, 7 and 9. Chains of + and − become signed terms, chains of × and ÷ factors.
function flatKey(item) {
  if (!item.op) return String(item.value);
  const sum = item.op === '+' || item.op === '−';
  const parts = [];
  (function collect(it, inverse) {
    const sameKind = sum ? it.op === '+' || it.op === '−' : it.op === '×' || it.op === '÷';
    if (!sameKind) {
      parts.push((inverse ? '/' : '*') + flatKey(it));
      return;
    }
    collect(it.left, inverse);
    collect(it.right, inverse !== (it.op === '−' || it.op === '÷'));
  })(item, false);
  return (sum ? 'S[' : 'P[') + parts.sort().join(',') + ']';
}

// Steps that make a number out of nothing and give the answer away: n − n, + 0, n ÷ n.
// × 1 and ÷ 1 are ordinary steps that children meet, so they are not tricks.
const isTrick = ([a, op, b, r]) =>
  (op === '−' && r === 0) || (op === '+' && (a === 0 || b === 0)) || (op === '÷' && a === b);

const usesOne = (steps) =>
  steps.some(([a, op, b]) => (op === '×' && (a === 1 || b === 1)) || (op === '÷' && b === 1));

// With four numbers a solution is either a chain or two pairs joined at the end;
// it's two pairs when both halves of the last step are results of earlier steps.
const isChain = (tree) => !(tree.left.op && tree.right.op);

function scoreSolution({ tree, steps }) {
  let score = 0;
  if (isChain(tree)) score += CHAIN_COST;
  if (steps.some((s) => s[1] === '÷')) score += DIVIDE_COST;
  for (const s of steps.slice(0, -1)) {
    if (s[3] > HUGE_LIMIT) score += ABOVE_HUGE_COST;
    else if (s[3] > TARGET) score += ABOVE_TARGET_COST;
  }
  if (steps.every((s) => s[1] === '+' || s[1] === '−')) score += ADD_SUBTRACT_ONLY_BONUS;
  return score;
}

// The card's score (lowest solution score + extras) and the solution it came from.
function scoreCard(numbers) {
  const all = solveTrees(numbers).map((tree) => ({ tree, steps: toSteps(tree) }));
  if (all.length === 0) return null;
  const clean = all.filter((r) => !r.steps.some(isTrick));
  const routes = clean.length > 0 ? clean : all;
  for (const r of routes) r.score = scoreSolution(r);
  // Among equally easy solutions the hint prefers one without × 1 or ÷ 1.
  routes.sort((x, y) => x.score - y.score || usesOne(x.steps) - usesOne(y.steps));

  let score = routes[0].score;
  if (clean.length === 0) score += ONLY_TRICKS_COST;
  if (new Set(routes.map((r) => flatKey(r.tree))).size <= FEW_SOLUTIONS_MAX) score += FEW_SOLUTIONS_COST;
  return { score, easiest: routes[0].steps };
}

// Same four numbers in any order give the same key.
const cardKey = (numbers) => [...numbers].sort((a, b) => a - b).join(',');

// Scores are cached because ranking and dealing keep meeting the same cards.
const scores = new Map();
function cachedScore(numbers) {
  const key = cardKey(numbers);
  if (!scores.has(key)) scores.set(key, scoreCard(numbers)?.score ?? null);
  return scores.get(key);
}

// Each deck is ranked once, on first use: every solvable card is scored and sorted, and the
// scores where 2 and 3 dots begin are kept. Cards with equal scores share one level, so a
// group of equal scores goes to the level its middle falls in.
const cutoffs = {};
function deckCutoffs(bigNumbers) {
  const deck = bigNumbers ? 'big' : 'small';
  if (cutoffs[deck]) return cutoffs[deck];

  const max = bigNumbers ? 20 : 9;
  const list = [];
  for (let a = 1; a <= max; a++)
    for (let b = a; b <= max; b++)
      for (let c = b; c <= max; c++)
        for (let d = c; d <= max; d++) {
          if (bigNumbers && d <= 9) continue;
          const score = cachedScore([a, b, c, d]);
          if (score !== null) list.push(score);
        }
  list.sort((x, y) => x - y);

  const levelAt = (share) => (share < ONE_DOT_SHARE ? 1 : share < ONE_DOT_SHARE + TWO_DOT_SHARE ? 2 : 3);
  const found = { two: Infinity, three: Infinity };
  for (let start = 0; start < list.length; ) {
    let end = start;
    while (end < list.length && list[end] === list[start]) end++;
    const level = levelAt((start + end) / 2 / list.length);
    if (level >= 2 && found.two === Infinity) found.two = list[start];
    if (level === 3 && found.three === Infinity) found.three = list[start];
    start = end;
  }
  return (cutoffs[deck] = found);
}

// True once a deck has been ranked, so a screen can tell if the next deal will take a moment.
export function isRanked(bigNumbers) {
  return Boolean(cutoffs[bigNumbers ? 'big' : 'small']);
}

// 1, 2 or 3 dots, or null if the card can't make 24. A card with any number above 9
// is rated against the 1–20 deck, otherwise against the 1–9 deck.
export function rate(numbers) {
  const score = cachedScore(numbers);
  if (score === null) return null;
  const { two, three } = deckCutoffs(numbers.some((n) => n > 9));
  return score >= three ? 3 : score >= two ? 2 : 1;
}

// The solution the rating is based on – also handy later for a hint.
export function easiest(numbers) {
  const scored = scoreCard(numbers);
  return scored ? scored.easiest : null;
}

const randomInt = (max) => 1 + Math.floor(Math.random() * max);

function randomNumbers(bigNumbers) {
  const max = bigNumbers ? 20 : 9;
  for (;;) {
    const numbers = [randomInt(max), randomInt(max), randomInt(max), randomInt(max)];
    if (!bigNumbers || numbers.some((n) => n > 9)) return numbers;
  }
}

// recent may hold plain number lists or earlier dealt cards ({ numbers }).
export function dealCard({ dots, bigNumbers = false, recent = [] }) {
  const seen = new Set(recent.map((card) => cardKey(card.numbers || card)));
  // Safety cap so a too-long recent list can never freeze the screen.
  for (let tries = 0; tries < 20000; tries++) {
    const numbers = randomNumbers(bigNumbers);
    if (seen.has(cardKey(numbers))) continue;
    if (rate(numbers) === dots) return { numbers: shuffle(numbers), dots };
  }
  throw new Error(`dealCard: no card found for ${dots} dots`);
}
