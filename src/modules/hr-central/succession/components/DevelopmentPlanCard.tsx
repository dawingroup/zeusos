// ============================================================================
// DEVELOPMENT PLAN CARD
// ZeusOS v2.0 - HR Module
// Displays a development plan with progress
// ============================================================================

import React from 'react';
import {
  Target,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
} from 'lucide-react';
import { DevelopmentPlan } from '../types/succession.types';
import {
  READINESS_LABELS,
  READINESS_COLORS,
  DEVELOPMENT_ACTION_LABELS,
} from '../constants/succession.constants';

interface DevelopmentPlanCardProps {
  plan: DevelopmentPlan;
  onSelect?: (plan: DevelopmentPlan) => void;
  onActivate?: (planId: string) => void;
}

export const DevelopmentPlanCard: React.FC<DevelopmentPlanCardProps> = ({
  plan,
  onSelect,
  onActivate,
}) => {
  const getStatusColor = () => {
    switch (plan.status) {
      case 'active': return 'text-[var(--rag-green)] bg-[var(--rag-green-soft)]';
      case 'draft': return 'text-muted-foreground bg-[var(--bg-sunken)]';
      case 'on_hold': return 'text-[var(--rag-amber)] bg-[var(--rag-amber-soft)]';
      case 'completed': return 'text-[var(--rag-blue)] bg-[var(--rag-blue-soft)]';
      case 'cancelled': return 'text-[var(--rag-red)] bg-[var(--rag-red-soft)]';
      default: return 'text-muted-foreground bg-[var(--bg-sunken)]';
    }
  };

  const completedActions = plan.actions.filter(a => a.status === 'completed').length;
  const inProgressActions = plan.actions.filter(a => a.status === 'in_progress').length;
  const totalActions = plan.actions.length;

  const getProgressColor = () => {
    if (plan.overallProgress >= 70) return 'bg-[var(--rag-green)]';
    if (plan.overallProgress >= 40) return 'bg-[var(--rag-amber)]';
    return 'bg-[var(--rag-red)]';
  };

  const isOverdue = plan.targetDate.toDate() < new Date() && plan.status === 'active';

  return (
    <div
      className="bg-card rounded-lg border border-[var(--border-subtle)] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(plan)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--rag-blue-soft)] flex items-center justify-center">
              <Target className="w-5 h-5 text-[var(--rag-blue)]" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{plan.employeeName}</h3>
              {plan.targetRoleTitle && (
                <p className="text-sm text-muted-foreground">Target: {plan.targetRoleTitle}</p>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor()}`}>
            {plan.status.replace('_', ' ')}
          </span>
        </div>

        {/* Objective */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{plan.objective}</p>

        {/* Target Readiness */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">Target:</span>
          <span
            className="px-2 py-1 text-xs font-medium rounded"
            style={{
              backgroundColor: `${READINESS_COLORS[plan.targetReadiness]}20`,
              color: READINESS_COLORS[plan.targetReadiness],
            }}
          >
            {READINESS_LABELS[plan.targetReadiness]}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Overall Progress</span>
            <span>{plan.overallProgress}%</span>
          </div>
          <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${plan.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Actions Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="w-4 h-4 text-[var(--rag-green)]" />
              <span className="font-bold text-foreground">{completedActions}</span>
            </div>
            <p className="text-xs text-muted-foreground">Done</p>
          </div>
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-[var(--rag-amber)]" />
              <span className="font-bold text-foreground">{inProgressActions}</span>
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4 text-[var(--fg-tertiary)]" />
              <span className="font-bold text-foreground">{totalActions - completedActions - inProgressActions}</span>
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Action Types */}
        <div className="flex flex-wrap gap-1 mb-3">
          {plan.actions.slice(0, 3).map((action) => (
            <span
              key={action.id}
              className={`px-2 py-0.5 text-xs rounded ${
                action.status === 'completed'
                  ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'
                  : action.status === 'in_progress'
                  ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                  : 'bg-[var(--bg-sunken)] text-muted-foreground'
              }`}
            >
              {DEVELOPMENT_ACTION_LABELS[action.type]}
            </span>
          ))}
          {plan.actions.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-muted-foreground">
              +{plan.actions.length - 3}
            </span>
          )}
        </div>

        {/* Target Date */}
        <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-[var(--rag-red)]' : 'text-muted-foreground'}`}>
          <Calendar className="w-4 h-4" />
          <span>
            Target: {plan.targetDate.toDate().toLocaleDateString()}
            {isOverdue && ' (Overdue)'}
          </span>
        </div>

        {/* Mentor/Sponsor */}
        {(plan.mentorId || plan.sponsorId) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>
              {plan.sponsorId && 'Sponsored'}
              {plan.sponsorId && plan.mentorId && ' • '}
              {plan.mentorId && 'Mentored'}
            </span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex justify-between items-center">
        {plan.status === 'draft' && onActivate ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActivate(plan.id);
            }}
            className="text-sm text-white bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] px-3 py-1 rounded font-medium"
          >
            Activate Plan
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">
            {plan.actions.filter(a => a.status === 'completed').length}/{plan.actions.length} actions completed
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-[var(--fg-tertiary)]" />
      </div>
    </div>
  );
};

export default DevelopmentPlanCard;
