/**
 * Project Tracker Page
 * Unified view of all design projects with Design Manager + Manufacturing progress.
 * Migrated to shared <DataTable> primitive.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, FolderKanban } from 'lucide-react';
import { useProjectTracker } from '../hooks/useProjectTracker';
import { CRM_DEAL_STAGE_LABELS } from '../constants/crm.constants';
import type { CRMDealStage } from '../types';
import {
  DataTable,
  RagBadge,
  Banner,
  EmptyStateV2,
  type DataTableColumn,
} from '@/shared/components/data-display';

type ProjectRow = ReturnType<typeof useProjectTracker>['projects'][number];

const STATUS_TONE: Record<string, 'green' | 'amber' | 'blue' | 'na'> = {
  active: 'green',
  'on-hold': 'amber',
  completed: 'blue',
  cancelled: 'na',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STAGE_TONE: Partial<Record<CRMDealStage, 'green' | 'amber' | 'blue' | 'red' | 'na'>> = {
  lead: 'na',
  qualification: 'blue',
  site_visit: 'blue',
  design_proposal: 'blue',
  quotation: 'amber',
  negotiation: 'amber',
  won: 'green',
  lost: 'red',
  on_hold: 'na',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MiniProgress({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-sunken)' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-[11.5px] font-medium tabular-nums w-9 text-right"
        style={{ color: 'var(--fg-secondary)' }}
      >
        {pct}%
      </span>
    </div>
  );
}

export default function ProjectTrackerPage() {
  const navigate = useNavigate();
  const { projects, loading, error } = useProjectTracker();

  const columns: DataTableColumn<ProjectRow>[] = useMemo(
    () => [
      {
        key: 'projectName',
        label: 'Project',
        render: (row) => (
          <div className="min-w-0">
            <div
              className="font-medium truncate"
              style={{ color: 'var(--fg-primary)' }}
            >
              {row.projectName}
            </div>
            <div
              className="text-[11.5px] font-mono truncate"
              style={{ color: 'var(--fg-tertiary)' }}
            >
              {row.projectCode}
            </div>
          </div>
        ),
      },
      { key: 'customerName', label: 'Customer' },
      {
        key: 'status',
        label: 'Status',
        width: 110,
        render: (row) => {
          const tone = STATUS_TONE[row.status] ?? 'na';
          return <RagBadge tone={tone}>{STATUS_LABEL[row.status] ?? row.status}</RagBadge>;
        },
      },
      {
        key: 'dealStage',
        label: 'Deal',
        width: 130,
        sortable: false,
        render: (row) =>
          row.dealStage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (row.dealId) navigate(`/crm/deals/${row.dealId}`);
              }}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <RagBadge tone={STAGE_TONE[row.dealStage as CRMDealStage] ?? 'na'}>
                {CRM_DEAL_STAGE_LABELS[row.dealStage as CRMDealStage] ?? row.dealStage}
              </RagBadge>
            </button>
          ) : (
            <span style={{ color: 'var(--fg-quaternary)' }}>—</span>
          ),
      },
      {
        key: 'totalDesignItems',
        label: 'Items',
        type: 'number',
        align: 'center',
        width: 80,
      },
      {
        key: 'totalMOs',
        label: 'MOs',
        type: 'number',
        align: 'center',
        width: 80,
      },
      {
        key: 'designProgress',
        label: 'Design Progress',
        width: 170,
        render: (row) => (
          <MiniProgress value={row.designProgress} color="var(--rag-blue)" />
        ),
      },
      {
        key: 'manufacturingProgress',
        label: 'Mfg Progress',
        width: 170,
        render: (row) => (
          <MiniProgress value={row.manufacturingProgress} color="var(--rag-green)" />
        ),
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        accessor: (row) => row.updatedAt.toISOString(),
        render: (row) => (
          <span style={{ color: 'var(--fg-secondary)' }}>{formatDate(row.updatedAt)}</span>
        ),
        width: 140,
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        align: 'right',
        width: 60,
        render: (row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/crm/projects/${row.projectId}`);
            }}
            className="inline-flex p-1 rounded transition-colors"
            style={{ color: 'var(--fg-tertiary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div>
        <h1>Project Tracker</h1>
        <p
          className="mt-1 text-[12.5px]"
          style={{ color: 'var(--fg-secondary)' }}
        >
          Track all active projects across Design Manager and Manufacturing in one unified view.
        </p>
      </div>

      {error && <Banner tone="danger" title="Couldn't load projects" message={error} />}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : projects.length === 0 ? (
        <div
          className="rounded-[10px] border bg-[var(--bg-surface)]"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <EmptyStateV2
            icon={<FolderKanban className="h-6 w-6" />}
            title="No projects found"
            message="Design projects will appear here when created."
          />
        </div>
      ) : (
        <DataTable<ProjectRow>
          data={projects}
          columns={columns}
          search="Search by name, code, or customer…"
          filters={[
            {
              label: 'Status',
              key: 'status',
              options: ['All', 'active', 'on-hold', 'completed', 'cancelled'],
            },
          ]}
          onRowClick={(row) => navigate(`/crm/projects/${row.projectId}`)}
        />
      )}
    </div>
  );
}
