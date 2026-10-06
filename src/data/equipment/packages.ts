// §9 dealer packages (DESIGN §9 9.2.3, D-9.44): a turnkey spread a hub dealer lists as one dealerNew listing; buying
// it creates one factory order per item with a shared ETA, and each item becomes its own machine on delivery. P3; the
// row ships in P1 as data for BALANCE T-09 (b) (D-9.57).
import type { EquipmentPackageRow } from './types';

export const equipmentPackages = {
  // Klondike tr300 950,000 + scrub 140,000 + cnv24 60,000 + Vortex cenL 240,000 × 1.10 + Caldera gen500 200,000 × 1.05
  // = 1,624,000 list; × (1 − 0.03) = $1,575,280. Power 220 + 55 + 45 + 15 = 335 kW ≤ the gen500's 375 kW continuous.
  pkg300: {
    id: 'pkg300',
    name: 'Klondike turnkey 300-bcy/hr spread',
    items: [
      { modelId: 'tr300', brandId: 'klondike' },
      { modelId: 'scrub', brandId: 'klondike' },
      { modelId: 'cnv24', brandId: 'klondike' }, // feed conveyor
      { modelId: 'cenL', brandId: 'vortex' },
      { modelId: 'gen500', brandId: 'caldera' },
    ],
    discountPct: 0.03, // fleet.packageDiscountPct
    assemblyCrewHours: 300, // tr300 240 + scrubber 40 + conveyor 20
    phase: 3,
  },
} as const satisfies Readonly<Record<string, EquipmentPackageRow>>;
