/**
 * SaveStatusIndicator Component
 * Displays current save status and last saved time
 */

import { Check, Loader2, AlertCircle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SaveStatus } from '../../types/strategy';

interface SaveStatusIndicatorProps {
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  className?: string;
  showLabel?: boolean;
}

export function SaveStatusIndicator({
  saveStatus,
  lastSaved,
  className,
  showLabel = true,
}: SaveStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          label: 'Saving...',
          textColor: 'text-blue-600',
        };
      case 'saved':
        return {
          icon: <Check className="w-4 h-4" />,
          label: 'Saved',
          textColor: 'text-green-600',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Save failed',
          textColor: 'text-red-600',
        };
      default: // idle
        return {
          icon: <Cloud className="w-4 h-4" />,
          label: lastSaved ? getTimeAgo(lastSaved) : 'Not saved',
          textColor: 'text-gray-500',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={cn('flex items-center gap-2', config.textColor, className)}>
      {config.icon}
      {showLabel && (
        <span className="text-sm font-medium">
          {config.label}
        </span>
      )}
    </div>
  );
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 10) {
    return 'Just now';
  }

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

/**
 * Compact version for toolbars
 */
interface CompactSaveStatusProps {
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  className?: string;
}

export function CompactSaveStatus({
  saveStatus,
  lastSaved,
  className,
}: CompactSaveStatusProps) {
  if (saveStatus === 'idle' && !lastSaved) {
    return null; // Don't show anything if never saved
  }

  return (
    <SaveStatusIndicator
      saveStatus={saveStatus}
      lastSaved={lastSaved}
      showLabel={false}
      className={className}
    />
  );
}

/**
 * Detailed version with timestamp tooltip
 */
export function DetailedSaveStatus({
  saveStatus,
  lastSaved,
  className,
}: CompactSaveStatusProps) {
  const config = {
    saving: { bg: 'bg-blue-50', border: 'border-blue-200' },
    saved: { bg: 'bg-green-50', border: 'border-green-200' },
    error: { bg: 'bg-red-50', border: 'border-red-200' },
    idle: { bg: 'bg-gray-50', border: 'border-gray-200' },
  };

  const style = config[saveStatus];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm',
        style.bg,
        style.border,
        className
      )}
      title={lastSaved ? `Last saved: ${lastSaved.toLocaleString()}` : undefined}
    >
      <SaveStatusIndicator saveStatus={saveStatus} lastSaved={lastSaved} />
    </div>
  );
}
