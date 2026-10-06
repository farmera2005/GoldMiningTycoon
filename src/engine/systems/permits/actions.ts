// §6 permits and obligations actions (DESIGN §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers PERMITS_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). The owning package fills it; the framework never edits it.
import type { ActionDef } from '../../actions/types';

/** This folder's action payloads, a union of `{ type: '<family>/<verb>'; … }` (`never` while it has none). */
export type PermitsAction = never;

/** Registry rows (validator, handler, `reveals` / `commits`, `fromPhase`, optional `warnings`). */
export const PERMITS_ACTIONS: readonly ActionDef[] = [];

/** Error codes this folder's validators return (SCREAMING_SNAKE). */
export const PERMITS_ERROR_CODES = [] as const satisfies readonly string[];

/** Non-blocking warning codes (s07 #3, S13-3). */
export const PERMITS_WARNING_CODES = [] as const satisfies readonly string[];
