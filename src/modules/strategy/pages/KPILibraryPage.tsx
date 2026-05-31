/**
 * KPI Library Page
 * Full browsable/searchable KPI catalog with filtering and add-to-tracking.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useKPIs } from '../hooks/useKPIs';
import { useKPILibrary } from '../hooks/useKPILibrary';
import { KPILibraryCard } from '../components/kpi/KPILibraryCard';
import { KPILibraryFilters } from '../components/kpi/KPILibraryFilters';
import { AddFromLibraryDialog } from '../components/kpi/AddFromLibraryDialog';
import type { KPILibraryEntry } from '../constants/kpiLibrary.constants';
import type { CreateKPIInput } from '../types/kpi.types';

const COMPANY_ID = 'zeus-group';

export function KPILibraryPage() {
  const [searchParams] = useSearchParams();

  // Get tracked KPIs to show tracking status
  const { kpis: trackedKPIs, createKPI, refresh } = useKPIs({
    companyId: COMPANY_ID,
    autoFetch: true,
  });

  // Library hook with URL param initialization
  const initialCategory = searchParams.get('category') || '';
  const library = useKPILibrary({
    trackedKPIs,
    initialCategory,
  });

  // Sync URL params to state on mount
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat && cat !== library.selectedCategory) {
      library.setSelectedCategory(cat);
    }
  }, []);

  // Dialog state
  const [dialogEntry, setDialogEntry] = useState<KPILibraryEntry | null>(null);

  async function handleAddToTracking(input: CreateKPIInput) {
    if (!COMPANY_ID) return;
    await createKPI(input);
    await refresh();
    setDialogEntry(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">KPI Library</h1>
        <p className="text-muted-foreground text-sm">
          Browse {library.totalCount} industry-standard KPIs organized by category. Add any KPI to start tracking.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <KPILibraryFilters
          searchQuery={library.searchQuery}
          onSearchChange={library.setSearchQuery}
          selectedCategory={library.selectedCategory}
          onCategoryChange={library.setSelectedCategory}
          selectedSubCategory={library.selectedSubCategory}
          onSubCategoryChange={library.setSelectedSubCategory}
          selectedModule={library.selectedModule}
          onModuleChange={library.setSelectedModule}
          showTrackedOnly={library.showTrackedOnly}
          onTrackedOnlyChange={library.setShowTrackedOnly}
          onClearFilters={library.clearFilters}
          filteredCount={library.filteredCount}
          totalCount={library.totalCount}
        />
      </div>

      {/* KPI Grid */}
      {library.entries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No KPIs match your filters.</p>
          <button
            onClick={library.clearFilters}
            className="mt-2 text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] font-medium"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {library.entries.map((entry) => (
            <KPILibraryCard
              key={entry.id}
              entry={entry}
              isTracked={library.isTracked(entry.id)}
              onAddToTracking={(e) => setDialogEntry(e)}
            />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      {dialogEntry && (
        <AddFromLibraryDialog
          entry={dialogEntry}
          isOpen={!!dialogEntry}
          onClose={() => setDialogEntry(null)}
          onAdd={handleAddToTracking}
        />
      )}
    </div>
  );
}

export default KPILibraryPage;
