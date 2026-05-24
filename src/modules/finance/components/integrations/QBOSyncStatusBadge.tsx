/**
 * QuickBooks Sync Status Badge
 * Reusable component for showing sync status with QBO
 */

// Loose Timestamp shape to accept both firebase/firestore Timestamps and the
// in-app shared Timestamp re-export (which lacks isEqual/toJSON).
interface LooseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

interface QBOSyncStatusBadgeProps {
  status?: 'pending' | 'synced' | 'error' | 'correction-pending';
  error?: string;
  lastSyncedAt?: LooseTimestamp;
  qboDocNumber?: string;
  qboDocUrl?: string;
  entityType?: 'Bill' | 'Sales Order' | 'Invoice' | 'Journal Entry' | 'Vendor';
  onRetry?: () => void;
  onSync?: () => void;
  compact?: boolean;
}

export function QBOSyncStatusBadge({
  status,
  error,
  lastSyncedAt,
  qboDocNumber,
  qboDocUrl,
  entityType = 'Bill',
  onRetry,
  onSync,
  compact = false,
}: QBOSyncStatusBadgeProps) {
  // If no status, show not synced (with optional sync button)
  if (!status) {
    if (compact) {
      return (
        <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--bg-sunken)] text-muted-foreground text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[var(--bg-sunken)] mr-1.5"></span>
          Not Synced
        </div>
      );
    }
    return (
      <div className="border border-[var(--border-subtle)] rounded-lg p-4 bg-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--bg-sunken)] text-muted-foreground text-xs font-medium mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--bg-sunken)] mr-1.5"></span>
              Not Synced
            </div>
            <p className="text-xs text-muted-foreground">
              {entityType} has not been synced to QuickBooks yet.
            </p>
          </div>
          {onSync && (
            <button
              onClick={onSync}
              className="ml-4 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Sync to QBO
            </button>
          )}
        </div>
      </div>
    );
  }

  // Status configurations
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      dot: 'bg-yellow-500',
      label: 'Pending Sync',
      icon: '⏳',
    },
    synced: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      dot: 'bg-green-500',
      label: 'Synced',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      dot: 'bg-red-500',
      label: 'Sync Failed',
      icon: '✕',
    },
    'correction-pending': {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      dot: 'bg-orange-500',
      label: 'Correction Pending',
      icon: '⟳',
    },
  };

  const config = statusConfig[status];

  // Compact mode - just badge
  if (compact) {
    return (
      <div
        className={`inline-flex items-center px-2.5 py-1 rounded-md ${config.bg} ${config.text} text-xs font-medium`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dot} mr-1.5`}></span>
        {config.label}
      </div>
    );
  }

  // Full mode - badge with details
  return (
    <div className="border border-[var(--border-subtle)] rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Status badge */}
          <div className="flex items-center mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md ${config.bg} ${config.text} text-xs font-medium`}>
              <span className={`w-2 h-2 rounded-full ${config.dot} mr-1.5`}></span>
              {config.label}
            </span>
            {status === 'synced' && qboDocNumber && (
              <span className="ml-2 text-sm text-muted-foreground">
                {entityType} #{qboDocNumber}
              </span>
            )}
          </div>

          {/* Last synced time */}
          {lastSyncedAt && (
            <p className="text-xs text-muted-foreground mb-2">
              Last attempt: {new Date(lastSyncedAt.toDate()).toLocaleString()}
            </p>
          )}

          {/* Error message */}
          {status === 'error' && error && (
            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
              <p className="text-xs text-red-700">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Success message with link */}
          {status === 'synced' && qboDocUrl && (
            <a
              href={qboDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              View in QuickBooks →
            </a>
          )}
        </div>

        {/* Retry button for errors or correction-pending */}
        {(status === 'error' || status === 'correction-pending') && onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {status === 'correction-pending' ? 'Sync Correction' : 'Retry Sync'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline sync status indicator
 */
export function QBOSyncIndicator({
  status,
  qboDocNumber,
}: {
  status?: 'pending' | 'synced' | 'error' | 'correction-pending';
  qboDocNumber?: string;
}) {
  if (!status) return null;

  const icons: Record<string, string> = {
    pending: '⏳',
    synced: '✓',
    error: '✕',
    'correction-pending': '⟳',
  };

  const colors: Record<string, string> = {
    pending: 'text-yellow-600',
    synced: 'text-green-600',
    error: 'text-red-600',
    'correction-pending': 'text-orange-600',
  };

  return (
    <span className={`inline-flex items-center text-xs ${colors[status]}`} title={`QuickBooks sync: ${status}`}>
      <span className="mr-1">{icons[status]}</span>
      {status === 'synced' && qboDocNumber && `QB #${qboDocNumber}`}
    </span>
  );
}
