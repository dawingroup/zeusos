/**
 * ReleaseChecklist — Pre-production gate verification checklist.
 * Supports pass/waive actions on individual gates to override blockers.
 */

import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Rocket,
  ShieldOff,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { SalesOrder, ApprovalGateId } from '../types';
import { GATE_LABELS, GATE_ORDER } from '../constants';
import { passGate, waiveGate, freezeScope } from '../services/salesOrderService';

interface ReleaseChecklistProps {
  order: SalesOrder;
  userId: string;
  onRelease: () => void;
  releasing?: boolean;
}

export default function ReleaseChecklist({
  order,
  userId,
  onRelease,
  releasing = false,
}: ReleaseChecklistProps) {
  const [waiveDialogGate, setWaiveDialogGate] = useState<ApprovalGateId | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [gateLoading, setGateLoading] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const checks = GATE_ORDER.map((gateId: ApprovalGateId) => {
    const gate = order.gates[gateId];
    const passed = !gate.required || gate.status === 'approved' || gate.status === 'waived';
    return {
      id: gateId,
      label: GATE_LABELS[gateId],
      required: gate.required,
      passed,
      waived: gate.status === 'waived',
      status: gate.status,
      isGate: true,
    };
  });

  const scopeFrozenCheck = {
    id: 'scope_frozen' as const,
    label: 'Scope Frozen',
    required: true,
    passed: order.scopeFrozen,
    waived: false,
    status: order.scopeFrozen ? 'approved' : 'not_started',
    isGate: false,
  };

  const criticalRisks = order.riskFlags.filter(
    (r) => r.severity === 'critical' && !r.resolvedAt,
  );
  const noCriticalRisks = {
    id: 'no_critical_risks' as const,
    label: 'No unresolved critical risks',
    required: true,
    passed: criticalRisks.length === 0,
    waived: false,
    status: criticalRisks.length === 0 ? 'approved' : 'rejected',
    isGate: false,
  };

  const allChecks = [...checks, scopeFrozenCheck, noCriticalRisks];
  const allPassed = allChecks.every((c) => c.passed);

  const handlePassGate = async (gateId: ApprovalGateId) => {
    setGateLoading(gateId);
    setGateError(null);
    try {
      await passGate(order.id, gateId, userId, 'Manually approved via checklist');
    } catch (err) {
      const msg = (err as Error).message || 'Failed to pass gate';
      setGateError(msg);
      console.error('Failed to pass gate:', err);
    } finally {
      setGateLoading(null);
    }
  };

  const handleFreezeScope = async () => {
    setGateLoading('scope_frozen');
    setGateError(null);
    try {
      await freezeScope(order.id, userId);
    } catch (err) {
      const msg = (err as Error).message || 'Failed to freeze scope';
      setGateError(msg);
      console.error('Failed to freeze scope:', err);
    } finally {
      setGateLoading(null);
    }
  };

  const handleWaiveGate = async () => {
    if (!waiveDialogGate || !waiveReason.trim()) return;
    setGateLoading(waiveDialogGate);
    setGateError(null);
    try {
      await waiveGate(order.id, waiveDialogGate, userId, waiveReason.trim());
      setWaiveDialogGate(null);
      setWaiveReason('');
    } catch (err) {
      const msg = (err as Error).message || 'Failed to waive gate';
      setGateError(msg);
      console.error('Failed to waive gate:', err);
    } finally {
      setGateLoading(null);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Production Release Checklist
      </h3>

      <div className="space-y-1">
        {allChecks.map((check) => (
          <div
            key={check.id}
            className="flex items-center justify-between py-1.5 group"
          >
            <div className="flex items-center gap-2">
              {check.passed ? (
                <CheckCircle
                  className={`h-5 w-5 flex-shrink-0 ${check.waived ? 'text-amber-500' : 'text-green-600'}`}
                />
              ) : check.required ? (
                <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              ) : (
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-gray-300" />
              )}
              <span
                className={`text-sm ${
                  check.passed ? 'text-gray-700' : 'font-semibold text-red-600'
                }`}
              >
                {check.label}
                {check.waived && (
                  <span className="ml-1.5 text-xs text-amber-600">(Waived)</span>
                )}
                {!check.required && (
                  <span className="ml-1.5 text-xs text-gray-400">(Not required)</span>
                )}
              </span>
            </div>

            {/* Gate override actions */}
            {check.isGate && !check.passed && check.required && (
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50"
                  onClick={() => handlePassGate(check.id as ApprovalGateId)}
                  disabled={gateLoading === check.id}
                  title="Mark as passed"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
                <button
                  className="p-1 rounded hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-50"
                  onClick={() => setWaiveDialogGate(check.id as ApprovalGateId)}
                  disabled={gateLoading === check.id}
                  title="Waive (override with reason)"
                >
                  <ShieldOff className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Scope freeze action */}
            {check.id === 'scope_frozen' && !check.passed && (
              <button
                className="px-2.5 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                onClick={handleFreezeScope}
                disabled={gateLoading === 'scope_frozen'}
              >
                {gateLoading === 'scope_frozen' ? 'Freezing...' : 'Freeze Scope'}
              </button>
            )}
          </div>
        ))}
      </div>

      {gateError && (
        <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{gateError}</span>
          <button onClick={() => setGateError(null)} className="p-0.5 hover:bg-red-100 rounded">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {!allPassed && !gateError && (
        <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs">
          Use the shield icons to manually approve or waive blocking gates.
        </div>
      )}

      <button
        className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          allPassed && !releasing
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        onClick={onRelease}
        disabled={!allPassed || releasing}
      >
        <Rocket className="h-4 w-4" />
        {releasing ? 'Releasing...' : 'Release to Production'}
      </button>

      {/* Waive Gate Dialog */}
      {waiveDialogGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Waive Gate: {GATE_LABELS[waiveDialogGate]}
              </h3>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => setWaiveDialogGate(null)}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Waiving a gate bypasses this requirement and adds a risk flag to the order audit trail.
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for waiver <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="e.g. Client verbally approved via phone, deposit received offline..."
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setWaiveDialogGate(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleWaiveGate}
                disabled={!waiveReason.trim() || !!gateLoading}
              >
                {gateLoading ? 'Waiving...' : 'Waive Gate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
