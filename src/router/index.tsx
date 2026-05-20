/**
 * Router Configuration
 * Main routing setup with lazy loading and guards
 */

import { Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  Navigate,
  useParams,
} from 'react-router-dom';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';
import { ErrorBoundary } from '@/shared/components/feedback/ErrorBoundary';
import { AppShell } from '@/shared/components/layout/AppShell';
import { AuthGuard } from './guards/AuthGuard';
import { RoleGuard } from './guards/RoleGuard';
import { ModuleGuard } from './guards/ModuleGuard';
import { testRoutes } from './testRoutes';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { lazyWithRetry } from '@/shared/utils/lazyWithRetry';

// Lazy load pages
const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazyWithRetry(() => import('@/pages/auth/VerifyEmailPage'));

// DashboardPage removed — /dashboard redirects to /

// Engagement Pages
const EngagementListPage = lazyWithRetry(() => import('@/pages/engagements/EngagementListPage'));
const EngagementDetailPage = lazyWithRetry(() => import('@/pages/engagements/EngagementDetailPage'));
const EngagementCreatePage = lazyWithRetry(() => import('@/pages/engagements/EngagementCreatePage'));

// Client Pages
const ClientListPage = lazyWithRetry(() => import('@/pages/clients/ClientListPage'));
const ClientCreatePage = lazyWithRetry(() => import('@/pages/clients/ClientCreatePage'));
const ClientDetailPage = lazyWithRetry(() => import('@/pages/clients/ClientDetailPage'));

// Advisory Module Routes (uses real implementations from subsidiaries)
const AdvisoryRoutes = lazyWithRetry(() => import('@/subsidiaries/advisory/AdvisoryModule'));

// AI Assistant
const AIAssistantPage = lazyWithRetry(() => import('@/pages/ai/AIAssistantPage'));

// MCP token-refresh proxy pairing (single-purpose, no AppShell)
const MCPPairingPage = lazyWithRetry(() => import('@/pages/mcp/MCPPairingPage'));

// Public legal pages (Meta App Review surface)
const PrivacyPolicyPage = lazyWithRetry(() => import('@/pages/legal/PrivacyPolicyPage'));

// Module Layouts with Tab Navigation
const HRLayout = lazyWithRetry(() => import('@/modules/hr/components/HRLayout'));
const PerformanceLayout = lazyWithRetry(() => import('@/modules/hr-central/performance/components/PerformanceLayout'));
const FinanceLayout = lazyWithRetry(() => import('@/modules/finance/components/FinanceLayout'));
const CapitalLayout = lazyWithRetry(() => import('@/modules/capital/components/CapitalLayout'));
const ComplianceLayout = lazyWithRetry(() => import('@/modules/compliance/components/ComplianceLayout').then(m => ({ default: m.ComplianceLayout })));
const MarketIntelLayout = lazyWithRetry(() => import('@/modules/intelligence/components/MarketIntelLayout'));

// Admin Pages
const UserManagementPage = lazyWithRetry(() => import('@/pages/admin/UserManagementPage'));
const UserDetailPage = lazyWithRetry(() => import('@/pages/admin/UserDetailPage'));
const SettingsPage = lazyWithRetry(() => import('@/app/pages/SettingsPage'));
const DriveFolderSettingsPage = lazyWithRetry(
  () => import('@/modules/admin/pages/DriveFolderSettingsPage'),
);
const ShopifySyncPage = lazyWithRetry(() => import('@/pages/admin/ShopifySyncPage'));
const DesignSystemPage = lazyWithRetry(() => import('@/pages/admin/DesignSystemPage'));
const RoleManagementPage = lazyWithRetry(() => import('@/pages/admin/RoleManagementPage'));
const ServiceCredentialsPage = lazyWithRetry(() => import('@/modules/admin/pages/ServiceCredentialsPage'));

// Unified Dashboard (eagerly loaded to avoid Suspense error on login)
import UnifiedDashboard from '@/app/pages/UnifiedDashboard';

// Finishes Modules
const DesignManagerLayout = lazyWithRetry(() => import('@/modules/design-manager/components/DesignManagerLayout'));
const DesignManagerPageNew = lazyWithRetry(() => import('@/modules/design-manager/components/dashboard/DesignManagerPageNew'));
const ProjectView = lazyWithRetry(() => import('@/modules/design-manager/components/project/ProjectView'));
const ItemDetailRouter = lazyWithRetry(() => import('@/modules/design-manager/components/design-item/ItemDetailRouter'));
const MaterialsPage = lazyWithRetry(() => import('@/modules/design-manager/pages/MaterialsPage'));
const KnowledgeBasePage = lazyWithRetry(() => import('@/modules/design-manager/pages/KnowledgeBasePage'));
const DesignStrategyCanvasPage = lazyWithRetry(() => import('@/modules/design-manager/pages/StrategyCanvasPage'));
const BottomUpPricingPage = lazyWithRetry(() => import('@/modules/design-manager/components/bottom-up-pricing/BottomUpPricingPage'));
const StrategyReportEditor = lazyWithRetry(() => import('@/modules/design-manager/components/strategy-report/StrategyReportEditor').then(m => ({ default: m.StrategyReportEditor })));
const CustomerHubModule = lazyWithRetry(() => import('@/modules/customer-hub/CustomerHubModule'));
const LaunchPipelineModule = lazyWithRetry(() => import('@/modules/launch-pipeline/LaunchPipelineModule'));
const AssetRegistryPage = lazyWithRetry(() => import('@/modules/assets').then(module => ({ default: module.AssetRegistryPage })));
const WorkshopViewerPage = lazyWithRetry(() => import('@/subsidiaries/finishes/design-studio/pages/WorkshopViewerPage'));
const DesignStudioModule = lazyWithRetry(() => import('@/subsidiaries/finishes/design-studio/DesignStudioModule'));
const SceneListPage = lazyWithRetry(() => import('@/subsidiaries/finishes/design-studio/pages/SceneListPage'));
const SceneWorkspacePage = lazyWithRetry(() => import('@/subsidiaries/finishes/design-studio/pages/SceneWorkspacePage'));

const ClipperPage = lazyWithRetry(() => import('@/app/pages/ClipperPage'));
const InventoryPage = lazyWithRetry(() => import('@/modules/inventory/pages/InventoryPage'));
const InventoryLayout = lazyWithRetry(() => import('@/modules/inventory/components/InventoryLayout'));
const FinishLibraryPage = lazyWithRetry(() => import('@/modules/inventory/pages/FinishLibraryPage'));
const OffcutLibraryPage = lazyWithRetry(() => import('@/modules/inventory/pages/OffcutLibraryPage'));
const StockAdjustmentsPage = lazyWithRetry(() => import('@/modules/inventory/pages/StockAdjustmentsPage'));
const CategoriesPage = lazyWithRetry(() => import('@/modules/inventory/pages/CategoriesPage'));
const IssueHistoryPage = lazyWithRetry(() => import('@/modules/inventory/pages/IssueHistoryPage'));
const StockAdjustmentDetailPage = lazyWithRetry(() => import('@/modules/inventory/pages/StockAdjustmentDetailPage'));
const FeatureLibraryPage = lazyWithRetry(() => import('@/modules/design-manager/components/feature-library/FeatureLibraryPage'));
const SuppliersPage = lazyWithRetry(() => import('@/modules/suppliers/pages/SuppliersPage'));
const SupplierDetailPage = lazyWithRetry(() => import('@/modules/suppliers/pages/SupplierDetailPage'));

// Procurement Module
const ProcurementLayout = lazyWithRetry(() => import('@/modules/procurement/components/ProcurementLayout'));
const ProcurementDashboardPage = lazyWithRetry(() => import('@/modules/procurement/pages/ProcurementDashboardPage'));
const PurchaseOrdersPage = lazyWithRetry(() => import('@/modules/procurement/pages/PurchaseOrdersPage'));
const OutsourcedOrdersPage = lazyWithRetry(() => import('@/modules/procurement/pages/OutsourcedOrdersPage'));
const OutsourcedAnalyticsPage = lazyWithRetry(() => import('@/modules/procurement/pages/OutsourcedAnalyticsPage'));
const ProcurementQueuePage = lazyWithRetry(() => import('@/modules/procurement/pages/ProcurementQueuePage'));
const ProcurementAdvisorPage = lazyWithRetry(() => import('@/modules/procurement/pages/ProcurementAdvisorPage'));
const ProcurementPODetailPage = lazyWithRetry(() => import('@/modules/procurement/pages/PurchaseOrderDetailPage'));

// Manufacturing Module
const ManufacturingLayout = lazyWithRetry(() => import('@/modules/manufacturing/components/ManufacturingLayout'));
const ManufacturingDashboardPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/ManufacturingDashboardPage'));
const ManufacturingOrdersPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/ManufacturingOrdersPage'));
const ShopFloorPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/ShopFloorPage'));
const WorkstationsPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/WorkstationsPage'));
const RoutingTemplatesPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/RoutingTemplatesPage'));
const ManufacturingOrderDetailPage = lazyWithRetry(() => import('@/modules/manufacturing/pages/ManufacturingOrderDetailPage'));
const OrderDetailPageEnhanced = lazyWithRetry(() => import('@/modules/manufacturing/pages/OrderDetailPageEnhanced'));

// Fulfillment Module
const FulfillmentModule = lazyWithRetry(() => import('@/modules/fulfillment/FulfillmentModule'));

// Construction Module
const ConstructionOrdersPage = lazyWithRetry(() => import('@/modules/construction/pages/ConstructionOrdersPage'));
const ConstructionOrderDetailPage = lazyWithRetry(() => import('@/modules/construction/pages/ConstructionOrderDetailPage'));

// CRM Module
const CRMLayout = lazyWithRetry(() => import('@/modules/crm/components/CRMLayout').then(m => ({ default: m.CRMLayout })));
const CRMDashboardPage = lazyWithRetry(() => import('@/modules/crm/pages/CRMDashboardPage'));
const CRMDealsPage = lazyWithRetry(() => import('@/modules/crm/pages/DealsPage'));
const CRMDealDetailPage = lazyWithRetry(() => import('@/modules/crm/pages/DealDetailPage'));
const CRMProjectTrackerPage = lazyWithRetry(() => import('@/modules/crm/pages/ProjectTrackerPage'));
const CRMProjectDetailPage = lazyWithRetry(() => import('@/modules/crm/pages/ProjectDetailPage'));
const CRMActivitiesPage = lazyWithRetry(() => import('@/modules/crm/pages/SalesActivitiesPage'));
const CRMTasksPage = lazyWithRetry(() => import('@/modules/crm/pages/SalesTasksPage'));
const CRMReportsPage = lazyWithRetry(() => import('@/modules/crm/pages/CRMReportsPage'));

// Sales Orders Module
const SalesOrderLayout = lazyWithRetry(() => import('@/modules/sales-orders/components/SalesOrderLayout'));
const SalesOrderDashboardPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/SalesOrderDashboardPage'));
const SalesOrdersPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/SalesOrdersPage'));
const SalesOrderDetailPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/SalesOrderDetailPage'));
const ChangeOrderDetailPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/ChangeOrderDetailPage'));

// WhatsApp Communication
const WhatsAppLayout = lazyWithRetry(() => import('@/modules/whatsapp/components/WhatsAppLayout'));
const WhatsAppInboxPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/WhatsAppInboxPage'));
const WhatsAppTemplatesPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/TemplatesPage'));
const WhatsAppBroadcastsPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/BroadcastsPage'));
const WhatsAppAutomationPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/AutomationPage'));
const WhatsAppCommercePage = lazyWithRetry(() => import('@/modules/whatsapp/pages/CommercePage'));
const WhatsAppSettingsPage = lazyWithRetry(() => import('@/modules/whatsapp/pages/WhatsAppSettingsPage'));

// Google Chat & Unified Messaging
const GChatInboxPage = lazyWithRetry(() => import('@/modules/gchat/pages/GChatInboxPage'));
const UnifiedInboxPage = lazyWithRetry(() => import('@/modules/messaging/pages/UnifiedInboxPage'));

// Marketing Hub
const MarketingLayout = lazyWithRetry(() => import('@/modules/marketing/components/MarketingLayout'));
const MarketingDashboardPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.MarketingDashboardPage })));
const CampaignListPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.CampaignListPage })));
const CampaignDetailPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.CampaignDetailPage })));
const CampaignCreatePage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.CampaignCreatePage })));
const ContentCalendarPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.ContentCalendarPage })));
const TemplateLibraryPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.TemplateLibraryPage })));
const AnalyticsReportsPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.AnalyticsReportsPage })));
const MediaLibraryPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.MediaLibraryPage })));
const MarketingAgentPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.MarketingAgentPage })));
const KeyDateDetailPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.KeyDateDetailPage })));
const ProjectCaseStudiesPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.ProjectCaseStudiesPage })));
const VoicesPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.VoicesPage })));
const PressMentionsPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.PressMentionsPage })));
const FeaturedUpdatesPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.FeaturedUpdatesPage })));
const SocialAccountsPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.SocialAccountsPage })));
const SocialOAuthCallbackPage = lazyWithRetry(() => import('@/modules/marketing/pages').then(m => ({ default: m.SocialOAuthCallbackPage })));

// Client Portal (Public)
const ClientPortalPage = lazyWithRetry(() => import('@/modules/design-manager/components/client-portal/ClientPortalPage'));

// Portal v2 — editorial client portal (warm paper, Finishes + Advisory)
const PortalSignInPage = lazyWithRetry(() => import('@/modules/client-portal/pages/SignInPage'));
const PortalProjectPickerPage = lazyWithRetry(() => import('@/modules/client-portal/pages/ProjectPickerPage'));
const PortalPreviewPage = lazyWithRetry(() => import('@/modules/client-portal/pages/PortalPreviewPage'));
const PortalFinishesDashboardPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesDashboardPage'));
const PortalFinishesApprovalsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesApprovalsPage'));
const PortalFinishesDrawingPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesDrawingPage'));
const PortalFinishesFinancialsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesFinancialsPage'));
const PortalFinishesSchedulePage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesSchedulePage'));
const PortalAdvisoryDashboardPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryDashboardPage'));
const PortalDashboardRouter = lazyWithRetry(() => import('@/modules/client-portal/pages/PortalDashboardRouter'));
const PortalMobileProjectPickerPage = lazyWithRetry(() => import('@/modules/client-portal/pages/mobile/MobileProjectPickerPage'));
const PortalMobileDashboardPage = lazyWithRetry(() => import('@/modules/client-portal/pages/mobile/MobileDashboardPage'));
const PortalMobileApprovalsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/mobile/MobileApprovalsPage'));
const PortalMobileQuoteDetailPage = lazyWithRetry(() => import('@/modules/client-portal/pages/mobile/MobileQuoteDetailPage'));
const PortalMobileDrawingDetailPage = lazyWithRetry(() => import('@/modules/client-portal/pages/mobile/MobileDrawingDetailPage'));
const PortalAuthCallbackPage = lazyWithRetry(() => import('@/modules/client-portal/pages/AuthCallbackPage'));

// Portal v2 — additional Finishes pages
const PortalFinishesQuotationsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesQuotationsPage'));
const PortalFinishesMaterialsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesMaterialsPage'));
const PortalFinishesDrawingsIndexPage = lazyWithRetry(() => import('@/modules/client-portal/pages/finishes/FinishesDrawingsIndexPage'));

// Portal v2 — Advisory pages
const PortalAdvisoryApprovalsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryApprovalsPage'));
const PortalAdvisoryFinancialsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryFinancialsPage'));
const PortalAdvisoryImplementationPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryImplementationPage'));
const PortalAdvisoryBOQsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryBOQsPage'));
const PortalAdvisoryMaterialSchedulesPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryMaterialSchedulesPage'));
const PortalAdvisoryDrawingsIndexPage = lazyWithRetry(() => import('@/modules/client-portal/pages/advisory/AdvisoryDrawingsIndexPage'));

// Portal v2 — shared pages (Snags / Interactions / Reports / Messages / Matflow)
const PortalFinishesSnagsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/SnagsPage').then(m => ({ default: m.FinishesSnagsPage })));
const PortalAdvisorySnagsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/SnagsPage').then(m => ({ default: m.AdvisorySnagsPage })));
const PortalFinishesInteractionsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/InteractionsPage').then(m => ({ default: m.FinishesInteractionsPage })));
const PortalAdvisoryInteractionsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/InteractionsPage').then(m => ({ default: m.AdvisoryInteractionsPage })));
const PortalFinishesReportsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/ReportsPage').then(m => ({ default: m.FinishesReportsPage })));
const PortalAdvisoryReportsPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/ReportsPage').then(m => ({ default: m.AdvisoryReportsPage })));
const PortalFinishesMessagesPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/MessagesPage').then(m => ({ default: m.FinishesMessagesPage })));
const PortalAdvisoryMessagesPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/MessagesPage').then(m => ({ default: m.AdvisoryMessagesPage })));
const PortalFinishesMatflowPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/MatflowPage').then(m => ({ default: m.FinishesMatflowPage })));
const PortalAdvisoryMatflowPage = lazyWithRetry(() => import('@/modules/client-portal/pages/shared/MatflowPage').then(m => ({ default: m.AdvisoryMatflowPage })));

// Sales Order Client Portal (Public)
const ClientQuoteAcceptancePage = lazyWithRetry(() => import('@/modules/sales-orders/pages/client-portal/ClientQuoteAcceptancePage'));
const ClientDesignReviewPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/client-portal/ClientDesignReviewPage'));
const ClientChangeOrderReviewPage = lazyWithRetry(() => import('@/modules/sales-orders/pages/client-portal/ClientChangeOrderReviewPage'));

// CD Portal (Public - Country Director Portal for Advisory)
const CDPortalPage = lazyWithRetry(() => import('@/subsidiaries/advisory/delivery/pages/CDPortalPage').then(m => ({ default: m.CDPortalPage })));

// Market Intelligence Pages
const IntelligenceDashboardPage = lazyWithRetry(() =>
  import('@/modules/market-intelligence/intelligence-dashboard/pages/IntelligenceDashboardPage')
);
const IntelligenceInsightsPage = lazyWithRetry(() =>
  import('@/modules/market-intelligence/intelligence-dashboard/pages/IntelligenceInsightsPage')
);
const IntelligenceReportsPage = lazyWithRetry(() =>
  import('@/modules/market-intelligence/intelligence-dashboard/pages/IntelligenceReportsPage')
);
const IntelligenceAnalyticsPage = lazyWithRetry(() =>
  import('@/modules/market-intelligence/intelligence-dashboard/pages/IntelligenceAnalyticsPage')
);

// Profile Pages
const ProfilePage = lazyWithRetry(() => import('@/pages/profile/ProfilePage'));

// HR Central Pages (dashboard removed - direct to content)
const EmployeeListPage = lazyWithRetry(() => import('@/pages/hr/EmployeeListPage'));
const EmployeeCreatePage = lazyWithRetry(() => import('@/pages/hr/EmployeeCreatePage'));
const EmployeeDetailPage = lazyWithRetry(() => import('@/pages/hr/EmployeeDetailPage'));
const EmployeeEditPage = lazyWithRetry(() => import('@/pages/hr/EmployeeEditPage'));
const LeaveManagementPage = lazyWithRetry(() => import('@/pages/hr/LeaveManagementPage'));
const PayrollPage = lazyWithRetry(() => import('@/pages/hr/PayrollPage'));
const PayrollBatchListPage = lazyWithRetry(() => import('@/pages/hr/PayrollBatchListPage'));
const PayrollBatchDetailPage = lazyWithRetry(() => import('@/pages/hr/PayrollBatchDetailPage'));
const MonthlyPayrollRunDetailPage = lazyWithRetry(() => import('@/pages/hr/MonthlyPayrollRunDetailPage'));
const OrgStructurePage = lazyWithRetry(() => import('@/pages/hr/OrgStructurePage'));

// Finance Pages — 5-tab structure: Analysis | Forecasting | Reports | Operations | Settings
const BudgetSpreadsheetPage = lazyWithRetry(() => import('@/modules/finance/pages/BudgetSpreadsheetPage'));
const ExpenseListPage = lazyWithRetry(() => import('@/pages/finance/ExpenseListPage'));
const FinanceIntegrationsPage = lazyWithRetry(() => import('@/modules/finance/pages/IntegrationsPage'));
const FinanceBillsPage = lazyWithRetry(() => import('@/modules/finance/pages/BillsPage'));
const FinanceInvoicesPage = lazyWithRetry(() => import('@/modules/finance/pages/InvoicesPage'));
const FinanceCashFlowPage = lazyWithRetry(() => import('@/modules/finance/pages/CashFlowPage'));
const FinanceForecastPage = lazyWithRetry(() => import('@/modules/finance/pages/ForecastPage'));
const FinanceProfitabilityPage = lazyWithRetry(() => import('@/modules/finance/pages/ProfitabilityPage'));
const FinanceGoalSeekPage = lazyWithRetry(() => import('@/modules/finance/pages/GoalSeekPage'));
const FinanceChartOfAccounts = lazyWithRetry(() => import('@/modules/finance/pages/ChartOfAccounts'));
// Finance — Section Layouts (persistent pill sub-navigation)
const OverviewLayout = lazyWithRetry(() => import('@/modules/finance/components/layouts/OverviewLayout').then(m => ({ default: m.OverviewLayout })));
const CashForecastLayout = lazyWithRetry(() => import('@/modules/finance/components/layouts/CashForecastLayout').then(m => ({ default: m.CashForecastLayout })));
const OperationsLayout = lazyWithRetry(() => import('@/modules/finance/components/layouts/OperationsLayout').then(m => ({ default: m.OperationsLayout })));
// Finance — Landing pages
const FinanceOverviewPage = lazyWithRetry(() => import('@/modules/finance/pages/FinanceOverviewPage'));
const CashForecastLandingPage = lazyWithRetry(() => import('@/modules/finance/pages/CashForecastLandingPage'));
const FinanceOperationsLanding = lazyWithRetry(() => import('@/modules/finance/pages/OperationsLandingPage'));
const FinanceSettingsLanding = lazyWithRetry(() => import('@/modules/finance/pages/SettingsLandingPage'));
const FinanceReportsLanding = lazyWithRetry(() => import('@/modules/finance/pages/ReportsLandingPage'));
// Finance — Analysis sub-pages
const FinanceKPIsPage = lazyWithRetry(() => import('@/modules/finance/pages/KPIsPage'));
const FinanceKPIExplorerPage = lazyWithRetry(() => import('@/modules/finance/pages/KPIExplorerPage'));
const FinanceGrowthPage = lazyWithRetry(() => import('@/modules/finance/pages/GrowthPage'));
const FinanceTrendPage = lazyWithRetry(() => import('@/modules/finance/pages/TrendPage'));
const FinanceFinancialHealthPage = lazyWithRetry(() => import('@/modules/finance/pages/FinancialHealthPage'));
// Finance — Operations sub-pages
const FinanceAccountabilityPage = lazyWithRetry(() => import('@/modules/finance/pages/AccountabilityPage'));
const FinanceRefundsPage = lazyWithRetry(() => import('@/modules/finance/pages/RefundsPage'));
const FinanceTaxCompliancePage = lazyWithRetry(() => import('@/modules/finance/pages/TaxCompliancePage'));
const FinanceReconciliationsPage = lazyWithRetry(() => import('@/modules/finance/pages/ReconciliationsPage'));
// Finance — Settings sub-pages
const FinanceAccountMappingsPage = lazyWithRetry(() => import('@/modules/finance/pages/AccountMappingsPage'));
const FinanceQBOSyncDashboard = lazyWithRetry(() => import('@/modules/finance/pages/QBOSyncDashboardPage'));
const FinancePricingAssumptionsPage = lazyWithRetry(() => import('@/modules/finance/pages/PricingAssumptionsPage'));
// Finance — Cash & Forecast sub-pages
const SpendPlanPage = lazyWithRetry(() => import('@/modules/finance/pages/SpendPlanPage'));
const ExpenditureQueuePage = lazyWithRetry(() => import('@/modules/finance/pages/ExpenditureQueuePage'));
const CashProjectionsPage = lazyWithRetry(() => import('@/modules/finance/pages/CashProjectionsPage'));
const SavingsTrackerPage = lazyWithRetry(() => import('@/modules/finance/pages/SavingsTrackerPage'));
const LiabilityRegisterPage = lazyWithRetry(() => import('@/modules/finance/pages/LiabilityRegisterPage'));
const CFOBriefingPage = lazyWithRetry(() => import('@/modules/finance/pages/CFOBriefingPage'));
const ScenarioAnalysisPage = lazyWithRetry(() => import('@/modules/finance/pages/ScenarioAnalysisPage'));
const GroupCashFlowPage = lazyWithRetry(() => import('@/modules/finance/pages/GroupCashFlowPage'));
const ProjectedReceiptsPage = lazyWithRetry(() => import('@/modules/finance/pages/ProjectedReceiptsPage'));
// Performance Pages (dashboard removed - direct to content)
const GoalListPage = lazyWithRetry(() => import('@/pages/performance/GoalListPage'));
const ReviewListPage = lazyWithRetry(() => import('@/pages/performance/ReviewListPage'));
const CompetencyListPage = lazyWithRetry(() => import('@/pages/performance/CompetencyListPage'));
const DevelopmentPlanListPage = lazyWithRetry(() => import('@/pages/performance/DevelopmentPlanListPage'));
const TrainingCatalogPage = lazyWithRetry(() => import('@/pages/performance/TrainingCatalogPage'));
const TrainingCourseFormPage = lazyWithRetry(() => import('@/pages/performance/TrainingCourseFormPage'));
const TrainingCourseDetailPage = lazyWithRetry(() => import('@/pages/performance/TrainingCourseDetailPage'));
const CompetencyFormPage = lazyWithRetry(() => import('@/pages/performance/CompetencyFormPage'));
const CompetencyDetailPage = lazyWithRetry(() => import('@/pages/performance/CompetencyDetailPage'));
const DevelopmentPlanFormPage = lazyWithRetry(() => import('@/pages/performance/DevelopmentPlanFormPage'));

// Capital Hub Pages — Capital seeking, readiness & application tracking
const CapitalDashboardPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalDashboardPage'));
const CapitalNeedsPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalNeedsPage'));
const CapitalProductsPage = lazyWithRetry(() => import('@/modules/capital/pages/CapitalProductsPage'));
const ReadinessPage = lazyWithRetry(() => import('@/modules/capital/pages/ReadinessPage'));
const CapitalApplicationsPage = lazyWithRetry(() => import('@/modules/capital/pages/ApplicationsPage'));
const CapitalApplicationDetailPage = lazyWithRetry(() => import('@/modules/capital/pages/ApplicationDetailPage'));
const CapitalFacilitiesPage = lazyWithRetry(() => import('@/modules/capital/pages/FacilitiesPage'));
const CapitalFacilityDetailPage = lazyWithRetry(() => import('@/modules/capital/pages/FacilityDetailPage'));

// Compliance Module
const ComplianceDashboardPage = lazyWithRetry(() => import('@/modules/compliance/pages/ComplianceDashboardPage').then(m => ({ default: m.ComplianceDashboardPage })));
const DocumentRegistryPage = lazyWithRetry(() => import('@/modules/compliance/pages/DocumentRegistryPage').then(m => ({ default: m.DocumentRegistryPage })));
const ObligationsPage = lazyWithRetry(() => import('@/modules/compliance/pages/ObligationsPage').then(m => ({ default: m.ObligationsPage })));

// Market Intelligence Module Pages (dashboard removed - direct to content)
const MarketCompetitorListPage = lazyWithRetry(() => import('@/modules/intelligence/pages/CompetitorListPage'));
const MarketCompetitorDetailPage = lazyWithRetry(() => import('@/modules/intelligence/pages/CompetitorDetailPage'));
const MarketCompetitorComparisonPage = lazyWithRetry(() => import('@/modules/intelligence/pages/CompetitorComparisonPage'));
const MarketNewsFeedPage = lazyWithRetry(() => import('@/modules/intelligence/pages/NewsFeedPage'));
const MarketAnalysisPage = lazyWithRetry(() => import('@/modules/intelligence/pages/MarketAnalysisPage'));
const MarketInsightsPage = lazyWithRetry(() => import('@/modules/intelligence/pages/InsightsPage'));
const MarketIntelligenceScanPage = lazyWithRetry(() => import('@/modules/intelligence/pages/MarketIntelligenceScanPage'));
const MarketTopicTrackingPage = lazyWithRetry(() => import('@/modules/intelligence/pages/TopicTrackingPage'));
const MarketSocialIntelligencePage = lazyWithRetry(() => import('@/modules/intelligence/pages/SocialIntelligencePage'));

// Intelligence Layer Module Pages
const IntelligenceLayout = lazyWithRetry(() => import('@/modules/intelligence-layer/components/IntelligenceLayout'));
const IntelligenceLayerDashboard = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/IntelligenceLayerDashboardPage'));
const IntelligenceAdminPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/IntelligenceAdminPage'));
const EmployeeTaskInboxPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/EmployeeTaskInboxPage'));
const ManagerDashboardPage = lazyWithRetry(() => import('@/modules/intelligence-layer/pages/ManagerDashboardPage'));

// Strategy Module Layout + Pages
const StrategyLayout = lazyWithRetry(() => import('@/modules/strategy/layouts/DashboardLayout'));
const ExecutiveDashboard = lazyWithRetry(() => import('@/modules/strategy/pages/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const StrategyOverview = lazyWithRetry(() => import('@/modules/strategy/pages/StrategyOverview').then(m => ({ default: m.StrategyOverview })));
const OKRDashboard = lazyWithRetry(() => import('@/modules/strategy/pages/OKRDashboard').then(m => ({ default: m.OKRDashboard })));
const KPILayout = lazyWithRetry(() => import('@/modules/strategy/components/kpi/KPILayout'));
const KPIOverviewPage = lazyWithRetry(() => import('@/modules/strategy/pages/KPIOverviewPage'));
const KPILibraryPage = lazyWithRetry(() => import('@/modules/strategy/pages/KPILibraryPage'));
const KPIActivePage = lazyWithRetry(() => import('@/modules/strategy/pages/KPIActivePage'));
const KPIScorecardsPage = lazyWithRetry(() => import('@/modules/strategy/pages/KPIScorecardsPage'));
const PerformanceDeepDive = lazyWithRetry(() => import('@/modules/strategy/pages/PerformanceDeepDive').then(m => ({ default: m.PerformanceDeepDive })));
const StrategyReviewPage = lazyWithRetry(() => import('@/modules/strategy/pages/StrategyReviewPage').then(m => ({ default: m.StrategyReviewPage })));

// Error Pages
const NotFoundPage = lazyWithRetry(() => import('@/pages/errors/NotFoundPage'));
const UnauthorizedPage = lazyWithRetry(() => import('@/pages/errors/UnauthorizedPage'));
const ServerErrorPage = lazyWithRetry(() => import('@/pages/errors/ServerErrorPage'));
const OfflinePage = lazyWithRetry(() => import('@/pages/errors/OfflinePage'));

// Page wrapper with Suspense
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullPageLoader />}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </Suspense>
);

const RedirectWithParams = ({
  to,
}: {
  to: (params: Record<string, string | undefined>) => string;
}) => {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
};

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/auth',
    children: [
      {
        path: 'login',
        element: <PageWrapper><LoginPage /></PageWrapper>,
      },
      {
        path: 'forgot-password',
        element: <PageWrapper><ForgotPasswordPage /></PageWrapper>,
      },
      {
        path: 'reset-password',
        element: <PageWrapper><ResetPasswordPage /></PageWrapper>,
      },
      {
        path: 'verify-email',
        element: <PageWrapper><VerifyEmailPage /></PageWrapper>,
      },
    ],
  },

  // Client Portal (Public - no auth required)
  {
    path: '/client-portal/:token',
    element: <PageWrapper><ClientPortalPage /></PageWrapper>,
  },

  // Sales Order Client Portal (Public - no auth required)
  {
    path: '/client-portal/:token/accept',
    element: <PageWrapper><ClientQuoteAcceptancePage /></PageWrapper>,
  },
  {
    path: '/client-portal/:token/design-review/:signoffId',
    element: <PageWrapper><ClientDesignReviewPage /></PageWrapper>,
  },
  {
    path: '/client-portal/:token/change-order/:coId',
    element: <PageWrapper><ClientChangeOrderReviewPage /></PageWrapper>,
  },

  // CD Portal (Public - Country Director Portal, no auth required)
  // Uses /cd-portal path to avoid conflict with /advisory/* protected route
  {
    path: '/cd-portal',
    element: <PageWrapper><CDPortalPage /></PageWrapper>,
  },

  // Portal v2 — editorial Client Portal (Public, mock data)
  {
    path: '/portal',
    children: [
      { index: true, element: <Navigate to="/portal/projects" replace /> },
      { path: 'sign-in', element: <PageWrapper><PortalSignInPage /></PageWrapper> },
      { path: 'projects', element: <PageWrapper><PortalProjectPickerPage /></PageWrapper> },
      { path: 'preview', element: <PageWrapper><PortalPreviewPage /></PageWrapper> },

      // Mobile companion screens (live at fixed mobile routes for review)
      { path: 'm/projects', element: <PageWrapper><PortalMobileProjectPickerPage /></PageWrapper> },
      { path: 'm/dashboard', element: <PageWrapper><PortalMobileDashboardPage /></PageWrapper> },
      { path: 'm/approvals', element: <PageWrapper><PortalMobileApprovalsPage /></PageWrapper> },
      { path: 'm/approvals/q-019', element: <PageWrapper><PortalMobileQuoteDetailPage /></PageWrapper> },
      { path: 'm/drawings/sd-104', element: <PageWrapper><PortalMobileDrawingDetailPage /></PageWrapper> },

      // Auth callback for magic-link sign-in
      { path: 'auth/callback', element: <PageWrapper><PortalAuthCallbackPage /></PageWrapper> },

      // Project routes — `:code` is the DesignProject.code. The
      // dashboard route uses a subsidiary-aware router that branches
      // between Finishes and Advisory dashboards based on the
      // project's `subsidiaryId`. All other routes default to the
      // Finishes pages; advisory-specific equivalents will replace
      // them as those screens go live.
      {
        path: 'p/:code',
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <PageWrapper><PortalDashboardRouter /></PageWrapper> },
          { path: 'approvals', element: <PageWrapper><PortalFinishesApprovalsPage /></PageWrapper> },
          { path: 'approvals/:id', element: <PageWrapper><PortalFinishesApprovalsPage /></PageWrapper> },
          { path: 'quotes', element: <PageWrapper><PortalFinishesQuotationsPage /></PageWrapper> },
          { path: 'quotes/:id', element: <PageWrapper><PortalFinishesQuotationsPage /></PageWrapper> },
          { path: 'financials', element: <PageWrapper><PortalFinishesFinancialsPage /></PageWrapper> },
          { path: 'materials', element: <PageWrapper><PortalFinishesMaterialsPage /></PageWrapper> },
          { path: 'drawings', element: <PageWrapper><PortalFinishesDrawingsIndexPage /></PageWrapper> },
          { path: 'drawings/:id', element: <PageWrapper><PortalFinishesDrawingPage /></PageWrapper> },
          { path: 'schedule', element: <PageWrapper><PortalFinishesSchedulePage /></PageWrapper> },
          { path: 'snags', element: <PageWrapper><PortalFinishesSnagsPage /></PageWrapper> },
          { path: 'interactions', element: <PageWrapper><PortalFinishesInteractionsPage /></PageWrapper> },
          { path: 'reports', element: <PageWrapper><PortalFinishesReportsPage /></PageWrapper> },
          { path: 'messages', element: <PageWrapper><PortalFinishesMessagesPage /></PageWrapper> },
          { path: 'matflow', element: <PageWrapper><PortalFinishesMatflowPage /></PageWrapper> },
        ],
      },

      // Advisory project routes
      {
        path: 'p/naqaa-rollout',
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <PageWrapper><PortalAdvisoryDashboardPage /></PageWrapper> },
          { path: 'approvals', element: <PageWrapper><PortalAdvisoryApprovalsPage /></PageWrapper> },
          { path: 'approvals/:id', element: <PageWrapper><PortalAdvisoryApprovalsPage /></PageWrapper> },
          { path: 'financials', element: <PageWrapper><PortalAdvisoryFinancialsPage /></PageWrapper> },
          { path: 'implementation', element: <PageWrapper><PortalAdvisoryImplementationPage /></PageWrapper> },
          { path: 'boqs', element: <PageWrapper><PortalAdvisoryBOQsPage /></PageWrapper> },
          { path: 'schedules', element: <PageWrapper><PortalAdvisoryMaterialSchedulesPage /></PageWrapper> },
          { path: 'drawings', element: <PageWrapper><PortalAdvisoryDrawingsIndexPage /></PageWrapper> },
          { path: 'snags', element: <PageWrapper><PortalAdvisorySnagsPage /></PageWrapper> },
          { path: 'interactions', element: <PageWrapper><PortalAdvisoryInteractionsPage /></PageWrapper> },
          { path: 'reports', element: <PageWrapper><PortalAdvisoryReportsPage /></PageWrapper> },
          { path: 'messages', element: <PageWrapper><PortalAdvisoryMessagesPage /></PageWrapper> },
          { path: 'matflow', element: <PageWrapper><PortalAdvisoryMatflowPage /></PageWrapper> },
        ],
      },
    ],
  },

  // MCP token-refresh proxy pairing — auth-gated, intentionally outside the
  // AppShell so the dialog is focused. Triggered by `setup.js login`.
  {
    path: '/mcp-login',
    element: (
      <AuthGuard>
        <PageWrapper><MCPPairingPage /></PageWrapper>
      </AuthGuard>
    ),
  },

  // Privacy policy + Meta data-deletion landing (Public — Meta App Review surface)
  {
    path: '/privacy',
    element: <PageWrapper><PrivacyPolicyPage /></PageWrapper>,
  },
  {
    path: '/privacy/data-deletion',
    element: <PageWrapper><PrivacyPolicyPage /></PageWrapper>,
  },

  // Protected routes
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell>
          <Outlet />
        </AppShell>
      </AuthGuard>
    ),
    errorElement: <ServerErrorPage />,
    children: [
      // ========================================
      // DAWIN FINISHES ROUTES
      // ========================================
      {
        index: true,
        element: <UnifiedDashboard />,
      },
      // Legacy route redirects kept for old links/search index entries.
      {
        path: 'design-manager/projects/:projectId',
        element: (
          <RedirectWithParams
            to={({ projectId }) => (projectId ? `/design/project/${projectId}` : '/design')}
          />
        ),
      },
      {
        path: 'design-manager/project/:projectId',
        element: (
          <RedirectWithParams
            to={({ projectId }) => (projectId ? `/design/project/${projectId}` : '/design')}
          />
        ),
      },
      {
        path: 'design-manager/projects/:projectId/items/:itemId',
        element: (
          <RedirectWithParams
            to={({ projectId, itemId }) =>
              projectId && itemId ? `/design/project/${projectId}/item/${itemId}` : '/design'
            }
          />
        ),
      },
      {
        path: 'design-manager/project/:projectId/item/:itemId',
        element: (
          <RedirectWithParams
            to={({ projectId, itemId }) =>
              projectId && itemId ? `/design/project/${projectId}/item/${itemId}` : '/design'
            }
          />
        ),
      },
      {
        path: 'crm/customers/:customerId',
        element: (
          <RedirectWithParams
            to={({ customerId }) => (customerId ? `/customers/${customerId}` : '/customers')}
          />
        ),
      },
      {
        path: 'procurement/purchase-orders/:poId',
        element: (
          <RedirectWithParams
            to={({ poId }) => (poId ? `/procurement/orders/${poId}` : '/procurement/orders')}
          />
        ),
      },
      {
        path: 'construction/orders/:coId',
        element: (
          <RedirectWithParams
            to={({ coId }) => (coId ? `/construction/${coId}` : '/construction')}
          />
        ),
      },
      {
        path: 'market-intelligence/competitors',
        element: <Navigate to="/market-intel/competitors" replace />,
      },
      {
        path: 'market-intelligence/competitors/:competitorId',
        element: (
          <RedirectWithParams
            to={({ competitorId }) =>
              competitorId ? `/market-intel/competitors/${competitorId}` : '/market-intel/competitors'
            }
          />
        ),
      },
      {
        path: 'market-intelligence/market',
        element: <Navigate to="/market-intel/market" replace />,
      },
      {
        path: 'market-intelligence/topics',
        element: <Navigate to="/market-intel/topics" replace />,
      },
      {
        path: 'market-intelligence/social',
        element: <Navigate to="/market-intel/social" replace />,
      },
      {
        path: 'market-intelligence/ai-scan',
        element: <Navigate to="/market-intel/ai-scan" replace />,
      },
      {
        path: 'strategy/documents',
        element: <Navigate to="/strategy/plans" replace />,
      },
      {
        path: 'strategy/documents/:documentId',
        element: <Navigate to="/strategy/plans" replace />,
      },
      {
        path: 'hr/organization/departments/:departmentId',
        element: <Navigate to="/hr/org-structure" replace />,
      },
      {
        path: 'customer-hub/contacts/:contactId',
        element: <Navigate to="/customers" replace />,
      },
      {
        path: 'inventory/items/:itemId',
        element: <Navigate to="/inventory" replace />,
      },
      {
        path: 'inventory/finishes/:finishId',
        element: <Navigate to="/inventory/finishes" replace />,
      },
      {
        path: 'compliance/documents/:documentId',
        element: <Navigate to="/compliance/documents" replace />,
      },
      {
        path: 'clipper',
        element: (
          <ModuleGuard module="clipper">
            <PageWrapper><ClipperPage /></PageWrapper>
          </ModuleGuard>
        ),
      },
      {
        path: 'projects/:projectId/strategy-report/:reportId',
        element: <PageWrapper><StrategyReportEditor /></PageWrapper>,
      },
      {
        path: 'design',
        element: (
          <ModuleGuard module="design-manager">
            <PageWrapper><DesignManagerLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <DesignManagerPageNew /> },
          { path: 'materials', element: <MaterialsPage /> },
          { path: 'features', element: <FeatureLibraryPage /> },
          { path: 'knowledge-base', element: <KnowledgeBasePage /> },
          { path: 'project/:projectId', element: <ProjectView /> },
          { path: 'project/:projectId/strategy', element: <DesignStrategyCanvasPage /> },
          { path: 'project/:projectId/pricing', element: <BottomUpPricingPage /> },
          { path: 'project/:projectId/item/:itemId', element: <ItemDetailRouter /> },
        ],
      },
      {
        path: 'customers/*',
        element: (
          <ModuleGuard module="customer-hub">
            <PageWrapper><CustomerHubModule /></PageWrapper>
          </ModuleGuard>
        ),
      },
      {
        path: 'assets',
        element: (
          <ModuleGuard module="asset-registry">
            <PageWrapper><ModuleContentWrapper><AssetRegistryPage /></ModuleContentWrapper></PageWrapper>
          </ModuleGuard>
        ),
      },
      {
        path: 'workshop',
        element: (
          <ModuleGuard module="design-studio">
            <PageWrapper><DesignStudioModule /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <WorkshopViewerPage /> },
          // P21.10: project-scoped scene routes — project is the parent in
          // the URL hierarchy. The flat routes below stay for back-compat
          // (links in the wild, older MO/DM deep-links). Both render the
          // same components; the project-scoped ones pass `projectId` via
          // the route param so the page can header the project context.
          { path: 'projects/:projectId/scenes', element: <SceneListPage /> },
          { path: 'projects/:projectId/scenes/:sceneId', element: <SceneWorkspacePage /> },
          { path: 'scenes', element: <SceneListPage /> },
          { path: 'scenes/:sceneId', element: <SceneWorkspacePage /> },
        ],
      },
      {
        path: 'inventory',
        element: (
          <ModuleGuard module="inventory">
            <PageWrapper><InventoryLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <InventoryPage /> },
          { path: 'finishes', element: <FinishLibraryPage /> },
          { path: 'offcuts', element: <OffcutLibraryPage /> },
          { path: 'adjustments', element: <StockAdjustmentsPage /> },
          { path: 'adjustments/:adjustmentId', element: <StockAdjustmentDetailPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'issues', element: <IssueHistoryPage /> },
        ],
      },
      {
        path: 'launch-pipeline/*',
        element: (
          <ModuleGuard module="launch-pipeline">
            <PageWrapper><LaunchPipelineModule /></PageWrapper>
          </ModuleGuard>
        ),
      },
      // ========================================
      // PROCUREMENT MODULE - Purchase Orders & Buying
      // ========================================
      {
        path: 'procurement',
        element: (
          <ModuleGuard module="procurement">
            <PageWrapper><ProcurementLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <ProcurementDashboardPage /> },
          { path: 'orders', element: <PurchaseOrdersPage /> },
          { path: 'orders/:poId', element: <ProcurementPODetailPage /> },
          { path: 'outsourcing', element: <OutsourcedOrdersPage /> },
          { path: 'outsourcing/analytics', element: <OutsourcedAnalyticsPage /> },
          { path: 'queue', element: <ProcurementQueuePage /> },
          { path: 'advisor', element: <ProcurementAdvisorPage /> },
        ],
      },

      // ========================================
      // MANUFACTURING MODULE - Production & Shop Floor
      // ========================================
      {
        path: 'manufacturing',
        element: (
          <ModuleGuard module="production">
            <PageWrapper><ManufacturingLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <ManufacturingDashboardPage /> },
          { path: 'orders', element: <ManufacturingOrdersPage /> },
          { path: 'orders/:orderId', element: <ManufacturingOrderDetailPage /> },
          { path: 'orders/:orderId/enhanced', element: <OrderDetailPageEnhanced /> },
          { path: 'shop-floor', element: <ShopFloorPage /> },
          { path: 'workstations', element: <WorkstationsPage /> },
          { path: 'routing-templates', element: <RoutingTemplatesPage /> },
          // Legacy redirects for bookmarks
          { path: 'purchase-orders', element: <Navigate to="/procurement/orders" replace /> },
          { path: 'purchase-orders/:poId', element: <Navigate to="/procurement/orders" replace /> },
          { path: 'procurement', element: <Navigate to="/procurement" replace /> },
          { path: 'procurement-queue', element: <Navigate to="/procurement/queue" replace /> },
        ],
      },

      // ========================================
      // CONSTRUCTION MODULE - On-Site Execution
      // ========================================
      {
        path: 'construction',
        element: (
          <ModuleGuard module="construction">
            <PageWrapper>
              <Outlet />
            </PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <ConstructionOrdersPage /> },
          { path: ':coId', element: <ConstructionOrderDetailPage /> },
        ],
      },

      // ========================================
      // FULFILLMENT MODULE - Post-Production Pipeline
      // ========================================
      {
        path: 'fulfillment',
        element: (
          <ModuleGuard module="production">
            <PageWrapper><FulfillmentModule /></PageWrapper>
          </ModuleGuard>
        ),
      },

      // ========================================
      // CRM MODULE - Sales Pipeline & Deal Tracking
      // ========================================
      {
        path: 'crm',
        element: (
          <ModuleGuard module="crm">
            <PageWrapper><CRMLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/crm/pipeline" replace /> },
          { path: 'pipeline', element: <CRMDashboardPage /> },
          { path: 'deals', element: <CRMDealsPage /> },
          { path: 'deals/:dealId', element: <CRMDealDetailPage /> },
          { path: 'projects', element: <CRMProjectTrackerPage /> },
          { path: 'projects/:projectId', element: <CRMProjectDetailPage /> },
          { path: 'activities', element: <CRMActivitiesPage /> },
          { path: 'tasks', element: <CRMTasksPage /> },
          { path: 'reports', element: <CRMReportsPage /> },
        ],
      },

      // ========================================
      // SALES ORDERS MODULE - Commercial Protection & Approval Gates
      // ========================================
      {
        path: 'sales-orders',
        element: (
          <ModuleGuard module="sales-orders">
            <PageWrapper><SalesOrderLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <SalesOrderDashboardPage /> },
          { path: 'list', element: <SalesOrdersPage /> },
          { path: ':orderId', element: <SalesOrderDetailPage /> },
          { path: ':orderId/change-orders/:coId', element: <ChangeOrderDetailPage /> },
        ],
      },

      // ========================================
      // GLOBAL SHARED ROUTES (Available across all subsidiaries)
      // ========================================
      {
        path: 'suppliers',
        element: (
          <ModuleGuard module="suppliers">
            <PageWrapper><ModuleContentWrapper><Outlet /></ModuleContentWrapper></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <SuppliersPage /> },
          { path: ':supplierId', element: <SupplierDetailPage /> },
        ],
      },

      // ========================================
      // DAWIN ADVISORY ROUTES
      // ========================================
      {
        path: 'dashboard',
        element: <Navigate to="/" replace />,
      },

      // Engagements (member+ access)
      {
        path: 'engagements',
        element: <RoleGuard roles={['member', 'manager', 'admin', 'super_admin']}><Outlet /></RoleGuard>,
        children: [
          { index: true, element: <PageWrapper><EngagementListPage /></PageWrapper> },
          { path: 'new', element: <PageWrapper><EngagementCreatePage /></PageWrapper> },
          { path: ':engagementId', element: <PageWrapper><EngagementDetailPage /></PageWrapper> },
        ],
      },

      // Clients (member+ access, shared across all subsidiaries)
      {
        path: 'clients',
        element: <RoleGuard roles={['member', 'manager', 'admin', 'super_admin']}><Outlet /></RoleGuard>,
        children: [
          { index: true, element: <PageWrapper><ClientListPage /></PageWrapper> },
          { path: 'new', element: <PageWrapper><ClientCreatePage /></PageWrapper> },
          { path: ':clientId', element: <PageWrapper><ClientDetailPage /></PageWrapper> },
        ],
      },

      // ========================================
      // DAWIN ADVISORY MODULE (Complete Implementation)
      // Includes: Investment, MatFlow, Delivery sub-modules
      // ========================================
      {
        path: 'advisory/*',
        element: (
          <ModuleGuard module="investment_advisory">
            <PageWrapper>
              <AdvisoryRoutes />
            </PageWrapper>
          </ModuleGuard>
        ),
      },

      // Market Intelligence Module
      {
        path: 'market-intelligence',
        element: <ModuleGuard module="market_intelligence"><Outlet /></ModuleGuard>,
        children: [
          { index: true, element: <PageWrapper><IntelligenceDashboardPage /></PageWrapper> },
          { path: 'insights', element: <PageWrapper><IntelligenceInsightsPage /></PageWrapper> },
          { path: 'reports', element: <PageWrapper><IntelligenceReportsPage /></PageWrapper> },
          { path: 'analytics', element: <PageWrapper><IntelligenceAnalyticsPage /></PageWrapper> },
        ],
      },

      // AI Assistant (member+ access)
      {
        path: 'assistant',
        element: (
          <RoleGuard roles={['member', 'manager', 'admin', 'super_admin']}>
            <PageWrapper><AIAssistantPage /></PageWrapper>
          </RoleGuard>
        ),
      },

      // Admin
      {
        path: 'admin',
        element: <RoleGuard roles={['admin', 'super_admin']}><Outlet /></RoleGuard>,
        children: [
          { index: true, element: <Navigate to="settings" replace /> },
          { path: 'users', element: <PageWrapper><UserManagementPage /></PageWrapper> },
          { path: 'users/:userId', element: <PageWrapper><UserDetailPage /></PageWrapper> },
          { path: 'roles', element: <PageWrapper><RoleManagementPage /></PageWrapper> },
          { path: 'settings', element: <PageWrapper><SettingsPage /></PageWrapper> },
          { path: 'drive-folders', element: <PageWrapper><DriveFolderSettingsPage /></PageWrapper> },
          { path: 'shopify-sync', element: <PageWrapper><ShopifySyncPage /></PageWrapper> },
          { path: 'api-keys', element: <PageWrapper><ServiceCredentialsPage /></PageWrapper> },
          { path: 'design-system', element: <PageWrapper><DesignSystemPage /></PageWrapper> },
        ],
      },

      // Profile
      {
        path: 'profile',
        element: <PageWrapper><ProfilePage /></PageWrapper>,
      },

      // ========================================
      // HR CENTRAL ROUTES - with Tab Navigation
      // ========================================
      {
        path: 'hr',
        element: (
          <ModuleGuard module="hr">
            <PageWrapper><HRLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/hr/employees" replace /> },
          { path: 'employees', element: <EmployeeListPage /> },
          { path: 'employees/new', element: <EmployeeCreatePage /> },
          { path: 'employees/:employeeId', element: <EmployeeDetailPage /> },
          { path: 'employees/:employeeId/edit', element: <EmployeeEditPage /> },
          { path: 'leave', element: <LeaveManagementPage /> },
          { path: 'payroll', element: <PayrollPage /> },
          { path: 'payroll/batches', element: <PayrollBatchListPage /> },
          { path: 'payroll/batches/:batchId', element: <PayrollBatchDetailPage /> },
          { path: 'payroll/monthly-runs/:runId', element: <MonthlyPayrollRunDetailPage /> },
          { path: 'org-structure', element: <OrgStructurePage /> },
          // Performance sub-module with its own layout
          {
            path: 'performance',
            element: <PageWrapper><PerformanceLayout /></PageWrapper>,
            children: [
              { index: true, element: <Navigate to="/hr/performance/reviews" replace /> },
              { path: 'reviews', element: <ReviewListPage /> },
              { path: 'reviews/:reviewId', element: <ReviewListPage /> },
              { path: 'goals', element: <GoalListPage /> },
              { path: 'goals/:goalId', element: <GoalListPage /> },
              { path: 'competencies', element: <CompetencyListPage /> },
              { path: 'competencies/new', element: <CompetencyFormPage /> },
              { path: 'competencies/:competencyId/edit', element: <CompetencyFormPage /> },
              { path: 'competencies/:competencyId', element: <CompetencyDetailPage /> },
              { path: 'development', element: <DevelopmentPlanListPage /> },
              { path: 'development/new', element: <DevelopmentPlanFormPage /> },
              { path: 'development/:planId/edit', element: <DevelopmentPlanFormPage /> },
              { path: 'training', element: <TrainingCatalogPage /> },
              { path: 'training/new', element: <TrainingCourseFormPage /> },
              { path: 'training/:courseId', element: <TrainingCourseDetailPage /> },
              { path: 'training/:courseId/edit', element: <TrainingCourseFormPage /> },
            ],
          },
        ],
      },

      // ========================================
      // FINANCE ROUTES - with Tab Navigation
      // ========================================
      {
        path: 'finance',
        element: (
          <ModuleGuard module="finance">
            <PageWrapper><FinanceLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          // Default → Overview
          { index: true, element: <Navigate to="/finance/overview" replace /> },

          // ── Tab 1: Overview (replaces Analysis) — Persistent pill nav ──
          {
            path: 'overview',
            element: <OverviewLayout />,
            children: [
              { index: true, element: <FinanceOverviewPage /> },
              { path: 'kpis', element: <FinanceKPIsPage /> },
              { path: 'kpi-explorer', element: <FinanceKPIExplorerPage /> },
              { path: 'profitability', element: <FinanceProfitabilityPage /> },
              { path: 'cash-flow', element: <FinanceCashFlowPage /> },
              { path: 'growth', element: <FinanceGrowthPage /> },
              { path: 'trend', element: <FinanceTrendPage /> },
              { path: 'goal-seek', element: <FinanceGoalSeekPage /> },
              { path: 'financial-health', element: <FinanceFinancialHealthPage /> },
              { path: 'reports', element: <FinanceReportsLanding /> },
            ],
          },

          // ── Tab 2: Cash & Forecast — Persistent pill nav ──
          {
            path: 'cash',
            element: <CashForecastLayout />,
            children: [
              { index: true, element: <CashForecastLandingPage /> },
              { path: 'forecast', element: <FinanceForecastPage /> },
              { path: 'spend-plan', element: <SpendPlanPage /> },
              { path: 'expenditures', element: <ExpenditureQueuePage /> },
              { path: 'projections', element: <CashProjectionsPage /> },
              { path: 'savings', element: <SavingsTrackerPage /> },
              { path: 'liabilities', element: <LiabilityRegisterPage /> },
              { path: 'briefing', element: <CFOBriefingPage /> },
              { path: 'scenarios', element: <ScenarioAnalysisPage /> },
              { path: 'group', element: <GroupCashFlowPage /> },
              { path: 'receipts', element: <ProjectedReceiptsPage /> },
            ],
          },

          // ── Tab 3: Operations — Persistent pill nav ──
          {
            path: 'operations',
            element: <OperationsLayout />,
            children: [
              { index: true, element: <FinanceOperationsLanding /> },
              { path: 'invoices', element: <FinanceInvoicesPage /> },
              { path: 'bills', element: <FinanceBillsPage /> },
              { path: 'budgets', element: <BudgetSpreadsheetPage /> },
              { path: 'expenses', element: <ExpenseListPage /> },
              { path: 'accountability', element: <FinanceAccountabilityPage /> },
              { path: 'refunds', element: <FinanceRefundsPage /> },
              { path: 'tax-compliance', element: <FinanceTaxCompliancePage /> },
              { path: 'reconciliations', element: <FinanceReconciliationsPage /> },
            ],
          },

          // ── Tab 4: Settings ──
          { path: 'settings', element: <FinanceSettingsLanding /> },
          { path: 'settings/accounts', element: <FinanceChartOfAccounts /> },
          { path: 'settings/integrations', element: <FinanceIntegrationsPage /> },
          { path: 'settings/sync', element: <FinanceQBOSyncDashboard /> },
          { path: 'settings/mappings', element: <FinanceAccountMappingsPage /> },
          { path: 'settings/pricing', element: <FinancePricingAssumptionsPage /> },

          // ── Backward-compatible redirects ──
          // Legacy top-level shortcuts
          { path: 'budgets', element: <Navigate to="/finance/operations/budgets" replace /> },
          { path: 'expenses', element: <Navigate to="/finance/operations/expenses" replace /> },
          { path: 'bills', element: <Navigate to="/finance/operations/bills" replace /> },
          { path: 'invoices', element: <Navigate to="/finance/operations/invoices" replace /> },
          { path: 'accounts', element: <Navigate to="/finance/settings/accounts" replace /> },
          { path: 'integrations', element: <Navigate to="/finance/settings/integrations" replace /> },
          { path: 'admin', element: <Navigate to="/finance/operations/reconciliations" replace /> },
          { path: 'dashboard', element: <Navigate to="/finance/overview" replace /> },
          // Old Analysis routes → Overview
          { path: 'analysis', element: <Navigate to="/finance/overview" replace /> },
          { path: 'analysis/kpis', element: <Navigate to="/finance/overview/kpis" replace /> },
          { path: 'analysis/kpi-explorer', element: <Navigate to="/finance/overview/kpi-explorer" replace /> },
          { path: 'analysis/profitability', element: <Navigate to="/finance/overview/profitability" replace /> },
          { path: 'analysis/cash-flow', element: <Navigate to="/finance/overview/cash-flow" replace /> },
          { path: 'analysis/growth', element: <Navigate to="/finance/overview/growth" replace /> },
          { path: 'analysis/trend', element: <Navigate to="/finance/overview/trend" replace /> },
          { path: 'analysis/goal-seek', element: <Navigate to="/finance/overview/goal-seek" replace /> },
          { path: 'analysis/financial', element: <Navigate to="/finance/overview/financial-health" replace /> },
          { path: 'profitability', element: <Navigate to="/finance/overview/profitability" replace /> },
          { path: 'goal-seek', element: <Navigate to="/finance/overview/goal-seek" replace /> },
          { path: 'cash-flow', element: <Navigate to="/finance/overview/cash-flow" replace /> },
          // Old Forecasting / Reports → Cash / Overview
          { path: 'forecast', element: <Navigate to="/finance/cash/forecast" replace /> },
          { path: 'reports', element: <Navigate to="/finance/overview/reports" replace /> },
          // Old Optimizer routes → Cash
          { path: 'optimizer', element: <Navigate to="/finance/cash" replace /> },
          { path: 'optimizer/dashboard', element: <Navigate to="/finance/cash" replace /> },
          { path: 'optimizer/spend-plan', element: <Navigate to="/finance/cash/spend-plan" replace /> },
          { path: 'optimizer/expenditures', element: <Navigate to="/finance/cash/expenditures" replace /> },
          { path: 'optimizer/projections', element: <Navigate to="/finance/cash/projections" replace /> },
          { path: 'optimizer/savings', element: <Navigate to="/finance/cash/savings" replace /> },
          { path: 'optimizer/liabilities', element: <Navigate to="/finance/cash/liabilities" replace /> },
          { path: 'optimizer/briefing', element: <Navigate to="/finance/cash/briefing" replace /> },
          { path: 'optimizer/scenarios', element: <Navigate to="/finance/cash/scenarios" replace /> },
        ],
      },

      // ========================================
      // PERFORMANCE ROUTES - DEPRECATED (Redirects to HR)
      // Performance is now part of HR Central
      // ========================================
      {
        path: 'performance',
        children: [
          { index: true, element: <Navigate to="/hr/performance/reviews" replace /> },
          { path: 'goals', element: <Navigate to="/hr/performance/goals" replace /> },
          { path: 'goals/:goalId', element: <Navigate to="/hr/performance/goals" replace /> },
          { path: 'reviews', element: <Navigate to="/hr/performance/reviews" replace /> },
          { path: 'reviews/:reviewId', element: <Navigate to="/hr/performance/reviews" replace /> },
          { path: 'competencies', element: <Navigate to="/hr/performance/competencies" replace /> },
          { path: 'development', element: <Navigate to="/hr/performance/development" replace /> },
        ],
      },

      // ========================================
      // CAPITAL HUB ROUTES - Capital seeking, readiness & tracking
      // ========================================
      {
        path: 'capital',
        element: (
          <ModuleGuard module="capital">
            <PageWrapper><CapitalLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/capital/dashboard" replace /> },
          { path: 'dashboard', element: <CapitalDashboardPage /> },
          { path: 'needs', element: <CapitalNeedsPage /> },
          { path: 'products', element: <CapitalProductsPage /> },
          { path: 'readiness', element: <ReadinessPage /> },
          { path: 'applications', element: <CapitalApplicationsPage /> },
          { path: 'applications/:applicationId', element: <CapitalApplicationDetailPage /> },
          { path: 'facilities', element: <CapitalFacilitiesPage /> },
          { path: 'facilities/:facilityId', element: <CapitalFacilityDetailPage /> },
        ],
      },

      // ========================================
      // COMPLIANCE ROUTES - Document management & obligations
      // ========================================
      {
        path: 'compliance',
        element: (
          <ModuleGuard module="compliance">
            <PageWrapper><ComplianceLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <ComplianceDashboardPage /> },
          { path: 'documents', element: <DocumentRegistryPage /> },
          { path: 'obligations', element: <ObligationsPage /> },
        ],
      },

      // ========================================
      // MARKET INTELLIGENCE ROUTES - with Tab Navigation
      // ========================================
      {
        path: 'market-intel',
        element: (
          <ModuleGuard module="market_intelligence">
            <PageWrapper><MarketIntelLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/market-intel/competitors" replace /> },
          { path: 'competitors', element: <MarketCompetitorListPage /> },
          { path: 'competitors/compare', element: <MarketCompetitorComparisonPage /> },
          { path: 'competitors/:competitorId', element: <MarketCompetitorDetailPage /> },
          { path: 'news', element: <MarketNewsFeedPage /> },
          { path: 'market', element: <MarketAnalysisPage /> },
          { path: 'insights', element: <MarketInsightsPage /> },
          { path: 'topics', element: <MarketTopicTrackingPage /> },
          { path: 'social', element: <MarketSocialIntelligencePage /> },
          { path: 'ai-scan', element: <MarketIntelligenceScanPage /> },
        ],
      },

      // ========================================
      // INTELLIGENCE LAYER ROUTES (with tab navigation)
      // ========================================
      {
        path: 'ai',
        element: (
          <ModuleGuard module="intelligence-layer">
            <PageWrapper><IntelligenceLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <IntelligenceLayerDashboard /> },
          {
            path: 'team',
            element: (
              <RoleGuard roles={['manager', 'admin', 'super_admin']}>
                <ManagerDashboardPage />
              </RoleGuard>
            ),
          },
          {
            path: 'admin',
            element: (
              <RoleGuard roles={['admin', 'super_admin']}>
                <IntelligenceAdminPage />
              </RoleGuard>
            ),
          },
        ],
      },

      // Employee Task Inbox (direct access for employees, also uses layout)
      {
        path: 'my-tasks',
        element: <PageWrapper><IntelligenceLayout /></PageWrapper>,
        children: [
          { index: true, element: <EmployeeTaskInboxPage /> },
        ],
      },

      // Unified Messaging Inbox (WhatsApp + Google Chat)
      {
        path: 'messaging',
        children: [
          {
            index: true,
            element: <PageWrapper><UnifiedInboxPage /></PageWrapper>,
          },
          {
            path: 'whatsapp',
            element: <PageWrapper><WhatsAppInboxPage /></PageWrapper>,
          },
          {
            path: 'gchat',
            element: <PageWrapper><GChatInboxPage /></PageWrapper>,
          },
        ],
      },

      // WhatsApp Communication Module (with tab navigation)
      {
        path: 'whatsapp',
        element: (
          <ModuleGuard module="whatsapp">
            <PageWrapper><WhatsAppLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <WhatsAppInboxPage /> },
          { path: 'templates', element: <WhatsAppTemplatesPage /> },
          { path: 'broadcasts', element: <WhatsAppBroadcastsPage /> },
          { path: 'automation', element: <WhatsAppAutomationPage /> },
          { path: 'commerce', element: <WhatsAppCommercePage /> },
          { path: 'settings', element: <WhatsAppSettingsPage /> },
        ],
      },

      // Marketing Hub
      {
        path: 'marketing',
        element: (
          <ModuleGuard module="marketing">
            <PageWrapper><MarketingLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <MarketingDashboardPage /> },
          { path: 'campaigns', element: <CampaignListPage /> },
          { path: 'campaigns/new', element: <CampaignCreatePage /> },
          { path: 'campaigns/:campaignId', element: <CampaignDetailPage /> },
          { path: 'calendar', element: <ContentCalendarPage /> },
          { path: 'templates', element: <TemplateLibraryPage /> },
          { path: 'analytics', element: <AnalyticsReportsPage /> },
          { path: 'media', element: <MediaLibraryPage /> },
          { path: 'agent', element: <MarketingAgentPage /> },
          { path: 'case-studies', element: <ProjectCaseStudiesPage /> },
          { path: 'voices', element: <VoicesPage /> },
          { path: 'press', element: <PressMentionsPage /> },
          { path: 'today', element: <FeaturedUpdatesPage /> },
          { path: 'accounts', element: <SocialAccountsPage /> },
          { path: 'accounts/oauth/meta/callback', element: <SocialOAuthCallbackPage /> },
          { path: 'key-dates/:dateId', element: <KeyDateDetailPage /> },
        ],
      },

      // ========================================
      // STRATEGY MODULE ROUTES
      // ========================================
      {
        path: 'strategy',
        element: (
          <ModuleGuard module="strategy">
            <PageWrapper><StrategyLayout /></PageWrapper>
          </ModuleGuard>
        ),
        children: [
          { index: true, element: <ExecutiveDashboard /> },
          { path: 'dashboard', element: <ExecutiveDashboard /> },
          { path: 'plans', element: <StrategyOverview /> },
          { path: 'plans/review/new', element: <StrategyReviewPage /> },
          { path: 'plans/review/:reviewId', element: <StrategyReviewPage /> },
          { path: 'plans/:planId', element: <StrategyOverview /> },
          { path: 'plans/:planId/review', element: <StrategyReviewPage /> },
          { path: 'okrs', element: <OKRDashboard /> },
          { path: 'okrs/new', element: <OKRDashboard /> },
          { path: 'okrs/:objectiveId', element: <OKRDashboard /> },
          {
            path: 'kpis',
            element: <KPILayout />,
            children: [
              { index: true, element: <KPIOverviewPage /> },
              { path: 'library', element: <KPILibraryPage /> },
              { path: 'active', element: <KPIActivePage /> },
              { path: 'active/:kpiId', element: <KPIActivePage /> },
              { path: 'scorecards', element: <KPIScorecardsPage /> },
              { path: 'new', element: <KPIOverviewPage /> },
            ],
          },
          { path: 'analytics', element: <PerformanceDeepDive /> },
          { path: 'entity/:entityId', element: <PerformanceDeepDive /> },
          { path: 'reports', element: <PerformanceDeepDive /> },
          { path: 'reviews', element: <PerformanceDeepDive /> },
          { path: 'settings', element: <PerformanceDeepDive /> },
        ],
      },
    ],
  },

  // Test routes (DawinOS v2.0 Testing Suite)
  ...testRoutes,

  // Error routes
  {
    path: '/unauthorized',
    element: <PageWrapper><UnauthorizedPage /></PageWrapper>,
  },
  {
    path: '/offline',
    element: <PageWrapper><OfflinePage /></PageWrapper>,
  },
  {
    path: '*',
    element: <PageWrapper><NotFoundPage /></PageWrapper>,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
