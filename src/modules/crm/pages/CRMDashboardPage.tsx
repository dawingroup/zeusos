/**
 * CRM Dashboard Page
 * Pipeline overview with KPI stats and kanban board
 */

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Banner, RagBadge } from '@/shared/components/data-display';
import { useDeals } from '../hooks/useDeals';
import { CRMDashboardStats } from '../components/dashboard/CRMDashboard';
import { PipelineKanban } from '../components/dashboard/PipelineKanban';
import { DealForm, type DealFormValues } from '../components/deals/DealForm';
import { Timestamp } from 'firebase/firestore';
import type { CRMDealFormData, CRMDealStage } from '../types';
import type { DealSyncResult } from '../services/dealSyncService';
import { updateDealValueForProject } from '../services/crmDealService';
import { useAuth } from '@/shared/hooks';
import { CRM_DEFAULT_CURRENCY } from '../constants/crm.constants';
import { fetchDocument } from '@/shared/services/firebase/firestore';

function formatCurrency(value: number, currency: string = 'UGX'): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatShortDate(timestamp: { toDate?: () => Date; seconds?: number } | undefined): string {
  if (!timestamp) return '';
  const date = timestamp.toDate?.() ?? new Date((timestamp.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface DealSummaryPanelProps {
  tone: 'won' | 'lost';
  deals: Array<{
    id: string;
    title: string;
    customerName?: string;
    estimatedValue?: number;
    currency?: string;
    actualCloseDate?: { toDate?: () => Date; seconds?: number };
    closedReason?: string;
  }>;
  formatCurrency: (value: number, currency?: string) => string;
  formatShortDate: (
    timestamp: { toDate?: () => Date; seconds?: number } | undefined,
  ) => string;
}

function DealSummaryPanel({
  tone,
  deals,
  formatCurrency,
  formatShortDate,
}: DealSummaryPanelProps) {
  const total = deals.reduce((sum, d) => sum + (d.estimatedValue ?? 0), 0);
  const isWon = tone === 'won';
  const TrendIcon = isWon ? TrendingUp : TrendingDown;
  const accentVar = isWon ? 'var(--rag-green)' : 'var(--rag-red)';
  const accentSoft = isWon ? 'var(--rag-green-soft)' : 'var(--rag-red-soft)';
  const linkTarget = isWon ? '/crm/deals?stage=won' : '/crm/deals?stage=lost';

  return (
    <div
      className="rounded-[10px] border bg-[var(--bg-surface)] overflow-hidden shadow-[var(--shadow-sm)]"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between border-b"
        style={{ backgroundColor: accentSoft, borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <TrendIcon className="h-3.5 w-3.5" style={{ color: accentVar }} />
          <h3
            className="text-[13px] font-semibold m-0"
            style={{ color: accentVar }}
          >
            {isWon ? 'Won' : 'Lost'} Deals ({deals.length})
          </h3>
        </div>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: accentVar, textDecoration: isWon ? 'none' : 'line-through' }}
        >
          {formatCurrency(total)}
        </span>
      </div>
      <div>
        {deals.slice(0, 10).map((deal) => (
          <NavLink
            key={deal.id}
            to={`/crm/deals/${deal.id}`}
            className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 transition-colors group"
            style={{ borderColor: 'var(--border-subtle)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <div className="min-w-0 flex-1">
              <p
                className="text-[13px] font-medium truncate m-0"
                style={{ color: 'var(--fg-primary)' }}
              >
                {deal.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p
                  className="text-[11.5px] m-0"
                  style={{ color: 'var(--fg-tertiary)' }}
                >
                  {deal.customerName}
                </p>
                {!isWon && deal.closedReason && (
                  <span
                    className="text-[10.5px] italic px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'var(--bg-sunken)',
                      color: 'var(--fg-tertiary)',
                    }}
                  >
                    {deal.closedReason}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <div className="text-right">
                <p
                  className="text-[13px] font-semibold tabular-nums m-0"
                  style={{
                    color: accentVar,
                    textDecoration: isWon ? 'none' : 'line-through',
                  }}
                >
                  {formatCurrency(deal.estimatedValue ?? 0, deal.currency)}
                </p>
                {deal.actualCloseDate && (
                  <p
                    className="text-[10.5px] m-0"
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    {formatShortDate(deal.actualCloseDate)}
                  </p>
                )}
              </div>
              <ChevronRight
                className="h-3.5 w-3.5"
                style={{ color: 'var(--fg-quaternary)' }}
              />
            </div>
          </NavLink>
        ))}
      </div>
      {deals.length > 10 && (
        <div
          className="px-4 py-2 border-t"
          style={{
            backgroundColor: 'var(--bg-sunken)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <NavLink
            to={linkTarget}
            className="text-[11.5px] font-medium"
            style={{ color: accentVar }}
          >
            View all {deals.length} {isWon ? 'won' : 'lost'} deals →
          </NavLink>
        </div>
      )}
    </div>
  );
}

export default function CRMDashboardPage() {
  const { user } = useAuth();
  const { deals, loading, error, syncing, autoSyncResult, autoSyncError, pipelineSummary, dealsByStage, actions } = useDeals();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncResult, setSyncResult] = useState<DealSyncResult | null>(null);
  const [syncError, setSyncError] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillLog, setBackfillLog] = useState<string[]>([]);

  const handleCreateDeal = async (values: DealFormValues) => {
    if (!user) return;
    const formData: CRMDealFormData = {
      title: values.title,
      description: values.description,
      customerId: values.customerId,
      customerName: values.customerName,
      stage: values.stage,
      probability: 0,
      priority: values.priority,
      source: values.source,
      estimatedValue: values.estimatedValue,
      currency: values.currency || CRM_DEFAULT_CURRENCY,
      linkedQuoteIds: [],
      linkedMOIds: [],
      ownerId: user.uid,
      ownerName: user.displayName || user.email || 'Unknown',
      teamMemberIds: [],
      expectedCloseDate: values.expectedCloseDate ? Timestamp.fromDate(new Date(values.expectedCloseDate)) : undefined,
      siteLocation: values.siteLocation,
      tags: values.tags,
      notes: values.notes,
      subsidiaryId: 'zeus-the-agency',
    };
    await actions.create(formData);
  };

  const handleStageDrop = async (dealId: string, newStage: CRMDealStage) => {
    try {
      await actions.changeStage(dealId, newStage);
    } catch (err) {
      console.error('Failed to change stage:', err);
    }
  };

  const handleBackfillValues = async () => {
    if (!user) return;
    setBackfilling(true);
    setBackfillLog([]);
    const log: string[] = [];

    try {
      const linkedDeals = deals.filter((d) => d.linkedProjectId);
      log.push(`Found ${linkedDeals.length} deals with linked projects`);
      setBackfillLog([...log]);

      let updated = 0;
      let skipped = 0;

      for (const deal of linkedDeals) {
        try {
          const project = await fetchDocument<Record<string, unknown>>('designProjects', deal.linkedProjectId!);
          if (!project) {
            log.push(`[SKIP] "${deal.title}" — project not found`);
            skipped++;
            setBackfillLog([...log]);
            continue;
          }

          const estimate = project.consolidatedEstimate as { total?: number; currency?: string } | undefined;
          if (!estimate?.total) {
            log.push(`[SKIP] "${deal.title}" — no estimate on project`);
            skipped++;
            setBackfillLog([...log]);
            continue;
          }

          const currency = estimate.currency || deal.currency || CRM_DEFAULT_CURRENCY;
          log.push(`[UPDATE] "${deal.title}" — ${currency} ${estimate.total.toLocaleString()} (was ${(deal.estimatedValue || 0).toLocaleString()})`);
          setBackfillLog([...log]);

          await updateDealValueForProject(deal.linkedProjectId!, estimate.total, currency, 'estimate', user.uid);
          updated++;
        } catch (err) {
          log.push(`[ERROR] "${deal.title}" — ${(err as Error).message}`);
          setBackfillLog([...log]);
        }
      }

      log.push(`Done: ${updated} updated, ${skipped} skipped`);
      setBackfillLog([...log]);
    } catch (err) {
      log.push(`Fatal error: ${(err as Error).message}`);
      setBackfillLog([...log]);
    } finally {
      setBackfilling(false);
    }
  };

  const handleSyncFromProjects = async () => {
    try {
      setSyncResult(null);
      setSyncError('');
      const result = await actions.syncFromProjects();
      setSyncResult(result);
    } catch (err) {
      setSyncError(`Sync failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Sales Pipeline</h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Track deals from lead to close. Drag cards to change stages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromProjects}
            disabled={syncing}
            title="Sync deals from Design Manager projects"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from Projects'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfillValues}
            disabled={backfilling || deals.length === 0}
            title="Update deal values from project estimates"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? 'animate-spin' : ''}`} />
            {backfilling ? 'Backfilling…' : 'Backfill Values'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateForm(true)}>
            + New Deal
          </Button>
        </div>
      </div>

      {/* Status meta strip */}
      <div
        className="rounded-[10px] border px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
        style={{
          backgroundColor: 'var(--bg-sunken)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--fg-secondary)',
        }}
      >
        <span>
          Auth:{' '}
          <strong style={{ color: 'var(--fg-primary)' }}>
            {user ? user.displayName || user.email : 'Not logged in'}
          </strong>
        </span>
        <span>
          Loading:{' '}
          <RagBadge tone={loading ? 'amber' : 'green'} hideDot>
            {String(loading)}
          </RagBadge>
        </span>
        <span>
          Deals:{' '}
          <strong style={{ color: 'var(--fg-primary)' }} className="tabular-nums">
            {deals.length}
          </strong>
        </span>
        {syncing && (
          <RagBadge tone="blue">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" />
            Syncing
          </RagBadge>
        )}
        {error && (
          <span style={{ color: 'var(--rag-red)' }}>
            Error: <strong>{error}</strong>
          </span>
        )}
      </div>

      {/* Sync / backfill detail log (collapsed into a single styled panel) */}
      {(autoSyncResult || autoSyncError || syncResult || syncError || backfillLog.length > 0) && (
        <details
          className="rounded-[10px] border bg-[var(--bg-surface)] text-[11.5px]"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <summary
            className="cursor-pointer select-none px-4 py-2.5 font-medium"
            style={{ color: 'var(--fg-primary)' }}
          >
            Sync &amp; backfill log
          </summary>
          <div
            className="px-4 pb-3 space-y-2 font-mono"
            style={{ color: 'var(--fg-secondary)' }}
          >
            {autoSyncResult && (
              <div className="border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="font-medium" style={{ color: 'var(--rag-blue)' }}>
                  Auto-sync: {autoSyncResult.created} created, {autoSyncResult.skipped} skipped,{' '}
                  {autoSyncResult.total} total projects
                  {autoSyncResult.errors.length > 0 && (
                    <span style={{ color: 'var(--rag-red)' }}> ({autoSyncResult.errors.length} errors)</span>
                  )}
                </div>
                {autoSyncResult.errors.map((e, i) => (
                  <div key={i} style={{ color: 'var(--rag-red)' }}>Error: {e}</div>
                ))}
                {autoSyncResult.debug.map((d, i) => (
                  <div key={i} style={{ color: 'var(--fg-tertiary)' }}>{d}</div>
                ))}
              </div>
            )}
            {autoSyncError && (
              <div style={{ color: 'var(--rag-red)' }}>Auto-sync error: {autoSyncError}</div>
            )}
            {syncResult && (
              <div className="border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="font-medium" style={{ color: 'var(--fg-primary)' }}>
                  Manual sync: {syncResult.created} created, {syncResult.skipped} skipped,{' '}
                  {syncResult.total} total projects
                  {syncResult.errors.length > 0 && (
                    <span style={{ color: 'var(--rag-red)' }}> ({syncResult.errors.length} errors)</span>
                  )}
                </div>
                {syncResult.errors.map((e, i) => (
                  <div key={i} style={{ color: 'var(--rag-red)' }}>Error: {e}</div>
                ))}
                {syncResult.debug.map((d, i) => (
                  <div key={i} style={{ color: 'var(--fg-tertiary)' }}>{d}</div>
                ))}
              </div>
            )}
            {syncError && <div style={{ color: 'var(--rag-red)' }}>{syncError}</div>}
            {backfillLog.length > 0 && (
              <div className="border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="font-medium" style={{ color: 'var(--rag-amber)' }}>
                  Backfill Values Log:
                </div>
                {backfillLog.map((entry, i) => {
                  const color = entry.startsWith('[ERROR]')
                    ? 'var(--rag-red)'
                    : entry.startsWith('[SKIP]')
                    ? 'var(--fg-tertiary)'
                    : entry.startsWith('[UPDATE]')
                    ? 'var(--rag-green)'
                    : entry.startsWith('Done:')
                    ? 'var(--rag-amber)'
                    : 'var(--fg-tertiary)';
                  return (
                    <div key={i} style={{ color }}>
                      {entry}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      )}

      {/* Syncing indicator */}
      {syncing && deals.length === 0 && (
        <Banner
          tone="info"
          title="Syncing deals"
          message="Pulling deals from Design Manager projects…"
          icon={<RefreshCw className="h-4 w-4 animate-spin" />}
        />
      )}

      {/* KPI Stats */}
      <CRMDashboardStats summary={pipelineSummary} loading={loading} />

      {/* Pipeline Kanban */}
      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-[260px] bg-gray-50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="space-y-2">
                <div className="h-20 bg-gray-200 rounded" />
                <div className="h-20 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PipelineKanban dealsByStage={dealsByStage} onStageDrop={handleStageDrop} />
      )}

      {/* Won/Lost Summary */}
      {!loading && (dealsByStage.won?.length > 0 || dealsByStage.lost?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dealsByStage.won?.length > 0 && (
            <DealSummaryPanel
              tone="won"
              deals={dealsByStage.won}
              formatCurrency={formatCurrency}
              formatShortDate={formatShortDate}
            />
          )}
          {dealsByStage.lost?.length > 0 && (
            <DealSummaryPanel
              tone="lost"
              deals={dealsByStage.lost}
              formatCurrency={formatCurrency}
              formatShortDate={formatShortDate}
            />
          )}
        </div>
      )}

      {/* Create Deal Form */}
      {showCreateForm && (
        <DealForm
          onSubmit={handleCreateDeal}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
