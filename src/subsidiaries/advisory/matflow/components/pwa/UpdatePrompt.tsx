/**
 * PWA Update Prompt Component
 * Notify users when a new version is available
 */

import { useState, useEffect } from 'react';
import { Button } from '@/core/components/ui/button';
import { RefreshCw, X, Download } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { skipWaiting, onMessage } from '../../services/serviceWorkerRegistration';

interface UpdatePromptProps {
  className?: string;
}

export function UpdatePrompt({ className }: UpdatePromptProps) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for service worker update messages
    const cleanup = onMessage((event) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        setShowUpdate(true);
      }
    });

    return cleanup;
  }, []);

  // Also check on mount if there's a waiting service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setShowUpdate(true);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
              }
            });
          }
        });
      });
    }
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    skipWaiting();
    
    // Reload after a short delay to allow the new service worker to activate
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm',
        'bg-background border rounded-lg shadow-lg p-4',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold">Update Available</h4>
          <p className="text-sm text-muted-foreground mt-1">
            A new version of MatFlow is available. Update now for the latest features and improvements.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Now
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              Later
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-full hover:bg-muted shrink-0"
          disabled={isUpdating}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default UpdatePrompt;
