/**
 * Daily Plan — Phase 6.E (DawinOS stream E port).
 *
 *   /tasks/today   MyDayPage          "Your focus today" + wrap-up
 *   /tasks/review  PlanTomorrowPage   the manager's evening review + coverage
 *
 * Server side: functions/src/event-task-engine/ (plans drafted 17:00,
 * published 06:00, closed 20:00; `dailyPlanAction` / `taskAction` callables).
 */

export * from './types';
export * from './format';
export * from './services/taskEngineFunctions';
export * from './services/dailyPlanService';
export * from './services/tasksService';
export { useTodayPlan, describePlanLoadError } from './hooks/useTodayPlan';
export { useTeamPlans } from './hooks/useTeamPlans';
export type { TeamPlanRow } from './hooks/useTeamPlans';
export { useDirectReports } from './hooks/useDirectReports';
export type { DirectReport } from './hooks/useDirectReports';
export { useUnassignedWork } from './hooks/useUnassignedWork';
export { FocusTodayCard } from './components/FocusTodayCard';
export { BlockedDialog, WrapUpModal } from './components/FocusDialogs';
export { AddOwnTaskDialog } from './components/AddOwnTaskDialog';
export { ActionCenterFocusStrip } from './components/ActionCenterFocusStrip';
