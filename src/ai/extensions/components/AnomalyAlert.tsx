/**
 * AnomalyAlert Component
 * Displays anomaly notifications with actions
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { Anomaly, AnomalyType } from '../types/ai-extensions';

interface AnomalyAlertProps {
  anomaly: Anomaly;
  onResolve: (anomalyId: string, resolution: string) => void;
  onDismiss?: (anomalyId: string) => void;
  compact?: boolean;
}

const TYPE_LABELS: Record<AnomalyType, string> = {
  budget_overrun: 'Budget Overrun',
  timeline_slip: 'Timeline Slip',
  unusual_payment: 'Unusual Payment',
  data_inconsistency: 'Data Inconsistency',
  missing_approval: 'Missing Approval',
  duplicate_entry: 'Duplicate Entry',
  rate_deviation: 'Rate Deviation',
  pattern_break: 'Pattern Break',
};

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
  critical: {
    bg: 'bg-[var(--rag-red-soft)]',
    border: 'border-[var(--rag-red)]',
    icon: 'text-[var(--rag-red)]',
    badge: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  },
  high: {
    bg: 'bg-[var(--rag-amber-soft)]',
    border: 'border-[var(--rag-amber)]',
    icon: 'text-[var(--rag-amber)]',
    badge: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  },
  medium: {
    bg: 'bg-[var(--rag-amber-soft)]',
    border: 'border-[var(--rag-amber)]',
    icon: 'text-[var(--rag-amber)]',
    badge: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  },
  low: {
    bg: 'bg-[var(--rag-blue-soft)]',
    border: 'border-[var(--rag-blue)]',
    icon: 'text-[var(--rag-blue)]',
    badge: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  },
};

export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
  anomaly,
  onResolve,
  onDismiss,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolution, setResolution] = useState('');

  const style = SEVERITY_STYLES[anomaly.severity];
  const Icon = anomaly.severity === 'critical' || anomaly.severity === 'high' 
    ? AlertTriangle 
    : anomaly.severity === 'medium' 
    ? AlertCircle 
    : Info;

  const handleResolve = () => {
    if (resolution.trim()) {
      onResolve(anomaly.id, resolution);
      setShowResolveForm(false);
      setResolution('');
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{anomaly.description}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.badge}`}>
          {anomaly.severity}
        </span>
        {onDismiss && (
          <button
            onClick={() => onDismiss(anomaly.id)}
            className="p-1 text-[var(--fg-tertiary)] hover:text-muted-foreground rounded"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-card ${style.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-foreground">{TYPE_LABELS[anomaly.type]}</h4>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${style.badge}`}>
                {anomaly.severity}
              </span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--bg-sunken)] text-muted-foreground">
                {Math.round(anomaly.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{anomaly.description}</p>
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(anomaly.id)}
              className="p-1 text-[var(--fg-tertiary)] hover:text-muted-foreground rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Values comparison */}
        {(anomaly.expectedValue !== undefined || anomaly.actualValue !== undefined) && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            {anomaly.expectedValue !== undefined && (
              <div>
                <span className="text-muted-foreground">Expected: </span>
                <span className="font-medium text-foreground">
                  {typeof anomaly.expectedValue === 'number'
                    ? anomaly.expectedValue.toLocaleString()
                    : String(anomaly.expectedValue)}
                </span>
              </div>
            )}
            {anomaly.actualValue !== undefined && (
              <div>
                <span className="text-muted-foreground">Actual: </span>
                <span className={`font-medium ${anomaly.deviation && anomaly.deviation > 0 ? 'text-[var(--rag-red)]' : 'text-foreground'}`}>
                  {typeof anomaly.actualValue === 'number'
                    ? anomaly.actualValue.toLocaleString()
                    : String(anomaly.actualValue)}
                </span>
              </div>
            )}
            {anomaly.deviation !== undefined && (
              <div>
                <span className="text-muted-foreground">Deviation: </span>
                <span className="font-medium text-[var(--rag-red)]">
                  {(anomaly.deviation * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-sm text-muted-foreground hover:text-muted-foreground"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide details' : 'Show evidence & actions'}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Evidence */}
            {anomaly.evidence.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase mb-2">Evidence</h5>
                <div className="space-y-2">
                  {anomaly.evidence.map((ev, i) => (
                    <div key={i} className="p-3 bg-card rounded-lg border border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {ev.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{ev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested actions */}
            {anomaly.suggestedActions.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Suggested Actions
                </h5>
                <ul className="space-y-1">
                  {anomaly.suggestedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-[var(--rag-blue)] mt-0.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]/50">
          {!showResolveForm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResolveForm(true)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] rounded-lg transition-colors"
              >
                Resolve
              </button>
              <button
                onClick={() => window.open(`/${anomaly.module}/${anomaly.entityType}/${anomaly.entityId}`, '_blank')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Entity
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe how this was resolved..."
                className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResolve}
                  disabled={!resolution.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--rag-green)] hover:bg-[var(--rag-green)] disabled:opacity-50 rounded-lg transition-colors"
                >
                  Mark Resolved
                </button>
                <button
                  onClick={() => {
                    setShowResolveForm(false);
                    setResolution('');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--fg-tertiary)]">
          <span>Detected: {new Date(anomaly.detectedAt).toLocaleString()}</span>
          <span>Method: {anomaly.detectionMethod.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * AnomalyList Component
 */
interface AnomalyListProps {
  anomalies: Anomaly[];
  onResolve: (anomalyId: string, resolution: string) => void;
  onDismiss?: (anomalyId: string) => void;
  groupBySeverity?: boolean;
}

export const AnomalyList: React.FC<AnomalyListProps> = ({
  anomalies,
  onResolve,
  onDismiss,
  groupBySeverity = false,
}) => {
  if (anomalies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[var(--rag-green)] opacity-50" />
        <p className="text-sm">No anomalies detected</p>
      </div>
    );
  }

  if (groupBySeverity) {
    const grouped = {
      critical: anomalies.filter((a) => a.severity === 'critical'),
      high: anomalies.filter((a) => a.severity === 'high'),
      medium: anomalies.filter((a) => a.severity === 'medium'),
      low: anomalies.filter((a) => a.severity === 'low'),
    };

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(
          ([severity, items]) =>
            items.length > 0 && (
              <div key={severity}>
                <h4 className="text-sm font-medium text-muted-foreground uppercase mb-3">
                  {severity} ({items.length})
                </h4>
                <div className="space-y-3">
                  {items.map((anomaly) => (
                    <AnomalyAlert
                      key={anomaly.id}
                      anomaly={anomaly}
                      onResolve={onResolve}
                      onDismiss={onDismiss}
                    />
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {anomalies.map((anomaly) => (
        <AnomalyAlert
          key={anomaly.id}
          anomaly={anomaly}
          onResolve={onResolve}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

/**
 * AnomalyBadge Component - For showing anomaly count
 */
interface AnomalyBadgeProps {
  count: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({ count, severity }) => {
  if (count === 0) return null;

  const colors = severity
    ? SEVERITY_STYLES[severity].badge
    : count > 0
    ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
    : 'bg-[var(--bg-sunken)] text-muted-foreground';

  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full ${colors}`}>
      {count}
    </span>
  );
};

export default AnomalyAlert;
