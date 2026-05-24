// ============================================================================
// CFO BRIEFING PAGE
// AI-powered daily financial briefing with decisions, risks, recommendations
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  Brain,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  Lightbulb,
  Shield,
} from 'lucide-react';
import { useCFOBriefing } from '../hooks/useCFOBriefing';
import { useAuth } from '@/shared/hooks/useAuth';

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  if (ts instanceof Date) return ts.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(ts);
}

const URGENCY_STYLES: Record<string, string> = {
  immediate: 'bg-[var(--rag-red-soft)] border-[var(--rag-red)] text-[var(--rag-red)]',
  today: 'bg-[var(--rag-amber-soft)] border-[var(--rag-amber)] text-[var(--rag-amber)]',
  this_week: 'bg-[var(--rag-amber-soft)] border-[var(--rag-amber)] text-[var(--rag-amber)]',
};

const SEVERITY_ICONS: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: Shield,
  info: Info,
};

export function CFOBriefingPage() {
  const navigate = useNavigate();
  useAuth();
  const companyId = 'dawinos'; // From company context

  const {
    briefing,
    briefingHistory,
    isLoading,
    isGenerating,
    error,
    generateBriefing,
  } = useCFOBriefing({ companyId });

  if (isLoading && !briefing) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-[var(--rag-blue)]" />
          <h2 className="text-xl font-bold text-foreground">AI CFO Briefing</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/finance/cash/scenarios')}
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Scenarios
          </Button>
          <Button
            size="sm"
            onClick={generateBriefing}
            disabled={isGenerating}
            className="bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] text-white"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Brain className="w-4 h-4 mr-1.5" />
            )}
            Generate Briefing
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!briefing && (
        <Card className="p-8 text-center">
          <Brain className="w-10 h-10 text-[var(--fg-tertiary)] mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No briefing available for today</p>
          <p className="text-xs text-[var(--fg-tertiary)] mb-4">
            Generate an AI-powered financial briefing using Claude
          </p>
          <Button
            onClick={generateBriefing}
            disabled={isGenerating}
            className="bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] text-white"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Brain className="w-4 h-4 mr-1.5" />}
            Generate Now
          </Button>
        </Card>
      )}

      {briefing && (
        <>
          {/* Executive Summary */}
          <Card className="p-5 border-l-4 border-l-indigo-500">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-[var(--rag-blue)]" />
              <h3 className="text-sm font-semibold text-foreground">Executive Summary</h3>
              <span className="text-xs text-[var(--fg-tertiary)] ml-auto">{formatDate(briefing.generatedAt)}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{briefing.executiveSummary}</p>
            {briefing.cashOutlookNarrative && (
              <p className="text-sm text-[var(--rag-blue)] mt-2 italic">{briefing.cashOutlookNarrative}</p>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Decisions */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-[var(--rag-amber)]" />
                Key Decisions
              </h3>
              {briefing.keyDecisions?.length > 0 ? (
                <div className="space-y-3">
                  {briefing.keyDecisions.map((decision, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${URGENCY_STYLES[decision.urgency] || URGENCY_STYLES.this_week}`}
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium">{decision.decision}</p>
                        <span className="text-xs font-medium uppercase shrink-0 ml-2">
                          {decision.urgency}
                        </span>
                      </div>
                      <p className="text-xs mt-1 opacity-80">{decision.rationale}</p>
                      {decision.recommendation && (
                        <p className="text-xs mt-1.5 font-medium">
                          Rec: {decision.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--fg-tertiary)]">No key decisions today</p>
              )}
            </Card>

            {/* Risk Alerts */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--rag-red)]" />
                Risk Alerts
              </h3>
              {briefing.riskAlerts?.length > 0 ? (
                <div className="space-y-3">
                  {briefing.riskAlerts.map((alert, idx) => {
                    const SeverityIcon = SEVERITY_ICONS[alert.severity] || Info;
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <SeverityIcon className={`w-4 h-4 mt-0.5 shrink-0 ${
                          alert.severity === 'critical' ? 'text-[var(--rag-red)]'
                            : alert.severity === 'warning' ? 'text-[var(--rag-amber)]'
                              : 'text-[var(--rag-blue)]'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{alert.suggestedAction}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--rag-green)]">
                  <CheckCircle className="w-4 h-4" />
                  No risk alerts today
                </div>
              )}
            </Card>
          </div>

          {/* Recommendations */}
          {briefing.recommendations?.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[var(--rag-green)]" />
                Recommendations
              </h3>
              <div className="space-y-2">
                {briefing.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      rec.priority >= 3 ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
                        : rec.priority >= 2 ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                          : 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]'
                    }`}>
                      P{rec.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{rec.action}</p>
                      {rec.expectedImpact && (
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.expectedImpact}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--fg-tertiary)] shrink-0">
                      {rec.category}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Briefing History */}
          {briefingHistory.length > 1 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recent Briefings</h3>
              <div className="space-y-2">
                {briefingHistory.slice(1).map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                    <span className="text-xs text-[var(--fg-tertiary)]">{formatDate(b.generatedAt)}</span>
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {b.executiveSummary?.slice(0, 100)}...
                    </p>
                    <span className="text-xs text-[var(--fg-tertiary)]">
                      {b.keyDecisions?.length || 0} decisions
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default CFOBriefingPage;
