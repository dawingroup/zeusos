/**
 * OfflineBanner Component
 * Banner displayed when user is offline
 */

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { isOnline, lastOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-[var(--rag-amber)] text-[var(--rag-amber)] px-4 py-2 text-center text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>
          You're offline. Changes will sync when connection is restored.
        </span>
        {lastOnline && (
          <span className="text-[var(--rag-amber)]">
            (Last online: {new Date(lastOnline).toLocaleTimeString()})
          </span>
        )}
      </div>
    </div>
  );
}
