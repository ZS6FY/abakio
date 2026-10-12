// Module config: Ontbrekende getalle (missing numbers).

import { makeMissingQuestion } from './questions.js';

export const MISSING = {
  id: 'missing',
  title: 'missing.title',
  learnHint: 'missing.learnHint',
  turnHint: 'missing.turnHint',
  makeQuestion: makeMissingQuestion
};
