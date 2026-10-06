// The chart kit (DESIGN §13.18 "Recharts usage", §13.20 chart palette): every chart is a <figure> with a caption
// summary and a table twin, colors come only from theme.ts, and tooltips show <Num>s.
export { Bullet, planStatus, type BulletProps, type BulletRow } from './Bullet';
export {
  CashForecast,
  cashRows,
  firstNegativeWeek,
  type CashChip,
  type CashForecastProps,
  type CashPoint,
} from './CashForecast';
export { ChartFigure, TwinTable, type ChartFigureProps, type TwinCell, type TwinTableProps } from './ChartFigure';
export { ChartTooltip, type ChartTooltipProps, type TooltipRow } from './ChartTooltip';
export { FanChart, fanRows, type FanChartProps, type FanPoint } from './FanChart';
export {
  PHASE_FILL,
  SeasonStrip,
  weekX,
  type SeasonBoundary,
  type SeasonOverlay,
  type SeasonSegment,
  type SeasonStripProps,
} from './SeasonStrip';
export { Sparkline, sparkRows, type SparkPoint, type SparklineProps } from './Sparkline';
export {
  StackedCost,
  foldCategories,
  OTHER_KEY,
  type CostCategory,
  type CostColumn,
  type StackedCostProps,
} from './StackedCost';
export { StageBars, idleCauseOrder, type StageBarsProps, type StageIdle, type StageRowView } from './StageBars';
export {
  CHART_COLORS,
  MARKS,
  MAX_ANIMATED_POINTS,
  SERIES_SLOTS,
  claimSlot,
  rampColor,
  seriesColor,
  shouldAnimate,
  tickText,
  useReducedMotion,
  type Ramp,
} from './theme';
export { Tornado, tornadoData, type TornadoProps, type TornadoRow } from './Tornado';
export { useWeekLabel, type WeekLabel } from './weekLabel';
