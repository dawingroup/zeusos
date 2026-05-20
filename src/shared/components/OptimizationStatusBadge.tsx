/**
 * Optimization Status Badge Component
 * Displays optimization state with color-coded indicator and re-optimize action
 */

import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, Loader2, XCircle, Info } from 'lucide-react';
import type { OptimizationStatus } from '@/shared/services/optimization/changeDetection';

// ============================================
// Types
// ============================================

export interface OptimizationStatusBadgeProps {
  status: OptimizationStatus | null;
  onReOptimize?: () => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showReasons?: boolean;
}

// ============================================
// Status Configuration
// ============================================

const STATUS_CONFIG = {
  fresh: {
    color: 'bg-green-100 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
    icon: CheckCircle,
    label: 'Up to date',
    description: 'Optimization results are current',
  },
  stale: {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dotColor: 'bg-yellow-500',
    icon: AlertTriangle,
    label: 'Needs update',
    description: 'Changes detected - re-optimization recommended',
  },
  optimizing: {
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
    icon: Loader2,
    label: 'Optimizing...',
    description: 'Optimization in progress',
  },
  error: {
    color: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    icon: XCircle,
    label: 'Error',
    description: 'Optimization failed',
  },
  unknown: {
    color: 'bg-gray-100 text-gray-500 border-gray-200',
    dotColor: 'bg-gray-400',
    icon: Info,
    label: 'Not optimized',
    description: 'Run optimization to generate results',
  },
} as const;

const SIZE_CONFIG = {
  sm: {
    badge: 'px-2 py-0.5 text-xs',
    dot: 'w-1.5 h-1.5',
    icon: 'w-3 h-3',
    button: 'px-2 py-0.5 text-xs',
  },
  md: {
    badge: 'px-2.5 py-1 text-sm',
    dot: 'w-2 h-2',
    icon: 'w-4 h-4',
    button: 'px-3 py-1 text-sm',
  },
  lg: {
    badge: 'px-3 py-1.5 text-base',
    dot: 'w-2.5 h-2.5',
    icon: 'w-5 h-5',
    button: 'px-4 py-1.5 text-base',
  },
} as const;

// ============================================
// Component
// ============================================

export function OptimizationStatusBadge({
  status,
  onReOptimize,
  size = 'md',
  showLabel = true,
  showReasons = true,
}: OptimizationStatusBadgeProps) {
  const [isReOptimizing, setIsReOptimizing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const statusKey = status?.status || 'unknown';
  const config = STATUS_CONFIG[statusKey];
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  const handleReOptimize = async () => {
    if (!onReOptimize || isReOptimizing) return;
    
    setIsReOptimizing(true);
    try {
      await onReOptimize();
    } finally {
      setIsReOptimizing(false);
    }
  };

  const reasons = status?.invalidationReasons || [];
  const hasReasons = reasons.length > 0;

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* Status Badge */}
      <div
        className={`
          inline-flex items-center gap-1.5 rounded-full border
          ${config.color} ${sizeConfig.badge}
          cursor-default transition-colors
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Animated dot for optimizing state */}
        {statusKey === 'optimizing' ? (
          <Loader2 className={`${sizeConfig.icon} animate-spin`} />
        ) : (
          <span className={`${sizeConfig.dot} rounded-full ${config.dotColor}`} />
        )}
        
        {showLabel && (
          <span className="font-medium">{config.label}</span>
        )}
      </div>

      {/* Tooltip with reasons */}
      {showTooltip && showReasons && (hasReasons || statusKey !== 'fresh') && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-start gap-2">
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900">
                {config.description}
              </p>
              
              {hasReasons && (
                <ul className="mt-2 space-y-1">
                  {reasons.map((reason, idx) => (
                    <li key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-gray-400" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
              
              {status?.lastOptimizedAt && (
                <p className="mt-2 text-xs text-gray-400">
                  Last optimized: {formatTimestamp(status.lastOptimizedAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Re-optimize Button */}
      {statusKey === 'stale' && onReOptimize && (
        <button
          onClick={handleReOptimize}
          disabled={isReOptimizing}
          className={`
            inline-flex items-center gap-1 rounded-md
            bg-[#872E5C] text-white hover:bg-[#6a2449]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors ${sizeConfig.button}
          `}
        >
          {isReOptimizing ? (
            <>
              <Loader2 className={`${sizeConfig.icon} animate-spin`} />
              <span>Optimizing...</span>
            </>
          ) : (
            <>
              <RefreshCw className={sizeConfig.icon} />
              <span>Re-optimize</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================
// Utilities
// ============================================

function formatTimestamp(timestamp: unknown): string {
  if (!timestamp) return 'Never';
  
  try {
    // Handle Firestore Timestamp
    if (typeof timestamp === 'object' && 'toDate' in (timestamp as object)) {
      return (timestamp as { toDate: () => Date }).toDate().toLocaleString();
    }
    
    // Handle Date
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }
    
    // Handle ISO string
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ============================================
// Compact Badge Variant
// ============================================

export function OptimizationStatusDot({
  status,
  size = 'md',
}: {
  status: OptimizationStatus | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const statusKey = status?.status || 'unknown';
  const config = STATUS_CONFIG[statusKey];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <span 
      className={`inline-block ${sizeConfig.dot} rounded-full ${config.dotColor}`}
      title={config.label}
    />
  );
}

export default OptimizationStatusBadge;
