/**
 * Project Budget Page
 * Interactive budget dashboard with live data from BOQ, requisitions, and payments
 */

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';
import { useProjectBudgetData } from '../hooks/useProjectBudgetData';
import {
  BudgetSummaryCards,
  BudgetDonutChart,
  BudgetCategoryBreakdown,
  RequisitionSpendingSummary,
  SpendingTimeline,
  BudgetLinesTable,
  VarianceAlertsBanner,
  EditBudgetDialog,
} from '../components/budget';

export function ProjectBudgetPage() {
  const { project } = useOutletContext<ProjectOutletContext>();
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const budgetData = useProjectBudgetData(db, project, user?.uid || '');

  if (budgetData.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading budget data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Variance Alerts */}
      <VarianceAlertsBanner
        alerts={budgetData.alerts}
        currency={project.budget.currency}
      />

      {/* Summary Cards + Edit trigger */}
      <BudgetSummaryCards
        budget={budgetData.budget}
        summary={budgetData.summary}
        requisitionSummary={budgetData.requisitionSummary}
        onEditBudget={() => setEditDialogOpen(true)}
      />

      {/* Two-column: Donut + Requisition Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetDonutChart
          segments={budgetData.donutSegments}
          totalBudget={project.budget.totalBudget}
          currency={project.budget.currency}
        />
        <RequisitionSpendingSummary
          requisitionSummary={budgetData.requisitionSummary}
          currency={project.budget.currency}
        />
      </div>

      {/* Category Breakdown */}
      <BudgetCategoryBreakdown
        categories={budgetData.categoryBreakdown}
        currency={project.budget.currency}
      />

      {/* Spending Timeline */}
      <SpendingTimeline
        entries={budgetData.spendingTimeline}
        totalBudget={project.budget.totalBudget}
        currency={project.budget.currency}
      />

      {/* Budget Lines Table */}
      <BudgetLinesTable
        lines={budgetData.budgetLines}
        currency={project.budget.currency}
      />

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={() => budgetData.refresh()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {/* Edit Budget Dialog */}
      <EditBudgetDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        currentBudget={project.budget}
        onSave={budgetData.updateBudget}
        saving={budgetData.budgetUpdateLoading}
      />
    </div>
  );
}

export default ProjectBudgetPage;
