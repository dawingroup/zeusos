/**
 * QBOSyncStatusIndicator
 * Shows QBO sync status icon.
 */

import { CheckCircle, AlertCircle, Clock, Ban, Loader2 } from 'lucide-react';

type SyncStatus = 'pending' | 'synced' | 'failed' | 'not_applicable';

interface QBOSyncStatusIndicatorProps {
  status?: SyncStatus;
  error?: string;
  journalEntryId?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function QBOSyncStatusIndicator({
  status = 'pending',
  error,
  journalEntryId,
  onRetry,
  retrying,
}: QBOSyncStatusIndicatorProps) {
  if (retrying) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  }

  switch (status) {
    case 'synced':
      return (
        <span title={`Synced — JE: ${journalEntryId || 'N/A'}`}>
          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
        </span>
      );
    case 'failed':
      return (
        <span title={`Sync failed: ${error || 'Unknown error'}`}>
          {onRetry ? (
            <button onClick={onRetry} className="hover:opacity-80">
              <AlertCircle className="h-4 w-4 text-red-600 mx-auto" />
            </button>
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 mx-auto" />
          )}
        </span>
      );
    case 'not_applicable':
      return (
        <span title="No QBO journal needed">
          <Ban className="h-4 w-4 text-muted-foreground/40 mx-auto" />
        </span>
      );
    case 'pending':
    default:
      return (
        <span title="Pending QBO sync">
          <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
        </span>
      );
  }
}
