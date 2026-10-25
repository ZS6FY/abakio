// Module config: Maak 24 – make 24 from four numbers. Has its own setup and play
// screens, and shares the results screen, badges and "Hoe werk dit?" page with the other modules.

import { renderMake24Setup } from './setup.js';
import { renderMake24Play, SKIP_PENALTY_MS } from './play.js';

const size = (s) => (s.big ? 'big' : 'small');

export const MAKE24 = {
  id: 'make24',
  title: 'make24.title',
  setup: renderMake24Setup,
  play: renderMake24Play,
  // Records (Uitdaging rounds): "make24|round5|dots|size" or "make24|streak|dots|size".
  // One-card records are kept by the play screen as "make24|card|dots|size".
  bestKey: (s) => `make24|${s.count === 'inf' ? 'streak' : `round${s.count}`}|${s.dots}|${size(s)}`,
  // A getter: the files import each other, so SKIP_PENALTY_MS must not be read while loading.
  get helpVars() { return { n: SKIP_PENALTY_MS / 1000 }; },
  helpSections: [
    ['make24.howTitle', 'info.make24How'],
    ['make24.mode', 'info.make24Mode'],
    ['make24.difficulty', 'info.make24Level'],
    ['make24.big', 'info.make24Big'],
    ['make24.count', 'info.make24Count']
  ]
};
