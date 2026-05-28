/**
 * ZeusOS Router Configuration
 *
 * Lean router for Phase 1.C-D. The construction/manufacturing route surface
 * (design-manager, inventory, manufacturing, cutlist-processor, fulfillment,
 * sales-orders, client-portal, crm, procurement, marketing, launch-pipeline,
 * customer-hub, whatsapp, gchat, messaging) was removed in Phase 1.C; the
 * advisory/investment subsidiary was removed in Phase 1.D (this is a
 * marketing consortium, not an advisory firm).
 *
 * Routes for the kept core modules (HR, Finance, Compliance, Strategy,
 * Market Intelligence, Intelligence Layer, Performance, Admin, Profile) are
 * wired here at the layout / landing-page level. Sub-page detail routes will
 * be re-added incrementally as Phase 3 (Campaign & Job Manager) and Phase 4
 * (Media / Production / Talent / Asset Library) land.
 */

import { Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
} from 'react-router-dom';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { AppShell } from '@/shared/components/layout/AppShell';
import { AuthGuard } from './guards/AuthGuard';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// ──────────────────────────────────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────────────────────────────────
const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazyWithRetry(() => import('@/pages/auth/VerifyEmailPage'));

// ──────────────────────────────────────────────────────────────────────────
// Account Management — Phase 3.D commercial core (Clients, MSAs, SOWs,
// Change Orders, MasterJobs, IWO issuance, deliverable review, intake).
// Every route is wrapped in AMAccessGuard (RoleGuard requireGlobalRole
// admin/owner + requireOrgKind PARENT) — subsidiary principals see 403.
// ──────────────────────────────────────────────────────────────────────────
const AMAccessGuard = lazyWithRetry(() => import('@/modules/account-management/components/AMAccessGuard'));
const AMLayout = lazyWithRetry(() => import('@/modules/account-management/components/AMLayout'));
const AMClientsPage = lazyWithRetry(() => import('@/modules/account-management/pages/ClientsPage'));
const AMClientCreatePage = lazyWithRetry(() => import('@/modules/account-management/pages/ClientCreatePage'));
const AMClientDetailPage = lazyWithRetry(() => import('@/modules/account-management/pages/ClientDetailPage'));
const AMMSAEditorPage = lazyWithRetry(() => import('@/modules/account-management/pages/MSAEditorPage'));
const AMSOWEditorPage = lazyWithRetry(() => import('@/modules/account-management/pages/SOWEditorPage'));
const AMChangeOrderPage = lazyWithRetry(() => import('@/modules/account-management/pages/ChangeOrderPage'));
const AMMasterJobsPage = lazyWithRetry(() => import('@/modules/account-management/pages/MasterJobsPage'));
const AMMasterJobDetailPage = lazyWithRetry(() => import('@/modules/account-management/pages/MasterJobDetailPage'));
const AMReviewQueuePage = lazyWithRetry(() => import('@/modules/account-management/pages/DeliverableReviewQueuePage'));
const AMIntakeQueuePage = lazyWithRetry(() => import('@/modules/account-management/pages/IntakeQueuePage'));

// ──────────────────────────────────────────────────────────────────────────
// Billing — Phase 3.F (standalone slice)
// ──────────────────────────────────────────────────────────────────────────
const BillingLayout = lazyWithRetry(() => import('@/modules/billing/components/BillingLayout'));
const ClientInvoicesPage = lazyWithRetry(() => import('@/modules/billing/pages/ClientInvoicesPage'));
const ClientInvoiceDetailPage = lazyWithRetry(() => import('@/modules/billing/pages/ClientInvoiceDetailPage'));
const InterCompanyInvoicesPage = lazyWithRetry(() => import('@/modules/billing/pages/InterCompanyInvoicesPage'));
const GLAdapterStatusPage = lazyWithRetry(() => import('@/modules/billing/pages/GLAdapterStatusPage'));
const BillingAccessGuard = lazyWithRetry(() => import('@/modules/billing/guards/BillingAccessGuard'));

// AI Assistant
const AIAssistantPage = lazyWithRetry(() => import('@/pages/ai/AIAssistantPage'));

// MCP token-refresh proxy pairing
const MCPPairingPage = lazyWithRetry(() => import('@/pages/mcp/MCPPairingPage'));

// ──────────────────────────────────────────────────────────────────────────
// Pricing — Phase 3.C (Pricing engine + Quote builder).
// Pricing surface gated by the shared ParentOrgGuard (3.D unified the
// authority signature with Account-Management + Billing).
// ──────────────────────────────────────────────────────────────────────────
import { ParentOrgGuard } from '@/router/guards/ParentOrgGuard';
import { BrandAccessGuard } from '@/router/guards/BrandAccessGuard';
const RateCardsPage      = lazyWithRetry(() => import('@/modules/pricing/pages/RateCardsPage'));
const RateCardEditorPage = lazyWithRetry(() => import('@/modules/pricing/pages/RateCardEditorPage'));
const QuoteBuilderPage   = lazyWithRetry(() => import('@/modules/pricing/pages/QuoteBuilderPage'));

// ──────────────────────────────────────────────────────────────────────────
// Delivery — Phase 3.E (subsidiary workspace). Three-layer §7.4 boundary:
//   1. SubsidiaryDeliveryGuard rejects parent-org users (this file).
//   2. AppShell nav builder hides commercial routes for subsidiary users.
//   3. Firestore rules + Cloud Function auth checks block the API path.
// ──────────────────────────────────────────────────────────────────────────
import { SubsidiaryDeliveryGuard } from '@/modules/delivery';
const IWOInboxPage     = lazyWithRetry(() => import('@/modules/delivery/pages/IWOInboxPage'));
const IWOWorkspacePage = lazyWithRetry(() => import('@/modules/delivery/pages/IWOWorkspacePage'));
const EcdReviewPage    = lazyWithRetry(() => import('@/modules/delivery/pages/EcdReviewPage'));
const BurnAndSlaPage   = lazyWithRetry(() => import('@/modules/delivery/pages/BurnAndSlaPage'));
const IwoHealthPage    = lazyWithRetry(() => import('@/modules/reports/pages/IwoHealthPage'));
const MyTimeThisWeekPage = lazyWithRetry(() => import('@/modules/time-tracking/pages/MyTimeThisWeekPage'));
const TeamTimePage     = lazyWithRetry(() => import('@/modules/time-tracking/pages/TeamTimePage'));

// ──────────────────────────────────────────────────────────────────────────
// Traffic — Phase 6.UI.B (parent-org only; ParentOrgGuard wraps the layout).
// Routing queue + brand-proposal cards consuming the routeBrand callable.
// ──────────────────────────────────────────────────────────────────────────
const TrafficLayout      = lazyWithRetry(() =>
  import('@/modules/traffic').then(m => ({ default: m.TrafficLayout }))
);
const RoutingQueuePage   = lazyWithRetry(() => import('@/modules/traffic/pages/RoutingQueuePage'));
const ActiveIwosPage     = lazyWithRetry(() => import('@/modules/traffic/pages/ActiveIwosPage'));
const BrandCapacityPage  = lazyWithRetry(() => import('@/modules/traffic/pages/BrandCapacityPage'));
const OverrideLogPage    = lazyWithRetry(() => import('@/modules/traffic/pages/OverrideLogPage'));

// ──────────────────────────────────────────────────────────────────────────
// Media Plan & Buying — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const MediaPlansListPage     = lazyWithRetry(() => import('@/modules/media/pages/MediaPlansListPage'));
const MediaPlanCreatePage    = lazyWithRetry(() => import('@/modules/media/pages/MediaPlanCreatePage'));
const MediaPlanDetailPage    = lazyWithRetry(() => import('@/modules/media/pages/MediaPlanDetailPage'));
const MediaPlanActualsPage   = lazyWithRetry(() => import('@/modules/media/pages/MediaPlanActualsPage'));
const PostCampaignReportPage = lazyWithRetry(() => import('@/modules/media/pages/PostCampaignReportPage'));

// ──────────────────────────────────────────────────────────────────────────
// Production — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const ProductionBoardPage      = lazyWithRetry(() => import('@/modules/production/pages/ProductionBoardPage'));
const ProductionJobCreatePage  = lazyWithRetry(() => import('@/modules/production/pages/ProductionJobCreatePage'));
const ProductionJobDetailPage  = lazyWithRetry(() => import('@/modules/production/pages/ProductionJobDetailPage'));

// ──────────────────────────────────────────────────────────────────────────
// Talent Roster — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const TalentRosterPage       = lazyWithRetry(() => import('@/modules/talent/pages/TalentRosterPage'));
const TalentCreatePage       = lazyWithRetry(() => import('@/modules/talent/pages/TalentCreatePage'));
const TalentProfilePage      = lazyWithRetry(() => import('@/modules/talent/pages/TalentProfilePage'));
const FreelancerContractsPage = lazyWithRetry(() => import('@/modules/talent/pages/FreelancerContractsPage'));
const TalentInvoicesPage     = lazyWithRetry(() => import('@/modules/talent/pages/TalentInvoicesPage'));

// ──────────────────────────────────────────────────────────────────────────
// Procurement — Phase 4.1 (parent-org-only viewer for POs + JEs)
// ──────────────────────────────────────────────────────────────────────────
const PurchaseOrdersListPage  = lazyWithRetry(() => import('@/modules/procurement/pages/PurchaseOrdersListPage'));
const PurchaseOrderCreatePage = lazyWithRetry(() => import('@/modules/procurement/pages/PurchaseOrderCreatePage'));
const PurchaseOrderDetailPage = lazyWithRetry(() => import('@/modules/procurement/pages/PurchaseOrderDetailPage'));
const JournalEntriesListPage  = lazyWithRetry(() => import('@/modules/procurement/pages/JournalEntriesListPage'));
const JournalEntryDetailPage  = lazyWithRetry(() => import('@/modules/procurement/pages/JournalEntryDetailPage'));

// ──────────────────────────────────────────────────────────────────────────
// Suppliers — Phase 4 (shared directory of external 3rd-party vendors)
// ──────────────────────────────────────────────────────────────────────────
const SuppliersListPage    = lazyWithRetry(() => import('@/modules/suppliers/pages/SuppliersListPage'));
const SupplierDetailPage   = lazyWithRetry(() => import('@/modules/suppliers/pages/SupplierDetailPage'));
const SupplierCreatePage   = lazyWithRetry(() => import('@/modules/suppliers/pages/SupplierCreatePage'));
const SupplierEditPage     = lazyWithRetry(() => import('@/modules/suppliers/pages/SupplierEditPage'));

// ──────────────────────────────────────────────────────────────────────────
// CRM — sales pipeline (parent-org only)
// ──────────────────────────────────────────────────────────────────────────
const LeadsListPage      = lazyWithRetry(() => import('@/modules/crm/pages/LeadsListPage'));
const LeadDetailPage     = lazyWithRetry(() => import('@/modules/crm/pages/LeadDetailPage'));
const LeadCreatePage     = lazyWithRetry(() => import('@/modules/crm/pages/LeadCreatePage'));
const PipelineKanbanPage = lazyWithRetry(() => import('@/modules/crm/pages/PipelineKanbanPage'));

// ──────────────────────────────────────────────────────────────────────────
// Asset Library — Phase 4 P1
// ──────────────────────────────────────────────────────────────────────────
const AssetLibraryListPage  = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetLibraryListPage'));
const AssetDetailPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetDetailPage'));
const AssetUploadPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetUploadPage'));
const AssetEditPage         = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetEditPage'));
const CollectionsPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/CollectionsPage'));
const CollectionDetailPage  = lazyWithRetry(() => import('@/modules/asset-library/pages/CollectionDetailPage'));

// Public share-link viewer (mounted OUTSIDE the AuthGuard).
const SharedAssetPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/SharedAssetPage'));

// Public legal pages (Meta App Review surface)
const PrivacyPolicyPage = lazyWithRetry(() => import('@/pages/legal/PrivacyPolicyPage'));

// ──────────────────────────────────────────────────────────────────────────
// HR
// ──────────────────────────────────────────────────────────────────────────
const HRLayout = lazyWithRetry(() => import('@/modules/hr/components/HRLayout'));
const EmployeeListPage = lazyWithRetry(() => import('@/pages/hr/EmployeeListPage'));
const EmployeeCreatePage = lazyWithRetry(() => import('@/pages/hr/EmployeeCreatePage'));
const EmployeeDetailPage = lazyWithRetry(() => import('@/pages/hr/EmployeeDetailPage'));
const EmployeeEditPage = lazyWithRetry(() => import('@/pages/hr/EmployeeEditPage'));
const LeaveManagementPage = lazyWithRetry(() => import('@/pages/hr/LeaveManagementPage'));
const PayrollPage = lazyWithRetry(() => import('@/pages/hr/PayrollPage'));
const OrgStructurePage = lazyWithRetry(() => import('@/pages/hr/OrgStructurePage'));

// Phase 6.UI.A — Role Profile + Role Assignment admin (PR 6). All
// three pages wrap in ParentOrgGuard at the route level.
const RoleProfilesListPage  = lazyWithRetry(() => import('@/modules/hr-central/role-profiles/pages/RoleProfilesListPage'));
const RoleProfileDetailPage = lazyWithRetry(() => import('@/modules/hr-central/role-profiles/pages/RoleProfileDetailPage'));
const RoleAssignmentsListPage = lazyWithRetry(() => import('@/modules/hr-central/role-profiles/pages/RoleAssignmentsListPage'));

// ADR-2026-05-25 §2.Q4 — Conflict firewall breach-risks feed.
const BreachRisksPage = lazyWithRetry(() => import('@/modules/conflict-firewall/pages/BreachRisksPage'));

// Performance
const PerformanceLayout = lazyWithRetry(() => import('@/modules/hr-central/performance/components/PerformanceLayout'));
const GoalListPage = lazyWithRetry(() => import('@/pages/performance/GoalListPage'));
const ReviewListPage = lazyWithRetry(() => import('@/pages/performance/ReviewListPage'));
const CompetencyListPage = lazyWithRetry(() => import('@/pages/performance/CompetencyListPage'));
const DevelopmentPlanListPage = lazyWithRetry(() => import('@/pages/performance/DevelopmentPlanListPage'));
const TrainingCatalogPage = lazyWithRetry(() => import('@/pages/performance/TrainingCatalogPage'));

// ──────────────────────────────────────────────────────────────────────────
// Finance — landing pages only; KPI / sub-page re-wiring deferred
// ──────────────────────────────────────────────────────────────────────────
const FinanceLayout = lazyWithRetry(() => import('@/modules/finance/components/FinanceLayout'));
const FinanceOverviewPage = lazyWithRetry(() => import('@/modules/finance/pages/FinanceOverviewPage'));
const FinanceCashFlowPage = lazyWithRetry(() => import('@/modules/finance/pages/CashFlowPage'));
const CashForecastLandingPage = lazyWithRetry(() => import('@/modules/finance/pages/CashForecastLandingPage'));
const FinanceOperationsLanding = lazyWithRetry(() => import('@/modules/finance/pages/OperationsLandingPage'));
const FinanceReportsLanding = lazyWithRetry(() => import('@/modules/finance/pages/ReportsLandingPage'));
const FinanceSettingsLanding = lazyWithRetry(() => import('@/modules/finance/pages/SettingsLandingPage'));
const CFOBriefingPage = lazyWithRetry(() => import('@/modules/finance/pages/CFOBriefingPage'));
const SpendPlanPage = lazyWithRetry(() => import('@/modules/finance/pages/SpendPlanPage'));
const ExpenditureQueuePage = lazyWithRetry(() => import('@/modules/finance/pages/ExpenditureQueuePage'));

// ──────────────────────────────────────────────────────────────────────────
// Compliance
// ──────────────────────────────────────────────────────────────────────────
const ComplianceLayout = lazyWithRetry(() =>
  import('@/modules/compliance/components/ComplianceLayout').then(m => ({ default: m.ComplianceLayout }))
);
const ComplianceDashboardPage = lazyWithRetry(() =>
  import('@/modules/compliance/pages/ComplianceDashboardPage').then(m => ({ default: m.ComplianceDashboardPage }))
);
const DocumentRegistryPage = lazyWithRetry(() =>
  import('@/modules/compliance/pages/DocumentRegistryPage').then(m => ({ default: m.DocumentRegistryPage }))
);
const ObligationsPage = lazyWithRetry(() =>
  import('@/modules/compliance/pages/ObligationsPage').then(m => ({ default: m.ObligationsPage }))
);

// ──────────────────────────────────────────────────────────────────────────
// Market Intelligence + Intelligence Layer
// ──────────────────────────────────────────────────────────────────────────
const MarketIntelLayout = lazyWithRetry(() => import('@/modules/intelligence/components/MarketIntelLayout'));
const MarketCompetitorListPage = lazyWithRetry(() => import('@/modules/intelligence/pages/CompetitorListPage'));
const MarketNewsFeedPage = lazyWithRetry(() => import('@/modules/intelligence/pages/NewsFeedPage'));
const MarketAnalysisPage = lazyWithRetry(() => import('@/modules/intelligence/pages/MarketAnalysisPage'));
const MarketInsightsPage = lazyWithRetry(() => import('@/modules/intelligence/pages/InsightsPage'));
const MarketTopicTrackingPage = lazyWithRetry(() => import('@/modules/intelligence/pages/TopicTrackingPage'));
const MarketSocialIntelligencePage = lazyWithRetry(() => import('@/modules/intelligence/pages/SocialIntelligencePage'));

const IntelligenceLayout = lazyWithRetry(() => import('@/modules/intelligence-layer/components/IntelligenceLayout'));
const IntelligenceLayerDashboard = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/IntelligenceLayerDashboardPage'));
const IntelligenceAdminPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/IntelligenceAdminPage'));
const EmployeeTaskInboxPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/EmployeeTaskInboxPage'));
const ManagerDashboardPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/ManagerDashboardPage'));

// ──────────────────────────────────────────────────────────────────────────
// Strategy
// ──────────────────────────────────────────────────────────────────────────
const StrategyLayout = lazyWithRetry(() => import('@/modules/strategy/layouts/DashboardLayout'));
const ExecutiveDashboard = lazyWithRetry(() =>
  import('@/modules/strategy/pages/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard }))
);
const StrategyOverview = lazyWithRetry(() =>
  import('@/modules/strategy/pages/StrategyOverview').then(m => ({ default: m.StrategyOverview }))
);
const OKRDashboard = lazyWithRetry(() =>
  import('@/modules/strategy/pages/OKRDashboard').then(m => ({ default: m.OKRDashboard }))
);
const KPILayout = lazyWithRetry(() => import('@/modules/strategy/components/kpi/KPILayout'));
const KPIOverviewPage = lazyWithRetry(() => import('@/modules/strategy/pages/KPIOverviewPage'));
const KPILibraryPage = lazyWithRetry(() => import('@/modules/strategy/pages/KPILibraryPage'));

// ──────────────────────────────────────────────────────────────────────────
// Profile + Admin
// ──────────────────────────────────────────────────────────────────────────
const ProfilePage = lazyWithRetry(() => import('@/pages/profile/ProfilePage'));
const NotificationSettingsPage = lazyWithRetry(() => import('@/pages/profile/NotificationSettingsPage'));
const UserManagementPage = lazyWithRetry(() => import('@/pages/admin/UserManagementPage'));
const RoleManagementPage = lazyWithRetry(() => import('@/pages/admin/RoleManagementPage'));
const AuditLogPage = lazyWithRetry(() => import('@/pages/admin/AuditLogPage'));
const DesignSystemPage = lazyWithRetry(() => import('@/pages/admin/DesignSystemPage'));

// ──────────────────────────────────────────────────────────────────────────
// Error pages
// ──────────────────────────────────────────────────────────────────────────
const NotFoundPage = lazyWithRetry(() => import('@/pages/errors/NotFoundPage'));
const UnauthorizedPage = lazyWithRetry(() => import('@/pages/errors/UnauthorizedPage'));
const OfflinePage = lazyWithRetry(() => import('@/pages/errors/OfflinePage'));

// ──────────────────────────────────────────────────────────────────────────
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullPageLoader />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
);

export const router = createBrowserRouter([
  // Public auth routes
  {
    path: '/auth',
    children: [
      { path: 'login',           element: <PageWrapper><LoginPage /></PageWrapper> },
      { path: 'forgot-password', element: <PageWrapper><ForgotPasswordPage /></PageWrapper> },
      { path: 'reset-password',  element: <PageWrapper><ResetPasswordPage /></PageWrapper> },
      { path: 'verify-email',    element: <PageWrapper><VerifyEmailPage /></PageWrapper> },
    ],
  },
  { path: '/login', element: <Navigate to="/auth/login" replace /> },
  { path: '/privacy', element: <PageWrapper><PrivacyPolicyPage /></PageWrapper> },
  { path: '/mcp/pair', element: <PageWrapper><MCPPairingPage /></PageWrapper> },
  // Phase 5.C — public asset/collection share viewer. The resolver
  // Cloud Function validates the token; the page lives outside the
  // AuthGuard so clients can open it without a Zeus login.
  { path: '/share/:token', element: <PageWrapper><SharedAssetPage /></PageWrapper> },

  // Authenticated app shell
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell><Outlet /></AppShell>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/strategy" replace /> },
      { path: 'dashboard', element: <Navigate to="/strategy" replace /> },

      // Account Management — Phase 3.D commercial core.
      // ADR-2026-05-25 §2.Q2 (UI layer 4.3) — list routes stay on
      // AMAccessGuard (parent-org only) since they expose the whole
      // client roster; per-client detail routes use BrandAccessGuard,
      // which accepts PARENT principals OR the home brand AD of the
      // client. Routes that key on a master_job resolve clientId via
      // `master_jobs/{id}.clientId`.
      { path: 'clients',                                                        element: <PageWrapper><AMAccessGuard><AMClientsPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/new',                                                    element: <PageWrapper><AMAccessGuard><AMClientCreatePage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId',                                              element: <PageWrapper><BrandAccessGuard><AMClientDetailPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/new',                                     element: <PageWrapper><BrandAccessGuard><AMMSAEditorPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId',                                  element: <PageWrapper><BrandAccessGuard><AMMSAEditorPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/new',                         element: <PageWrapper><BrandAccessGuard><AMSOWEditorPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId',                      element: <PageWrapper><BrandAccessGuard><AMSOWEditorPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId/change-orders/new',    element: <PageWrapper><BrandAccessGuard><AMChangeOrderPage /></BrandAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId/change-orders/:coId',  element: <PageWrapper><BrandAccessGuard><AMChangeOrderPage /></BrandAccessGuard></PageWrapper> },
      { path: 'master-jobs',                                                    element: <PageWrapper><AMAccessGuard><AMMasterJobsPage /></AMAccessGuard></PageWrapper> },
      { path: 'master-jobs/:masterJobId',                                       element: <PageWrapper><BrandAccessGuard clientIdParam="masterJobId" resolveVia="master_jobs"><AMMasterJobDetailPage /></BrandAccessGuard></PageWrapper> },
      {
        path: 'account-mgmt',
        element: (
          <PageWrapper>
            <AMAccessGuard>
              <AMLayout />
            </AMAccessGuard>
          </PageWrapper>
        ),
        children: [
          { index: true,     element: <Navigate to="reviews" replace /> },
          { path: 'reviews', element: <AMReviewQueuePage /> },
          { path: 'intake',  element: <AMIntakeQueuePage /> },
        ],
      },

      // AI Assistant
      { path: 'ai-assistant', element: <PageWrapper><ModuleContentWrapper><AIAssistantPage /></ModuleContentWrapper></PageWrapper> },

      // HR
      {
        path: 'hr',
        element: <PageWrapper><HRLayout /></PageWrapper>,
        children: [
          { index: true,                     element: <Navigate to="employees" replace /> },
          { path: 'employees',               element: <EmployeeListPage /> },
          { path: 'employees/new',           element: <EmployeeCreatePage /> },
          { path: 'employees/:employeeId',   element: <EmployeeDetailPage /> },
          { path: 'employees/:employeeId/edit', element: <EmployeeEditPage /> },
          { path: 'leave',                   element: <LeaveManagementPage /> },
          { path: 'payroll',                 element: <PayrollPage /> },
          { path: 'org-structure',           element: <OrgStructurePage /> },
          // Phase 6.UI.A — Role Profile + Role Assignment admin (PR 6).
          { path: 'role-profiles',                  element: <ParentOrgGuard><RoleProfilesListPage /></ParentOrgGuard> },
          { path: 'role-profiles/:id',              element: <ParentOrgGuard><RoleProfileDetailPage /></ParentOrgGuard> },
          { path: 'role-assignments',               element: <ParentOrgGuard><RoleAssignmentsListPage /></ParentOrgGuard> },
        ],
      },

      // Performance
      {
        path: 'performance',
        element: <PageWrapper><PerformanceLayout /></PageWrapper>,
        children: [
          { index: true,                element: <Navigate to="goals" replace /> },
          { path: 'goals',              element: <GoalListPage /> },
          { path: 'reviews',            element: <ReviewListPage /> },
          { path: 'competencies',       element: <CompetencyListPage /> },
          { path: 'development-plans', element: <DevelopmentPlanListPage /> },
          { path: 'training',           element: <TrainingCatalogPage /> },
        ],
      },

      // Finance
      {
        path: 'finance',
        element: <PageWrapper><FinanceLayout /></PageWrapper>,
        children: [
          { index: true,                  element: <FinanceOverviewPage /> },
          { path: 'overview',             element: <FinanceOverviewPage /> },
          { path: 'cash',                 element: <FinanceCashFlowPage /> },
          { path: 'cash-forecast',        element: <CashForecastLandingPage /> },
          { path: 'operations',           element: <FinanceOperationsLanding /> },
          { path: 'reports',              element: <FinanceReportsLanding /> },
          { path: 'settings',             element: <FinanceSettingsLanding /> },
          { path: 'cfo-briefing',         element: <CFOBriefingPage /> },
          { path: 'spend-plan',           element: <SpendPlanPage /> },
          { path: 'expenditure-queue',    element: <ExpenditureQueuePage /> },
        ],
      },

      // Billing — Phase 3.F standalone slice. The composite
      // BillingAccessGuard enforces admin/owner + (today) BILLING_ADMIN
      // scope approximation; Phase 3.A.5 turns the scope check into a
      // real grant lookup and adds the org-kind === 'PARENT' assertion.
      {
        path: 'billing',
        element: (
          <PageWrapper>
            <BillingAccessGuard>
              <BillingLayout />
            </BillingAccessGuard>
          </PageWrapper>
        ),
        children: [
          { index: true,                              element: <Navigate to="client-invoices" replace /> },
          { path: 'client-invoices',                  element: <ClientInvoicesPage /> },
          { path: 'client-invoices/:invoiceId',       element: <ClientInvoiceDetailPage /> },
          { path: 'intercompany',                     element: <InterCompanyInvoicesPage /> },
          { path: 'gl-status',                        element: <GLAdapterStatusPage /> },
        ],
      },

      // Compliance
      {
        path: 'compliance',
        element: <PageWrapper><ComplianceLayout /></PageWrapper>,
        children: [
          { index: true,            element: <ComplianceDashboardPage /> },
          { path: 'documents',      element: <DocumentRegistryPage /> },
          { path: 'obligations',    element: <ObligationsPage /> },
        ],
      },

      // Market Intelligence
      {
        path: 'market-intel',
        element: <PageWrapper><MarketIntelLayout /></PageWrapper>,
        children: [
          { index: true,            element: <Navigate to="competitors" replace /> },
          { path: 'competitors',    element: <MarketCompetitorListPage /> },
          { path: 'news',           element: <MarketNewsFeedPage /> },
          { path: 'market',         element: <MarketAnalysisPage /> },
          { path: 'insights',       element: <MarketInsightsPage /> },
          { path: 'topics',         element: <MarketTopicTrackingPage /> },
          { path: 'social',         element: <MarketSocialIntelligencePage /> },
        ],
      },

      // Pricing — Phase 3.C, gated by ParentOrgGuard (3.D unification).
      { path: 'pricing',                       element: <Navigate to="/pricing/rate-cards" replace /> },
      { path: 'pricing/rate-cards',            element: <PageWrapper><ParentOrgGuard><RateCardsPage /></ParentOrgGuard></PageWrapper> },
      { path: 'pricing/rate-cards/:id',        element: <PageWrapper><ParentOrgGuard><RateCardEditorPage /></ParentOrgGuard></PageWrapper> },
      { path: 'pricing/quotes/:id',            element: <PageWrapper><ParentOrgGuard><QuoteBuilderPage /></ParentOrgGuard></PageWrapper> },
      { path: 'pricing/quotes/new',            element: <PageWrapper><ParentOrgGuard><QuoteBuilderPage /></ParentOrgGuard></PageWrapper> },

      // Delivery — Phase 3.E (subsidiary workspace). Guarded so parent-org
      // users get redirected to the AM-side IWO view (3.D, TODO) and
      // subsidiary users pass through.
      { path: 'delivery',           element: <Navigate to="/delivery/inbox" replace /> },
      { path: 'delivery/inbox',     element: <PageWrapper><SubsidiaryDeliveryGuard><IWOInboxPage /></SubsidiaryDeliveryGuard></PageWrapper> },
      { path: 'delivery/iwo/:id',   element: <PageWrapper><SubsidiaryDeliveryGuard><IWOWorkspacePage /></SubsidiaryDeliveryGuard></PageWrapper> },

      // ──────────────────────────────────────────────────────────────────
      // Phase 6.UI placeholder + live routes for manifest items.
      // ──────────────────────────────────────────────────────────────────
      // Phase 6.UI.B — Traffic surface (parent-org only).
      {
        path: 'traffic',
        element: <PageWrapper><ParentOrgGuard><TrafficLayout /></ParentOrgGuard></PageWrapper>,
        children: [
          { index: true,         element: <RoutingQueuePage /> },
          { path: 'active',      element: <ActiveIwosPage /> },
          { path: 'capacity',    element: <BrandCapacityPage /> },
          { path: 'overrides',   element: <OverrideLogPage /> },
        ],
      },

      // ADR-2026-05-25 §2.Q4 — Conflict firewall (named-competitor).
      // Per-client list lives on ClientDetailPage; categories survive
      // as a reporting overlay only.
      { path: 'conflict-firewall',                 element: <Navigate to="/conflict-firewall/breach-risks" replace /> },
      { path: 'conflict-firewall/categories',      element: <Navigate to="/conflict-firewall/breach-risks" replace /> },
      { path: 'conflict-firewall/client-tags',     element: <Navigate to="/clients" replace /> },
      { path: 'conflict-firewall/walls',           element: <Navigate to="/conflict-firewall/breach-risks" replace /> },
      { path: 'conflict-firewall/breach-risks',    element: <PageWrapper><ParentOrgGuard><BreachRisksPage /></ParentOrgGuard></PageWrapper> },

      // Phase 6.UI.D.2 — ECD Review aggregator (live this PR).
      // Subsidiary delivery only; per-rung RBAC follow-up lands in 6.D.2-RBAC.
      { path: 'delivery/ecd-review', element: <PageWrapper><SubsidiaryDeliveryGuard><EcdReviewPage /></SubsidiaryDeliveryGuard></PageWrapper> },
      // /delivery/active was a Phase 6.UI placeholder. IWOInboxPage at
      // /delivery/inbox already shows in-flight IWOs in its second
      // section, so the standalone route was duplicating the same data.
      // Redirect preserves any deep-links that survived the manifest cut.
      { path: 'delivery/active',     element: <Navigate to="/delivery/inbox" replace /> },
      { path: 'delivery/burn',       element: <PageWrapper><SubsidiaryDeliveryGuard><BurnAndSlaPage /></SubsidiaryDeliveryGuard></PageWrapper> },

      { path: 'reports',             element: <PageWrapper><ParentOrgGuard><IwoHealthPage /></ParentOrgGuard></PageWrapper> },

      // Phase 5.D — cross-IWO "My Time This Week" read view. Posting still
      // happens from /delivery/iwo/:id; this page closes the visibility gap.
      // No guard: rule-layer scoping on time_entries already filters reads
      // to (parent-org OR home subsidiary on the parent IWO), and a signed-
      // out user falls into the page's own "Sign in" copy.
      { path: 'time',                element: <PageWrapper><MyTimeThisWeekPage /></PageWrapper> },
      // Phase 5.D — parent-org cross-brand team-time roll-up. Guarded
      // because the underlying collection-group query only succeeds for
      // parent-org principals (the time_entries rule rejects a
      // subsidiary's cross-brand read wholesale).
      { path: 'time/team',           element: <PageWrapper><ParentOrgGuard><TeamTimePage /></ParentOrgGuard></PageWrapper> },

      // Intelligence Layer
      {
        path: 'intelligence',
        element: <PageWrapper><IntelligenceLayout /></PageWrapper>,
        children: [
          { index: true,            element: <IntelligenceLayerDashboard /> },
          { path: 'admin',          element: <IntelligenceAdminPage /> },
          { path: 'inbox',          element: <EmployeeTaskInboxPage /> },
          { path: 'manager',        element: <ManagerDashboardPage /> },
        ],
      },

      // Strategy
      {
        path: 'strategy',
        element: <PageWrapper><StrategyLayout /></PageWrapper>,
        children: [
          { index: true,            element: <ExecutiveDashboard /> },
          { path: 'overview',       element: <StrategyOverview /> },
          { path: 'okrs',           element: <OKRDashboard /> },
          {
            path: 'kpi',
            element: <KPILayout />,
            children: [
              { index: true,        element: <KPIOverviewPage /> },
              { path: 'library',    element: <KPILibraryPage /> },
            ],
          },
        ],
      },

      // Profile
      { path: 'profile',                element: <PageWrapper><ProfilePage /></PageWrapper> },
      { path: 'notification-settings',  element: <PageWrapper><NotificationSettingsPage /></PageWrapper> },

      // Admin
      { path: 'admin/users',         element: <PageWrapper><UserManagementPage /></PageWrapper> },
      { path: 'admin/roles',         element: <PageWrapper><RoleManagementPage /></PageWrapper> },
      { path: 'admin/audit-log',     element: <PageWrapper><AuditLogPage /></PageWrapper> },
      { path: 'admin/design-system', element: <PageWrapper><DesignSystemPage /></PageWrapper> },

      // ── Media Plan & Buying — Phase 4 ─────────────────────────────────────
      // Gated: parent-org users for plan creation; subsidiary buyers can post
      // actuals. Access guard deferred to Phase 4.B when isCommercialActor is
      // available as a React hook — for now any authenticated user can access.
      { path: 'media',                 element: <PageWrapper><ModuleContentWrapper><MediaPlansListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/new',             element: <PageWrapper><ModuleContentWrapper><MediaPlanCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/:planId',         element: <PageWrapper><ModuleContentWrapper><MediaPlanDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/:planId/actuals', element: <PageWrapper><ModuleContentWrapper><MediaPlanActualsPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/:planId/report',  element: <PageWrapper><ModuleContentWrapper><PostCampaignReportPage /></ModuleContentWrapper></PageWrapper> },

      // ── Production — Phase 4 ───────────────────────────────────────────────
      // Gated: parent-org AND subsidiary production team. Access guard
      // deferred to Phase 4.B.
      { path: 'production',        element: <PageWrapper><ModuleContentWrapper><ProductionBoardPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'production/new',    element: <PageWrapper><ModuleContentWrapper><ProductionJobCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'production/:jobId', element: <PageWrapper><ModuleContentWrapper><ProductionJobDetailPage /></ModuleContentWrapper></PageWrapper> },

      // ── Talent Roster — Phase 4 ────────────────────────────────────────────
      // Gated: HR + parent-org AM for approvals; freelancer self-service
      // invite is a Phase 5 stub.
      { path: 'talent',                      element: <PageWrapper><ModuleContentWrapper><TalentRosterPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/new',                  element: <PageWrapper><ModuleContentWrapper><TalentCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/invoices',             element: <PageWrapper><ModuleContentWrapper><TalentInvoicesPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/:profileId',           element: <PageWrapper><ModuleContentWrapper><TalentProfilePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/:profileId/contracts', element: <PageWrapper><ModuleContentWrapper><FreelancerContractsPage /></ModuleContentWrapper></PageWrapper> },

      // ── Procurement — Phase 4.1 (parent-org viewer for POs + JEs) ─────────
      // Firestore rules block subsidiary reads on purchase_orders + journal_entries.
      { path: 'procurement/purchase-orders',         element: <PageWrapper><ModuleContentWrapper><PurchaseOrdersListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'procurement/purchase-orders/new',     element: <PageWrapper><ModuleContentWrapper><PurchaseOrderCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'procurement/purchase-orders/:poId',   element: <PageWrapper><ModuleContentWrapper><PurchaseOrderDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'procurement/journal-entries',         element: <PageWrapper><ModuleContentWrapper><JournalEntriesListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'procurement/journal-entries/:jeId',   element: <PageWrapper><ModuleContentWrapper><JournalEntryDetailPage /></ModuleContentWrapper></PageWrapper> },

      // ── Suppliers — Phase 4 (shared directory of external vendors) ────────
      // Staff read; firestore.rules enforces parent-org-only write.
      { path: 'suppliers',                    element: <PageWrapper><ModuleContentWrapper><SuppliersListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'suppliers/new',                element: <PageWrapper><ModuleContentWrapper><SupplierCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'suppliers/:supplierId',        element: <PageWrapper><ModuleContentWrapper><SupplierDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'suppliers/:supplierId/edit',   element: <PageWrapper><ModuleContentWrapper><SupplierEditPage /></ModuleContentWrapper></PageWrapper> },

      // ── CRM — sales pipeline (parent-org only) ─────────────────────────────
      // Firestore rules enforce parent-org-only on crm_leads.
      { path: 'crm',                  element: <PageWrapper><ModuleContentWrapper><LeadsListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'crm/new',              element: <PageWrapper><ModuleContentWrapper><LeadCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'crm/pipeline',         element: <PageWrapper><ModuleContentWrapper><PipelineKanbanPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'crm/:leadId',          element: <PageWrapper><ModuleContentWrapper><LeadDetailPage /></ModuleContentWrapper></PageWrapper> },

      // ── Asset Library — Phase 4 P1 ────────────────────────────────────────
      // Staff-wide access — any authenticated user can browse and upload.
      // No commercial-actor gate; assets are shared across all sub-brands.
      { path: 'assets',                    element: <PageWrapper><ModuleContentWrapper><AssetLibraryListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/new',                element: <PageWrapper><ModuleContentWrapper><AssetUploadPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/collections',        element: <PageWrapper><ModuleContentWrapper><CollectionsPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/collections/:colId', element: <PageWrapper><ModuleContentWrapper><CollectionDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/:itemId',            element: <PageWrapper><ModuleContentWrapper><AssetDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/:itemId/edit',       element: <PageWrapper><ModuleContentWrapper><AssetEditPage /></ModuleContentWrapper></PageWrapper> },
    ],
  },

  // Error routes
  { path: '/unauthorized', element: <PageWrapper><UnauthorizedPage /></PageWrapper> },
  { path: '/offline',      element: <PageWrapper><OfflinePage /></PageWrapper> },
  { path: '*',             element: <PageWrapper><NotFoundPage /></PageWrapper> },
]);

export function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
