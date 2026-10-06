// Grade (DESIGN §13.2, §2.4, D-13.14): metal ("raw") oz per bank cubic yard to 4 dp, with g/m³ (2 dp) in the
// tooltip, using ui.fmt.ozPerYd3PerGPerM3 = 0.024581 (1 g = 0.0321507 ozt; 1 m³ = 1.307951 yd³).
import { uiConfig } from '../../data/tuning/ui';
import { fixed } from './numbers';

/** `0.0095 oz/bcy`. */
export function grade(ozPerBcy: number): string {
  return `${fixed(ozPerBcy, uiConfig['ui.fmt.gradeDecimals'])} oz/bcy`;
}

/** The tooltip text: `0.39 g/m³`. */
export function gradeMetric(ozPerBcy: number): string {
  return `${fixed(ozPerBcy / uiConfig['ui.fmt.ozPerYd3PerGPerM3'], 2)} g/m³`;
}

/** Both together, as the T1 table writes them: `0.0095 oz/bcy (0.39 g/m³)`. */
export function gradeWithMetric(ozPerBcy: number): string {
  return `${grade(ozPerBcy)} (${gradeMetric(ozPerBcy)})`;
}

/** A grams-per-cubic-metre value on its own (`gPerM3` unit). */
export function gramsPerM3(gPerM3: number): string {
  return `${fixed(gPerM3, 2)} g/m³`;
}
