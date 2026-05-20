/**
 * FinishLibraryPage
 * Main page for the Finish Library — manages the shared catalog of finishes.
 */

import { useState, useCallback, useMemo } from 'react';
import { Plus, LayoutGrid, List, Loader2, Settings } from 'lucide-react';
import type { FinishDocument, FinishCategory, FinishAvailability } from '../types';
import { useFinishLibrary } from '../hooks/useFinishLibrary';
import { createFinish, updateFinish, archiveFinish, seedDefaultFinishes } from '../services/finishLibraryService';
import { seedDefaultAttributes } from '../services/finishAttributeService';
import { useAuth } from '@/contexts/AuthContext';
import {
  FinishCategoryTabs,
  FinishListView,
  FinishSwatchGrid,
  FinishDetailForm,
  FinishImportExport,
  FinishStorefrontDrawer,
} from '../components/finishes';
import type { FinishDocumentFormData } from '../schemas/finishSchema';

type ViewMode = 'list' | 'grid';

export default function FinishLibraryPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<FinishCategory | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<FinishAvailability | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [editingFinish, setEditingFinish] = useState<FinishDocument | null>(null);
  const [storefrontFinish, setStorefrontFinish] = useState<FinishDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const organizationId = 'default'; // TODO: Get from GlobalState

  const { finishes, loading, refresh } = useFinishLibrary({
    organizationId,
    category: activeCategory === 'all' ? undefined : activeCategory,
    isActive: true,
  });

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return finishes;
    const term = searchTerm.toLowerCase();
    return finishes.filter(f =>
      f.name.toLowerCase().includes(term) ||
      f.code.toLowerCase().includes(term) ||
      f.tags?.some(t => t.toLowerCase().includes(term))
    );
  }, [finishes, searchTerm]);

  // Category counts
  const counts = useMemo(() => {
    const all = finishes;
    const c: Record<string, number> = { all: all.length };
    for (const f of all) {
      c[f.category] = (c[f.category] || 0) + 1;
    }
    return c;
  }, [finishes]);

  const handleEdit = useCallback((finish: FinishDocument) => {
    setEditingFinish(finish);
    setFormOpen(true);
  }, []);

  const handleArchive = useCallback(async (finish: FinishDocument) => {
    if (!user || !confirm(`Archive "${finish.name}"?`)) return;
    await archiveFinish(finish.id, user.uid);
    refresh();
  }, [user, refresh]);

  const handleSave = useCallback(async (data: FinishDocumentFormData) => {
    if (!user) return;
    setSaving(true);
    try {
      if (editingFinish) {
        await updateFinish(editingFinish.id, data as Partial<FinishDocument>, user.uid);
      } else {
        await createFinish(
          { ...data, organizationId, isActive: true } as Omit<FinishDocument, 'id' | 'createdAt' | 'updatedAt'>,
          user.uid
        );
      }
      setFormOpen(false);
      setEditingFinish(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [user, editingFinish, organizationId, refresh]);

  const handleSeedDefaults = useCallback(async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const [attrResult, finishResult] = await Promise.all([
        seedDefaultAttributes(organizationId, user.uid),
        seedDefaultFinishes(organizationId, user.uid),
      ]);
      alert(
        `Seeded ${finishResult.created} finishes (${finishResult.skipped} existed) and ` +
        `${attrResult.created} attributes (${attrResult.skipped} existed)`
      );
      refresh();
    } finally {
      setSeeding(false);
    }
  }, [user, organizationId, refresh]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Finish Library</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Shared catalog of colors, textures, and surfaces
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seed Attributes button */}
          <button
            type="button"
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--fg-primary)',
            }}
            title="Seed default finishes and attribute definitions for boards, paints, tiles, and more"
          >
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
            Seed Defaults
          </button>

          {/* Import/Export */}
          {user && (
            <FinishImportExport
              organizationId={organizationId}
              userId={user.uid}
              onImportComplete={refresh}
            />
          )}

          {/* View toggle */}
          <div
            className="flex border rounded-md overflow-hidden"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="p-2"
              style={{
                backgroundColor:
                  viewMode === 'list' ? 'var(--bg-sunken)' : 'transparent',
                color:
                  viewMode === 'list' ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
              }}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="p-2"
              style={{
                backgroundColor:
                  viewMode === 'grid' ? 'var(--bg-sunken)' : 'transparent',
                color:
                  viewMode === 'grid' ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
              }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add button */}
          <button
            type="button"
            onClick={() => { setEditingFinish(null); setFormOpen(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Plus className="w-4 h-4" />
            Add Finish
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <FinishCategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        counts={counts}
      />

      {/* Content */}
      {viewMode === 'list' ? (
        <FinishListView
          finishes={filtered}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onOpenStorefront={setStorefrontFinish}
          subtypeFilter={subtypeFilter}
          onSubtypeFilterChange={setSubtypeFilter}
          availabilityFilter={availabilityFilter}
          onAvailabilityFilterChange={setAvailabilityFilter}
        />
      ) : (
        <FinishSwatchGrid
          finishes={filtered}
          loading={loading}
          onSelect={handleEdit}
        />
      )}

      {/* Detail Form Modal */}
      {formOpen && (
        <FinishDetailForm
          finish={editingFinish}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditingFinish(null); }}
          saving={saving}
        />
      )}

      {/* Storefront drawer (dawinFinishes block) */}
      {storefrontFinish && (
        <FinishStorefrontDrawer
          finish={storefrontFinish}
          onClose={() => setStorefrontFinish(null)}
        />
      )}
    </div>
  );
}
