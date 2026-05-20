/**
 * Notification Permission Prompt Component
 * UI for requesting push notification permissions
 */

import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Bell, BellOff, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface NotificationPromptProps {
  userId: string;
  onDismiss?: () => void;
  variant?: 'card' | 'banner' | 'inline';
  className?: string;
}

export function NotificationPrompt({
  userId,
  onDismiss,
  variant = 'card',
  className,
}: NotificationPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
  } = usePushNotifications({ userId });

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed || permission === 'denied') {
    return null;
  }

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      setDismissed(true);
      onDismiss?.();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3',
          'flex items-center justify-between gap-4',
          'animate-in slide-in-from-top duration-300',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5" />
          <span className="text-sm font-medium">
            Enable notifications for delivery updates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleEnable}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Enable'
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-primary-foreground hover:text-primary-foreground/80"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-4 p-3 rounded-lg bg-muted',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">Get notified about delivery updates</span>
        </div>
        <Button size="sm" onClick={handleEnable} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Bell className="h-4 w-4 mr-2" />
          )}
          Enable
        </Button>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn('relative', className)}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" />
          Stay Updated
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Enable push notifications to receive alerts about:
        </p>
        <ul className="text-sm space-y-2 mb-4">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            New material deliveries
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Procurement approvals
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            Sync status updates
          </li>
        </ul>
        <Button onClick={handleEnable} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Enabling...
            </>
          ) : (
            <>
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Notification Settings Component
 * Manage notification preferences
 */
interface NotificationSettingsProps {
  userId: string;
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications({ userId });

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">Notifications not supported</p>
          <p className="text-sm text-muted-foreground">
            Your browser doesn't support push notifications
          </p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 text-red-700">
        <BellOff className="h-5 w-5" />
        <div>
          <p className="font-medium">Notifications blocked</p>
          <p className="text-sm">
            Please enable notifications in your browser settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">Push Notifications</p>
          <p className="text-sm text-muted-foreground">
            {isSubscribed
              ? 'Receiving delivery and sync updates'
              : 'Not receiving notifications'}
          </p>
        </div>
      </div>
      <Button
        variant={isSubscribed ? 'outline' : 'default'}
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          'Disable'
        ) : (
          'Enable'
        )}
      </Button>
    </div>
  );
}

export default NotificationPrompt;
