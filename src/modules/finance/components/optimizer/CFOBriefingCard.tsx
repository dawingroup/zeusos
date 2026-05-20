// ============================================================================
// CFO BRIEFING CARD
// Compact card for embedding the latest CFO briefing in the dashboard
// ============================================================================

import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import {
  Brain,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type { CFOBriefing } from '../../types/optimizer.types';

interface CFOBriefingCardProps {
  briefing: CFOBriefing | null;
  isGenerating?: boolean;
  onGenerate?: () => void;
  onViewFull?: () => void;
  className?: string;
}

export function CFOBriefingCard({
  briefing,
  isGenerating,
  onGenerate,
  onViewFull,
  className = '',
}: CFOBriefingCardProps) {
  if (!briefing) {
    return (
      <Card className={`p-5 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900">AI CFO Briefing</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">No briefing generated for today</p>
        {onGenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Brain className="w-4 h-4 mr-1.5" />
            )}
            Generate Briefing
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className={`p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900">AI CFO Briefing</h3>
        </div>
        {onViewFull && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewFull}
            className="text-xs"
          >
            Full Briefing
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {briefing.executiveSummary?.length > 200
          ? briefing.executiveSummary.slice(0, 200) + '...'
          : briefing.executiveSummary}
      </p>

      {/* Quick Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {briefing.keyDecisions?.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {briefing.keyDecisions.length} decisions
          </span>
        )}
        {briefing.riskAlerts?.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {briefing.riskAlerts.length} risks
          </span>
        )}
        {briefing.recommendations?.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {briefing.recommendations.length} recommendations
          </span>
        )}
      </div>

      {/* Top Risk Alert */}
      {briefing.riskAlerts?.length > 0 && (
        <div className={`mt-3 p-2 rounded text-xs flex items-start gap-1.5 ${
          briefing.riskAlerts[0].severity === 'critical' ? 'bg-red-50 text-red-700'
            : 'bg-amber-50 text-amber-700'
        }`}>
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{briefing.riskAlerts[0].message}: {briefing.riskAlerts[0].suggestedAction?.slice(0, 100)}</span>
        </div>
      )}
    </Card>
  );
}

export default CFOBriefingCard;
