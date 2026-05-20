/**
 * RiskFlagBanner — Prominent risk warnings display.
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { RiskFlag, RiskSeverity } from '../types';
import { RISK_TYPE_LABELS } from '../constants';

interface RiskFlagBannerProps {
  riskFlags: RiskFlag[];
  compact?: boolean;
}

const SEVERITY_CONFIG: Record<RiskSeverity, { bg: string; text: string; border: string; iconColor: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', iconColor: 'text-red-500' },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', iconColor: 'text-red-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', iconColor: 'text-amber-500' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', iconColor: 'text-blue-500' },
};

export default function RiskFlagBanner({ riskFlags, compact = false }: RiskFlagBannerProps) {
  const activeRisks = riskFlags.filter((r) => !r.resolvedAt);

  if (activeRisks.length === 0) return null;

  const severityOrder: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...activeRisks].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {sorted.map((risk) => {
          const config = SEVERITY_CONFIG[risk.severity];
          return (
            <span
              key={risk.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase ${config.bg} ${config.text}`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${config.iconColor}`} />
              {risk.severity}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((risk) => {
        const config = SEVERITY_CONFIG[risk.severity];
        return (
          <div
            key={risk.id}
            className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border ${config.bg} ${config.border}`}
          >
            <ShieldAlert className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
            <div>
              <p className={`text-sm font-semibold ${config.text}`}>
                {RISK_TYPE_LABELS[risk.type]}
              </p>
              <p className={`text-xs ${config.text} opacity-80`}>{risk.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
