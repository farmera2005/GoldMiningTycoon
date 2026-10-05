// Tuning values are plain data (DESIGN §2.10). Keys are dotted and namespaced exactly as in DESIGN's tuning tables,
// e.g. 'game.history.weeklyKeep'. Tables (honesty mixes, per-band multipliers) are nested readonly objects or arrays.
export type TuningScalar = number | boolean | string;
export type TuningValue = TuningScalar | readonly TuningValue[] | { readonly [k: string]: TuningValue };
export type TuningTable = { readonly [key: string]: TuningValue };
