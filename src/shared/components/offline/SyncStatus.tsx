/**
 * SyncStatus Component
 * Display sync status with pending changes indicator
 */

import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { cn } from '@/shared/lib/utils';

interface SyncStatusProps {
  pendingChanges?: number;
  lastSyncTime?: Date | null;
  isSyncing?: boolean;
  hasErrors?: boolean;
  onSyncNow?: () => void;
}

export function SyncStatus({
  pendingChanges = 0,
  lastSyncTime = null,
  isSyncing = false,
  hasErrors = false,
  onSyncNow,
}: SyncStatusProps) {
  const { isOnline } = useOnlineStatus();
  const [showPopover, setShowPopover] = useState(false);

  const getStatusIcon = () => {
    if (!isOnline) return <CloudOff className="h-4 w-4" />;
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (hasErrors) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (pendingChanges > 0) return <Cloud className="h-4 w-4 text-yellow-500" />;
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (hasErrors) return 'Sync error';
    if (pendingChanges > 0) return `${pendingChanges} pending`;
    return 'Synced';
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setShowPopover(!showPopover)}
      >
        {getStatusIcon()}
        <span className="text-xs">{getStatusText()}</span>
      </Button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-background border rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Sync Status</span>
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                )}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending changes</span>
                <span>{pendingChanges}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last sync</span>
                <span>
                  {lastSyncTime
                    ? new Date(lastSyncTime).toLocaleTimeString()
                    : 'Never'}
                </span>
              </div>
            </div>

            {isOnline && pendingChanges > 0 && onSyncNow && (
              <Button
                size="sm"
                className="w-full"
                onClick={onSyncNow}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Sync Now'
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
