/**
 * Production module — Phase 4.
 *
 * Owns: production_jobs and subcollections (checklist_items, shoot_days, post_phases).
 * Kanban with 10 stages: BRIEF → COMPLETE.
 */

export type {
  ProductionJob,
  ProductionJobType,
  ProductionStage,
  ProductionStageTransition,
} from './types/production-job.types';
export { PRODUCTION_STAGES } from './types/production-job.types';
export type { ChecklistItem } from './types/production-checklist.types';
export type { ShootDay } from './types/shoot-day.types';
export type { PostPhase, PostPhaseKind, PostPhaseStatus } from './types/post-phase.types';

export {
  createProductionJob,
  getProductionJob,
  listProductionJobs,
  updateProductionJob,
  advanceProductionStage,
} from './services/production-job.service';

export {
  addChecklistItem,
  listChecklistItems,
  completeChecklistItem,
  uncompleteChecklistItem,
  deleteChecklistItem,
} from './services/checklist.service';

export { ProductionStageBadge } from './components/ProductionStageBadge';
export { ProductionJobCard } from './components/ProductionJobCard';
export { ProductionKanban } from './components/ProductionKanban';
export { ChecklistPanel } from './components/ChecklistPanel';
export { CallSheetPanel } from './components/CallSheetPanel';
export { PostProductionPanel } from './components/PostProductionPanel';

export { default as ProductionBoardPage } from './pages/ProductionBoardPage';
export { default as ProductionJobDetailPage } from './pages/ProductionJobDetailPage';
