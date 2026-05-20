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
  immediate: 'bg-red-50 border-red-200 text-red-800',
  today: 'bg-orange-50 border-orange-200 text-orange-800',
  this_week: 'bg-amber-50 border-amber-200 text-amber-800',
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
          <Brain className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900">AI CFO Briefing</h2>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!briefing && (
        <Card className="p-8 text-center">
          <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No briefing available for today</p>
          <p className="text-xs text-gray-400 mb-4">
            Generate an AI-powered financial briefing using Claude
          </p>
          <Button
            onClick={generateBriefing}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
              <Brain className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900">Executive Summary</h3>
              <span className="text-xs text-gray-400 ml-auto">{formatDate(briefing.generatedAt)}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{briefing.executiveSummary}</p>
            {briefing.cashOutlookNarrative && (
              <p className="text-sm text-indigo-600 mt-2 italic">{briefing.cashOutlookNarrative}</p>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Key Decisions */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
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
                <p className="text-sm text-gray-400">No key decisions today</p>
              )}
            </Card>

            {/* Risk Alerts */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-500" />
                Risk Alerts
              </h3>
              {briefing.riskAlerts?.length > 0 ? (
                <div className="space-y-3">
                  {briefing.riskAlerts.map((alert, idx) => {
                    const SeverityIcon = SEVERITY_ICONS[alert.severity] || Info;
                    return (
                      <div key={idx} className="flex items-start gap-2">
                        <SeverityIcon className={`w-4 h-4 mt-0.5 shrink-0 ${
                          alert.severity === 'critical' ? 'text-red-500'
                            : alert.severity === 'warning' ? 'text-amber-500'
                              : 'text-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{alert.suggestedAction}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  No risk alerts today
                </div>
              )}
            </Card>
          </div>

          {/* Recommendations */}
          {briefing.recommendations?.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Recommendations
              </h3>
              <div className="space-y-2">
                {briefing.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      rec.priority >= 3 ? 'bg-red-50 text-red-700'
                        : rec.priority >= 2 ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                    }`}>
                      P{rec.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{rec.action}</p>
                      {rec.expectedImpact && (
                        <p className="text-xs text-gray-500 mt-0.5">{rec.expectedImpact}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
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
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Briefings</h3>
              <div className="space-y-2">
                {briefingHistory.slice(1).map(b => (
                  <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400">{formatDate(b.generatedAt)}</span>
                    <p className="text-sm text-gray-600 truncate flex-1">
                      {b.executiveSummary?.slice(0, 100)}...
                    </p>
                    <span className="text-xs text-gray-400">
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
