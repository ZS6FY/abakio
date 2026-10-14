// Pictures for Maak 'n getal: simple shapes in different colours, laid out in
// ten-frames (two rows of 5), so a child sees "5 and 2 more" instead of
// counting every shape one by one.
//
// A picture is a list of parts, e.g. [{ n: 6, k: 'fill', s: 0 }, { n: 3, k: 'fill', s: 1 }]:
//   n – how many shapes, s – which style (shape + colour) to use,
//   k – 'fill'  a normal shape
//       'cross' a shape that is taken away (faded and crossed out)
//       'ghost' an outline only: the missing part in a Maatjies sum
// Unused cells in the last ten-frame stay empty.

const SHAPES = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  triangle: '<path d="M12 3 L21.5 20 H2.5 Z"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3 5 6.5 5c2.1 0 3.6 1.2 5.5 3.2C13.9 6.2 15.4 5 17.5 5 21 5 23 8.3 21.5 11.8 19.5 16.4 12 21 12 21z"/>',
  star: '<path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/>',
  diamond: '<path d="M12 2.5 L21 12 L12 21.5 L3 12 Z"/>'
};
const SHAPE_NAMES = Object.keys(SHAPES);
const COLOURS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#51cf66', '#b197fc', '#ff922b', '#f783ac'];

const shuffled = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// n styles that differ in BOTH shape and colour, so they are easy to tell
// apart, also for a child who doesn't see all colours well.
export function pickStyles(n) {
  const shapes = shuffled(SHAPE_NAMES);
  const colours = shuffled(COLOURS);
  return Array.from({ length: n }, (_, i) => ({ shape: shapes[i % shapes.length], colour: colours[i % colours.length] }));
}

function cell(style, kind) {
  if (!style) return '<span class="cell"></span>';
  const body = SHAPES[style.shape];
  if (kind === 'ghost') {
    return `<span class="cell"><svg viewBox="0 0 24 24"><g fill="none" stroke="${style.colour}" stroke-width="2" stroke-dasharray="3 2">${body}</g></svg></span>`;
  }
  if (kind === 'cross') {
    return `<span class="cell"><svg viewBox="0 0 24 24"><g fill="${style.colour}" opacity="0.35">${body}</g>
      <path d="M5 5 L19 19 M19 5 L5 19" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></span>`;
  }
  return `<span class="cell"><svg viewBox="0 0 24 24"><g fill="${style.colour}">${body}</g></svg></span>`;
}

// size: 'big' for the question picture, 'mini' for the number cards.
export function frameHtml(parts, styles, size = 'big') {
  const cells = [];
  parts.forEach((p) => {
    for (let i = 0; i < p.n; i++) cells.push(cell(styles[p.s], p.k));
  });
  const frames = Math.max(1, Math.ceil(cells.length / 10));
  while (cells.length < frames * 10) cells.push(cell(null));
  let html = '';
  for (let f = 0; f < frames; f++) {
    html += `<div class="tenframe">${cells.slice(f * 10, f * 10 + 10).join('')}</div>`;
  }
  return `<div class="frames ${size}" aria-hidden="true">${html}</div>`;
}
