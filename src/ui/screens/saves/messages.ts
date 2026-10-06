// Player-facing text for save errors and notices (DESIGN §13.16, §13.21 codes), from the t() catalog.
import type { SaveError, SaveNotice } from '../../../persistence';
import { assertNever } from '../../lib/assertNever';
import { t } from '../../text';

export function errorText(error: SaveError): string {
  return t(`save.${error.code}`, { message: error.message });
}

export function noticeText(notice: SaveNotice): string {
  switch (notice.code) {
    case 'SAVE_MIGRATED':
      return t('notice.SAVE_MIGRATED', {
        from: notice.fromVersion,
        to: notice.toVersion,
        list: notice.migrations.length > 0 ? ` (${notice.migrations.join(', ')})` : '',
      });
    case 'TUNING_DIFFERS':
      return t('notice.TUNING_DIFFERS');
    default:
      return assertNever(notice);
  }
}
