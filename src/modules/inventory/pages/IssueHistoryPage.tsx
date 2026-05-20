/**
 * IssueHistoryPage
 * Route: /inventory/issues
 * Migrated to shared <DataTable> primitive.
 */

import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalState } from '@/integration/store/GlobalContext';
import { useInventoryIssues } from '../hooks/useInventoryIssues';
import { reverseIssue } from '../services/inventoryIssueService';
import { IssueFromStoresModal } from '../components/IssueFromStoresModal';
import {
  ISSUE_REASON_LABELS,
  type IssueStatus,
} from '../types/inventoryIssue';
import { Button } from '@/core/components/ui/button';
import {
  DataTable,
  RagBadge,
  Banner,
  type DataTableColumn,
} from '@/shared/components/data-display';

type IssueRow = ReturnType<typeof useInventoryIssues>['issues'][number];

const STATUS_TONE: Record<IssueStatus, 'na' | 'green' | 'red'> = {
  draft: 'na',
  issued: 'green',
  reversed: 'red',
};

export default function IssueHistoryPage() {
  const { user } = useAuth();
  const { state } = useGlobalState();
  const organizationId = state.auth?.user?.organizationId || 'dawinos';

  const { issues, loading, error } = useInventoryIssues(organizationId);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function handleReverse(issueId: string) {
    if (
      !confirm(
        'Reverse this issue? Stock will be returned and a reversing journal entry created.',
      )
    )
      return;
    try {
      await reverseIssue(issueId);
    } catch (err) {
      alert(`Reverse failed: ${(err as Error).message}`);
    }
  }

  const columns: DataTableColumn<IssueRow>[] = useMemo(
    () => [
      {
        key: 'issueNumber',
        label: 'Issue #',
        type: 'mono',
        render: (row) => row.issueNumber || row.id.slice(0, 8),
        width: 130,
      },
      {
        key: 'createdAt',
        label: 'Date',
        type: 'date',
        accessor: (row) =>
          row.createdAt?.toDate?.()
            ? row.createdAt.toDate().toISOString()
            : '',
        render: (row) =>
          row.createdAt?.toDate?.()
            ? row.createdAt.toDate().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '—',
        width: 130,
      },
      {
        key: 'reason',
        label: 'Reason',
        render: (row) => ISSUE_REASON_LABELS[row.reason] || row.reason,
      },
      { key: 'issuedTo', label: 'Issued To' },
      {
        key: 'lineCount',
        label: 'Items',
        align: 'right',
        type: 'number',
      },
      {
        key: 'totalValue',
        label: 'Value',
        align: 'right',
        render: (row) => (
          <span className="tabular-nums font-medium">
            {row.totalValue.toLocaleString()} UGX
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 110,
        render: (row) => (
          <RagBadge tone={STATUS_TONE[row.status] ?? 'na'}>
            {row.status}
          </RagBadge>
        ),
      },
      {
        key: 'qboSyncStatus',
        label: 'QBO',
        width: 90,
        render: (row) =>
          row.qboSyncStatus === 'synced' ? (
            <RagBadge tone="green" hideDot>
              Synced
            </RagBadge>
          ) : row.qboSyncStatus === 'error' ? (
            <RagBadge tone="red" hideDot>
              Error
            </RagBadge>
          ) : (
            <RagBadge tone="na" hideDot>
              Pending
            </RagBadge>
          ),
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        width: 100,
        align: 'right',
        render: (row) =>
          row.status === 'issued' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReverse(row.id);
              }}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
              style={{ color: 'var(--rag-red)' }}
              title="Reverse issue"
            >
              <RotateCcw className="h-3 w-3" />
              Reverse
            </button>
          ) : null,
      },
    ],
    [],
  );

  if (!user) return null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1>Issue from Stores</h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            {issues.length} issue{issues.length !== 1 ? 's' : ''} on record
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + New Issue
        </Button>
      </div>

      {error && <Banner tone="danger" title="Couldn't load issues" message={error.message} />}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <DataTable<IssueRow>
          data={issues}
          columns={columns}
          search="Search by issue #, recipient or reason…"
          filters={[
            { label: 'Status', key: 'status', options: ['All', 'issued', 'reversed'] },
            {
              label: 'Reason',
              key: 'reason',
              options: ['All', ...Object.keys(ISSUE_REASON_LABELS)],
            },
          ]}
        />
      )}

      {showCreateModal && (
        <IssueFromStoresModal
          isOpen
          onClose={() => setShowCreateModal(false)}
          userId={user.uid}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
