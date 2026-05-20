/**
 * Review Summary Component
 * Displays statistics and import action for reviewed items
 */

import React from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calculator,
  Clock,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import type { ReviewStats } from '../../utils/reviewHelpers';

interface ReviewSummaryProps {
  stats: ReviewStats;
  projectName: string;
  fileName: string;
  onProceedImport: () => void;
  onCancel: () => void;
  isImporting: boolean;
}

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  stats,
  projectName,
  fileName,
  onProceedImport,
  onCancel,
  isImporting,
}) => {
  const approvalProgress = stats.total > 0 
    ? Math.round((stats.approved / stats.total) * 100) 
    : 0;
  
  const canProceed = stats.approved > 0 && !isImporting;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Review Summary</h3>
          <p className="text-sm text-gray-500 mt-1">
            Importing to: <span className="font-medium">{projectName}</span>
          </p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <FileText size={12} />
            {fileName}
          </p>
        </div>
        
        {/* Progress ring */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="#22c55e"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${approvalProgress * 2.26} 226`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-900">{approvalProgress}%</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={FileText}
          label="Total Items"
          value={stats.total}
          color="gray"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={stats.approved}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={stats.pending}
          color="amber"
        />
        <StatCard
          icon={XCircle}
          label="Rejected"
          value={stats.rejected}
          color="red"
        />
      </div>

      {/* Quality indicators */}
      <div className="space-y-3 pt-4 border-t border-gray-100">
        <QualityIndicator
          icon={TrendingUp}
          label="High Confidence"
          value={stats.highConfidence}
          total={stats.total}
          color="green"
        />
        <QualityIndicator
          icon={Calculator}
          label="With Formula"
          value={stats.withFormula}
          total={stats.total}
          color="blue"
        />
      </div>

      {/* Warnings */}
      {(stats.lowConfidence > 0 || stats.withErrors > 0) && (
        <div className="space-y-2">
          {stats.lowConfidence > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm text-amber-700">
                <strong>{stats.lowConfidence}</strong> items have low confidence
              </span>
            </div>
          )}
          {stats.withErrors > 0 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle size={18} className="text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">
                <strong>{stats.withErrors}</strong> items have errors
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onProceedImport}
          disabled={!canProceed}
          className={`
            flex items-center justify-center gap-2 w-full px-6 py-3 rounded-lg font-medium
            ${canProceed
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isImporting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Import {stats.approved} Items
            </>
          )}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          disabled={isImporting}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-400 text-center">
        Only approved items will be imported. Rejected items will be skipped.
      </p>
    </div>
  );
};

/**
 * Stat card component
 */
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'gray' | 'green' | 'amber' | 'red' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, color }) => {
  const TONE_BG: Record<StatCardProps['color'], string> = {
    gray: 'var(--bg-sunken)',
    green: 'var(--rag-green-soft)',
    amber: 'var(--rag-amber-soft)',
    red: 'var(--rag-red-soft)',
    blue: 'var(--rag-blue-soft)',
  };
  const TONE_FG: Record<StatCardProps['color'], string> = {
    gray: 'var(--fg-secondary)',
    green: 'var(--rag-green)',
    amber: 'var(--rag-amber)',
    red: 'var(--rag-red)',
    blue: 'var(--rag-blue)',
  };

  return (
    <div
      className="flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)] p-3"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="p-1 rounded-md grid place-items-center"
          style={{ backgroundColor: TONE_BG[color], color: TONE_FG[color] }}
        >
          <Icon size={14} />
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {label}
        </span>
      </div>
      <span
        className="text-[26px] font-semibold tabular-nums"
        style={{
          color: TONE_FG[color],
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}
      >
        {value}
      </span>
    </div>
  );
};

/**
 * Quality indicator component
 */
interface QualityIndicatorProps {
  icon: React.ElementType;
  label: string;
  value: number;
  total: number;
  color: 'green' | 'blue';
}

const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  icon: Icon,
  label,
  value,
  total,
  color,
}) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorMap = {
    green: { bar: 'bg-green-500', text: 'text-green-600' },
    blue: { bar: 'bg-blue-500', text: 'text-blue-600' },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-1 text-sm ${colorMap[color].text}`}>
          <Icon size={14} />
          {label}
        </div>
        <span className="text-sm font-medium text-gray-700">
          {value}/{total}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color].bar} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ReviewSummary;
