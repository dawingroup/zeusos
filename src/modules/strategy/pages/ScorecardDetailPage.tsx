// ============================================================================
// ScorecardDetailPage
// DawinOS v2.0 - CEO Strategy Command Module
// Detail view + section/KPI management for a single KPI scorecard
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronRight,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
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
import { Label } from '@/core/components/ui/label';
import { useKPIScorecard } from '../hooks/useKPIScorecard';
import { useKPIs } from '../hooks/useKPIs';
import { kpiService } from '../services/kpi.service';
import type { CreateScorecardSectionInput, ScorecardSection } from '../types/kpi.types';
import {
  KPI_PERFORMANCE_COLORS,
  KPI_PERFORMANCE_LABELS,
  KPI_SCOPE_LABELS,
  KPI_SCORECARD_TYPE_LABELS,
  type KPIPerformance,
  type KPIScorecardType,
} from '../constants/kpi.constants';
import { STRATEGY_COMPANY_ID } from '../constants/company';

const COMPANY_ID = STRATEGY_COMPANY_ID;

const SECTION_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const ScorecardDetailPage: React.FC = () => {
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const navigate = useNavigate();

  const {
    scorecard,
    kpis: assignedKpis,
    overallScore,
    sectionScores,
    loading,
    error,
    refresh,
    addSection,
    updateSection,
    removeSection,
  } = useKPIScorecard({
    companyId: COMPANY_ID,
    scorecardId: scorecardId || null,
  });

  const { activeKPIs } = useKPIs({ companyId: COMPANY_ID, autoFetch: true });

  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!scorecard) return;
    setBusy(true);
    try {
      await kpiService.deleteScorecard(COMPANY_ID, scorecard.id);
      navigate('/strategy/kpis/scorecards');
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  const handleAddKpiToSection = async (section: ScorecardSection, kpiId: string) => {
    if (section.kpiIds.includes(kpiId)) return;
    setBusy(true);
    try {
      await updateSection(section.id, { kpiIds: [...section.kpiIds, kpiId] });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveKpiFromSection = async (section: ScorecardSection, kpiId: string) => {
    setBusy(true);
    try {
      await updateSection(section.id, { kpiIds: section.kpiIds.filter((id) => id !== kpiId) });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSection = async (section: ScorecardSection) => {
    if (!confirm(`Remove section "${section.name}"? KPIs themselves stay; they just leave this scorecard.`)) return;
    setBusy(true);
    try {
      await removeSection(section.id);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading scorecard…
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/strategy/kpis/scorecards')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to scorecards
        </Button>
        <Banner
          tone="danger"
          title="Couldn't load scorecard"
          message={error?.message || 'Scorecard not available'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
    );
  }

  const sectionsSorted = [...scorecard.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
        <button
          onClick={() => navigate('/strategy/kpis/scorecards')}
          className="hover:text-gray-700 inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Scorecards
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-700 truncate">{scorecard.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {KPI_SCORECARD_TYPE_LABELS[scorecard.type as KPIScorecardType] || scorecard.type}
              </span>
              <span className="text-[11px] text-gray-500">
                {KPI_SCOPE_LABELS[scorecard.scope]}
              </span>
              <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                FY {scorecard.fiscalYear}{scorecard.quarter ? ` · Q${scorecard.quarter}` : ''}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{scorecard.name}</h1>
            {scorecard.description && (
              <p className="mt-1.5 text-sm text-gray-600">{scorecard.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5" />
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

        {/* Overall score */}
        <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-100">
          <ScoreStat label="Overall score" value={`${overallScore.toFixed(1)}%`} accent />
          <ScoreStat
            label="Sections"
            value={`${sectionsSorted.length}`}
            sub={`${assignedKpis.length} KPI${assignedKpis.length === 1 ? '' : 's'} assigned`}
          />
          <ScoreStat
            label="Refresh"
            value={scorecard.refreshFrequency}
            sub={`${[
              scorecard.showTrends && 'trends',
              scorecard.showTargets && 'targets',
              scorecard.showVariance && 'variance',
            ]
              .filter(Boolean)
              .join(' · ')}`}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sectionsSorted.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            score={sectionScores[section.id] || 0}
            assignedKpis={assignedKpis.filter((k) => section.kpiIds.includes(k.id))}
            availableKpis={activeKPIs.filter((k) => !section.kpiIds.includes(k.id))}
            pickerOpen={pickerSectionId === section.id}
            onOpenPicker={() => setPickerSectionId(section.id)}
            onClosePicker={() => setPickerSectionId(null)}
            onPickKpi={(kpiId) => handleAddKpiToSection(section, kpiId)}
            onRemoveKpi={(kpiId) => handleRemoveKpiFromSection(section, kpiId)}
            onRemoveSection={() => handleRemoveSection(section)}
            disableRemove={sectionsSorted.length <= 1}
            busy={busy}
          />
        ))}

        <Button variant="outline" size="sm" onClick={() => setAddSectionOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add section
        </Button>
      </div>

      {/* Add section dialog */}
      {addSectionOpen && (
        <AddSectionDialog
          open={addSectionOpen}
          onOpenChange={setAddSectionOpen}
          existingCount={sectionsSorted.length}
          onAdd={async (input) => {
            await addSection(input);
          }}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this scorecard?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              The scorecard and its section structure will be removed. The underlying KPI
              definitions and their measurements stay intact.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete scorecard
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ScoreStat
// ---------------------------------------------------------------------------
const ScoreStat: React.FC<{ label: string; value: string; sub?: string; accent?: boolean }> = ({
  label,
  value,
  sub,
  accent,
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">{label}</p>
    <p
      className={`text-xl font-semibold tabular-nums ${
        accent ? 'text-blue-700' : 'text-gray-900'
      }`}
    >
      {value}
    </p>
    {sub && <p className="text-[11px] text-gray-500 mt-0.5 capitalize">{sub}</p>}
  </div>
);

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------
interface SectionCardProps {
  section: ScorecardSection;
  score: number;
  assignedKpis: { id: string; code: string; name: string; currentValue?: number; unit: string; currentPerformance?: string }[];
  availableKpis: { id: string; code: string; name: string }[];
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onPickKpi: (kpiId: string) => void;
  onRemoveKpi: (kpiId: string) => void;
  onRemoveSection: () => void;
  disableRemove: boolean;
  busy: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  score,
  assignedKpis,
  availableKpis,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onPickKpi,
  onRemoveKpi,
  onRemoveSection,
  disableRemove,
  busy,
}) => {
  const color = section.color || SECTION_PALETTE[section.order % SECTION_PALETTE.length];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <h3 className="text-sm font-semibold text-gray-900 truncate">{section.name}</h3>
          <span className="text-[11px] text-gray-500 flex-shrink-0">
            weight {section.weight}
          </span>
          {section.kpiIds.length > 0 && (
            <span className="text-[11px] text-gray-500 inline-flex items-center gap-1 flex-shrink-0">
              <Layers className="h-3 w-3" />
              {section.kpiIds.length} KPI{section.kpiIds.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[12px] font-semibold tabular-nums px-2 py-0.5 rounded"
            style={{
              color,
              backgroundColor: color + '11',
            }}
          >
            {score.toFixed(1)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemoveSection}
            disabled={busy || disableRemove}
            aria-label="Remove section"
            title={disableRemove ? 'Keep at least one section' : 'Remove section'}
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-400" />
          </Button>
        </div>
      </div>

      {assignedKpis.length === 0 ? (
        <p className="text-[12px] text-gray-500 mb-2">No KPIs in this section yet.</p>
      ) : (
        <ul className="space-y-1 mb-3">
          {assignedKpis.map((kpi) => {
            const perf = (kpi.currentPerformance as KPIPerformance) || undefined;
            const perfColor = perf ? KPI_PERFORMANCE_COLORS[perf] : '#9ca3af';
            return (
              <li
                key={kpi.id}
                className="flex items-center gap-2 p-2 rounded border border-gray-100 hover:border-gray-200 group"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: perfColor }}
                  aria-hidden
                />
                <Link
                  to={`/strategy/kpis/active/${kpi.id}`}
                  className="flex items-center gap-2 min-w-0 flex-1 hover:underline underline-offset-2"
                >
                  <span className="text-[10px] font-mono px-1 py-0 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                    {kpi.code}
                  </span>
                  <span className="text-[12.5px] font-medium text-gray-900 truncate">
                    {kpi.name}
                  </span>
                </Link>
                <span className="text-[11px] text-gray-500 tabular-nums flex-shrink-0">
                  {kpi.currentValue !== undefined ? `${kpi.currentValue}` : '—'}
                  {kpi.unit ? ` ${kpi.unit}` : ''}
                </span>
                {perf && (
                  <span className="text-[10px] text-gray-400 hidden md:inline flex-shrink-0">
                    {KPI_PERFORMANCE_LABELS[perf]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveKpi(kpi.id)}
                  disabled={busy}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove from section"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen ? (
        <div className="border border-gray-200 rounded-md p-2 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-gray-500 font-medium">
              Add KPI to {section.name}
            </span>
            <button
              type="button"
              onClick={onClosePicker}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close picker"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {availableKpis.length === 0 ? (
            <p className="text-[12px] text-gray-500 px-2 py-3 text-center">
              All active KPIs are already in this section.
            </p>
          ) : (
            <ul className="max-h-[200px] overflow-y-auto">
              {availableKpis.map((kpi) => (
                <li key={kpi.id}>
                  <button
                    type="button"
                    onClick={() => onPickKpi(kpi.id)}
                    disabled={busy}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white"
                  >
                    <span className="text-[10px] font-mono px-1 py-0 rounded bg-gray-100 text-gray-600">
                      {kpi.code}
                    </span>
                    <span className="text-[12.5px] text-gray-900 truncate flex-1">
                      {kpi.name}
                    </span>
                    <ArrowRight className="h-3 w-3 text-gray-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onOpenPicker} disabled={busy}>
          <Plus className="h-3.5 w-3.5" />
          Add KPI
        </Button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// AddSectionDialog
// ---------------------------------------------------------------------------
const AddSectionDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
  onAdd: (input: CreateScorecardSectionInput) => Promise<void>;
}> = ({ open, onOpenChange, existingCount, onAdd }) => {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('1');
  const [color, setColor] = useState(SECTION_PALETTE[existingCount % SECTION_PALETTE.length]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setWeight('1');
      setColor(SECTION_PALETTE[existingCount % SECTION_PALETTE.length]);
      setError(null);
    }
  }, [open, existingCount]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({
        name: name.trim(),
        weight: parseFloat(weight) || 1,
        kpiIds: [],
        color,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add section');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add section</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="sec-name">Name *</Label>
            <Input
              id="sec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Experience"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sec-weight">Weight</Label>
              <Input
                id="sec-weight"
                type="number"
                step="0.1"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-1 h-9">
                {SECTION_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${
                      color === c ? 'border-gray-700' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
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
            disabled={!name.trim() || submitting}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScorecardDetailPage;
