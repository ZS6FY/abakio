// Missing-number questions, built from the same facts as the times tables.
//
// Fact { op, a, b, turn }: a is the table, b runs 1–12, p = a × b.
//
// Gentle form (Draai om off) – the table number stays visible:
//   ×  ? × a = p      (answer b)
//   ÷  p ÷ ? = a      (answer b)     – the partner of ? × a = p
//
// Stretch forms (Draai om on, fact.turn = true) – one is picked at random:
//   ×  b × ? = p   (a)    ? × b = p   (a)    a × ? = p   (b)
//   ÷  ? ÷ a = b   (p)    p ÷ ? = b   (a)    ? ÷ b = a   (p)

import { shuffle } from '../tables/questions.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function buildForm(f) {
  const { a, b } = f;
  const p = a * b;

  if (f.op === 'mul') {
    if (!f.turn) return { left: '?', sym: '×', right: a, result: p, answer: b, filled: [b, a] };
    return pick([
      { left: b, sym: '×', right: '?', result: p, answer: a, filled: [b, a] },
      { left: '?', sym: '×', right: b, result: p, answer: a, filled: [a, b] },
      { left: a, sym: '×', right: '?', result: p, answer: b, filled: [a, b] }
    ]);
  }

  if (!f.turn) return { left: p, sym: '÷', right: '?', result: a, answer: b, filled: [p, b] };
  return pick([
    { left: '?', sym: '÷', right: a, result: b, answer: p, filled: [p, a] },
    { left: p, sym: '÷', right: '?', result: b, answer: a, filled: [p, a] },
    { left: '?', sym: '÷', right: b, result: a, answer: p, filled: [p, b] }
  ]);
}

// Plausible wrong answers: near the right one, or a related number from the fact.
function wrongOptions(f, form) {
  const { a, b } = f;
  const ans = form.answer;
  const isProduct = ans === a * b && ans > 12;
  const candidates = isProduct
    ? [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10]
    : [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, a, b];

  const unique = [...new Set(candidates)].filter((n) => n > 0 && n !== ans);
  const picked = shuffle(unique).slice(0, 3);
  let extra = ans + 3;
  while (picked.length < 3) {
    if (!picked.includes(extra)) picked.push(extra);
    extra++;
  }
  return picked;
}

export function makeMissingQuestion(f) {
  const form = buildForm(f);
  const display = `${form.left} ${form.sym} ${form.right} = ${form.result}`;
  const full = `${form.filled[0]} ${form.sym} ${form.filled[1]} = ${form.result}`;
  return {
    fact: f,
    // Stats key: the question with its gap, e.g. "m:?×2=12".
    key: `m:${display.replace(/\s/g, '')}`,
    display,
    full,
    answer: form.answer,
    options: shuffle([form.answer, ...wrongOptions(f, form)])
  };
}
