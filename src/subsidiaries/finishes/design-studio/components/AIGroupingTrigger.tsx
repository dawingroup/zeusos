/**
 * AI Grouping Trigger — inline "run AI assembly grouping" control
 *
 * Rendered above AssemblyReviewPanel in Quick Review. Calls groupModelWithAI
 * directly (no Scene/Firestore needed) and exposes the AI result so the caller
 * can reconcile it with the existing heuristic groups, or simply display the
 * AI reasoning for user confidence.
 */

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { groupModelWithAI } from '../services/aiAssemblyGrouper.service';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type { ModelGrouping } from '../types/modelPackage.types';

interface AIGroupingTriggerProps {
  parsedModel: ParsedModel | null;
  archetypeKey?: string;
  onComplete?: (grouping: ModelGrouping) => void;
}

export default function AIGroupingTrigger({ parsedModel, archetypeKey, onComplete }: AIGroupingTriggerProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ModelGrouping | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!parsedModel) return null;

  const handleRun = async () => {
    setStatus('running');
    setError(null);
    try {
      const grouping = await groupModelWithAI({
        cabinetId: 'quick-review',
        parsedModel,
        archetypeKey,
      });
      setResult(grouping);
      setStatus('done');
      onComplete?.(grouping);
    } catch (err) {
      setError((err as Error).message || 'AI grouping failed');
      setStatus('error');
    }
  };

  return (
    <div className="p-3 border-b border-border space-y-2 bg-accent/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">AI Assembly Grouping</span>
        </div>
        <Button
          size="sm"
          variant={status === 'done' ? 'outline' : 'default'}
          className="h-7 text-xs"
          onClick={handleRun}
          disabled={status === 'running'}
        >
          {status === 'running' ? (
            <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Running…</>
          ) : status === 'done' ? (
            <>Re-run</>
          ) : (
            <>Run AI</>
          )}
        </Button>
      </div>

      {status === 'error' && error && (
        <div className="flex items-start gap-1.5 p-2 rounded bg-destructive/10 text-destructive text-[11px]">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {status === 'done' && result && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <Badge variant={result.source === 'ai' ? 'default' : 'secondary'} className="h-4 text-[9px] px-1">
              {result.source}
            </Badge>
            <span>{result.assemblies.length} assemblies · {(result.confidence * 100).toFixed(0)}% confidence</span>
          </div>
          {result.reasoning && (
            <p className="text-[10px] text-muted-foreground italic line-clamp-3">
              {result.reasoning}
            </p>
          )}
        </div>
      )}

      {status === 'idle' && (
        <p className="text-[10px] text-muted-foreground">
          Claude will analyze mesh names + bounding boxes to group parts into carcass, shelves, doors, drawers, hardware.
        </p>
      )}
    </div>
  );
}
