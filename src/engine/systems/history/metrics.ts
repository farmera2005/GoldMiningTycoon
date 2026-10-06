// Labels and units of the history metrics (DESIGN §2.5; S13-8): §2 publishes them beside HistorySlice, so a `history`
// ExplainRef (§13 13.13), the charts and the CSV export name every series the same way. The UI reads this table and
// keeps none of its own.
import type { Unit } from '../../core/calc';
import type { HistoryMetric } from './types';

export interface HistoryMetricInfo {
  readonly label: string;
  readonly unit: Unit;
}

export const HISTORY_METRIC_INFO: Readonly<Record<HistoryMetric, HistoryMetricInfo>> = {
  spot: { label: 'Gold spot', unit: 'usdPerFineOz' },
  goldIdx: { label: 'Gold index', unit: 'index' },
  cpiIndex: { label: 'Consumer price index', unit: 'index' },
  cpiYoY: { label: 'Inflation, year on year', unit: 'pct' },
  baseRate: { label: 'Base interest rate', unit: 'apr' },
  realRate: { label: 'Real interest rate', unit: 'apr' },
  usdIdx: { label: 'US dollar index', unit: 'index' },
  cbPublished: { label: 'Central-bank gold buying', unit: 'index' },
  geoRisk: { label: 'Geopolitical risk', unit: 'index' },
  eqSentiment: { label: 'Equity sentiment', unit: 'index' },
  dieselRack: { label: 'Diesel rack price', unit: 'usdPerGal' },
  cashCents: { label: 'Cash on hand at week end', unit: 'cents' },
  ownerNwCents: { label: 'Owner net worth at week end', unit: 'cents' },
  companyNwCents: { label: 'Company net worth at week end', unit: 'cents' },
  payWashedBcy: { label: 'Pay washed', unit: 'bcy' },
  weighedRawOz: { label: 'Raw gold weighed at cleanups', unit: 'rawOz' },
  soldFineOz: { label: 'Fine gold sold', unit: 'fineOz' },
  sampleRawOz: { label: 'Raw gold weighed from samples', unit: 'rawOz' },
  fineOzRecovered: { label: 'Fine gold recovered (estimated)', unit: 'fineOz' },
};
