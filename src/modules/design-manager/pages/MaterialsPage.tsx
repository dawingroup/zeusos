/**
 * MaterialsPage Component
 * Global materials administration page with Clipper integration tab.
 * Migrated to portal redesign tokens.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import { MaterialList } from '../components/materials';
import { ClipReviewQueue } from '../components/materials/ClipReviewQueue';
import { Button } from '@/core/components/ui/button';
import { Banner } from '@/shared/components/data-display';
import { cn } from '@/shared/lib/utils';

type MaterialTab = 'library' | 'clipper';

export function MaterialsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<MaterialTab>(
    tabParam === 'clipper' ? 'clipper' : 'library',
  );
  const [backfillStatus, setBackfillStatus] = useState<'idle' | 'running' | 'done' | 'error'>(
    'idle',
  );
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam === 'clipper' && activeTab !== 'clipper') {
      setActiveTab('clipper');
    }
  }, [tabParam]);

  const handleBackfill = async (dryRun: boolean) => {
    setBackfillStatus('running');
    setBackfillResult(null);

    try {
      const backfillFn = httpsCallable<
        { dryRun: boolean },
        {
          total: number;
          needsUpdate: number;
          updated: number;
          skipped: number;
          failed: number;
          errors: Array<{ id: string; name: string; error: string }>;
        }
      >(functions, 'backfillMaterialFields');

      const result = await backfillFn({ dryRun });
      const d = result.data;
      const prefix = dryRun ? '[DRY RUN] ' : '';
      setBackfillResult(
        `${prefix}Total: ${d.total} | Updated: ${d.updated} | Skipped: ${d.skipped} | Failed: ${d.failed}` +
          (d.errors.length > 0
            ? `\nErrors: ${d.errors.map((e) => `${e.name}: ${e.error}`).join(', ')}`
            : ''),
      );
      setBackfillStatus('done');
    } catch (e) {
      setBackfillResult((e as Error).message);
      setBackfillStatus('error');
    }
  };

  if (!user?.email) {
    return (
      <div
        className="text-center py-12 text-[13px]"
        style={{ color: 'var(--fg-tertiary)' }}
      >
        Please log in to manage materials.
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Material Library</h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Manage global materials available to all projects. Convert clipped materials from the web into your library.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBackfill(true)}
            disabled={backfillStatus === 'running'}
          >
            {backfillStatus === 'running' ? 'Running…' : 'Preview Backfill'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleBackfill(false)}
            disabled={backfillStatus === 'running'}
          >
            {backfillStatus === 'running' ? 'Running…' : 'Run Backfill'}
          </Button>
        </div>
      </div>

      {backfillResult && (
        <Banner
          tone={
            backfillStatus === 'error'
              ? 'danger'
              : backfillStatus === 'done'
              ? 'success'
              : 'info'
          }
          title={
            backfillStatus === 'error'
              ? 'Backfill failed'
              : backfillStatus === 'done'
              ? 'Backfill complete'
              : 'Backfill running'
          }
          message={
            <span className="whitespace-pre-wrap">{backfillResult}</span>
          }
          onDismiss={() => setBackfillResult(null)}
        />
      )}

      {/* Tabs */}
      <div
        className="flex items-center gap-0.5 border-b -mb-px"
        style={{ borderColor: 'var(--border-default)' }}
      >
        {(['library', 'clipper'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'inline-flex items-center pt-2.5 pb-3 px-3 text-[12.5px] font-medium transition-colors border-b-2 -mb-px',
              )}
              style={{
                color: active ? 'var(--accent)' : 'var(--fg-tertiary)',
                borderBottomColor: active ? 'var(--accent)' : 'transparent',
              }}
            >
              {tab === 'library' ? 'Global Materials' : 'From Clipper'}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'library' ? (
        <MaterialList tier="global" userId={user.email} title="Global Materials" />
      ) : (
        <ClipReviewQueue userId={user.uid} />
      )}
    </div>
  );
}

export default MaterialsPage;
