/**
 * Delivery Module Routes
 * With nested routing for persistent project navigation
 *
 * Includes integrated MatFlow features (BOQ, Materials, Formulas, etc.)
 * And Manual Requisition Backlog for legacy data migration
 */

import { Route, Routes, Navigate } from 'react-router-dom';
import { DeliveryLayout } from './components/DeliveryLayout';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { ProjectList } from './pages/ProjectList';
import { ProgramList } from './pages/ProgramList';
import { ProgramDetail } from './pages/ProgramDetail';
import { NewProgram } from './pages/NewProgram';
import { NewProject } from './pages/NewProject';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { NewBOQRequisitionPage } from './pages/NewBOQRequisitionPage';
// ADD-FIN-001 Enhanced Forms
import { RequisitionFormEnhanced } from './components/forms/RequisitionFormEnhanced';
import { AccountabilityFormEnhanced } from './components/forms/AccountabilityFormEnhanced';
// Hierarchical Requisitions
import { ChildRequisitionFormPage } from './pages/ChildRequisitionFormPage';

// Project Layout and Pages
import { ProjectLayout } from './components/projects/ProjectLayout';
import { ProjectOverview } from './pages/ProjectOverview';
import { ProjectProgressPage } from './pages/ProjectProgressPage';
import { ProjectBudgetPage } from './pages/ProjectBudgetPage';
import { ProjectTimelinePage } from './pages/ProjectTimelinePage';
import { ProjectTeamPage } from './pages/ProjectTeamPage';
import { ProjectScopePage } from './pages/ProjectScopePage';
import { ProjectDocumentsPage } from './pages/ProjectDocumentsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SiteVisitsPage } from './pages/SiteVisitsPage';
import { RequisitionsPage } from './pages/RequisitionsPage';
import { RequisitionDetailPage } from './pages/RequisitionDetailPage';
import { AccountabilityDetailPage } from './pages/AccountabilityDetailPage';
import { AccountabilityOverviewPage } from './pages/AccountabilityOverviewPage';
import { RequisitionTrackerPage } from './pages/RequisitionTrackerPage';

// Manual Requisition Backlog pages (legacy data migration)
import { ManualRequisitionListPage } from './pages/ManualRequisitionListPage';
import { ManualRequisitionFormPage } from './pages/ManualRequisitionFormPage';
import { ManualRequisitionDetailPage } from './pages/ManualRequisitionDetailPage';

// Reports (Google Docs report generation)
import { ReportsPage } from './pages/ReportsPage';

// Template Management (admin)
import { TemplateManagementPage } from './pages/TemplateManagementPage';

// Quick Capture
import { QuickCapturesPage } from './pages/QuickCapturesPage';
import { QuickCaptureFormPage } from './pages/QuickCaptureFormPage';

// Allocation Groups
import { AllocationGroupDetailPage } from './pages/AllocationGroupDetailPage';

// AMH Reports & Reconciliation
import { AMHReportWizard } from './reports/components/AMHReportWizard';
import { DataReconciliationPage } from './pages/DataReconciliationPage';

// Data Migration utility
import { DataMigrationPage } from './pages/DataMigrationPage';

// Data Recovery utility
import { DataRecoveryPage } from './pages/DataRecoveryPage';

// Project Settings
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';

// Schedule Management
import { ProjectSchedulePage } from './pages/ProjectSchedulePage';

// Program Budget
import { ProgramBudgetPage } from './pages/ProgramBudgetPage';

// Fund Transfer Detail
import { FundTransferDetailPage } from './pages/FundTransferDetailPage';

// Edit Project
import { EditProject } from './pages/EditProject';

// Payment Detail
import { PaymentDetailPage } from './pages/PaymentDetailPage';

// MatFlow feature imports (integrated) - all use default exports
import BOQImport from '../matflow/pages/BOQImport';
import BOQImportReview from '../matflow/pages/BOQImportReview';
import BOQManagement from '../matflow/pages/BOQManagement';
import MaterialLibrary from '../matflow/pages/MaterialLibrary';
import MaterialForecast from '../matflow/pages/MaterialForecast';
import FormulaDatabase from '../matflow/pages/FormulaDatabase';
import MatFlowProcurement from '../matflow/pages/ProcurementPage';
import SuppliersPage from '../matflow/pages/SuppliersPage';
import MatFlowReports from '../matflow/pages/Reports';

export function DeliveryRoutes() {
  return (
    <Routes>
      <Route element={<DeliveryLayout />}>
        <Route index element={<DeliveryDashboard />} />

        {/* Programs */}
        <Route path="programs" element={<ProgramList />} />
        <Route path="programs/new" element={<NewProgram />} />
        <Route path="programs/:programId" element={<ProgramDetail />} />
        <Route path="programs/:programId/budget" element={<ProgramBudgetPage />} />
        <Route path="programs/:programId/transfers/:transferId" element={<FundTransferDetailPage />} />

        {/* Projects List */}
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:projectId/edit" element={<EditProject />} />

        {/* Project Detail with Nested Routes - All routes under ProjectLayout */}
        <Route path="projects/:projectId" element={<ProjectLayout />}>
          {/* Index route - Overview */}
          <Route index element={<ProjectOverview />} />

          {/* BOQ with sub-routes for view modes */}
          <Route path="boq">
            <Route index element={<Navigate to="summary" replace />} />
            <Route path="summary" element={<BOQManagement />} />
            <Route path="details" element={<BOQManagement />} />
            <Route path="materials" element={<BOQManagement />} />
            <Route path="import" element={<BOQImport />} />
            <Route path="review/:jobId" element={<BOQImportReview />} />
          </Route>

          {/* Project Sections */}
          <Route path="scope" element={<ProjectScopePage />} />
          <Route path="budget" element={<ProjectBudgetPage />} />
          <Route path="progress" element={<ProjectProgressPage />} />
          <Route path="timeline" element={<ProjectTimelinePage />} />
          <Route path="schedule" element={<ProjectSchedulePage />} />
          <Route path="team" element={<ProjectTeamPage />} />
          <Route path="documents" element={<ProjectDocumentsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/:paymentId" element={<PaymentDetailPage />} />
          <Route path="visits" element={<SiteVisitsPage />} />
          <Route path="procurement" element={<MatFlowProcurement />} />
          <Route path="tracker" element={<RequisitionTrackerPage />} />

          {/* Requisitions with nested detail routes */}
          <Route path="requisitions">
            <Route index element={<RequisitionsPage />} />
            <Route path="new" element={<NewBOQRequisitionPage />} />
            <Route path="new/manual" element={<RequisitionFormEnhanced />} />
            <Route path="new/child" element={<ChildRequisitionFormPage />} />
            <Route path=":requisitionId" element={<RequisitionDetailPage />} />
            <Route path=":requisitionId/edit" element={<RequisitionFormEnhanced />} />
            <Route path=":requisitionId/accountability/new" element={<AccountabilityFormEnhanced />} />
          </Route>

          {/* Accountabilities under project context */}
          <Route path="accountabilities/:accountabilityId" element={<AccountabilityDetailPage />} />

          {/* Project Settings (branding, configuration) */}
          <Route path="settings" element={<ProjectSettingsPage />} />

          {/* Reports (Google Docs report generation) */}
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        {/* Module-Level Routes (not project-specific) */}
        <Route path="approvals" element={<ApprovalsPage />} />

        {/* Quick Captures (field expenditure recording) */}
        <Route path="quick-captures" element={<QuickCapturesPage />} />
        <Route path="quick-captures/new" element={<QuickCaptureFormPage />} />
        <Route path="quick-captures/:id/edit" element={<QuickCaptureFormPage />} />

        {/* Allocation Groups (multi-project splits) */}
        <Route path="allocations/:groupId" element={<AllocationGroupDetailPage />} />

        {/* Accountability Overview (module-level) */}
        <Route path="accountability" element={<AccountabilityOverviewPage />} />

        {/* AMH Reports (Accountability, Monitoring & Harmonization) */}
        <Route path="amh-reports" element={<AMHReportWizard />} />

        {/* Data Reconciliation */}
        <Route path="reconciliation" element={<DataReconciliationPage />} />

        {/* Manual Requisition Backlog (legacy data migration) */}
        <Route path="backlog" element={<ManualRequisitionListPage />} />
        <Route path="backlog/new" element={<ManualRequisitionFormPage />} />
        <Route path="backlog/:requisitionId" element={<ManualRequisitionDetailPage />} />
        <Route path="backlog/:requisitionId/edit" element={<ManualRequisitionFormPage />} />

        {/* MatFlow Integration - Material Library */}
        <Route path="materials">
          <Route index element={<MaterialLibrary />} />
          <Route path="forecast" element={<MaterialForecast />} />
        </Route>

        {/* MatFlow Integration - Formula Database */}
        <Route path="formulas" element={<FormulaDatabase />} />

        {/* MatFlow Integration - Suppliers */}
        <Route path="suppliers" element={<SuppliersPage />} />

        {/* MatFlow Integration - Reports */}
        <Route path="reports" element={<MatFlowReports />} />

        {/* Data Migration utility (admin) */}
        <Route path="data-migration" element={<DataMigrationPage />} />

        {/* Data Recovery utility (admin) */}
        <Route path="data-recovery" element={<DataRecoveryPage />} />

        {/* Report Template Management (admin) */}
        <Route path="templates" element={<TemplateManagementPage />} />
      </Route>
    </Routes>
  );
}
