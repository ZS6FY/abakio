// Module config: Maak 'n getal (make a number) – + and − for Gr 1–2,
// with pictures. Has its own setup and play screens, but shares the results
// screen, badges, ⓘ cards and the "Hoe werk dit?" page with the other modules.

import { renderMakeSetup } from './setup.js';
import { renderMakePlay } from './play.js';

export const MAKE = {
  id: 'make',
  title: 'make.title',
  setup: renderMakeSetup,
  play: renderMakePlay,
  // Records: "make|mode|op|count|step|targets"
  bestKey: (s) => `make|${s.mode}|${s.op}|${s.count}|${s.step}|${s.targets.join(',')}`,
  helpSections: [
    ['tables.mode', 'info.mode'],
    ['make.step', 'info.makeStep'],
    ['tables.op', 'info.makeOp'],
    ['make.targets', 'info.makeTargets'],
    ['make.pictures', 'info.makePictures'],
    ['tables.count', 'info.count']
  ]
};
