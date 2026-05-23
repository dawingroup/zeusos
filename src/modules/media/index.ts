/**
 * Media Plan & Buying module — Phase 4.
 *
 * Owns: media_plans, media_buys, actuals subcollections, post_campaign_reports.
 * Does not touch pricing or billing directly — links via masterJobId.
 */

export type { MediaPlan, MediaPlanStatus, CurrencyCode } from './types/media-plan.types';
export type { MediaBuy, MediaVehicleType } from './types/media-buy.types';
export type { MediaActual } from './types/media-actual.types';
export type { PostCampaignReport, CampaignMetric } from './types/post-campaign-report.types';

export {
  createMediaPlan,
  getMediaPlan,
  listMediaPlans,
  updateMediaPlan,
  closeMediaPlan,
  deleteMediaPlan,
  addMediaBuy,
  listMediaBuys,
  updateMediaBuy,
  deleteMediaBuy,
  computeVariancePct,
} from './services/media-plan.service';

export { postActual, listActuals } from './services/media-actuals.service';

export { MediaPlanStatusBadge } from './components/MediaPlanStatusBadge';
export { VehicleTypeBadge } from './components/VehicleTypeBadge';
export { MediaBuyGrid } from './components/MediaBuyGrid';
export { MediaBuyForm } from './components/MediaBuyForm';
export { ActualReconcileForm } from './components/ActualReconcileForm';

export { default as MediaPlansListPage } from './pages/MediaPlansListPage';
export { default as MediaPlanCreatePage } from './pages/MediaPlanCreatePage';
export { default as MediaPlanDetailPage } from './pages/MediaPlanDetailPage';
export { default as MediaPlanActualsPage } from './pages/MediaPlanActualsPage';
export { default as PostCampaignReportPage } from './pages/PostCampaignReportPage';
