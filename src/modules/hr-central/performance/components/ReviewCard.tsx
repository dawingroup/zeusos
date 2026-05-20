// ============================================================================
// REVIEW CARD
// DawinOS v2.0 - HR Module
// Performance review summary card
// ============================================================================

import React from 'react';
import {
  ClipboardList,
  User,
  Calendar,
  Star,
} from 'lucide-react';
import { PerformanceReview } from '../types/performance.types';
import {
  REVIEW_STATUS_LABELS,
  REVIEW_CYCLE_LABELS,
  FIVE_POINT_RATINGS,
  ReviewStatus,
} from '../constants/performance.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ReviewCardProps {
  review: PerformanceReview;
  onView?: () => void;
  onAction?: () => void;
  isManager?: boolean;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

const getStatusColor = (status: ReviewStatus): string => {
  const colors: Record<ReviewStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    self_assessment: 'bg-blue-100 text-blue-800',
    manager_review: 'bg-indigo-100 text-indigo-800',
    calibration: 'bg-purple-100 text-purple-800',
    acknowledgement: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  onView,
  onAction,
  isManager = false,
}) => {
  const progress = (review.currentStep / review.totalSteps) * 100;
  
  const getRatingLabel = (rating?: number) => {
    if (!rating) return null;
    const rounded = Math.round(rating);
    return Object.values(FIVE_POINT_RATINGS).find(r => r.value === rounded)?.label || `${rating.toFixed(1)}`;
  };
  
  const getActionLabel = () => {
    switch (review.status) {
      case 'draft':
        return isManager ? 'Start Review' : null;
      case 'self_assessment':
        return isManager ? 'Awaiting Self Assessment' : 'Complete Self Assessment';
      case 'manager_review':
        return isManager ? 'Complete Assessment' : 'Awaiting Manager Review';
      case 'acknowledgement':
        return isManager ? 'Awaiting Acknowledgement' : 'Acknowledge Review';
      default:
        return null;
    }
  };
  
  const actionLabel = getActionLabel();
  const canTakeAction = actionLabel && !actionLabel.startsWith('Awaiting');
  
  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date instanceof Date ? date.toLocaleDateString() : new Date(date).toLocaleDateString();
  };

  const isOverdue = review.dueDate && new Date(review.dueDate) < new Date();
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{review.employeeName}</h3>
              <p className="text-sm text-gray-500">{review.employeePosition}</p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(review.status)}`}>
            {REVIEW_STATUS_LABELS[review.status]}
          </span>
        </div>
        
        {/* Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{REVIEW_CYCLE_LABELS[review.reviewCycle]}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-4 h-4 text-gray-400" />
            <span>Manager: {review.managerName}</span>
          </div>
          <p className="text-sm text-gray-500">
            Period: {formatDate(review.periodStart)} - {formatDate(review.periodEnd)}
          </p>
        </div>
        
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{review.currentStep}/{review.totalSteps} steps</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        {/* Rating (if completed) */}
        {review.finalRating && (
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span className="font-medium text-gray-900">
              {review.finalRating.toFixed(1)} - {getRatingLabel(review.finalRating)}
            </span>
          </div>
        )}
        
        {/* Due Date */}
        <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
          Due: {formatDate(review.dueDate)}
        </p>
      </div>
      
      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={onView}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          View Details
        </button>
        {canTakeAction && (
          <button
            onClick={onAction}
            className="ml-auto px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
