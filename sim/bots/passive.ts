// `passive` (DESIGN §2.12.1 named test bots, BALANCE §4.5, G-03): never operates; holds cash and the start's assets,
// so its runs measure fixed and holding costs. It answers every decision with the decision's default.
import { answerOpenDecisions, takeDefaults } from './decisions';
import type { Bot } from './types';

export const passiveBot: Bot = {
  id: 'passive',
  decide: (_state, view) => answerOpenDecisions(view.openDecisions, takeDefaults),
};
