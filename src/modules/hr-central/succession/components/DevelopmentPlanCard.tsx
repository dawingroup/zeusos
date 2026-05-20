// ============================================================================
// DEVELOPMENT PLAN CARD
// DawinOS v2.0 - HR Module
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
      case 'active': return 'text-green-600 bg-green-50';
      case 'draft': return 'text-gray-600 bg-gray-100';
      case 'on_hold': return 'text-amber-600 bg-amber-50';
      case 'completed': return 'text-blue-600 bg-blue-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const completedActions = plan.actions.filter(a => a.status === 'completed').length;
  const inProgressActions = plan.actions.filter(a => a.status === 'in_progress').length;
  const totalActions = plan.actions.length;

  const getProgressColor = () => {
    if (plan.overallProgress >= 70) return 'bg-green-500';
    if (plan.overallProgress >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const isOverdue = plan.targetDate.toDate() < new Date() && plan.status === 'active';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(plan)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{plan.employeeName}</h3>
              {plan.targetRoleTitle && (
                <p className="text-sm text-gray-500">Target: {plan.targetRoleTitle}</p>
              )}
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor()}`}>
            {plan.status.replace('_', ' ')}
          </span>
        </div>

        {/* Objective */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{plan.objective}</p>

        {/* Target Readiness */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">Target:</span>
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
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Overall Progress</span>
            <span>{plan.overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ width: `${plan.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Actions Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="flex items-center justify-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="font-bold text-gray-900">{completedActions}</span>
            </div>
            <p className="text-xs text-gray-500">Done</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-gray-900">{inProgressActions}</span>
            </div>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="font-bold text-gray-900">{totalActions - completedActions - inProgressActions}</span>
            </div>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        {/* Action Types */}
        <div className="flex flex-wrap gap-1 mb-3">
          {plan.actions.slice(0, 3).map((action) => (
            <span
              key={action.id}
              className={`px-2 py-0.5 text-xs rounded ${
                action.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : action.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {DEVELOPMENT_ACTION_LABELS[action.type]}
            </span>
          ))}
          {plan.actions.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-gray-500">
              +{plan.actions.length - 3}
            </span>
          )}
        </div>

        {/* Target Date */}
        <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
          <Calendar className="w-4 h-4" />
          <span>
            Target: {plan.targetDate.toDate().toLocaleDateString()}
            {isOverdue && ' (Overdue)'}
          </span>
        </div>

        {/* Mentor/Sponsor */}
        {(plan.mentorId || plan.sponsorId) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
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
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        {plan.status === 'draft' && onActivate ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActivate(plan.id);
            }}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded font-medium"
          >
            Activate Plan
          </button>
        ) : (
          <span className="text-sm text-gray-500">
            {plan.actions.filter(a => a.status === 'completed').length}/{plan.actions.length} actions completed
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
};

export default DevelopmentPlanCard;
