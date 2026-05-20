/**
 * LoadingOverlay Component
 * Overlay with loading spinner for async operations
 */

import { LoadingSpinner } from './LoadingSpinner';

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ 
  isLoading, 
  text = 'Loading...', 
  children 
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  );
}
