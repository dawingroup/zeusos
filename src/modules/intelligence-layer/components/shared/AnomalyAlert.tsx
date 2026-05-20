// ============================================================================
// ANOMALY ALERT
// DawinOS v2.0 - Intelligence Layer
// Alert component for detected anomalies
// ============================================================================

import React, { useState } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Search,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';

import { ANOMALY_SEVERITY, MODULE_COLOR } from '../../constants';
import type { Anomaly } from '../../types';
import { ModuleSourceBadge } from './ModuleSourceBadge';

interface AnomalyAlertProps {
  anomaly: Anomaly;
  onAcknowledge?: (anomaly: Anomaly) => void;
  onInvestigate?: (anomaly: Anomaly) => void;
  onResolve?: (anomaly: Anomaly) => void;
  expanded?: boolean;
}

export const AnomalyAlert: React.FC<AnomalyAlertProps> = ({
  anomaly,
  onAcknowledge,
  onInvestigate,
  onResolve,
  expanded: initialExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const severityConfig = ANOMALY_SEVERITY.find(s => s.id === anomaly.severity);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDeviation = (deviation: number): string => {
    const sign = deviation >= 0 ? '+' : '';
    return `${sign}${deviation.toFixed(1)}%`;
  };

  return (
    <Card
      className="border-l-4"
      style={{
        borderLeftColor: severityConfig?.color || '#9e9e9e',
        backgroundColor: severityConfig?.bgColor || '#fafafa',
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className="p-2 rounded-lg text-white shrink-0"
            style={{ backgroundColor: severityConfig?.color || '#9e9e9e' }}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge style={{ backgroundColor: severityConfig?.color, color: 'white' }}>
                {severityConfig?.label}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {anomaly.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Detected {new Date(anomaly.detectedAt).toLocaleString()}
              </span>
            </div>

            <h4 className="font-medium mb-1">{anomaly.title}</h4>
            <p className="text-sm text-muted-foreground mb-3">{anomaly.description}</p>

            <ModuleSourceBadge module={anomaly.sourceModule} />

            {/* Metric Details */}
            {anomaly.metric && (
              <div className="mt-4 p-3 bg-white rounded-lg border">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Expected</p>
                    <p className="text-lg font-bold">{anomaly.metric.expectedValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Actual</p>
                    <p
                      className="text-lg font-bold"
                      style={{ color: anomaly.metric.deviation > 0 ? '#f44336' : '#4caf50' }}
                    >
                      {anomaly.metric.actualValue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deviation</p>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(anomaly.metric.trend)}
                      <span
                        className="text-lg font-bold"
                        style={{ color: Math.abs(anomaly.metric.deviation) > 20 ? '#f44336' : '#ff9800' }}
                      >
                        {formatDeviation(anomaly.metric.deviation)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Expandable Section */}
            {expanded && (
              <div className="mt-4 space-y-4">
                {anomaly.affectedEntities && anomaly.affectedEntities.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Affected Entities</p>
                    <div className="flex flex-wrap gap-1">
                      {anomaly.affectedEntities.map((entity, idx) => (
                        <Badge
                          key={idx}
                          variant={entity.impact === 'direct' ? 'default' : 'outline'}
                        >
                          {entity.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {anomaly.suggestedActions && anomaly.suggestedActions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Suggested Actions</p>
                    <ul className="space-y-1">
                      {anomaly.suggestedActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          {anomaly.status === 'new' && onAcknowledge && (
            <Button variant="outline" size="sm" onClick={() => onAcknowledge(anomaly)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Acknowledge
            </Button>
          )}
          {(anomaly.status === 'new' || anomaly.status === 'acknowledged') && onInvestigate && (
            <Button
              size="sm"
              onClick={() => onInvestigate(anomaly)}
              style={{ backgroundColor: MODULE_COLOR }}
            >
              <Search className="h-4 w-4 mr-2" />
              Investigate
            </Button>
          )}
          {anomaly.status === 'investigating' && onResolve && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => onResolve(anomaly)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Resolved
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnomalyAlert;
