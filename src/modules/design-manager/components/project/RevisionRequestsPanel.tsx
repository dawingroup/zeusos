/**
 * RevisionRequestsPanel
 *
 * Phase 3b designer inbox — subscribes to `revisionRequests` for the
 * current project and exposes the four state transitions
 * (pending → acknowledged → resolved/declined). Grouped by status so
 * pending requests are at the top; resolved/declined are collapsed by
 * default to keep the panel short.
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  subscribeToRevisionRequests,
  acknowledgeRevisionRequest,
  resolveRevisionRequest,
  declineRevisionRequest,
  countOpenRequests,
  type RevisionRequest,
  type RevisionRequestStatus,
} from '../../services/revisionRequestService';
import { useAuth } from '@/contexts/AuthContext';

interface RevisionRequestsPanelProps {
  projectId: string;
  /** Optional — scope the panel to a single design item. */
  itemId?: string;
}

const STATUS_STYLE: Record<
  RevisionRequestStatus,
  { label: string; bg: string; text: string; icon: typeof Clock }
> = {
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  acknowledged: { label: 'In progress', bg: 'bg-blue-50', text: 'text-blue-700', icon: Eye },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  declined: { label: 'Declined', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle },
};

export function RevisionRequestsPanel({ projectId, itemId }: RevisionRequestsPanelProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RevisionRequest[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToRevisionRequests(
      projectId,
      itemId ? { itemId } : undefined,
      (rows) => {
        setRequests(rows);
        setLoading(false);
      },
    );
    return unsub;
  }, [projectId, itemId]);

  const open = requests.filter((r) => r.status === 'pending' || r.status === 'acknowledged');
  const closed = requests.filter((r) => r.status === 'resolved' || r.status === 'declined');
  const openCount = countOpenRequests(requests);

  const doAcknowledge = async (id: string) => {
    if (!user?.uid) return;
    setActioningId(id);
    try {
      await acknowledgeRevisionRequest(id, user.uid);
    } finally {
      setActioningId(null);
    }
  };

  const doResolve = async (id: string) => {
    if (!user?.uid) return;
    const note = window.prompt('Resolution note (optional):', '');
    if (note === null) return; // cancelled
    setActioningId(id);
    try {
      await resolveRevisionRequest(id, user.uid, { note: note || undefined });
    } finally {
      setActioningId(null);
    }
  };

  const doDecline = async (id: string) => {
    if (!user?.uid) return;
    const note = window.prompt('Why is this declined?', '');
    if (note === null) return; // cancelled
    setActioningId(id);
    try {
      await declineRevisionRequest(id, user.uid, note || 'Declined');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <MessageSquare className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-700">Revision Requests</h3>
        {openCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
            {openCount}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {requests.length} total
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center">
          <Loader2 className="h-4 w-4 mx-auto animate-spin text-gray-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          No revision requests yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {/* Open requests */}
          {open.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              actioning={actioningId === r.id}
              onAcknowledge={() => doAcknowledge(r.id)}
              onResolve={() => doResolve(r.id)}
              onDecline={() => doDecline(r.id)}
            />
          ))}

          {/* Closed — collapsed by default */}
          {closed.length > 0 && (
            <div>
              <button
                onClick={() => setShowClosed((v) => !v)}
                className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
              >
                {showClosed ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {closed.length} closed request{closed.length === 1 ? '' : 's'}
              </button>
              {showClosed &&
                closed.map((r) => (
                  <RequestRow
                    key={r.id}
                    request={r}
                    actioning={false}
                    onAcknowledge={() => {}}
                    onResolve={() => {}}
                    onDecline={() => {}}
                    readOnly
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RequestRowProps {
  request: RevisionRequest;
  actioning: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDecline: () => void;
  readOnly?: boolean;
}

function RequestRow({
  request,
  actioning,
  onAcknowledge,
  onResolve,
  onDecline,
  readOnly = false,
}: RequestRowProps) {
  const statusCfg = STATUS_STYLE[request.status];
  const Icon = statusCfg.icon;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
            statusCfg.bg,
            statusCfg.text,
          )}
        >
          <Icon className="h-3 w-3" />
          {statusCfg.label}
        </span>
        {request.itemName && (
          <span className="text-xs text-gray-600 truncate">{request.itemName}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-400">
          <User className="h-3 w-3" />
          {request.requestedByName || 'Client'}
        </span>
      </div>

      <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{request.message}</p>

      {request.resolvedNote && (
        <p className="text-xs italic text-gray-500 border-l-2 border-gray-200 pl-2 mb-2">
          {request.resolvedNote}
        </p>
      )}

      {!readOnly && request.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            disabled={actioning}
            onClick={onAcknowledge}
            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
          >
            Acknowledge
          </button>
          <button
            disabled={actioning}
            onClick={onResolve}
            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 disabled:opacity-50"
          >
            Resolve
          </button>
          <button
            disabled={actioning}
            onClick={onDecline}
            className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}

      {!readOnly && request.status === 'acknowledged' && (
        <div className="flex gap-2 pt-1">
          <button
            disabled={actioning}
            onClick={onResolve}
            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 disabled:opacity-50"
          >
            Mark resolved
          </button>
          <button
            disabled={actioning}
            onClick={onDecline}
            className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}

export default RevisionRequestsPanel;
