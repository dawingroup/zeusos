// ============================================================================
// PERFORMANCE DASHBOARD
// ZeusOS v2.0 - HR Module
// Main performance management dashboard
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Plus,
  ClipboardList,
  Target,
  MessageSquare,
  BarChart3,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ReviewCard } from './ReviewCard';
import { GoalCard } from './GoalCard';
import { usePerformance } from '../hooks/usePerformance';
import { REVIEW_STATUS } from '../constants/performance.constants';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface PerformanceDashboardProps {
  companyId: string;
  employeeId?: string;
  isManager?: boolean;
}

type TabValue = 'reviews' | 'goals' | 'feedback' | 'analytics';

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  companyId,
  employeeId,
  isManager = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabValue>('reviews');
  
  const {
    reviews,
    goals,
    feedback,
    analytics,
    isLoading,
    error,
    loadAnalytics,
  } = usePerformance({
    companyId,
    employeeId,
    autoLoad: true,
  });
  
  // Stats
  const pendingReviews = reviews.filter(
    r => r.status !== REVIEW_STATUS.COMPLETED && r.status !== REVIEW_STATUS.CANCELLED
  ).length;
  const activeGoals = goals.filter(
    g => g.status !== 'completed' && g.status !== 'exceeded' && g.status !== 'cancelled'
  ).length;
  
  // Load analytics when tab changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      const yearStart = new Date();
      yearStart.setMonth(0, 1);
      const yearEnd = new Date();
      yearEnd.setMonth(11, 31);
      loadAnalytics(yearStart, yearEnd);
    }
  }, [activeTab, loadAnalytics]);

  const tabs: Array<{ id: TabValue; label: string; icon: React.ReactNode; managerOnly?: boolean }> = [
    { id: 'reviews', label: 'Reviews', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'goals', label: 'Goals', icon: <Target className="w-4 h-4" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, managerOnly: true },
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Performance Management</h1>
        <div className="flex gap-2">
          {isManager && (
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm">
              <Plus className="w-4 h-4" />
              New Review
            </button>
          )}
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] text-muted-foreground rounded-md hover:bg-[var(--bg-sunken)] font-medium text-sm">
            <Target className="w-4 h-4" />
            Add Goal
          </button>
        </div>
      </div>
      
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Summary Stats */}
      <KPIGrid cols={4}>
        <KPICard label="Pending Reviews" value={pendingReviews} />
        <KPICard label="Active Goals" value={activeGoals} />
        <KPICard label="Feedback Received" value={feedback.length} />
        <KPICard label="Average Rating" value={analytics?.averageRating?.toFixed(1) || '-'} />
      </KPIGrid>
      
      {/* Tabs */}
      <div className="border-b border-[var(--border-subtle)]">
        <nav className="flex gap-4">
          {tabs.map(tab => {
            if (tab.managerOnly && !isManager) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-muted-foreground hover:text-muted-foreground hover:border-[var(--border-default)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      )}
      
      {/* Reviews Tab */}
      {activeTab === 'reviews' && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              isManager={isManager}
            />
          ))}
          {reviews.length === 0 && (
            <div className="col-span-full bg-card rounded-lg border border-[var(--border-subtle)] p-8 text-center">
              <ClipboardList className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground">No Reviews Found</h3>
              <p className="text-muted-foreground">Performance reviews will appear here</p>
            </div>
          )}
        </div>
      )}
      
      {/* Goals Tab */}
      {activeTab === 'goals' && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
          {goals.length === 0 && (
            <div className="col-span-full bg-card rounded-lg border border-[var(--border-subtle)] p-8 text-center">
              <Target className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground">No Goals Set</h3>
              <p className="text-muted-foreground mb-4">Create goals to track your progress</p>
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm">
                <Plus className="w-4 h-4" />
                Add Goal
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Feedback Tab */}
      {activeTab === 'feedback' && !isLoading && (
        <div className="bg-card rounded-lg border border-[var(--border-subtle)] p-6">
          {feedback.length > 0 ? (
            <div className="space-y-4">
              {feedback.map(fb => (
                <div
                  key={fb.id}
                  className="p-4 border border-[var(--border-subtle)] rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-foreground">
                      {fb.isAnonymous ? 'Anonymous' : fb.sourceEmployeeName}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium border border-[var(--border-default)] rounded-full text-muted-foreground">
                      {fb.feedbackType}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{fb.comments}</p>
                  <p className="text-xs text-muted-foreground">
                    {fb.submittedAt?.toDate?.()?.toLocaleDateString() || ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-foreground">No Feedback Yet</h3>
              <p className="text-muted-foreground">Feedback from peers and managers will appear here</p>
            </div>
          )}
        </div>
      )}
      
      {/* Analytics Tab */}
      {activeTab === 'analytics' && !isLoading && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded-lg border border-[var(--border-subtle)] p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Rating Distribution</h3>
            {Object.entries(analytics.ratingDistribution).map(([rating, count]) => (
              <div key={rating} className="flex items-center gap-3 mb-2">
                <span className="text-sm text-muted-foreground w-16">{rating} Star</span>
                <div className="flex-1 h-5 bg-[var(--bg-sunken)] rounded overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded"
                    style={{ width: `${analytics.totalReviews > 0 ? ((count as number) / analytics.totalReviews) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8 text-right">{count as number}</span>
              </div>
            ))}
          </div>
          <div className="bg-card rounded-lg border border-[var(--border-subtle)] p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Department Averages</h3>
            {Object.entries(analytics.departmentAverages).map(([dept, avg]) => (
              <div key={dept} className="flex justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
                <span className="text-sm text-muted-foreground">{dept}</span>
                <span className="text-sm font-semibold text-foreground">{(avg as number).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
