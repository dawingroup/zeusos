/**
 * Construction Order Detail Page.
 *
 * Renders a single CO with stage stepper, per-stage advance buttons,
 * contractor + cost panels, execution timeline, and snag list.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  HardHat,
  ArrowRight,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useConstructionOrder } from '../hooks/useConstructionOrder';
import {
  transitionCOStage,
  getNextCOStage,
  markSignoff,
  addSnag,
  resolveSnag,
  putCOOnHold,
  resumeCO,
  cancelCO,
} from '../services/constructionOrderService';
import { CO_STAGE_LABELS, CO_STATUS_LABELS } from '../types';
import { COStageStepper } from '../components/COStageStepper';
import { ExecutionTimeline } from '../components/ExecutionTimeline';

export default function ConstructionOrderDetailPage() {
  const { coId } = useParams<{ coId: string }>();
  const { user } = useAuth();
  const { order, loading } = useConstructionOrder(coId);

  const [busy, setBusy] = useState(false);
  const [newSnag, setNewSnag] = useState('');

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading construction order…</div>;
  }
  if (!order) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-600">Construction Order not found.</div>
        <Link to="/construction" className="text-sm text-amber-700 hover:underline">
          ← Back to Construction Orders
        </Link>
      </div>
    );
  }

  const userId = user?.uid || 'system';
  const nextStage = getNextCOStage(order.currentStage);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      alert(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const onAdvance = () =>
    nextStage && guard(() => transitionCOStage(order.id, nextStage, userId));

  const onSignoff = () => guard(() => markSignoff(order.id, userId));

  const onHold = () => {
    const reason = window.prompt('Reason for hold?') || undefined;
    return guard(() => putCOOnHold(order.id, userId, reason));
  };

  const onResume = () => guard(() => resumeCO(order.id, userId));

  const onCancel = () => {
    if (!window.confirm('Cancel this Construction Order?')) return;
    const reason = window.prompt('Reason for cancellation?') || undefined;
    return guard(() => cancelCO(order.id, userId, reason));
  };

  const onAddSnag = async () => {
    const desc = newSnag.trim();
    if (!desc) return;
    await guard(() => addSnag(order.id, { description: desc, severity: 'minor' }, userId));
    setNewSnag('');
  };

  const snags = order.execution?.snagList || [];
  const openSnags = snags.filter((s) => !s.resolvedAt);
  const canSignoff = order.currentStage === 'handover' && !order.execution?.signoffAt;
  const isTerminal = order.status === 'completed' || order.status === 'cancelled';

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/construction"
            className="text-gray-400 hover:text-gray-600"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{order.coNumber}</h1>
            <p className="text-sm text-gray-500">
              {order.designItemName || 'Construction item'}
              {order.projectCode ? ` · ${order.projectCode}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase px-2 py-1 bg-gray-100 text-gray-700 rounded">
            {CO_STATUS_LABELS[order.status]}
          </span>
          {!isTerminal && nextStage && (
            <button
              onClick={onAdvance}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50"
            >
              Advance to {CO_STAGE_LABELS[nextStage]}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {canSignoff && (
            <button
              onClick={onSignoff}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Record Final Signoff
            </button>
          )}
          {!isTerminal && order.status !== 'on-hold' && (
            <button
              onClick={onHold}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <PauseCircle className="w-4 h-4" />
              Hold
            </button>
          )}
          {order.status === 'on-hold' && (
            <button
              onClick={onResume}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              Resume
            </button>
          )}
          {!isTerminal && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm border border-red-200 text-red-700 px-3 py-1.5 rounded hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <COStageStepper currentStage={order.currentStage} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contractor panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Contractor</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900 text-right">{order.contractorName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Contact</dt>
              <dd className="text-gray-900 text-right">{order.contractorContact || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">ID</dt>
              <dd className="text-gray-900 text-right">{order.contractorId || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Cost panel */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost</h3>
          <p className="text-2xl font-semibold text-gray-900">
            {order.currency} {(order.totalCost || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Copied from design item at release.</p>
        </div>

        {/* Source link */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Source</h3>
          <p className="text-sm text-gray-700">
            Design Item: <span className="font-medium">{order.designItemName || order.designItemId}</span>
          </p>
          <Link
            to={`/design/project/${order.projectId}/item/${order.designItemId}`}
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:underline mt-2"
          >
            Open design item
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Execution timeline + Snag list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Execution Timeline</h3>
          <ExecutionTimeline execution={order.execution} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Snag List</h3>
            {openSnags.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                {openSnags.length} open
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={newSnag}
              onChange={(e) => setNewSnag(e.target.value)}
              placeholder="Describe a snag…"
              className="flex-1 text-sm border rounded px-2 py-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddSnag();
              }}
            />
            <button
              onClick={onAddSnag}
              disabled={busy || !newSnag.trim()}
              className="inline-flex items-center gap-1 text-sm bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {snags.length === 0 ? (
            <p className="text-xs text-gray-500">No snags raised.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {snags.map((s) => (
                <li key={s.id} className="py-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className={
                        s.resolvedAt
                          ? 'text-sm text-gray-400 line-through'
                          : 'text-sm text-gray-800'
                      }
                    >
                      {s.description}
                    </p>
                    {s.severity && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">
                        {s.severity}
                      </span>
                    )}
                  </div>
                  {!s.resolvedAt && (
                    <button
                      onClick={() =>
                        guard(() =>
                          resolveSnag(order.id, s.id, userId, 'Resolved on site'),
                        )
                      }
                      disabled={busy}
                      className="text-xs text-green-700 hover:underline disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Scope */}
      {(order.scopeOfWork || order.exclusions || order.notes) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {order.scopeOfWork && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Scope of Work</h4>
              <p className="text-sm text-gray-800 whitespace-pre-line">{order.scopeOfWork}</p>
            </div>
          )}
          {order.exclusions && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Exclusions</h4>
              <p className="text-sm text-gray-800 whitespace-pre-line">{order.exclusions}</p>
            </div>
          )}
          {order.notes && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-gray-500">Notes</h4>
              <p className="text-sm text-gray-800 whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
