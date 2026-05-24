/**
 * OfflinePage
 * Offline status page
 */

import { WifiOff, RefreshCw } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/core/components/ui/button';
import { useOnlineStatus } from '@/shared/hooks';

export default function OfflinePage() {
  const { isOnline } = useOnlineStatus();

  const handleRetry = () => {
    window.location.reload();
  };

  if (isOnline) {
    window.history.back();
  }

  return (
    <>
      <Helmet>
        <title>Offline | ZeusOS</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-[var(--rag-amber)]/10 p-4">
              <WifiOff className="h-12 w-12 text-[var(--rag-amber)]" />
            </div>
          </div>

          <h1 className="text-2xl font-semibold mb-2">You're offline</h1>
          <p className="text-muted-foreground mb-8">
            This page requires an internet connection. Please check your network
            connection and try again.
          </p>

          <Button onClick={handleRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Connection
          </Button>

          <p className="text-sm text-muted-foreground mt-8">
            Some features may still be available offline. Try navigating to a
            previously visited page.
          </p>
        </div>
      </div>
    </>
  );
}
