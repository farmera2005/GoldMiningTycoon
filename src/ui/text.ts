// t(): the UI copy catalog lookup (DESIGN §13.19, D-13.12). English only for now; placeholders are `{name}`.
import { uiText, type UiTextKey } from '../data/text/ui';

export type { UiTextKey } from '../data/text/ui';

export function t(key: UiTextKey, params: Readonly<Record<string, string | number>> = {}): string {
  return uiText[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : whole,
  );
}
