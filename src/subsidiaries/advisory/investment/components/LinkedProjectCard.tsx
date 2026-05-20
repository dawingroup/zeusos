/**
 * LinkedProjectCard - Display linked project within deal view
 */

import React from 'react';
import { useDealProjectLink, useSyncDealWithProject } from '../../shared/hooks/cross-module-hooks';
import { useCurrentUserId } from '@/contexts/AuthContext';

interface LinkedProjectCardProps {
  dealId: string;
  onViewProject?: (projectId: string) => void;
}

export const LinkedProjectCard: React.FC<LinkedProjectCardProps> = ({
  dealId,
  onViewProject,
}) => {
  const { link, loading, error, refresh } = useDealProjectLink(dealId);
  const { sync, loading: syncing } = useSyncDealWithProject();
  const userId = useCurrentUserId();

  const handleSync = async () => {
    try {
      await sync(dealId, userId);
      await refresh();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
        <p className="text-sm text-gray-500 mt-2">Loading linked project...</p>
      </div>
    );
  }
  
  if (error || !link) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="text-sm">No project linked to this deal</span>
        </div>
      </div>
    );
  }
  
  const { projectData, progressMapping, financialMapping } = link;
  const isOverBudget = financialMapping.budgetVariancePercentage > 5;
  const isBehindSchedule = progressMapping.daysAheadOrBehind < -7;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'planning': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{projectData.projectName}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(projectData.projectStatus)}`}>
                {projectData.projectStatus}
              </span>
            </div>
            <p className="text-sm text-gray-500">Linked Delivery Project</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Sync with project"
          >
            <svg className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => onViewProject?.(projectData.projectId)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="View project details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Alerts */}
      {(isOverBudget || isBehindSchedule) && (
        <div className="px-4 py-2 space-y-2">
          {isOverBudget && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Budget variance: {financialMapping.budgetVariancePercentage.toFixed(1)}% over</span>
            </div>
          )}
          {isBehindSchedule && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Schedule: {Math.abs(progressMapping.daysAheadOrBehind)} days behind</span>
            </div>
          )}
        </div>
      )}
      
      {/* Progress Section */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Construction Progress</span>
          <span className="text-lg font-semibold text-blue-600">
            {progressMapping.physicalProgress.toFixed(1)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressMapping.physicalProgress, 100)}%` }}
          />
        </div>
        
        {/* Milestone indicators */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${
            progressMapping.foundationComplete 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            Foundation
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            progressMapping.structureComplete 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            Structure
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            progressMapping.mepComplete 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            MEP
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            progressMapping.handoverComplete 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            Handover
          </span>
        </div>
      </div>
      
      {/* Financial Section */}
      <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Budget</p>
          <p className="text-lg font-semibold text-gray-900">
            ${(financialMapping.currentBudget / 1000000).toFixed(2)}M
          </p>
          {financialMapping.budgetVariance !== 0 && (
            <div className={`flex items-center gap-1 text-xs ${
              financialMapping.budgetVariance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {financialMapping.budgetVariance > 0 ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              <span>
                {financialMapping.budgetVariance > 0 ? '+' : ''}
                ${(Math.abs(financialMapping.budgetVariance) / 1000).toFixed(0)}K
              </span>
            </div>
          )}
        </div>
        
        <div>
          <p className="text-xs text-gray-500 mb-1">Spent to Date</p>
          <p className="text-lg font-semibold text-gray-900">
            ${(financialMapping.totalSpent / 1000000).toFixed(2)}M
          </p>
          <p className="text-xs text-gray-500">
            {((financialMapping.totalSpent / financialMapping.currentBudget) * 100).toFixed(0)}% utilized
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500">Schedule Status</p>
            <p className={`text-sm font-medium ${
              progressMapping.onSchedule ? 'text-green-600' : 'text-amber-600'
            }`}>
              {progressMapping.onSchedule 
                ? 'On Track' 
                : `${Math.abs(progressMapping.daysAheadOrBehind)} days ${progressMapping.daysAheadOrBehind > 0 ? 'ahead' : 'behind'}`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs text-gray-500">Remaining</p>
            <p className="text-sm font-medium text-gray-900">
              ${(financialMapping.totalRemaining / 1000000).toFixed(2)}M
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <button
          onClick={() => onViewProject?.(projectData.projectId)}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Full Project
        </button>
        <span className="text-xs text-gray-500">
          Last synced: {link.lastSyncedAt?.toDate().toLocaleString() || 'Never'}
        </span>
      </div>
    </div>
  );
};

export default LinkedProjectCard;
