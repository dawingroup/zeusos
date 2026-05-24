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
      bg: 'bg-[var(--rag-amber-soft)]',
      text: 'text-[var(--rag-amber)]',
      dot: 'bg-[var(--rag-amber)]',
      label: 'Pending Sync',
      icon: '⏳',
    },
    synced: {
      bg: 'bg-[var(--rag-green-soft)]',
      text: 'text-[var(--rag-green)]',
      dot: 'bg-[var(--rag-green)]',
      label: 'Synced',
      icon: '✓',
    },
    error: {
      bg: 'bg-[var(--rag-red-soft)]',
      text: 'text-[var(--rag-red)]',
      dot: 'bg-[var(--rag-red)]',
      label: 'Sync Failed',
      icon: '✕',
    },
    'correction-pending': {
      bg: 'bg-[var(--rag-amber-soft)]',
      text: 'text-[var(--rag-amber)]',
      dot: 'bg-[var(--rag-amber)]',
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
            <div className="mt-2 p-2 bg-[var(--rag-red-soft)] rounded border border-[var(--rag-red)]">
              <p className="text-xs text-[var(--rag-red)]">
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
              className="text-xs text-[var(--rag-blue)] hover:text-[var(--rag-blue)] underline"
            >
              View in QuickBooks →
            </a>
          )}
        </div>

        {/* Retry button for errors or correction-pending */}
        {(status === 'error' || status === 'correction-pending') && onRetry && (
          <button
            onClick={onRetry}
            className="ml-4 px-3 py-1.5 text-xs font-medium text-white bg-[var(--rag-blue)] rounded-md hover:bg-[var(--rag-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
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
    pending: 'text-[var(--rag-amber)]',
    synced: 'text-[var(--rag-green)]',
    error: 'text-[var(--rag-red)]',
    'correction-pending': 'text-[var(--rag-amber)]',
  };

  return (
    <span className={`inline-flex items-center text-xs ${colors[status]}`} title={`QuickBooks sync: ${status}`}>
      <span className="mr-1">{icons[status]}</span>
      {status === 'synced' && qboDocNumber && `QB #${qboDocNumber}`}
    </span>
  );
}
