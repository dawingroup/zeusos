/**
 * ErrorDisplay Component
 * Display error states with retry option
 */

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: 'inline' | 'card' | 'fullPage';
  className?: string;
}

export function ErrorDisplay({ 
  title = 'Error',
  message, 
  onRetry,
  variant = 'inline',
  className,
}: ErrorDisplayProps) {
  if (variant === 'fullPage') {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn('rounded-lg border border-destructive/50 bg-destructive/10 p-4', className)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="mt-3">
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/50', className)}>
      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      <div className="flex-1 flex items-center justify-between">
        <span className="text-sm text-destructive">{message}</span>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
