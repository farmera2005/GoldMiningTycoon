// `ui.*` presentation configuration (DESIGN §13.25). NOT part of TuningResolved and NOT in meta.tuningHash (D-13.32):
// changing one of these never forks a save or a golden replay. Keys match the 13.25 table one for one.
import type { TuningTable } from './types';

export const uiConfig = {
  // Runs and stop rules (§2.7, 13.9)
  'ui.runMaxWeeksDefault': 26,
  'ui.runDeadlineNoticeWeeks': 2,
  'ui.runGoldMoveStopPct': 0.05,
  // Explanation retention and report memory (13.13, 13.16, D-13.10)
  'ui.calcRetentionWeeks': 4,
  'ui.calcPersistWeeks': 1,
  'ui.persistReportMaxKb': 200,
  'ui.reportsInMemory': 13,
  'ui.undoMaxEntries': 50,
  'ui.advanceBudgetMs': 20,
  // Autosave (13.16, D-13.25)
  'ui.autosaveRotatingSlots': 3,
  'ui.autosaveYearlyKeep': 5,
  'ui.autosaveEveryRunWeeks': 8,
  // Inbox, toasts, searches, calendar
  'ui.inboxAutoArchiveInfoWeeks': 8,
  'ui.maxToastsVisible': 3,
  'ui.maxSavedSearches': 20,
  'ui.agendaWeeks': 26,
  // Production vs plan and permit meters
  'ui.planVarianceWarnPct': 0.1,
  'ui.planVarianceBadPct': 0.25,
  'ui.condMeterWarnFrac': 0.9,
  // Estimate heat map (13.5)
  'ui.heatmapLog2Step': 0.5,
  'ui.heatmapRatio1': 2,
  'ui.heatmapRatio2': 4,
  'ui.heatmapRatio3': 8,
  'ui.heatmapCellPx': 32,
  'ui.heatmapLongAxisRows': 10,
  // Explain (13.13)
  'ui.explainPopoverChildren': 5,
  'ui.explainDefaultDepth': 2,
  'ui.explainLiveBudgetMs': 25,
  // Tables (13.2)
  'ui.virtualizeRowThreshold': 100,
  // Formatting (13.2)
  'ui.fmt.centsHiddenAboveUsd': 1000,
  'ui.fmt.compactAboveUsd': 100000,
  'ui.fmt.ozDecimalsBelow100': 3,
  'ui.fmt.ozDecimalsAtOrAbove100': 2,
  'ui.fmt.gradeDecimals': 4,
  'ui.fmt.pctDecimals': 1,
  'ui.fmt.rateDecimals': 2,
  'ui.fmt.ozPerYd3PerGPerM3': 0.024581,
  // Layout (13.1, 13.19)
  'ui.layout.minWidthPx': 1024,
  'ui.layout.fullLayoutMinPx': 1280,
  'ui.layout.designWidthPx': 1440,
  'ui.layout.navPx': 224,
  'ui.layout.railPx': 56,
  'ui.layout.drawerPx': 440,
  'ui.layout.topBarPx': 56,
  // Onboarding (13.14)
  'ui.tutorialDefaultOnFirstGame': true,
  // Theme and fonts (13.20, D-13.56, D-13.59, D-13.60)
  'ui.theme.default': 'system',
  'ui.theme.grainOpacityDaylight': 0.05,
  'ui.theme.grainOpacityLamplight': 0.07,
  'ui.theme.displayMinPx': 16,
  'ui.fonts.maxKb': 260,
} as const satisfies TuningTable;

export type UiConfigKey = keyof typeof uiConfig;
