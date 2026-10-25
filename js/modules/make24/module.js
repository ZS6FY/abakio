// Module config: Maak 24 – make 24 from four numbers. Has its own setup and play
// screens, and shares the "Hoe werk dit?" page with the other modules.

import { renderMake24Setup } from './setup.js';
import { renderMake24Play } from './play.js';

export const MAKE24 = {
  id: 'make24',
  title: 'make24.title',
  setup: renderMake24Setup,
  play: renderMake24Play,
  helpSections: [
    ['make24.howTitle', 'info.make24How'],
    ['make24.difficulty', 'info.make24Level'],
    ['make24.big', 'info.make24Big']
  ]
};
