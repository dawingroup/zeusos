/**
 * Assignment & Handoff bounded context.
 *
 * Owns: master jobs, sub-jobs, IWOs, handoff packets, budget holds.
 * Must never: issue an IWO without locked budget.
 *
 * Per spec §1.3 / §7 — the spine that turns agreed, priced scope into
 * internal work orders and tracks them to completion. Phase 3.A.5
 * delivers the **types only**; the runtime guards (`issueWorkOrder`,
 * `acceptWorkOrder`, etc.) land in Phase 3.B.
 */

export type { MasterJob, MasterJobStatus } from './types/master-job.types';
export type { InternalWorkOrder } from './types/iwo.types';
export type {
  HandoffPacket,
  HandoffMilestone,
  HandoffAcceptanceCriterion,
} from './types/handoff-packet.types';
export type { BudgetHold } from './types/budget-hold.types';

export {
  IWO_STATES,
  IWO_EVENTS,
  IWO_TRANSITIONS,
  IWO_TRANSITION_LOOKUP,
  IWO_TERMINAL_STATES,
  IWO_ACTIVE_STATES,
  BUDGET_HOLD_STATES,
} from './constants/iwo-states';
export type {
  IWOState,
  IWOEvent,
  IWOEventActor,
  IWOTransition,
  BudgetHoldState,
} from './constants/iwo-states';
