import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { SyncStatus } from '../hooks/useSyncStatus';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  onSync: () => void;
  compact?: boolean;
}

export function SyncStatusIndicator({ status, onSync, compact = false }: SyncStatusIndicatorProps) {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'syncing':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
      default:
        return status.pendingCount > 0 
          ? <CloudOff className="w-4 h-4 text-yellow-500" />
          : <Cloud className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'syncing':
        if (status.progress) {
          return `Syncing ${status.progress.synced}/${status.progress.total}...`;
        }
        return 'Syncing...';
      case 'success':
        return 'Synced!';
      case 'error':
        return status.error || 'Sync failed';
      case 'idle':
      default:
        if (status.pendingCount > 0) {
          return `${status.pendingCount} pending`;
        }
        if (status.lastSync) {
          return `Last sync: ${formatRelativeTime(status.lastSync)}`;
        }
        return 'All synced';
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'syncing':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'idle':
      default:
        return status.pendingCount > 0 
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
          : 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  if (compact) {
    return (
      <button
        onClick={onSync}
        disabled={status.status === 'syncing'}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all ${getStatusColor()} ${
          status.status !== 'syncing' ? 'hover:opacity-80 cursor-pointer' : 'cursor-wait'
        }`}
        title={status.status === 'syncing' ? 'Syncing...' : 'Click to sync'}
      >
        {getStatusIcon()}
        {status.pendingCount > 0 && status.status !== 'syncing' && (
          <span className="font-medium">{status.pendingCount}</span>
        )}
      </button>
    );
  }

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-xs font-medium">{getStatusText()}</span>
      </div>
      
      {status.status !== 'syncing' && status.pendingCount > 0 && (
        <button
          onClick={onSync}
          className="flex items-center gap-1 px-2 py-1 bg-white rounded text-xs font-medium hover:bg-gray-50 transition-colors border border-current/20"
        >
          <RefreshCw className="w-3 h-3" />
          Sync now
        </button>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
