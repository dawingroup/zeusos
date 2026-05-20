/**
 * AI Field Indicator
 *
 * Small inline badge shown next to form fields that were auto-filled by AI.
 * Purple for normal confidence, amber for low confidence.
 */

import { Sparkles, X } from 'lucide-react';

interface AiFieldIndicatorProps {
  confidence?: number;
  onDismiss: () => void;
}

export function AiFieldIndicator({ confidence = 1, onDismiss }: AiFieldIndicatorProps) {
  const isLowConfidence = confidence < 0.5;
  const colorClasses = isLowConfidence
    ? 'bg-amber-100 text-amber-700'
    : 'bg-purple-100 text-purple-700';

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${colorClasses}`}>
      <Sparkles className="w-3 h-3" />
      <span>{isLowConfidence ? 'AI (verify)' : 'AI'}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="ml-0.5 hover:opacity-70"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
