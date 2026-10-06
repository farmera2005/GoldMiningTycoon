// §9 equipment classes (DESIGN §9 9.2.1): each class's component family, depreciation curve (9.3.2), book family
// (9.10), rate spec (9.7.2), whether it takes an operator, its §7 roles, its transport load pool (9.5) and its
// listing group (9.3.3).
//
// Family mapping notes. 9.3.2 prices plant, recovery and conveyor on one curve ("plant, recovery, conveyor") and puts
// camps with the light items ("light (pumps, gensets, drills, road trucks, camps)"); D-9.61 puts pickups there too, so
// every site item depreciates on the light curve (hours weight 0.3). 9.10's book table has no recovery row: recovery
// units take the plant book life. Site items keep their own book row (7 yr, 10%).
import type { ClassDef, ClassId } from './types';

export const CLASS_IDS = [
  'excavator',
  'dozer',
  'artTruck',
  'loader',
  'washPlant',
  'recovery',
  'pump',
  'generator',
  'drill',
  'conveyor',
  'roadTruck',
  'site',
] as const satisfies readonly ClassId[];

export const equipmentClasses = {
  excavator: {
    id: 'excavator',
    name: 'Excavator',
    family: 'excavator',
    depFamily: 'excavator',
    bookFamily: 'excavator',
    rate: { specField: 'rateBcyHr', unit: 'bcyHr' }, // loading trucks
    operated: true,
    roles: ['strip', 'dig', 'feed', 'support', 'reclaim'],
    loadPool: 'heavy',
    listingGroup: 'excavator',
  },
  dozer: {
    id: 'dozer',
    name: 'Dozer',
    family: 'dozer',
    depFamily: 'dozer',
    bookFamily: 'dozer',
    rate: { specField: 'rateBcyHr', unit: 'bcyHr' }, // at a 150 ft push
    operated: true,
    roles: ['strip', 'dig', 'support', 'reclaim'], // dig = rip assist (§7 7.6.2)
    loadPool: 'heavy',
    listingGroup: 'dozer',
  },
  artTruck: {
    id: 'artTruck',
    name: 'Articulated truck',
    family: 'wheeled',
    depFamily: 'wheeled',
    bookFamily: 'wheeled',
    rate: { specField: 'payloadBcy', unit: 'bcyPerLoad' }, // §7 reads it as the payload P_k (D-9.27)
    operated: true,
    roles: ['haul'],
    loadPool: 'heavy',
    listingGroup: 'artTruck',
  },
  loader: {
    id: 'loader',
    name: 'Loader',
    family: 'wheeled',
    depFamily: 'wheeled',
    bookFamily: 'wheeled',
    rate: { specField: 'rateBcyHr', unit: 'bcyHr' }, // load-and-carry feed
    operated: true,
    roles: ['feed', 'haul', 'support', 'reclaim'],
    loadPool: 'heavy',
    listingGroup: 'loader',
  },
  washPlant: {
    id: 'washPlant',
    name: 'Wash plant',
    family: 'plant',
    depFamily: 'plant',
    bookFamily: 'plant',
    rate: { specField: 'ratedBcyHr', unit: 'bcyHr' }, // plant add-ons (scrubber, extra runs) carry no rate of their own
    operated: false, // plant-operator skill acts on recovery in §7, not on capacity (D-9.26)
    roles: ['plant'],
    loadPool: 'heavy',
    listingGroup: 'washPlant',
  },
  recovery: {
    id: 'recovery',
    name: 'Recovery unit',
    family: 'recovery',
    depFamily: 'plant',
    bookFamily: 'plant',
    rate: { specField: 'fineTreatCapBcyHr', unit: 'bcyHr' }, // plant-feed equivalent
    operated: false,
    roles: ['plant'],
    loadPool: 'light',
    listingGroup: 'other',
  },
  pump: {
    id: 'pump',
    name: 'Pump',
    family: 'light',
    depFamily: 'light',
    bookFamily: 'light',
    rate: { specField: 'pumpGpm', unit: 'gpm' }, // at 100 ft total dynamic head
    operated: false,
    roles: ['water'],
    loadPool: 'light',
    listingGroup: 'pump',
  },
  generator: {
    id: 'generator',
    name: 'Generator',
    family: 'light',
    depFamily: 'light',
    bookFamily: 'light',
    rate: { specField: 'generatorKw', unit: 'kW' }, // 75% continuous
    operated: false,
    roles: ['power'],
    loadPool: 'light',
    listingGroup: 'generator',
  },
  drill: {
    id: 'drill',
    name: 'Drill rig',
    family: 'light',
    depFamily: 'light',
    bookFamily: 'light',
    rate: { specField: 'drillFtHr', unit: 'ftHr' },
    operated: true, // §8's driller role
    roles: [], // §4 programs, not a §7 mine-plan role
    loadPool: 'heavy',
    listingGroup: 'other',
  },
  conveyor: {
    id: 'conveyor',
    name: 'Conveyor',
    family: 'plant',
    depFamily: 'plant',
    bookFamily: 'plant',
    rate: { specField: 'stackerCapBcyHr', unit: 'bcyHr' }, // cuts §7 tailings-handling hours
    operated: false,
    roles: ['support'],
    loadPool: 'heavy',
    listingGroup: 'other',
  },
  roadTruck: {
    id: 'roadTruck',
    name: 'Road truck',
    family: 'light',
    depFamily: 'light',
    bookFamily: 'light',
    rate: null, // service, fuel-lube and lowboy tractors: effects, not a rate
    operated: false, // 9.7.2's S list; §8 maps the lowboy driver to its truck class
    roles: ['support'],
    loadPool: 'light',
    listingGroup: 'other',
  },
  site: {
    id: 'site',
    name: 'Site item',
    family: 'none',
    depFamily: 'light',
    bookFamily: 'site',
    rate: null, // flat upkeep only (9.2.5)
    operated: false,
    roles: [],
    loadPool: 'light',
    listingGroup: 'other',
  },
} as const satisfies { readonly [C in ClassId]: ClassDef & { readonly id: C } };
