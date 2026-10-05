// Player-facing text for save errors and notices (DESIGN §13.16, §13.21 codes). Kept apart from the screen so the
// `t()` catalog (13.19) can take these strings over without touching the component.
import type { SaveError, SaveNotice } from '../../../persistence';
import { assertNever } from '../../lib/assertNever';

export function errorText(error: SaveError): string {
  switch (error.code) {
    case 'SAVE_CORRUPT':
      return `That file could not be read. ${error.message} Nothing was changed.`;
    case 'SAVE_FORMAT':
      return `${error.message} Nothing was changed.`;
    case 'SAVE_TOO_NEW':
      return `${error.message} Update the game to load it. Nothing was changed.`;
    case 'SLOT_NOT_FOUND':
      return error.message;
    case 'IRONMAN_MANUAL_SAVE':
      return error.message;
    case 'SAVE_WRITE_FAILED':
      return `${error.message} Export the game now so you do not lose progress.`;
    default:
      return assertNever(error.code);
  }
}

export function noticeText(notice: SaveNotice): string {
  switch (notice.code) {
    case 'SAVE_MIGRATED':
      return notice.migrations.length > 0
        ? `Updated from save version ${notice.fromVersion} to ${notice.toVersion} (${notice.migrations.join(', ')}).`
        : `Updated from save version ${notice.fromVersion} to ${notice.toVersion}.`;
    case 'TUNING_DIFFERS':
      return 'This game keeps the tuning it was created with.';
    default:
      return assertNever(notice);
  }
}
