// Questions for Maak 'n getal.
//
// Four steps (settings.step), each with + or − (settings.op, or both with 'mix').
// T is the number the learner chose on the setup screen.
//
//   sum   Tel saam / Wat bly oor   a + b = □  (answer T)       T − b = □   (the answer at the end,
//                                                               as in the Gr 1 class books)
//   bond  Maatjies                 a + □ = T                   T − □ = c
//   pick2 Kies twee                3 cards, tap the 2 that make T   (+: a + b = T, −: a − b = T)
//   pick3 Kies drie                4 cards, tap the 3 that make T   (+: a + b + c = T, −: a − b − c = T)
//
// sum and bond: choose the answer from 3 numbers (as in the Grade R book).
// pick2 and pick3: exactly one set of cards works, so a child who finds a
// correct answer is never marked wrong.
// No zeros anywhere: every part is at least 1.

export const STEPS = ['sum', 'bond', 'pick2', 'pick3'];
const SIGN = { add: '+', sub: '−' };

const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sentence = (values, op, result) => `${values.join(` ${SIGN[op]} `)} = ${result}`;

// Three answers to choose from: the right one and two close neighbours, smallest first.
export function choiceOptions(answer) {
  const near = [answer - 2, answer - 1, answer + 1, answer + 2].filter((n) => n >= 1);
  return [answer, ...shuffle(near).slice(0, 2)].sort((x, y) => x - y);
}

function choice(step, op, T, display, full, answer, parts) {
  return {
    kind: 'choice', step, op, target: T, display, full, answer,
    answerText: String(answer), options: choiceOptions(answer), parts,
    key: `n:${display.replace(/\s/g, '')}`
  };
}

function sumQuestion(T, op) {
  if (op === 'add') {
    const a = rnd(1, T - 1);
    const b = T - a;
    return choice('sum', op, T, `${a} + ${b} = □`, `${a} + ${b} = ${T}`, T,
      [{ n: a, k: 'fill', s: 0 }, { n: b, k: 'fill', s: 1 }]);
  }
  const b = rnd(1, T - 1);
  const c = T - b;
  return choice('sum', op, T, `${T} − ${b} = □`, `${T} − ${b} = ${c}`, c,
    [{ n: c, k: 'fill', s: 0 }, { n: b, k: 'cross', s: 0 }]);
}

function bondQuestion(T, op) {
  if (op === 'add') {
    const a = rnd(1, T - 1);
    const ans = T - a;
    return choice('bond', op, T, `${a} + □ = ${T}`, `${a} + ${ans} = ${T}`, ans,
      [{ n: a, k: 'fill', s: 0 }, { n: ans, k: 'ghost', s: 1 }]);
  }
  const c = rnd(1, T - 1);
  const ans = T - c;
  return choice('bond', op, T, `${T} − □ = ${c}`, `${T} − ${ans} = ${c}`, ans,
    [{ n: c, k: 'fill', s: 0 }, { n: ans, k: 'cross', s: 0 }]);
}

// What a set of cards makes: + adds them all; − takes the smaller ones away from the biggest.
export function makes(values, op) {
  if (op === 'add') return values.reduce((x, y) => x + y, 0);
  const [big, ...rest] = [...values].sort((x, y) => y - x);
  return rest.reduce((x, y) => x - y, big);
}

// Write the chosen cards as a sum: + in the order tapped, − biggest first.
export function cardSentence(values, op, result) {
  const ordered = op === 'sub' ? [...values].sort((x, y) => y - x) : values;
  return sentence(ordered, op, result);
}

function combos(n, k, start = 0, acc = [], out = []) {
  if (acc.length === k) { out.push([...acc]); return out; }
  for (let i = start; i < n; i++) { acc.push(i); combos(n, k, i + 1, acc, out); acc.pop(); }
  return out;
}

// How many different sets of `need` cards make T.
export function countSolutions(cards, need, op, T) {
  return combos(cards.length, need).filter((idx) => makes(idx.map((i) => cards[i]), op) === T).length;
}

function pickQuestion(step, T, op) {
  const need = step === 'pick3' ? 3 : 2;
  if (op === 'add' && T < need) op = 'sub'; // cannot split T into enough parts of 1 or more
  const biggest = Math.max(20, T + 5); // largest card in a − sum

  for (let tries = 0; tries < 500; tries++) {
    let parts;
    if (op === 'add') {
      if (need === 2) { const a = rnd(1, T - 1); parts = [a, T - a]; }
      else { const a = rnd(1, T - 2); const b = rnd(1, T - a - 1); parts = [a, b, T - a - b]; }
    } else {
      const room = biggest - T;
      if (need === 2) { const b = rnd(1, room); parts = [T + b, b]; }
      else { const b = rnd(1, room - 1); const c = rnd(1, room - b); parts = [T + b + c, b, c]; }
    }
    const hi = op === 'add' ? Math.max(T - 1, need + 2) : biggest;
    const extra = rnd(1, hi);
    const cards = [...parts, extra];
    if (countSolutions(cards, need, op, T) !== 1) continue;

    const order = shuffle(cards.map((_, i) => i));
    const shown = order.map((i) => cards[i]);
    const solution = order.map((orig, pos) => (orig < need ? pos : -1)).filter((pos) => pos >= 0);
    const full = cardSentence(parts, op, T);
    return {
      kind: 'pick', step, op, target: T, need,
      cards: shown, solution, full, answerText: full,
      key: `${step}:${SIGN[op]}${T}`
    };
  }
  return null;
}

export function makeQuestion(spec) {
  const { step, op, target } = spec;
  if (step === 'sum') return sumQuestion(target, op);
  if (step === 'bond') return bondQuestion(target, op);
  return pickQuestion(step, target, op) ?? pickQuestion(step, target, op === 'add' ? 'sub' : 'add');
}

// A spec says what to ask, without the numbers: { step, op, target }.
export function makeSpec(settings, previous = null) {
  const op = settings.op === 'mix' ? pick(['add', 'sub']) : settings.op;
  let target = pick(settings.targets);
  if (previous && settings.targets.length > 1 && target === previous.target) target = pick(settings.targets);
  return { step: settings.step, op, target };
}

// A whole round: every chosen number comes up about equally often.
export function makeRound(settings, n) {
  const out = [];
  let bag = [];
  for (let i = 0; i < n; i++) {
    if (!bag.length) bag = shuffle(settings.targets);
    const target = bag.pop();
    const op = settings.op === 'mix' ? pick(['add', 'sub']) : settings.op;
    out.push({ step: settings.step, op, target });
  }
  return out;
}
