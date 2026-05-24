// ============================================================================
// BUSINESS PIVOTS SECTION
// ZeusOS v2.0 - CEO Strategy Command
// Timeline/card UI for company-level business pivots
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  Calendar,
  Tag,
  ArrowRightLeft,
  TrendingUp,
  Users,
  Cpu,
  DollarSign,
  Link2,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Loader2,
  GitBranch,
} from 'lucide-react';
import type { BusinessPivot, PivotCategory, PivotStatus } from '../../types/strategy.types';
import {
  createPivot,
  updatePivot,
  deletePivot,
  subscribeToPivots,
} from '../../services/businessPivots.service';

const PIVOT_CATEGORIES: { value: PivotCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
  { value: 'customer_focus', label: 'Customer Focus Shift', icon: Users },
  { value: 'product_pivot', label: 'Product Pivot', icon: ArrowRightLeft },
  { value: 'market_pivot', label: 'Market Pivot', icon: TrendingUp },
  { value: 'operational_restructure', label: 'Operational Restructure', icon: GitBranch },
  { value: 'technology_shift', label: 'Technology Shift', icon: Cpu },
  { value: 'revenue_model', label: 'Revenue Model Change', icon: DollarSign },
  { value: 'partnership', label: 'Partnership / Alliance', icon: Link2 },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const PIVOT_STATUSES: { value: PivotStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: 'bg-[var(--bg-sunken)] text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' },
  { value: 'completed', label: 'Completed', color: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' },
  { value: 'abandoned', label: 'Abandoned', color: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]' },
];

const CATEGORY_COLORS: Record<PivotCategory, string> = {
  customer_focus: 'border-l-pink-500',
  product_pivot: 'border-l-blue-500',
  market_pivot: 'border-l-green-500',
  operational_restructure: 'border-l-purple-500',
  technology_shift: 'border-l-cyan-500',
  revenue_model: 'border-l-amber-500',
  partnership: 'border-l-indigo-500',
  other: 'border-l-gray-500',
};

const AFFECTED_AREAS = [
  'Sales', 'Marketing', 'Operations', 'Finance', 'HR', 'Technology',
  'Product', 'Customer Service', 'Supply Chain', 'Legal', 'R&D',
];

function emptyPivot(userId: string): Omit<BusinessPivot, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '', description: '', category: 'other', status: 'planned',
    pivotDate: new Date().toISOString().split('T')[0],
    impactAssessment: '', outcomes: '', lessonsLearned: '',
    affectedAreas: [], createdBy: userId,
  };
}

interface Props {
  companyId: string;
  userId: string;
  readOnly?: boolean;
}

export const BusinessPivotsSection: React.FC<Props> = ({ companyId, userId, readOnly = false }) => {
  const [pivots, setPivots] = useState<BusinessPivot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPivot, setEditingPivot] = useState<(Omit<BusinessPivot, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPivots, setExpandedPivots] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToPivots(companyId, (data) => { setPivots(data); setIsLoading(false); });
    return () => unsub();
  }, [companyId]);

  const toggleExpanded = (id: string) => {
    setExpandedPivots(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleNew = () => { setEditingPivot(emptyPivot(userId)); setIsFormOpen(true); };
  const handleEdit = (p: BusinessPivot) => { setEditingPivot({ ...p }); setIsFormOpen(true); };

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try { await deletePivot(companyId, id); } catch (e) { console.error('Delete failed:', e); }
    finally { setDeletingId(null); }
  }, [companyId]);

  const handleSave = useCallback(async () => {
    if (!editingPivot || !editingPivot.title.trim()) return;
    setIsSaving(true);
    try {
      if (editingPivot.id) {
        const { id, ...data } = editingPivot;
        await updatePivot(companyId, id, data);
      } else {
        await createPivot(companyId, editingPivot);
      }
      setIsFormOpen(false); setEditingPivot(null);
    } catch (e) { console.error('Save failed:', e); }
    finally { setIsSaving(false); }
  }, [companyId, editingPivot]);

  const toggleArea = (area: string) => {
    if (!editingPivot) return;
    const areas = editingPivot.affectedAreas.includes(area)
      ? editingPivot.affectedAreas.filter(a => a !== area)
      : [...editingPivot.affectedAreas, area];
    setEditingPivot({ ...editingPivot, affectedAreas: areas });
  };

  const pivotsByYear = pivots.reduce<Record<string, BusinessPivot[]>>((acc, p) => {
    const yr = p.pivotDate ? new Date(p.pivotDate).getFullYear().toString() : 'Unknown';
    (acc[yr] ||= []).push(p); return acc;
  }, {});
  const sortedYears = Object.keys(pivotsByYear).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return (
      <div className="bg-card border border-[var(--border-subtle)] rounded-xl p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--rag-blue)] mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading business pivots...</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-[var(--border-subtle)] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-sunken)]">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Business Pivots & Strategic Shifts</h3>
            <p className="text-xs text-muted-foreground">{pivots.length} pivot{pivots.length !== 1 ? 's' : ''} documented</p>
          </div>
        </div>
        {!readOnly && (
          <button onClick={handleNew} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Pivot
          </button>
        )}
      </div>

      {/* Form */}
      {isFormOpen && editingPivot && (
        <PivotForm
          pivot={editingPivot}
          onChange={setEditingPivot}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingPivot(null); }}
          isSaving={isSaving}
          onToggleArea={toggleArea}
        />
      )}

      {/* Timeline */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {pivots.length === 0 && !isFormOpen ? (
          <div className="px-5 py-8 text-center">
            <ArrowRightLeft className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-1">No business pivots documented yet</p>
            <p className="text-xs text-[var(--fg-tertiary)] mb-3">Record strategic shifts to provide context for AI-powered strategy reviews.</p>
            {!readOnly && (
              <button onClick={handleNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">
                <Plus className="w-3.5 h-3.5" /> Add First Pivot
              </button>
            )}
          </div>
        ) : sortedYears.map(year => (
          <div key={year}>
            <div className="px-5 py-2 bg-[var(--bg-sunken)] border-b border-[var(--border-subtle)]">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{year}</span>
            </div>
            {pivotsByYear[year].map(pivot => (
              <PivotCard
                key={pivot.id}
                pivot={pivot}
                isExpanded={expandedPivots.has(pivot.id)}
                onToggle={() => toggleExpanded(pivot.id)}
                onEdit={() => handleEdit(pivot)}
                onDelete={() => handleDelete(pivot.id)}
                isDeleting={deletingId === pivot.id}
                readOnly={readOnly}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Sub-components ----

interface PivotFormProps {
  pivot: Omit<BusinessPivot, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
  onChange: (p: Omit<BusinessPivot, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  onToggleArea: (area: string) => void;
}

const PivotForm: React.FC<PivotFormProps> = ({ pivot, onChange, onSave, onCancel, isSaving, onToggleArea }) => (
  <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-indigo-50/30">
    <h4 className="text-sm font-semibold text-foreground mb-3">{pivot.id ? 'Edit Pivot' : 'New Business Pivot'}</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
        <input type="text" value={pivot.title} onChange={(e) => onChange({ ...pivot, title: e.target.value })}
          placeholder="e.g., Shift from retail to B2B customers"
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Pivot Date</label>
          <input type="date" value={pivot.pivotDate} onChange={(e) => onChange({ ...pivot, pivotDate: e.target.value })}
            className="w-full border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select value={pivot.status} onChange={(e) => onChange({ ...pivot, status: e.target.value as PivotStatus })}
            className="w-full border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            {PIVOT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
        <select value={pivot.category} onChange={(e) => onChange({ ...pivot, category: e.target.value as PivotCategory })}
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          {PIVOT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
        <textarea value={pivot.description} onChange={(e) => onChange({ ...pivot, description: e.target.value })}
          placeholder="Describe the pivot, why it was undertaken, and what changed..." rows={3}
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Impact Assessment</label>
        <textarea value={pivot.impactAssessment} onChange={(e) => onChange({ ...pivot, impactAssessment: e.target.value })}
          placeholder="What was the impact on the business?" rows={2}
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Outcomes</label>
        <textarea value={pivot.outcomes} onChange={(e) => onChange({ ...pivot, outcomes: e.target.value })}
          placeholder="What were the results?" rows={2}
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Lessons Learned</label>
        <textarea value={pivot.lessonsLearned} onChange={(e) => onChange({ ...pivot, lessonsLearned: e.target.value })}
          placeholder="Key takeaways and lessons..." rows={2}
          className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Affected Business Areas</label>
        <div className="flex flex-wrap gap-1.5">
          {AFFECTED_AREAS.map(area => (
            <button key={area} onClick={() => onToggleArea(area)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                pivot.affectedAreas.includes(area) ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-card text-muted-foreground border-[var(--border-subtle)] hover:border-[var(--border-default)]'
              }`}>{area}</button>
          ))}
        </div>
      </div>
    </div>
    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-subtle)]">
      <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" /> Cancel
      </button>
      <button onClick={onSave} disabled={!pivot.title.trim() || isSaving}
        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {pivot.id ? 'Update Pivot' : 'Save Pivot'}
      </button>
    </div>
  </div>
);

interface PivotCardProps {
  pivot: BusinessPivot;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  readOnly: boolean;
}

const PivotCard: React.FC<PivotCardProps> = ({ pivot, isExpanded, onToggle, onEdit, onDelete, isDeleting, readOnly }) => {
  const catConfig = PIVOT_CATEGORIES.find(c => c.value === pivot.category);
  const statusConfig = PIVOT_STATUSES.find(s => s.value === pivot.status);
  const CatIcon = catConfig?.icon || MoreHorizontal;

  return (
    <div className={`border-l-4 ${CATEGORY_COLORS[pivot.category]} mx-3 my-2 rounded-lg overflow-hidden bg-card`}>
      <div onClick={onToggle} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-sunken)]/50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <CatIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">{pivot.title}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="w-3 h-3" />{new Date(pivot.pivotDate).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Tag className="w-3 h-3" />{catConfig?.label || pivot.category}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusConfig && (
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusConfig.color}`}>{statusConfig.label}</span>
          )}
          {!readOnly && (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={onEdit} className="p-1 text-[var(--fg-tertiary)] hover:text-[var(--rag-blue)] rounded"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} disabled={isDeleting} className="p-1 text-[var(--fg-tertiary)] hover:text-[var(--rag-red)] rounded">
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--fg-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)]" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-[var(--border-subtle)] pt-2">
          {pivot.description && <Detail label="Description" text={pivot.description} />}
          {pivot.impactAssessment && <Detail label="Impact Assessment" text={pivot.impactAssessment} />}
          {pivot.outcomes && <Detail label="Outcomes" text={pivot.outcomes} />}
          {pivot.lessonsLearned && <Detail label="Lessons Learned" text={pivot.lessonsLearned} />}
          {pivot.affectedAreas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Affected Areas</p>
              <div className="flex flex-wrap gap-1">
                {pivot.affectedAreas.map(a => (
                  <span key={a} className="px-2 py-0.5 text-[10px] bg-[var(--bg-sunken)] text-muted-foreground rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Detail: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>
  </div>
);

export default BusinessPivotsSection;
