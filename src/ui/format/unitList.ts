// Every §2.8 Unit at run time (the engine exports the type only). The Record keeps the list complete: adding a unit to
// the engine's union without listing it here is a type error, so text templates and the CSV writer can check a unit
// name they read from data.
import type { Unit } from '../../engine';

const UNIT_SET: Readonly<Record<Unit, true>> = {
  usd: true,
  cents: true,
  usdPerFineOz: true,
  usdPerRawOz: true,
  usdPerOz: true,
  usdPerBcy: true,
  usdPerLcy: true,
  usdPerHour: true,
  usdPerDay: true,
  usdPerWeek: true,
  usdPerMonth: true,
  usdPerYear: true,
  usdPerAcre: true,
  usdPerGal: true,
  usdPerSt: true,
  oz: true,
  rawOz: true,
  fineOz: true,
  milliOz: true,
  ozPerBcy: true,
  gPerM3: true,
  mg: true,
  bcy: true,
  lcy: true,
  bcyPerHour: true,
  lcyPerHour: true,
  acres: true,
  ft: true,
  gpm: true,
  acreFt: true,
  gal: true,
  galPerHour: true,
  hours: true,
  days: true,
  weeks: true,
  months: true,
  years: true,
  turn: true,
  pct: true,
  apr: true,
  ratio: true,
  mult: true,
  prob: true,
  count: true,
  people: true,
  score: true,
  points: true,
  index: true,
  zScore: true,
  st: true,
  ozPerSt: true,
  station: true,
  none: true,
};

export const UNITS: readonly Unit[] = Object.keys(UNIT_SET) as Unit[];

export function isUnit(s: string): s is Unit {
  return Object.hasOwn(UNIT_SET, s);
}
