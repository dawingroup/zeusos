/**
 * FullPageLoader Component
 * Full screen loading state
 */

import { LoadingSpinner } from './LoadingSpinner';

interface FullPageLoaderProps {
  text?: string;
}

export function FullPageLoader({ text = 'Loading...' }: FullPageLoaderProps) {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" />
        <p className="text-lg text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
