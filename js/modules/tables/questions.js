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

// The same two numbers make one family of sums: 3 × 2, 2 × 3, 6 ÷ 2 and 6 ÷ 3 belong together.
const family = (f) => `${Math.min(f.a, f.b)}x${Math.max(f.a, f.b)}`;

// Partners (the turned-around form, the ÷ partner) must be at least this many places apart,
// so a sum never gives away the answer to the next one.
const PARTNER_GAP = 3;

// Shuffle so that no two sums of one family are closer than `gap` places.
// `before` is what was asked just ahead of this list (it counts for the first places).
// It builds the order place by place, picking at random among the sums that are allowed,
// and favours big families so they don't get stuck at the end. If it still gets stuck it
// starts over; after many tries it settles for a plain shuffle.
function spreadShuffle(items, gap = PARTNER_GAP, before = []) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const left = new Map(); // family -> sums not yet placed
    for (const f of items) {
      const fam = family(f);
      if (!left.has(fam)) left.set(fam, []);
      left.get(fam).push(f);
    }
    const recent = before.slice(-(gap - 1)).map(family); // families of the last gap − 1 places
    const out = [];
    while (out.length < items.length) {
      const allowed = [...left.entries()].filter(([fam, list]) => list.length && !recent.includes(fam));
      if (!allowed.length) break;
      // Pick a family in proportion to how many of its sums are left, then a random sum from it.
      let r = Math.random() * allowed.reduce((n, [, list]) => n + list.length, 0);
      let [fam, list] = allowed[allowed.length - 1];
      for (const entry of allowed) {
        r -= entry[1].length;
        if (r < 0) { [fam, list] = entry; break; }
      }
      const f = list.splice(Math.floor(Math.random() * list.length), 1)[0];
      out.push(f);
      recent.push(fam);
      if (recent.length > gap - 1) recent.shift();
    }
    if (out.length === items.length) return out;
  }
  return shuffle(items);
}

// Learn mode.
//
// Geskommel: every sum on its own, mixed through each other, partners kept apart.
//
// In volgorde: first the normal forms in table order (1 × 2, 2 × 2, 3 × 2 …), then the partner
// forms as a second part, mixed up:
//   × (or mixed): the × facts in order; then the turned-around forms and, with mixed, the ÷ sums
//   ÷ only:       the ÷ facts in order; then their turned-around forms
export function buildLearnRound(tables, op, turnaround, shuffled = false) {
  const normal = [];
  const turned = [];
  for (const a of [...tables].sort((x, y) => x - y)) {
    for (let b = 1; b <= 12; b++) {
      for (const kind of ['mul', 'div']) {
        if (kind === 'mul' ? !wantsMul(op) : !wantsDiv(op)) continue;
        const f = { op: kind, a, b, turn: false };
        normal.push(f);
        if (turnaround && a !== b) turned.push({ ...f, turn: true });
      }
    }
  }

  if (shuffled) return spreadShuffle([...normal, ...turned]);

  const lead = op === 'div' ? 'div' : 'mul';
  const first = normal.filter((f) => f.op === lead);
  const second = [...normal.filter((f) => f.op !== lead), ...turned];
  return [...first, ...spreadShuffle(second, PARTNER_GAP, first)];
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
    display: `${text} = ?`,
    full: `${text} = ${answer}`,
    answer,
    options: shuffle([answer, ...wrongOptions(f, answer, divisor)])
  };
}
