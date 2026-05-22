/**
 * ZeusOS Router Configuration
 *
 * Lean router for Phase 1.C. The construction/manufacturing route surface
 * (design-manager, inventory, manufacturing, cutlist-processor, fulfillment,
 * sales-orders, client-portal, crm, procurement, marketing, launch-pipeline,
 * customer-hub, whatsapp, gchat, messaging) has been removed.
 *
 * Routes for the kept core modules (HR, Finance, Capital, Compliance, Strategy,
 * Market Intelligence, Intelligence Layer, Performance, Admin, Profile,
 * Advisory) are wired here at the layout / landing-page level. Sub-page
 * detail routes will be re-added incrementally as Phase 3 (Campaign & Job
 * Manager) and Phase 4 (Media / Production / Talent / Asset Library) land.
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
// Engagements (legacy advisory project model — retained until Phase 4)
// ──────────────────────────────────────────────────────────────────────────
const EngagementListPage = lazyWithRetry(() => import('@/pages/engagements/EngagementListPage'));
const EngagementDetailPage = lazyWithRetry(() => import('@/pages/engagements/EngagementDetailPage'));
const EngagementCreatePage = lazyWithRetry(() => import('@/pages/engagements/EngagementCreatePage'));

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

// Advisory subsidiary module (will be renamed agency-core in Phase 3)
const AdvisoryRoutes = lazyWithRetry(() => import('@/subsidiaries/advisory/AdvisoryModule'));

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

// ──────────────────────────────────────────────────────────────────────────
// Media Plan & Buying — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const MediaPlansListPage     = lazyWithRetry(() => import('@/modules/media/pages/MediaPlansListPage'));
const MediaPlanDetailPage    = lazyWithRetry(() => import('@/modules/media/pages/MediaPlanDetailPage'));
const MediaPlanActualsPage   = lazyWithRetry(() => import('@/modules/media/pages/MediaPlanActualsPage'));
const PostCampaignReportPage = lazyWithRetry(() => import('@/modules/media/pages/PostCampaignReportPage'));

// ──────────────────────────────────────────────────────────────────────────
// Production — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const ProductionBoardPage     = lazyWithRetry(() => import('@/modules/production/pages/ProductionBoardPage'));
const ProductionJobDetailPage = lazyWithRetry(() => import('@/modules/production/pages/ProductionJobDetailPage'));

// ──────────────────────────────────────────────────────────────────────────
// Talent Roster — Phase 4
// ──────────────────────────────────────────────────────────────────────────
const TalentRosterPage       = lazyWithRetry(() => import('@/modules/talent/pages/TalentRosterPage'));
const TalentProfilePage      = lazyWithRetry(() => import('@/modules/talent/pages/TalentProfilePage'));
const FreelancerContractsPage = lazyWithRetry(() => import('@/modules/talent/pages/FreelancerContractsPage'));
const TalentInvoicesPage     = lazyWithRetry(() => import('@/modules/talent/pages/TalentInvoicesPage'));

// ──────────────────────────────────────────────────────────────────────────
// Asset Library — Phase 4 P1
// ──────────────────────────────────────────────────────────────────────────
const AssetLibraryListPage  = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetLibraryListPage'));
const AssetDetailPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetDetailPage'));
const AssetUploadPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/AssetUploadPage'));
const CollectionsPage       = lazyWithRetry(() => import('@/modules/asset-library/pages/CollectionsPage'));
const CollectionDetailPage  = lazyWithRetry(() => import('@/modules/asset-library/pages/CollectionDetailPage'));

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
// Capital Hub
// ──────────────────────────────────────────────────────────────────────────
const CapitalLayout = lazyWithRetry(() => import('@/modules/capital/components/CapitalLayout'));
const CapitalDashboardPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalDashboardPage'));
const CapitalNeedsPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalNeedsPage'));
const CapitalProductsPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalProductsPage'));
const ReadinessPage = lazyWithRetry(() => import('@/modules/capital/pages/ReadinessPage'));
const CapitalApplicationsPage = lazyWithRetry(() => import('@/modules/capital/pages/ApplicationsPage'));
const CapitalFacilitiesPage = lazyWithRetry(() => import('@/modules/capital/pages/FacilitiesPage'));

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

      // Engagements (legacy)
      { path: 'engagements',                  element: <PageWrapper><ModuleContentWrapper><EngagementListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'engagements/new',              element: <PageWrapper><ModuleContentWrapper><EngagementCreatePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'engagements/:engagementId',    element: <PageWrapper><ModuleContentWrapper><EngagementDetailPage /></ModuleContentWrapper></PageWrapper> },

      // Account Management — Phase 3.D commercial core.
      { path: 'clients',                                                        element: <PageWrapper><AMAccessGuard><AMClientsPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/new',                                                    element: <PageWrapper><AMAccessGuard><AMClientCreatePage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId',                                              element: <PageWrapper><AMAccessGuard><AMClientDetailPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/new',                                     element: <PageWrapper><AMAccessGuard><AMMSAEditorPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId',                                  element: <PageWrapper><AMAccessGuard><AMMSAEditorPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/new',                         element: <PageWrapper><AMAccessGuard><AMSOWEditorPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId',                      element: <PageWrapper><AMAccessGuard><AMSOWEditorPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId/change-orders/new',    element: <PageWrapper><AMAccessGuard><AMChangeOrderPage /></AMAccessGuard></PageWrapper> },
      { path: 'clients/:clientId/msas/:msaId/sows/:sowId/change-orders/:coId',  element: <PageWrapper><AMAccessGuard><AMChangeOrderPage /></AMAccessGuard></PageWrapper> },
      { path: 'master-jobs',                                                    element: <PageWrapper><AMAccessGuard><AMMasterJobsPage /></AMAccessGuard></PageWrapper> },
      { path: 'master-jobs/:masterJobId',                                       element: <PageWrapper><AMAccessGuard><AMMasterJobDetailPage /></AMAccessGuard></PageWrapper> },
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

      // Advisory module (becomes agency-core in Phase 3)
      { path: 'advisory/*', element: <PageWrapper><AdvisoryRoutes /></PageWrapper> },

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

      // Capital
      {
        path: 'capital',
        element: <PageWrapper><CapitalLayout /></PageWrapper>,
        children: [
          { index: true,             element: <CapitalDashboardPage /> },
          { path: 'needs',           element: <CapitalNeedsPage /> },
          { path: 'products',        element: <CapitalProductsPage /> },
          { path: 'readiness',       element: <ReadinessPage /> },
          { path: 'applications',    element: <CapitalApplicationsPage /> },
          { path: 'facilities',      element: <CapitalFacilitiesPage /> },
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
      { path: 'media/:planId',         element: <PageWrapper><ModuleContentWrapper><MediaPlanDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/:planId/actuals', element: <PageWrapper><ModuleContentWrapper><MediaPlanActualsPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'media/:planId/report',  element: <PageWrapper><ModuleContentWrapper><PostCampaignReportPage /></ModuleContentWrapper></PageWrapper> },

      // ── Production — Phase 4 ───────────────────────────────────────────────
      // Gated: parent-org AND subsidiary production team. Access guard
      // deferred to Phase 4.B.
      { path: 'production',        element: <PageWrapper><ModuleContentWrapper><ProductionBoardPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'production/:jobId', element: <PageWrapper><ModuleContentWrapper><ProductionJobDetailPage /></ModuleContentWrapper></PageWrapper> },

      // ── Talent Roster — Phase 4 ────────────────────────────────────────────
      // Gated: HR + parent-org AM for approvals; freelancer self-service
      // invite is a Phase 5 stub.
      { path: 'talent',                      element: <PageWrapper><ModuleContentWrapper><TalentRosterPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/invoices',             element: <PageWrapper><ModuleContentWrapper><TalentInvoicesPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/:profileId',           element: <PageWrapper><ModuleContentWrapper><TalentProfilePage /></ModuleContentWrapper></PageWrapper> },
      { path: 'talent/:profileId/contracts', element: <PageWrapper><ModuleContentWrapper><FreelancerContractsPage /></ModuleContentWrapper></PageWrapper> },

      // ── Asset Library — Phase 4 P1 ────────────────────────────────────────
      // Staff-wide access — any authenticated user can browse and upload.
      // No commercial-actor gate; assets are shared across all sub-brands.
      { path: 'assets',                    element: <PageWrapper><ModuleContentWrapper><AssetLibraryListPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/new',                element: <PageWrapper><ModuleContentWrapper><AssetUploadPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/collections',        element: <PageWrapper><ModuleContentWrapper><CollectionsPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/collections/:colId', element: <PageWrapper><ModuleContentWrapper><CollectionDetailPage /></ModuleContentWrapper></PageWrapper> },
      { path: 'assets/:itemId',            element: <PageWrapper><ModuleContentWrapper><AssetDetailPage /></ModuleContentWrapper></PageWrapper> },
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
