// The shared components (DESIGN §13.18 component structure): screens import them from here.
export { DataTable, type DataColumn, type DataTableProps } from './DataTable';
export type { CellValue, ColumnKind, FilterValue, SortSpec } from './dataTableModel';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Meter, meterStatus, type MeterProps } from './Meter';
export { ConfirmDialog, Modal, focusableIn, type ConfirmDialogProps, type ModalProps } from './Modal';
export { PeriodPicker, type PeriodPickerProps } from './PeriodPicker';
export {
  PERIOD_OPTIONS,
  resolvePeriod,
  type PeriodContext,
  type PeriodKind,
  type PeriodRange,
  type PeriodSpec,
} from './periods';
export { PlaceholderScreen } from './PlaceholderScreen';
export { Button, MessageArea, Panel, ScreenTitle } from './primitives';
export { QuickView, type QuickViewProps } from './QuickView';
export { EstimateRange, RangeBar, scalePosition, type EstimateRangeProps, type RangeBarProps } from './RangeBar';
export { StatTile, type StatTileProps } from './StatTile';
export { SeverityChip, StatusChip, StatusIcon, StatusText, type Status } from './StatusChip';
export { Stepper, type StepDef, type StepperProps } from './Stepper';
export { RouteTabs, Tabs, type RouteTab, type TabItem, type TabsProps } from './Tabs';
