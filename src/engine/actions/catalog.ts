// Registers every engine action type (DESIGN §2.2). Each section adds its family's rows here with its phase; §13
// test T24 checks that every action a screen dispatches is registered under its owner's name.
import { decisionAnswerDef } from './handlers/decision';
import { isRegisteredAction, registerAction } from './registry';

/** The engine's action types, in registration order (documentation and tests; the registry is keyed by type). */
export const ENGINE_ACTION_TYPES = ['decision/answer'] as const;

// Guarded so a re-evaluated module (hot reload, duplicated test import) does not throw on a duplicate row.
if (!isRegisteredAction(decisionAnswerDef.type)) registerAction(decisionAnswerDef);
