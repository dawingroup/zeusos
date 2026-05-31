// ============================================================================
// ObjectiveDetailPage
// DawinOS v2.0 - CEO Strategy Command Module
// Detail view + KR management for a single OKR objective
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Circle,
  Edit2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { okrService } from '../services/okr.service';
import { useOKRs } from '../hooks/useOKRs';
import { useOKRCycles } from '../hooks/useOKRCycle';
import { useAuth } from '@/shared/hooks/useAuth';
import type {
  CreateKeyResultInput,
  KeyResult,
  OKRObjective,
} from '../types/okr.types';
import {
  CONFIDENCE_LEVEL,
  CONFIDENCE_LEVEL_COLORS,
  CONFIDENCE_LEVEL_LABELS,
  KEY_RESULT_TYPE,
  KEY_RESULT_TYPE_LABELS,
  OKR_LEVEL_LABELS,
  OKR_STATUS,
  OKR_STATUS_LABELS,
  formatProgress,
  formatScore,
  getScoreColor,
  type KeyResultType,
} from '../constants/okr.constants';
import { ObjectiveDialog } from '../components/okr/ObjectiveDialog';
import { CheckInDialog } from '../components/okr/CheckInDialog';
import { KpiPicker } from '../components/okr/KpiPicker';
import { STRATEGY_COMPANY_ID } from '../constants/company';

const COMPANY_ID = STRATEGY_COMPANY_ID;

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  deferred: 'bg-amber-50 text-amber-700 border-amber-200',
};

const CONFIDENCE_TEXT_CLASS: Record<string, string> = {
  success: 'text-green-700 bg-green-50 border-green-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  error: 'text-red-700 bg-red-50 border-red-200',
  default: 'text-gray-700 bg-gray-50 border-gray-200',
  info: 'text-blue-700 bg-blue-50 border-blue-200',
};

export const ObjectiveDetailPage: React.FC = () => {
  const { objectiveId } = useParams<{ objectiveId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [objective, setObjective] = useState<OKRObjective | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addKROpen, setAddKROpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<KeyResult | null>(null);
  const [editLinkTarget, setEditLinkTarget] = useState<KeyResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { cycles } = useOKRCycles({ companyId: COMPANY_ID });
  const {
    updateObjective,
    deleteObjective,
    activateObjective,
    completeObjective,
    addKeyResult,
    updateKeyResult,
    removeKeyResult,
    checkIn,
  } = useOKRs({ companyId: COMPANY_ID, autoFetch: false });

  const loadObjective = async () => {
    if (!objectiveId) return;
    setLoading(true);
    setError(null);
    try {
      const obj = await okrService.getObjective(COMPANY_ID, objectiveId);
      if (!obj) {
        setError('Objective not found');
      } else {
        setObjective(obj);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load objective');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObjective();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectiveId]);

  const handleActivate = async () => {
    if (!objective) return;
    setBusy(true);
    try {
      const next = await activateObjective(objective.id);
      setObjective(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!objective) return;
    setBusy(true);
    try {
      const next = await completeObjective(objective.id);
      setObjective(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!objective) return;
    setBusy(true);
    try {
      await deleteObjective(objective.id);
      navigate('/strategy/okrs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setBusy(false);
    }
  };

  const handleAddKR = async (input: CreateKeyResultInput) => {
    if (!objective) return;
    await addKeyResult(objective.id, input);
    await loadObjective();
  };

  const handleRemoveKR = async (krId: string) => {
    if (!objective) return;
    if (!confirm('Remove this key result?')) return;
    setBusy(true);
    try {
      await removeKeyResult(objective.id, krId);
      await loadObjective();
    } finally {
      setBusy(false);
    }
  };

  const handleCheckIn = async (input: {
    keyResultId: string;
    newValue: number;
    confidence: typeof CONFIDENCE_LEVEL[keyof typeof CONFIDENCE_LEVEL];
    note?: string;
    blockers?: string[];
    wins?: string[];
  }) => {
    if (!objective) return;
    await checkIn(objective.id, input);
    await loadObjective();
  };

  const handleMilestoneToggle = async (krId: string, milestoneId: string) => {
    if (!objective || !user?.uid) return;
    setBusy(true);
    try {
      await okrService.completeMilestone(
        COMPANY_ID,
        objective.id,
        krId,
        milestoneId,
        user.uid,
        user.displayName || undefined
      );
      await loadObjective();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update milestone');
    } finally {
      setBusy(false);
    }
  };

  const recentCheckIns = useMemo(() => {
    if (!objective) return [];
    return objective.keyResults
      .flatMap((kr) =>
        kr.checkIns.map((ci) => ({ ...ci, krTitle: kr.title, krId: kr.id }))
      )
      .sort((a, b) => b.date.toMillis() - a.date.toMillis())
      .slice(0, 8);
  }, [objective]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading objective…
      </div>
    );
  }

  if (error || !objective) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/strategy/okrs')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to OKRs
        </Button>
        <Banner
          tone="danger"
          title="Couldn't load objective"
          message={error || 'Objective not available'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    );
  }

  const scoreColor = getScoreColor(objective.score);
  const cycle = cycles.find((c) => c.id === objective.cycleId);
  const isDraft = objective.status === OKR_STATUS.DRAFT;
  const isActive = objective.status === OKR_STATUS.ACTIVE;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1100px] mx-auto">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
        <button
          onClick={() => navigate('/strategy/okrs')}
          className="hover:text-gray-700 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          OKRs
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-700 truncate">{objective.title}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  STATUS_BADGE_CLASS[objective.status] || STATUS_BADGE_CLASS.draft
                }`}
              >
                {OKR_STATUS_LABELS[objective.status]}
              </span>
              <span className="text-[11px] text-gray-500 uppercase tracking-wide">
                {OKR_LEVEL_LABELS[objective.level]}
              </span>
              {objective.isStretch && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  <Zap className="h-3 w-3" />
                  Stretch
                </span>
              )}
              {cycle && (
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                  <Calendar className="h-3 w-3" />
                  {cycle.name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{objective.title}</h1>
            {objective.description && (
              <p className="mt-1.5 text-sm text-gray-600">{objective.description}</p>
            )}
            <div className="mt-3 flex items-center gap-4 text-[12px] text-gray-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {objective.ownerName}
              </span>
              {objective.category && (
                <span className="text-gray-400">· {objective.category}</span>
              )}
              {objective.lastCheckInDate && (
                <span>
                  Last check-in {objective.lastCheckInDate.toDate().toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={loadObjective}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress + actions */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[11px] text-gray-500 font-medium uppercase">Progress</span>
              <span className="text-[12px] font-semibold" style={{ color: scoreColor }}>
                {formatProgress(objective.progress || 0)} · {formatScore(objective.score || 0)}
              </span>
            </div>
            <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(objective.progress || 0, 100)}%`,
                  backgroundColor: scoreColor,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <Button variant="primary" size="sm" onClick={handleActivate} disabled={busy}>
                Activate
              </Button>
            )}
            {isActive && (
              <Button variant="outline" size="sm" onClick={handleComplete} disabled={busy}>
                Mark complete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Key results */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Key results
            <span className="ml-2 text-[12px] text-gray-500 font-normal">
              {objective.keyResults.length}/5
            </span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddKROpen(true)}
            disabled={objective.keyResults.length >= 5}
          >
            <Plus className="h-3.5 w-3.5" />
            Add key result
          </Button>
        </div>

        {objective.keyResults.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-sm">No key results yet.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => setAddKROpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first KR
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {objective.keyResults
              .sort((a, b) => a.order - b.order)
              .map((kr, idx) => (
                <KeyResultRow
                  key={kr.id}
                  index={idx}
                  kr={kr}
                  onCheckIn={() => setCheckInTarget(kr)}
                  onRemove={() => handleRemoveKR(kr.id)}
                  onEditLink={() => setEditLinkTarget(kr)}
                  onToggleMilestone={(milestoneId) => handleMilestoneToggle(kr.id, milestoneId)}
                  onTargetChange={async (newTarget) => {
                    if (!objective) return;
                    await updateKeyResult(objective.id, kr.id, { targetValue: newTarget });
                    await loadObjective();
                  }}
                  busy={busy}
                />
              ))}
          </div>
        )}
      </div>

      {/* Recent check-ins */}
      {recentCheckIns.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4 inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            Recent check-ins
          </h2>
          <div className="space-y-3">
            {recentCheckIns.map((ci) => {
              const confKey = ci.confidence;
              const confColor = CONFIDENCE_LEVEL_COLORS[confKey] || 'default';
              return (
                <div
                  key={ci.id}
                  className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0 last:pb-0"
                >
                  <div className="mt-0.5">
                    <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[12.5px] font-medium text-gray-900 truncate">
                        {ci.krTitle}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          CONFIDENCE_TEXT_CLASS[confColor] || CONFIDENCE_TEXT_CLASS.default
                        }`}
                      >
                        {CONFIDENCE_LEVEL_LABELS[confKey]}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {ci.date.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-600">
                      <span className="text-gray-400">{ci.previousValue}</span> →{' '}
                      <span className="font-medium text-gray-900">{ci.newValue}</span>
                      {ci.note && <span className="ml-2 text-gray-500">· {ci.note}</span>}
                    </p>
                    {(ci.wins.length > 0 || ci.blockers.length > 0) && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        {ci.wins.map((w, i) => (
                          <span
                            key={`w-${i}`}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"
                          >
                            ✓ {w}
                          </span>
                        ))}
                        {ci.blockers.map((b, i) => (
                          <span
                            key={`b-${i}`}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200"
                          >
                            ⚠ {b}
                          </span>
                        ))}
                      </div>
                    )}
                    {ci.createdByName && (
                      <p className="text-[10px] text-gray-400 mt-1">by {ci.createdByName}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editOpen && (
        <ObjectiveDialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) loadObjective();
          }}
          mode="edit"
          companyId={COMPANY_ID}
          objective={objective}
          cycles={cycles}
          defaultCycleId={objective.cycleId}
          defaultOwner={{ id: objective.ownerId, name: objective.ownerName }}
          onUpdate={async (id, input) => {
            const next = await updateObjective(id, input);
            setObjective(next);
            return next;
          }}
        />
      )}

      {/* Add KR dialog */}
      {addKROpen && (
        <AddKeyResultDialog
          open={addKROpen}
          onOpenChange={setAddKROpen}
          companyId={COMPANY_ID}
          onAdd={async (input) => {
            await handleAddKR(input);
          }}
        />
      )}

      {/* Edit linked-KPI dialog */}
      {editLinkTarget && (
        <EditKrLinkDialog
          open={!!editLinkTarget}
          onOpenChange={(open) => !open && setEditLinkTarget(null)}
          companyId={COMPANY_ID}
          keyResult={editLinkTarget}
          onSave={async (link) => {
            if (!objective) return;
            await updateKeyResult(objective.id, editLinkTarget.id, {
              linkedKpiId: link?.id ?? null,
              linkedKpiName: link?.name ?? null,
              linkedKpiUnit: link?.unit ?? null,
            });
            await loadObjective();
            setEditLinkTarget(null);
          }}
        />
      )}

      {/* Check-in dialog */}
      {checkInTarget && (
        <CheckInDialog
          open={!!checkInTarget}
          onOpenChange={(open) => !open && setCheckInTarget(null)}
          keyResult={checkInTarget}
          onSubmit={handleCheckIn}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this objective?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              This will permanently delete the objective and all its key results, check-ins, and
              milestones. This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete objective
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// KeyResultRow
// ---------------------------------------------------------------------------
interface KeyResultRowProps {
  index: number;
  kr: KeyResult;
  onCheckIn: () => void;
  onRemove: () => void;
  onEditLink: () => void;
  onToggleMilestone: (milestoneId: string) => void;
  onTargetChange: (newTarget: number) => Promise<void>;
  busy: boolean;
}

const KeyResultRow: React.FC<KeyResultRowProps> = ({
  index,
  kr,
  onCheckIn,
  onRemove,
  onEditLink,
  onToggleMilestone,
  onTargetChange: _onTargetChange,
  busy,
}) => {
  const navigate = useNavigate();
  const scoreColor = getScoreColor(kr.score || 0);
  const isMilestone = kr.type === KEY_RESULT_TYPE.MILESTONE;

  return (
    <div className="border border-gray-200 rounded-md p-3.5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-medium text-gray-400 uppercase">KR {index + 1}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
              {KEY_RESULT_TYPE_LABELS[kr.type]}
            </span>
            {kr.isComplete && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Done
              </span>
            )}
            {kr.linkedKpiId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/strategy/kpis/${kr.linkedKpiId}`);
                }}
                className="group/chip inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                title={`Open KPI: ${kr.linkedKpiName || 'unnamed'}`}
              >
                <BarChart3 className="h-3 w-3" />
                <span className="truncate max-w-[140px]">
                  {kr.linkedKpiName || 'Linked KPI'}
                </span>
              </button>
            )}
          </div>
          <p className="text-[13.5px] font-medium text-gray-900">{kr.title}</p>
          {kr.description && <p className="text-[12px] text-gray-500 mt-0.5">{kr.description}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onCheckIn} disabled={busy}>
            <TrendingUp className="h-3 w-3" />
            Check in
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEditLink}
            disabled={busy}
            title={kr.linkedKpiId ? 'Change linked KPI' : 'Link a KPI'}
          >
            <BarChart3 className="h-3 w-3" />
            {kr.linkedKpiId ? 'KPI' : 'Link KPI'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove KR"
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-400" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${Math.min((kr.progress || 0), 100)}%`,
              backgroundColor: scoreColor,
            }}
          />
        </div>
        <span className="text-[11px] font-semibold tabular-nums w-12 text-right" style={{ color: scoreColor }}>
          {formatProgress(kr.progress || 0)}
        </span>
      </div>

      <div className="text-[11px] text-gray-500">
        {!isMilestone && (
          <>
            <span className="text-gray-400">{kr.startValue}</span>
            {kr.unit && <span className="text-gray-400"> {kr.unit}</span>}
            <span className="mx-1.5">→</span>
            <span className="font-medium text-gray-900">{kr.currentValue}</span>
            {kr.unit && <span> {kr.unit}</span>}
            <span className="mx-1.5">/</span>
            <span className="font-medium text-gray-700">{kr.targetValue}</span>
            {kr.unit && <span className="text-gray-500"> {kr.unit}</span>}
          </>
        )}
        {kr.ownerName && (
          <span className="ml-3 inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {kr.ownerName}
          </span>
        )}
      </div>

      {isMilestone && kr.milestones.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {kr.milestones
            .sort((a, b) => a.order - b.order)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => !m.isComplete && onToggleMilestone(m.id)}
                disabled={busy || m.isComplete}
                className="flex items-center gap-2 w-full text-left p-1 rounded hover:bg-gray-50 disabled:hover:bg-transparent"
              >
                {m.isComplete ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                )}
                <span
                  className={`text-[12px] ${
                    m.isComplete ? 'text-gray-400 line-through' : 'text-gray-700'
                  }`}
                >
                  {m.title}
                </span>
                {m.targetDate && (
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {m.targetDate.toDate().toLocaleDateString()}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AddKeyResultDialog (lightweight inline-add form)
// ---------------------------------------------------------------------------
interface AddKeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateKeyResultInput) => Promise<void>;
  companyId: string;
}

const AddKeyResultDialog: React.FC<AddKeyResultDialogProps> = ({
  open,
  onOpenChange,
  onAdd,
  companyId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<KeyResultType>(KEY_RESULT_TYPE.NUMERIC);
  const [unit, setUnit] = useState('');
  const [startValue, setStartValue] = useState('0');
  const [targetValue, setTargetValue] = useState('100');
  const [linkedKpi, setLinkedKpi] = useState<{ id: string; name: string; unit?: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setType(KEY_RESULT_TYPE.NUMERIC);
      setUnit('');
      setStartValue('0');
      setTargetValue('100');
      setLinkedKpi(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        unit: unit.trim() || undefined,
        startValue: parseFloat(startValue) || 0,
        targetValue: parseFloat(targetValue) || 0,
        linkedKpiId: linkedKpi?.id,
        linkedKpiName: linkedKpi?.name,
        linkedKpiUnit: linkedKpi?.unit,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add key result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add key result</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="kr-title">Title *</Label>
            <Input
              id="kr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What measurable outcome will move this objective?"
            />
          </div>
          <div>
            <Label htmlFor="kr-desc">Description</Label>
            <Textarea
              id="kr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label htmlFor="kr-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as KeyResultType)}>
                <SelectTrigger id="kr-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KEY_RESULT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kr-start">Start</Label>
              <Input
                id="kr-start"
                type="number"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kr-target">Target</Label>
              <Input
                id="kr-target"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="kr-unit">Unit</Label>
              <Input
                id="kr-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, $"
              />
            </div>
          </div>
          <div>
            <Label>Tracked by KPI (optional)</Label>
            <KpiPicker
              companyId={companyId}
              selectedKpiId={linkedKpi?.id ?? null}
              selectedKpiName={linkedKpi?.name ?? null}
              onChange={setLinkedKpi}
            />
            <p className="mt-1 text-[10.5px] text-gray-500">
              Linking lets this KR show the KPI it's measuring without duplicating the metric.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add key result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// EditKrLinkDialog
// ---------------------------------------------------------------------------
interface EditKrLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  keyResult: KeyResult;
  onSave: (link: { id: string; name: string; unit?: string } | null) => Promise<void>;
}

const EditKrLinkDialog: React.FC<EditKrLinkDialogProps> = ({
  open,
  onOpenChange,
  companyId,
  keyResult,
  onSave,
}) => {
  const [picked, setPicked] = useState<{ id: string; name: string; unit?: string } | null>(
    keyResult.linkedKpiId
      ? {
          id: keyResult.linkedKpiId,
          name: keyResult.linkedKpiName || '',
          unit: keyResult.linkedKpiUnit || undefined,
        }
      : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPicked(
        keyResult.linkedKpiId
          ? {
              id: keyResult.linkedKpiId,
              name: keyResult.linkedKpiName || '',
              unit: keyResult.linkedKpiUnit || undefined,
            }
          : null
      );
      setError(null);
    }
  }, [open, keyResult]);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSave(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link this KR to a KPI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="text-[12px] text-gray-500">Key result</p>
            <p className="text-[13px] font-medium text-gray-900">{keyResult.title}</p>
          </div>
          <div>
            <Label>KPI</Label>
            <KpiPicker
              companyId={companyId}
              selectedKpiId={picked?.id ?? null}
              selectedKpiName={picked?.name ?? null}
              onChange={setPicked}
            />
            <p className="mt-1.5 text-[11px] text-gray-500">
              The KR keeps its own current value and target — the KPI link is shown as a chip so
              readers can jump to the underlying metric. Clearing the link removes the chip and
              the inverse pointer on the KPI page.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObjectiveDetailPage;
