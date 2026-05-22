/**
 * Delivery (per subsidiary) bounded context.
 *
 * Owns: tasks, timesheets, deliverables.
 * Must never: contact client on price/scope.
 *
 * Per spec §1.3 — subsidiaries run their delivery workspaces and post
 * actuals upward via TimeEntry / CostEntry / Deliverable. They have no
 * API path to client pricing, contracts, or invoicing.
 */

export type { TimeEntry } from './types/time-entry.types';
export type { CostEntry, CostEntryKind } from './types/cost-entry.types';
export type {
  Deliverable,
  DeliverableAcceptanceState,
  DeliverableKind,
  ApprovalSlot,
} from './types/deliverable.types';

// Phase 3.E — subsidiary delivery workspace.
export { SubsidiaryDeliveryGuard } from './components/SubsidiaryDeliveryGuard';
export { RouteToAMButton } from './components/RouteToAMButton';
export type { RouteToAMButtonProps } from './components/RouteToAMButton';
export {
  isParentOrgUser,
  isSubsidiaryUser,
  resolveHomeSubsidiaryId,
} from './components/deliveryAccess';
export {
  computeBurnMeter,
  sumEntries,
  type BurnMeter,
  type BurnStatus,
} from './services/burnMeter';
