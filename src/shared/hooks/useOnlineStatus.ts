/**
 * useOnlineStatus Hook
 * Track online/offline status with last online timestamp
 */

import { useState, useEffect } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  lastOnline: Date | null;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastOnline: typeof navigator !== 'undefined' && navigator.onLine ? new Date() : null,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus({
        isOnline: true,
        lastOnline: new Date(),
      });
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        isOnline: false,
        lastOnline: prev.lastOnline,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
