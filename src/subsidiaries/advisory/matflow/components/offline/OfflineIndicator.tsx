/**
 * Offline Indicator Component
 * Visual indicator for network and sync status
 */

import React from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import { useSyncStatus } from '../../hooks/useSyncStatus';

interface OfflineIndicatorProps {
  variant?: 'badge' | 'icon' | 'full';
  showDetails?: boolean;
}

const formatTimeAgo = (date: Date | null): string => {
  if (!date) return 'Never';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  variant = 'badge',
  showDetails = true,
}) => {
  const {
    pendingWrites,
    lastSyncAt,
    syncErrors,
    isOnline,
    isOffline,
    isSyncing,
    hasPendingWrites,
    hasErrors,
    sync,
    retryFailed,
    clearErrors,
  } = useSyncStatus();

  const [showPopover, setShowPopover] = React.useState(false);

  const getStatusIcon = () => {
    if (isOffline) return <WifiOff className="h-4 w-4" />;
    if (isSyncing) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (hasErrors) return <AlertTriangle className="h-4 w-4" />;
    if (hasPendingWrites) return <Cloud className="h-4 w-4" />;
    return <CheckCircle2 className="h-4 w-4" />;
  };

  const getStatusColor = () => {
    if (isOffline) return 'bg-gray-500';
    if (hasErrors) return 'bg-red-500';
    if (hasPendingWrites) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusTextColor = () => {
    if (isOffline) return 'text-gray-600';
    if (hasErrors) return 'text-red-600';
    if (hasPendingWrites) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (hasErrors) return 'Sync Error';
    if (hasPendingWrites) return `${pendingWrites} pending`;
    return 'Synced';
  };

  // Simple icon variant
  if (variant === 'icon') {
    return (
      <div className={`p-1 rounded-full ${getStatusTextColor()}`}>
        {getStatusIcon()}
      </div>
    );
  }

  // Badge variant without details
  if (variant === 'badge' && !showDetails) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${
        isOffline ? 'border-gray-300 text-gray-600 bg-gray-50' :
        hasErrors ? 'border-red-300 text-red-600 bg-red-50' :
        hasPendingWrites ? 'border-yellow-300 text-yellow-600 bg-yellow-50' :
        'border-green-300 text-green-600 bg-green-50'
      }`}>
        {getStatusIcon()}
        {getStatusText()}
      </span>
    );
  }

  // Full variant with popover
  return (
    <div className="relative">
      <button 
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
        {getStatusIcon()}
        <span className="hidden sm:inline text-gray-600">{getStatusText()}</span>
      </button>

      {showPopover && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPopover(false)} 
          />
          
          {/* Popover */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-gray-500" />
                  )}
                  <span className="font-medium">
                    {isOnline ? 'Connected' : 'Offline Mode'}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Sync Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Sync Status</span>
                  <span className="font-medium">{getStatusText()}</span>
                </div>
                
                {hasPendingWrites && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Pending changes</span>
                      <span>{pendingWrites}</span>
                    </div>
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`}
                        style={{ width: isSyncing ? '50%' : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Last Sync */}
              {lastSyncAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Last synced</span>
                  <span>{formatTimeAgo(lastSyncAt)}</span>
                </div>
              )}

              {/* Errors */}
              {hasErrors && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{syncErrors.length} sync error(s)</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {syncErrors[0]?.error}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {isOnline && hasPendingWrites && (
                  <button
                    onClick={() => sync()}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync Now
                  </button>
                )}
                
                {hasErrors && (
                  <>
                    <button
                      onClick={() => retryFailed()}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => clearErrors()}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Offline Mode Info */}
              {isOffline && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  Changes made while offline will sync automatically when you reconnect.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
