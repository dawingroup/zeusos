// ============================================================================
// GOAL CARD
// ZeusOS v2.0 - HR Module
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
    not_started: 'bg-[var(--bg-sunken)] text-foreground',
    in_progress: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    on_track: 'bg-indigo-100 text-indigo-800',
    at_risk: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    completed: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
    exceeded: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
    cancelled: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  };
  return colors[status] || 'bg-[var(--bg-sunken)] text-foreground';
};

const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    critical: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
    high: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    medium: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    low: 'bg-[var(--bg-sunken)] text-foreground',
  };
  return colors[priority] || 'bg-[var(--bg-sunken)] text-foreground';
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
  
  const progressColor = goal.progress >= 100 ? 'bg-[var(--rag-green)]' : 'bg-indigo-600';
  
  return (
    <div className="bg-card rounded-lg border border-[var(--border-subtle)] shadow-sm h-full flex flex-col">
      <div className="p-4 flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{goal.title}</h3>
            <div className="flex gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-[var(--border-default)] text-muted-foreground">
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
              className="p-1 hover:bg-[var(--bg-sunken)] rounded-full"
            >
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-card rounded-md shadow-lg border border-[var(--border-subtle)] z-10">
                <button
                  onClick={() => { onUpdateProgress?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-sunken)] flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Update Progress
                </button>
                <button
                  onClick={() => { onEdit?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-sunken)] flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Goal
                </button>
                <button
                  onClick={() => { onComplete?.(); setMenuOpen(false); }}
                  disabled={goal.status === 'completed' || goal.status === 'exceeded'}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-sunken)] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Complete
                </button>
                <button
                  onClick={() => { onDelete?.(); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-sunken)] flex items-center gap-2 text-[var(--rag-red)]"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {goal.description}
        </p>
        
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-muted-foreground">{goal.progress}%</span>
          </div>
          <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2">
            <div 
              className={`${progressColor} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(goal.progress, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Target (if quantitative) */}
        {goal.measurementType === 'quantitative' && goal.targetValue && (
          <div className="flex justify-between text-sm mb-3">
            <span className="text-muted-foreground">
              Current: {goal.currentValue?.toLocaleString() || 0} {goal.targetUnit}
            </span>
            <span className="text-muted-foreground">
              Target: {goal.targetValue.toLocaleString()} {goal.targetUnit}
            </span>
          </div>
        )}
        
        {/* Status & Due Date */}
        <div className="flex justify-between items-center">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
            {GOAL_STATUS_LABELS[goal.status]}
          </span>
          <span className={`text-xs ${isOverdue ? 'text-[var(--rag-red)]' : 'text-muted-foreground'}`}>
            Due: {formatDate(goal.dueDate)}
          </span>
        </div>
      </div>
    </div>
  );
};
