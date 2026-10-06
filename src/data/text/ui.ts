// Player-facing UI copy for typed codes (DESIGN §13.19 "All strings go through a t() catalog", D-13.12). English
// only; `{name}` placeholders are filled by ui/text.ts `t()`. Each code group mirrors its owner's code list: §1
// setup codes (13.14), §13.21 UI action codes, and the §2.9 save errors and notices.
export const uiText = {
  // §1 1.6 setup validation (13.14 wizard)
  'setup.NAME_EMPTY': 'Enter a company name.',
  'setup.NAME_TOO_LONG': 'Keep the name to {max} characters or fewer.',
  'setup.BACKED_TERMS_REQUIRED': 'Choose the investor terms for a Backed start.',
  'setup.BACKED_TERMS_UNEXPECTED': 'Investor terms apply only to a Backed start.',
  'setup.ENTITY_NOT_ALLOWED': 'A sole proprietorship cannot take equity investors.',
  'setup.SCENARIO_UNKNOWN': 'That scenario is not available.',
  'setup.DISTRICT_TEMPLATE_NOT_IN_PHASE': 'That district is not available in this version.',
  'setup.INHERITOR_NEEDS_NORTHERN': 'An Inheritor start needs the northern district.',
  'setup.START_NOT_IN_PHASE': 'That start is not available in this version.',
  'setup.START_YEAR_INVALID': 'Enter a start year from 1900 to 2500.',
  'setup.OPENING_SPOT_INVALID': 'The opening gold price must be above zero.',
  'setup.SEED_EMPTY': 'Enter a world seed, or press New seed.',
  'setup.SEED_TOO_LONG': 'Keep the seed to {max} characters or fewer.',

  // §13.21 ui/advanceWeek and ui/undo refusals
  'advance.BLOCKING_DECISION_OPEN': 'Answer the open decision before the week can advance.',
  'advance.RUN_IN_PROGRESS': 'Wait for the run to stop.',
  'advance.GAME_OVER': 'The run has ended; this save is read-only.',
  'advance.NO_GAME': 'Start or load a game first.',
  'undo.NOTHING_TO_UNDO': 'Nothing to undo this week.',
  'undo.UNDO_NOT_ALLOWED': 'The last action cannot be undone: it drew dice, revealed information or made a commitment.',
  'undo.UNDO_IRONMAN': 'Ironman games have no undo.',

  // §2.9 / §13.16 save errors and notices
  'save.SAVE_CORRUPT': 'That file could not be read. {message} Nothing was changed.',
  'save.SAVE_FORMAT': '{message} Nothing was changed.',
  'save.SAVE_TOO_NEW': '{message} Update the game to load it. Nothing was changed.',
  'save.SAVE_TOO_OLD':
    '{message} Saves from that version cannot be carried forward; start a new game. Nothing was changed.',
  'save.SLOT_NOT_FOUND': '{message}',
  'save.IRONMAN_MANUAL_SAVE': '{message}',
  'save.SAVE_WRITE_FAILED': '{message} Export the game now so you do not lose progress.',
  'save.SAVE_READ_FAILED': '{message} The browser may be blocking or clearing site storage. Nothing was changed.',
  'notice.SAVE_MIGRATED': 'Updated from save version {from} to {to}{list}.',
  'notice.TUNING_DIFFERS': 'This game keeps the tuning it was created with.',
  'autosave.failed': 'Autosave failed: {message} Export the game now so you do not lose progress.',
  'quickSave.failed': 'Quick save failed: {message} Export the game now so you do not lose progress.',
} as const satisfies Readonly<Record<string, string>>;

export type UiTextKey = keyof typeof uiText;
