/**
 * Phase 6.UI.B — Traffic module public surface.
 *
 * The 4 pages (Routing Queue · Active IWOs · Brand Capacity ·
 * Override Log) mount under `/traffic/*` via the `TrafficLayout`
 * tabbed shell.
 */

export { TrafficLayout } from './components/TrafficLayout';
export { default as RoutingQueuePage } from './pages/RoutingQueuePage';
export { default as ActiveIwosPage } from './pages/ActiveIwosPage';
export { default as BrandCapacityPage } from './pages/BrandCapacityPage';
export { default as OverrideLogPage } from './pages/OverrideLogPage';

export { RouteBrandProposalCard } from './components/RouteBrandProposalCard';
export { CandidateRejectionList } from './components/CandidateRejectionList';

export type {
  RoutingProposal,
  RoutingRequest,
  RoutingOverride,
  BrandCandidate,
  CandidateRejectionReason,
} from './types/traffic.types';

export {
  routeBrandFn,
  subscribeOpenMasterJobs,
  subscribeActiveIwos,
  subscribeRoutingProposals,
  type RoutingBrandProposedEvent,
} from './services/traffic.service';
