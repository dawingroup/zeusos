/**
 * MyRevisionRequests — portal-side view of the client's own submitted
 * revision requests, with the designer's status updates visible.
 *
 * Phase 4b follow-up to Phase 3b: closes the feedback loop so clients
 * can see which of their asks are pending, in progress, resolved, or
 * declined — along with any resolution note from the designer. Before
 * this, the portal was write-only: clients shot requests into the void
 * with no visible acknowledgement.
 *
 * Authentication: the portal uses anonymous Firebase auth tied to an
 * access token, so `getAuth().currentUser.uid` is a stable
 * per-portal-session identifier. We scope the query to `projectId`
 * (same as DeliverablesList) — showing ALL requests for the project
 * is safer than filtering by `requestedBy`, because portal users who
 * re-open a link in a fresh tab get a new anon UID and would
 * otherwise "lose" their previous requests. The whole-project view is
 * the right mental model for a client anyway.
 */

import { useEffect, useState } from 'react';
import {
  MessageSquare,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import {
  subscribeToRevisionRequests,
  type RevisionRequest,
  type RevisionRequestStatus,
} from '../../services/revisionRequestService';

interface MyRevisionRequestsProps {
  projectId: string;
}

const STATUS_CFG: Record<
  RevisionRequestStatus,
  { label: string; bg: string; text: string; icon: typeof Clock }
> = {
  pending: { label: 'Awaiting design team', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  acknowledged: { label: 'In progress', bg: 'bg-blue-50', text: 'text-blue-700', icon: Eye },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
  declined: { label: 'Declined', bg: 'bg-gray-100', text: 'text-gray-600', icon: XCircle },
};

export default function MyRevisionRequests({ projectId }: MyRevisionRequestsProps) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RevisionRequest[]>([]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToRevisionRequests(projectId, undefined, (rows) => {
      setRequests(rows);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  // Don't render an empty card — the "Request Revision" button already
  // lives in DeliverablesList for first-time submissions. Only surface
  // the history card when there's something to show.
  if (!loading && requests.length === 0) {
    return null;
  }

  const openCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'acknowledged',
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Your Revision Requests
          <Badge variant="outline" className="ml-auto">
            {openCount > 0 ? `${openCount} open · ${requests.length} total` : `${requests.length} total`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center">
            <Loader2 className="h-4 w-4 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const cfg = STATUS_CFG[r.status];
              const Icon = cfg.icon;
              const createdAt = r.createdAt?.toDate
                ? r.createdAt.toDate()
                : null;
              const resolvedAt = r.resolvedAt?.toDate ? r.resolvedAt.toDate() : null;
              return (
                <div
                  key={r.id}
                  className="border border-gray-200 rounded-lg p-3 space-y-1.5"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0',
                        cfg.bg,
                        cfg.text,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {r.itemName && (
                      <span className="text-xs text-muted-foreground truncate">
                        {r.itemName}
                      </span>
                    )}
                    {createdAt && (
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {createdAt.toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                  {r.resolvedNote && (
                    <p className="text-xs italic text-muted-foreground border-l-2 border-gray-200 pl-2 mt-1">
                      <span className="font-medium not-italic">Design team:</span>{' '}
                      {r.resolvedNote}
                      {resolvedAt && (
                        <span className="ml-1 text-[10px]">
                          · {resolvedAt.toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
