// Maak 24 card engine: solver, difficulty rating and dealing. Pure logic, no DOM.
//
// A solution is a list of steps [left, op, right, result], e.g. [[3, '×', 5, 15], [15, '−', 7, 8], [8, '×', 3, 24]].
// Two numbers are combined at a time, the same way the player will build an answer by tapping.

import { shuffle } from '../tables/questions.js';

const TARGET = 24;

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
  return [...found.values()].map((item) => toSteps(item));
}

const usesDivide = (steps) => steps.some((s) => s[1] === '÷');
const goesAbove = (steps) => steps.some((s) => s[3] > TARGET);

// First version of the rating; the thresholds will be tuned after play-testing.
export function rate(numbers) {
  const solutions = solve(numbers);
  if (solutions.length === 0) return null;
  const friendly = solutions.some((s) => !usesDivide(s) && !goesAbove(s));
  if (solutions.length >= 4 && friendly) return 1;
  if (solutions.length <= 2 || solutions.every(usesDivide) || solutions.every(goesAbove)) return 3;
  return 2;
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
