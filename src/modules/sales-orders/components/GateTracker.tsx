/**
 * GateTracker — The most important UI element.
 * Visual horizontal stepper showing all 6 approval gates with pass/fail/pending/waived status.
 */

import {
  CheckCircle,
  XCircle,
  Clock,
  ShieldOff,
  Minus,
} from 'lucide-react';
import type { ApprovalGates, ApprovalGateId, GateStatusValue } from '../types';
import { GATE_LABELS, GATE_ORDER, GATE_DESCRIPTIONS } from '../constants';

interface GateTrackerProps {
  gates: ApprovalGates;
  onGateClick?: (gateId: ApprovalGateId) => void;
  compact?: boolean;
}

const statusConfig: Record<
  GateStatusValue,
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  approved: { icon: CheckCircle, color: 'text-green-600', label: 'Passed' },
  rejected: { icon: XCircle, color: 'text-red-600', label: 'Rejected' },
  in_progress: { icon: Clock, color: 'text-amber-600', label: 'In Progress' },
  not_started: { icon: Minus, color: 'text-gray-400', label: 'Pending' },
  waived: { icon: ShieldOff, color: 'text-amber-500', label: 'Waived' },
};

const statusBadgeConfig: Record<GateStatusValue, { bg: string; text: string }> = {
  approved: { bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
  not_started: { bg: 'bg-gray-100', text: 'text-gray-500' },
  waived: { bg: 'bg-amber-100', text: 'text-amber-600' },
};

export default function GateTracker({ gates, onGateClick, compact = false }: GateTrackerProps) {
  if (compact) {
    return (
      <div className="flex flex-col gap-2 py-1">
        {GATE_ORDER.map((gateId) => {
          const gate = gates[gateId];
          const config = statusConfig[gate.status];
          const Icon = config.icon;
          return (
            <div
              key={gateId}
              className={`flex items-center gap-2 ${onGateClick ? 'cursor-pointer' : ''}`}
              onClick={() => onGateClick?.(gateId)}
            >
              <Icon className={`h-4 w-4 ${gate.required ? config.color : 'text-gray-300'}`} />
              <span className={`text-xs ${gate.required ? 'text-gray-700' : 'text-gray-400'}`}>
                {GATE_LABELS[gateId]}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full py-2">
      <p className="text-sm font-semibold text-gray-900 mb-3">Approval Gates</p>
      <div className="flex items-start">
        {GATE_ORDER.map((gateId, idx) => {
          const gate = gates[gateId];
          const config = statusConfig[gate.status];
          const badgeConfig = statusBadgeConfig[gate.status];
          const Icon = config.icon;
          const label = GATE_LABELS[gateId];
          const description = GATE_DESCRIPTIONS[gateId];

          return (
            <div key={gateId} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div className="absolute top-4 right-1/2 w-full h-0.5 bg-gray-200 -z-0" />
              )}

              {/* Icon */}
              <div
                className={`relative z-10 bg-white p-1 ${onGateClick ? 'cursor-pointer' : ''}`}
                onClick={() => onGateClick?.(gateId)}
                title={`${label}: ${description}${!gate.required ? ' (Not required)' : ''}${gate.notes ? `\n${gate.notes}` : ''}`}
              >
                <Icon
                  className={`h-5 w-5 ${gate.required ? config.color : 'text-gray-300'}`}
                  style={{ opacity: gate.required ? 1 : 0.5 }}
                />
              </div>

              {/* Label */}
              <p
                className={`text-[10px] font-semibold mt-1 text-center leading-tight ${
                  gate.required ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {label}
              </p>

              {/* Status badge */}
              <span
                className={`mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  gate.required
                    ? `${badgeConfig.bg} ${badgeConfig.text}`
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {gate.required ? config.label : 'N/A'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
