// Maak 24 card engine: solver, difficulty rating and dealing. Pure logic, no DOM.
//
// A solution is a list of steps [left, op, right, result], e.g. [[3, '×', 5, 15], [15, '−', 7, 8], [8, '×', 3, 24]].
// Two numbers are combined at a time, the same way the player will build an answer by tapping.

import { shuffle } from '../tables/questions.js';

const TARGET = 24;

// Rating knobs – tune these after play-testing. A solution's score starts at 0; lower is easier.
const DIVIDE_COST = 2;              // uses ÷
const ABOVE_TARGET_COST = 1;        // per in-between number above 24 …
const HUGE_LIMIT = 50;
const ABOVE_HUGE_COST = 2;          // … or above 50 instead
const OBVIOUS_PAIR_BONUS = -1;      // last step is a pair children know by heart
const OBVIOUS_PRODUCTS = [[1, 24], [2, 12], [3, 8], [4, 6]];
const OBVIOUS_ADD_PARTS = [12, 20, 18];
const ADD_SUBTRACT_ONLY_BONUS = -1; // uses only + and −
const ONE_SOLUTION_COST = 1;        // the card has only one route
const ONLY_TRICKS_COST = 1;         // every route needs a trick step (… − itself, + 0, × 1, ÷ 1)
const ONE_DOT_MAX = 0;              // card score ≤ 0 → 1 dot
const TWO_DOT_MAX = 2;              // card score 1–2 → 2 dots, higher → 3 dots

// Every whole-number result of combining a and b. Subtraction is always larger minus smaller
// and division must be exact, so no step ever needs a negative number or a fraction.
function combine(a, b) {
  const hi = Math.max(a.value, b.value);
  const lo = Math.min(a.value, b.value);
  const big = a.value >= b.value ? a : b;
  const small = big === a ? b : a;
  const out = [
    node('+', big, small, hi + lo),
    node('×', big, small, hi * lo),
    node('−', big, small, hi - lo)
  ];
  if (lo !== 0 && hi % lo === 0) out.push(node('÷', big, small, hi / lo));
  if (hi !== lo && hi !== 0 && lo % hi === 0) out.push(node('÷', small, big, lo / hi));
  return out;
}

// key: a + b and b + a get the same key (children sorted), so swapped answers count once.
function node(op, left, right, value) {
  const keys = [left.key, right.key];
  if (op === '+' || op === '×') keys.sort();
  return { op, left, right, value, key: `(${keys[0]}${op}${keys[1]})` };
}

function leaf(n) {
  return { value: n, key: String(n) };
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
    if (items.length === 1) {
      if (items[0].value === TARGET) found.set(items[0].key, items[0]);
      return;
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const rest = items.filter((_, k) => k !== i && k !== j);
        for (const next of combine(items[i], items[j])) search([...rest, next]);
      }
    }
  }

  search(numbers.map(leaf));
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

// Steps that change nothing and give the answer away: n − n, + 0, × 1, ÷ 1.
const isTrick = ([a, op, b, r]) =>
  (op === '−' && r === 0) || (op === '+' && (a === 0 || b === 0)) ||
  (op === '×' && (a === 1 || b === 1)) || (op === '÷' && b === 1);

function isObviousPair([a, op, b]) {
  if (op === '×') return OBVIOUS_PRODUCTS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
  if (op === '+') return OBVIOUS_ADD_PARTS.includes(a) || OBVIOUS_ADD_PARTS.includes(b);
  return false;
}

function scoreSolution(steps) {
  let score = 0;
  if (steps.some((s) => s[1] === '÷')) score += DIVIDE_COST;
  for (const s of steps.slice(0, -1)) {
    if (s[3] > HUGE_LIMIT) score += ABOVE_HUGE_COST;
    else if (s[3] > TARGET) score += ABOVE_TARGET_COST;
  }
  if (isObviousPair(steps[steps.length - 1])) score += OBVIOUS_PAIR_BONUS;
  if (steps.every((s) => s[1] === '+' || s[1] === '−')) score += ADD_SUBTRACT_ONLY_BONUS;
  return score;
}

// The routes a card is rated by, plus the card's score (lowest route score + extras).
function rateRoutes(numbers) {
  const all = solveTrees(numbers).map((tree) => ({ tree, steps: toSteps(tree) }));
  if (all.length === 0) return null;
  const clean = all.filter((r) => !r.steps.some(isTrick));
  const routes = clean.length > 0 ? clean : all;
  for (const r of routes) r.score = scoreSolution(r.steps);
  routes.sort((x, y) => x.score - y.score);

  let score = routes[0].score;
  if (clean.length === 0) score += ONLY_TRICKS_COST;
  if (new Set(routes.map((r) => flatKey(r.tree))).size === 1) score += ONE_SOLUTION_COST;
  return { score, easiest: routes[0].steps };
}

// 1, 2 or 3 dots, or null if the card can't make 24.
export function rate(numbers) {
  const rated = rateRoutes(numbers);
  if (!rated) return null;
  if (rated.score <= ONE_DOT_MAX) return 1;
  if (rated.score <= TWO_DOT_MAX) return 2;
  return 3;
}

// The route the rating is based on – also handy later for a hint.
export function easiest(numbers) {
  const rated = rateRoutes(numbers);
  return rated ? rated.easiest : null;
}

// Same four numbers in any order give the same key.
const cardKey = (numbers) => [...numbers].sort((a, b) => a - b).join(',');

// Ratings are cached because random dealing keeps meeting the same cards.
const ratings = new Map();
function cachedRate(numbers) {
  const key = cardKey(numbers);
  if (!ratings.has(key)) ratings.set(key, rate(numbers));
  return ratings.get(key);
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
    if (cachedRate(numbers) === dots) return { numbers: shuffle(numbers), dots };
  }
  throw new Error(`dealCard: no card found for ${dots} dots`);
}
