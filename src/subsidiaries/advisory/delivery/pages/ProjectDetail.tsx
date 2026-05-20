/**
 * Project Detail - Comprehensive project view with tabs
 */

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Edit, Trash2, AlertCircle } from 'lucide-react';
import { ProjectHeader } from '../components/projects/ProjectHeader';
import { ProjectTabs, ProjectTabId } from '../components/projects/ProjectTabs';
import { StatCard } from '../components/common/MetricCard';
import { ProgressBar, DualProgressBar } from '../components/common/ProgressBar';
import { SCurveChart } from '../components/charts/SCurveChart';
import { SimpleBudgetBar } from '../components/charts/BudgetBarChart';
import { useProject, useProjectMutations } from '../hooks/project-hooks';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { fmtDate } from '../utils/dates';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProjectTabId>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle tab changes - some tabs navigate to separate pages
  const handleTabChange = (tabId: ProjectTabId) => {
    if (tabId === 'boq') {
      console.log('Navigating to BOQ management page:', `/advisory/delivery/projects/${projectId}/boq`);
      navigate(`/advisory/delivery/projects/${projectId}/boq`);
      return;
    }
    if (tabId === 'payments') {
      navigate(`/advisory/delivery/projects/${projectId}/payments`);
      return;
    }
    if (tabId === 'visits') {
      navigate(`/advisory/delivery/projects/${projectId}/visits`);
      return;
    }
    if (tabId === 'requisitions') {
      navigate(`/advisory/delivery/projects/${projectId}/requisitions`);
      return;
    }
    if (tabId === 'procurement') {
      navigate(`/advisory/delivery/projects/${projectId}/procurement`);
      return;
    }
    setActiveTab(tabId);
  };
  
  const { project, loading, error } = useProject(db, projectId || null);
  const { deleteProject, loading: deleting } = useProjectMutations(db, user?.uid || '');

  const handleDelete = async () => {
    if (!projectId || !user) return;
    try {
      await deleteProject(projectId, 'Deleted by user');
      navigate('/advisory/delivery/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  // Mock S-curve data
  const scurveData = Array.from({ length: 20 }, (_, i) => ({
    weekNumber: i + 1,
    weekStartDate: new Date(2024, 0, 15 + i * 7),
    plannedCumulative: Math.min(100, (i + 1) * 5),
    plannedIncremental: 5,
    actualCumulative: i < 13 ? Math.min(100, (i + 1) * 5 + Math.random() * 5 - 2) : undefined,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading project...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Project not found</h2>
        <p className="text-gray-600 mt-2">The project you're looking for doesn't exist.</p>
        <Link to="/advisory/delivery/projects" className="text-primary hover:underline mt-4 inline-block">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link 
          to="/advisory/delivery/projects" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </Link>
        
        <div className="flex items-center gap-2">
          <Link
            to={`/advisory/delivery/projects/${projectId}/edit`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Confirm?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <ProjectHeader project={project} />

      {/* Tabs */}
      <ProjectTabs {...{ activeTab, onTabChange: handleTabChange } as any} />

      {/* Tab Content */}
      <div className="bg-white rounded-lg border">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Physical Progress"
                value={`${project.progress.physicalProgress}%`}
                variant={project.progress.progressStatus === 'on_track' ? 'success' : 'warning'}
              />
              <StatCard
                label="Financial Progress"
                value={`${project.progress.financialProgress}%`}
              />
              <StatCard
                label="Days Remaining"
                value={project.timeline.daysRemaining}
              />
              <StatCard
                label="Budget Status"
                value={project.budget.varianceStatus.replace('_', ' ')}
                variant={(project.budget.varianceStatus as string) === 'on_budget' ? 'success' : 'warning'}
              />
            </div>

            {/* Progress section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Progress Overview</h3>
                <DualProgressBar
                  physical={project.progress.physicalProgress}
                  financial={project.progress.financialProgress}
                />
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Budget Utilization</h3>
                <SimpleBudgetBar
                  allocated={project.budget.totalBudget}
                  spent={project.budget.spent}
                  committed={project.budget.committed}
                  currency={project.budget.currency}
                  compact
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="p-6 space-y-6">
            <SCurveChart data={scurveData} currentWeek={13} height={350} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Physical Progress</h3>
                <ProgressBar 
                  value={project.progress.physicalProgress}
                  status={project.progress.progressStatus}
                  size="lg"
                  showLabel
                />
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">Financial Progress</h3>
                <ProgressBar 
                  value={project.progress.financialProgress}
                  size="lg"
                  showLabel
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Budget Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Budget" value={`UGX ${(project.budget.totalBudget / 1000000).toFixed(0)}M`} />
              <StatCard label="Spent" value={`UGX ${(project.budget.spent / 1000000).toFixed(0)}M`} />
              <StatCard label="Committed" value={`UGX ${(project.budget.committed / 1000000).toFixed(0)}M`} />
              <StatCard label="Remaining" value={`UGX ${(project.budget.remaining / 1000000).toFixed(0)}M`} variant="success" />
            </div>
            <SimpleBudgetBar
              allocated={project.budget.totalBudget}
              spent={project.budget.spent}
              committed={project.budget.committed}
              currency={project.budget.currency}
            />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Timeline</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Start Date"
                value={fmtDate(project.timeline.currentStartDate as never)}
              />
              <StatCard
                label="End Date"
                value={fmtDate(project.timeline.currentEndDate as never)}
              />
              <StatCard label="Duration" value={`${project.timeline.currentDuration} days`} />
              <StatCard 
                label="Time Elapsed" 
                value={`${project.timeline.percentTimeElapsed}%`} 
              />
            </div>
            
            {project.timeline.isDelayed && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                ⚠️ Project is delayed by {project.timeline.delayDays} days
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">
              {project.implementationType === 'contractor' ? 'Contractor' : 'Site Team'}
            </h3>
            
            {project.contractor && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-lg">{project.contractor.companyName}</div>
                <div className="text-gray-600 mt-1">Contract: {project.contractor.contractNumber}</div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-sm text-gray-500">Contact Person</div>
                    <div className="font-medium">{project.contractor.contactPerson?.name}</div>
                    <div className="text-sm text-gray-600">{project.contractor.contactPerson?.role}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Contract Value</div>
                    <div className="font-medium">
                      UGX {((project.contractor.contractValue ?? 0) / 1000000).toFixed(0)}M
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(activeTab === 'scope' || activeTab === 'documents') && (
          <div className="p-6 text-center text-gray-500">
            <p>Content for {activeTab} tab coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
}
