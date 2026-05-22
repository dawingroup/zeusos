/**
 * Account Management bounded context — Phase 3.D.
 *
 * Owns: client intake, contracts editing (MSA / SOW / ChangeOrder),
 * master-job rollup, IWO issuance, deliverable acceptance review,
 * direct-client-request intake.
 *
 * Per Plan §14.5 — AM owns phases 1–2 (intake, scope, price, assign) and
 * 5–6 (client delivery, billing) of the engagement lifecycle. Phases 3–4
 * (delivery, internal QA) belong to the subsidiary, wrapped by IWOs that
 * the commercial core controls.
 *
 * All AM routes are gated by `<RoleGuard requireGlobalRole={['admin','owner']}
 * requireOrgKind='PARENT'>` (see AMAccessGuard) — subsidiary users see 403.
 */

export { default as AMLayout } from './components/AMLayout';
export { default as AMAccessGuard } from './components/AMAccessGuard';
export { default as MasterJobRollupCard } from './components/MasterJobRollupCard';
export { default as IssueIWODialog } from './components/IssueIWODialog';

export { default as ClientsPage } from './pages/ClientsPage';
export { default as ClientDetailPage } from './pages/ClientDetailPage';
export { default as ClientCreatePage } from './pages/ClientCreatePage';
export { default as MSAEditorPage } from './pages/MSAEditorPage';
export { default as SOWEditorPage } from './pages/SOWEditorPage';
export { default as ChangeOrderPage } from './pages/ChangeOrderPage';
export { default as MasterJobsPage } from './pages/MasterJobsPage';
export { default as MasterJobDetailPage } from './pages/MasterJobDetailPage';
export { default as DeliverableReviewQueuePage } from './pages/DeliverableReviewQueuePage';
export { default as IntakeQueuePage } from './pages/IntakeQueuePage';
