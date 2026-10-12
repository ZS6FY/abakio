// Builds times-table questions with four answer options.
// A "fact" is one table entry: { op: 'mul' | 'div', a, b }
//   mul: a × b          (a is the chosen table, b runs 1–12)
//   div: (a × b) ÷ a    (answer b)

export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// All facts for the chosen tables and operation.
export function buildPool(tables, op) {
  const pool = [];
  for (const a of tables) {
    for (let b = 1; b <= 12; b++) {
      if (op === 'mul' || op === 'mix') pool.push({ op: 'mul', a, b });
      if (op === 'div' || op === 'mix') pool.push({ op: 'div', a, b });
    }
  }
  return pool;
}

export function factKey(f) {
  return f.op === 'mul'
    ? `${Math.min(f.a, f.b)}x${Math.max(f.a, f.b)}`
    : `${f.a * f.b}/${f.a}`;
}

// A fixed-length round: shuffled facts, repeated if the round is longer
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

// Wrong options that a learner could plausibly pick: neighbouring facts
// and answers that are a little off. Never random numbers.
function wrongOptions(f, answer) {
  const { a, b } = f;
  const candidates = f.op === 'mul'
    ? [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b,
       answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]
    : [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3, a];

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
  if (f.op === 'mul') {
    // Show 7 × 8 and 8 × 7 both, so learners see the two orders.
    const swap = Math.random() < 0.5;
    text = swap ? `${f.b} × ${f.a}` : `${f.a} × ${f.b}`;
    answer = f.a * f.b;
  } else {
    text = `${f.a * f.b} ÷ ${f.a}`;
    answer = f.b;
  }
  return {
    fact: f,
    key: factKey(f),
    text,
    answer,
    options: shuffle([answer, ...wrongOptions(f, answer)])
  };
}
