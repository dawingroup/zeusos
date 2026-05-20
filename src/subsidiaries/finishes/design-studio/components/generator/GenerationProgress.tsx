/**
 * GenerationProgress — Real-time progress bar for AI model generation
 */

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { GenerationProgress as ProgressType } from '../../types/generation.types';

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Loader2 }> = {
  uploading: { color: 'bg-blue-500', icon: Loader2 },
  generating: { color: 'bg-amber-500', icon: Loader2 },
  processing: { color: 'bg-purple-500', icon: Loader2 },
  complete: { color: 'bg-green-500', icon: CheckCircle2 },
  error: { color: 'bg-red-500', icon: AlertCircle },
};

interface GenerationProgressProps {
  progress: ProgressType;
}

export default function GenerationProgress({ progress }: GenerationProgressProps) {
  const config = STATUS_CONFIG[progress.status] || STATUS_CONFIG.generating;
  const Icon = config.icon;
  const isAnimating = progress.status !== 'complete' && progress.status !== 'error';

  return (
    <div className="border rounded-lg p-2 bg-muted/10">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-3.5 w-3.5 ${isAnimating ? 'animate-spin' : ''} ${
          progress.status === 'complete' ? 'text-green-600' :
          progress.status === 'error' ? 'text-red-600' :
          'text-primary'
        }`} />
        <span className="text-[11px] font-medium flex-1">{progress.message}</span>
        {progress.progress > 0 && progress.status !== 'error' && (
          <span className="text-[10px] text-muted-foreground">{progress.progress}%</span>
        )}
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.color}`}
          style={{ width: `${Math.max(progress.progress, isAnimating ? 5 : 0)}%` }}
        />
      </div>
      {progress.error && (
        <p className="text-[10px] text-red-600 mt-1">{progress.error}</p>
      )}
    </div>
  );
}
