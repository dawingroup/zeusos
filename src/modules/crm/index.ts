/**
 * CRM module — sales pipeline for the marketing consortium.
 *
 * Owns: crm_leads/{leadId} + activities sub-collection. Parent-org only
 * (Firestore rules) — subsidiaries don't see the deal pipeline.
 *
 * Replaces the construction-shaped DawinOS CRM (BoQ-aware deal tracker,
 * removed in Phase 1.C) with a lean 5-stage funnel:
 *   PROSPECT → QUALIFIED → PITCH → WON | LOST
 *
 * Won leads convert to Phase 3.D Clients via the /clients/new?fromLead=:id
 * route — the AM team confirms the handoff so this module never
 * auto-creates Client docs.
 */

export type {
  Lead,
  LeadStage,
  LeadSource,
  LeadActivity,
  ActivityKind,
  CurrencyCode,
} from './types/lead.types';

export {
  createLead,
  getLead,
  listLeads,
  updateLead,
  changeLeadStage,
  recordClientConversion,
  logActivity,
  listActivities,
  isValidStageTransition,
  allowedNextStages,
} from './services/lead.service';

export { LeadStageBadge } from './components/LeadStageBadge';
export { LeadCard } from './components/LeadCard';
export { ActivityLogPanel } from './components/ActivityLogPanel';

export { default as LeadsListPage }       from './pages/LeadsListPage';
export { default as LeadDetailPage }      from './pages/LeadDetailPage';
export { default as LeadCreatePage }      from './pages/LeadCreatePage';
export { default as PipelineKanbanPage }  from './pages/PipelineKanbanPage';
