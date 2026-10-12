// Builds times-table questions with four answer options.
//
// A "fact" is one table entry: { op: 'mul' | 'div', a, b, turn }
//   a is the table (e.g. 2 for the 2-times table), b runs 1–12.
//   Normal form, table number second:   b × a      and   (a × b) ÷ a = b
//   Turnaround form ("Draai om"):       a × b      and   (a × b) ÷ b = a

export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const wantsMul = (op) => op === 'mul' || op === 'mix';
const wantsDiv = (op) => op === 'div' || op === 'mix';

// All facts for the chosen tables and operation (normal form only).
export function buildPool(tables, op) {
  const pool = [];
  for (const a of tables) {
    for (let b = 1; b <= 12; b++) {
      if (wantsMul(op)) pool.push({ op: 'mul', a, b, turn: false });
      if (wantsDiv(op)) pool.push({ op: 'div', a, b, turn: false });
    }
  }
  return pool;
}

// Learn mode: the tables in order, 1 × 2, 2 × 2, 3 × 2 …
// With "mixed", each × fact is followed by its ÷ partner (3 × 2 = 6, then 6 ÷ 2 = 3).
// With turnaround, each fact is followed by its turned-around form (3 × 2, then 2 × 3).
export function buildLearnRound(tables, op, turnaround) {
  const round = [];
  const add = (f) => {
    round.push(f);
    if (turnaround && f.a !== f.b) round.push({ ...f, turn: true });
  };
  for (const a of [...tables].sort((x, y) => x - y)) {
    for (let b = 1; b <= 12; b++) {
      if (wantsMul(op)) add({ op: 'mul', a, b, turn: false });
      if (wantsDiv(op)) add({ op: 'div', a, b, turn: false });
    }
  }
  return round;
}

// Game mode: with turnaround on, about half the facts are asked the other way round.
export function withTurn(f, turnaround) {
  return { ...f, turn: turnaround && f.a !== f.b && Math.random() < 0.5 };
}

export function factKey(f) {
  if (f.op === 'mul') return `${Math.min(f.a, f.b)}x${Math.max(f.a, f.b)}`;
  return `${f.a * f.b}/${f.turn ? f.b : f.a}`;
}

// A fixed-length game round: shuffled facts, repeated if the round is longer
// than the pool, never the same fact twice in a row.
export function buildRound(pool, count) {
  const round = [];
  while (round.length < count) {
    for (const f of shuffle(pool)) {
      if (round.length >= count) break;
      const last = round[round.length - 1];
      if (last && factKey(last) === factKey(f) && pool.length > 1) continue;
      round.push(f);
    }
  }
  return round;
}

// Random fact for the "unlimited" round, avoiding a repeat of the last one.
export function randomFact(pool, last) {
  if (pool.length === 1) return pool[0];
  let f;
  do {
    f = pool[Math.floor(Math.random() * pool.length)];
  } while (last && factKey(f) === factKey(last));
  return f;
}

// Wrong options a learner could plausibly pick: neighbouring facts and
// answers that are a little off. Never random numbers.
function wrongOptions(f, answer, divisor) {
  const { a, b } = f;
  const candidates = f.op === 'mul'
    ? [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b,
       answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]
    : [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, divisor];

  const unique = [...new Set(candidates)].filter((n) => n > 0 && n !== answer);
  const picked = shuffle(unique).slice(0, 3);

  // Safety net for very small numbers.
  let extra = answer + 3;
  while (picked.length < 3) {
    if (!picked.includes(extra)) picked.push(extra);
    extra++;
  }
  return picked;
}

export function makeQuestion(f) {
  let text;
  let answer;
  let divisor = null;
  if (f.op === 'mul') {
    text = f.turn ? `${f.a} × ${f.b}` : `${f.b} × ${f.a}`;
    answer = f.a * f.b;
  } else {
    divisor = f.turn ? f.b : f.a;
    answer = f.turn ? f.a : f.b;
    text = `${f.a * f.b} ÷ ${divisor}`;
  }
  return {
    fact: f,
    key: factKey(f),
    text,
    answer,
    options: shuffle([answer, ...wrongOptions(f, answer, divisor)])
  };
}
