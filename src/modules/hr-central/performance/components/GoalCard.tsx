// ============================================================================
// GOAL CARD
// DawinOS v2.0 - HR Module
// Performance goal card component
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { PerformanceGoal } from '../types/performance.types';
import {
  GOAL_STATUS_LABELS,
  GOAL_TYPE_LABELS,
  GoalStatus,
} from '../constants/performance.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface GoalCardProps {
  goal: PerformanceGoal;
  onEdit?: () => void;
  onDelete?: () => void;
  onUpdateProgress?: () => void;
  onComplete?: () => void;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const getStatusColor = (status: GoalStatus): string => {
  const colors: Record<GoalStatus, string> = {
    not_started: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    on_track: 'bg-indigo-100 text-indigo-800',
    at_risk: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    exceeded: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-amber-100 text-amber-800',
    medium: 'bg-blue-100 text-blue-800',
    low: 'bg-gray-100 text-gray-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onEdit,
  onDelete,
  onUpdateProgress,
  onComplete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date instanceof Date ? date.toLocaleDateString() : new Date(date).toLocaleDateString();
  };
  
  const isOverdue = goal.dueDate && new Date(goal.dueDate) < new Date() && 
    goal.status !== 'completed' && goal.status !== 'exceeded';
  
  const progressColor = goal.progress >= 100 ? 'bg-green-500' : 'bg-indigo-600';
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="p-4 flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{goal.title}</h3>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-gray-300 text-gray-700">
                {GOAL_TYPE_LABELS[goal.type]}
              </span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(goal.priority)}`}>
                {goal.priority.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <button
                  onClick={() => { onUpdateProgress?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Update Progress
                </button>
                <button
                  onClick={() => { onEdit?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Goal
                </button>
                <button
                  onClick={() => { onComplete?.(); setMenuOpen(false); }}
                  disabled={goal.status === 'completed' || goal.status === 'exceeded'}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Complete
                </button>
                <button
                  onClick={() => { onDelete?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {goal.description}
        </p>
        
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="font-semibold text-gray-700">{goal.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`${progressColor} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(goal.progress, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Target (if quantitative) */}
        {goal.measurementType === 'quantitative' && goal.targetValue && (
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-700">
              Current: {goal.currentValue?.toLocaleString() || 0} {goal.targetUnit}
            </span>
            <span className="text-gray-500">
              Target: {goal.targetValue.toLocaleString()} {goal.targetUnit}
            </span>
          </div>
        )}
        
        {/* Status & Due Date */}
        <div className="flex justify-between items-center">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
            {GOAL_STATUS_LABELS[goal.status]}
          </span>
          <span className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
            Due: {formatDate(goal.dueDate)}
          </span>
        </div>
      </div>
    </div>
  );
};
