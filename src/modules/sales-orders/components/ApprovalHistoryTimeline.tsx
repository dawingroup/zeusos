/**
 * ApprovalHistoryTimeline — vertical timeline of change-order approval
 * events. Reusable in ChangeOrderDetailPage, the client portal review
 * page, and any CO drawer that needs an audit trail.
 *
 * Events come from `changeOrders/{coId}/approvalEvents` and are ordered
 * ascending by `createdAt` (oldest first). The caller passes them in so
 * this component stays presentation-only.
 */

import type { Timestamp } from 'firebase/firestore';
import {
  FilePlus,
  Send,
  UserCheck,
  UserX,
  Globe,
  MessageCircle,
  Mail,
  MapPin,
  Undo2,
  CheckCircle2,
  XCircle,
  GitBranch,
} from 'lucide-react';
import type {
  ChangeOrderApprovalEvent,
  ChangeOrderApprovalAction,
  ChangeOrderApprovalChannel,
} from '../types';

interface Props {
  events: ChangeOrderApprovalEvent[];
  loading?: boolean;
  emptyMessage?: string;
}

const ACTION_LABELS: Record<ChangeOrderApprovalAction, string> = {
  created: 'Created',
  submitted_for_internal: 'Submitted for internal review',
  internal_approved: 'Internally approved',
  internal_rejected: 'Internally rejected',
  submitted_to_client: 'Sent to client',
  client_approved: 'Client approved',
  client_rejected: 'Client rejected',
  withdrawn: 'Withdrawn',
  applied_to_so: 'Applied to sales order',
};

const ACTION_ICONS: Record<ChangeOrderApprovalAction, typeof FilePlus> = {
  created: FilePlus,
  submitted_for_internal: GitBranch,
  internal_approved: UserCheck,
  internal_rejected: UserX,
  submitted_to_client: Send,
  client_approved: CheckCircle2,
  client_rejected: XCircle,
  withdrawn: Undo2,
  applied_to_so: CheckCircle2,
};

const ACTION_COLORS: Record<ChangeOrderApprovalAction, string> = {
  created: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted_for_internal: 'bg-blue-50 text-blue-600 border-blue-200',
  internal_approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  internal_rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  submitted_to_client: 'bg-violet-50 text-violet-700 border-violet-200',
  client_approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  client_rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  withdrawn: 'bg-slate-100 text-slate-600 border-slate-200',
  applied_to_so: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const CHANNEL_ICONS: Record<ChangeOrderApprovalChannel, typeof Globe> = {
  internal: UserCheck,
  portal: Globe,
  whatsapp: MessageCircle,
  email: Mail,
  in_person: MapPin,
};

const CHANNEL_LABELS: Record<ChangeOrderApprovalChannel, string> = {
  internal: 'Internal',
  portal: 'Client portal',
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_person: 'In person',
};

function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts as unknown as string);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ApprovalHistoryTimeline({
  events,
  loading = false,
  emptyMessage = 'No approval events yet.',
}: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
        Loading history…
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-xs text-gray-500 py-2">{emptyMessage}</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-3">
      {events.map((ev, idx) => {
        const Icon = ACTION_ICONS[ev.action] ?? FilePlus;
        const ChannelIcon = CHANNEL_ICONS[ev.channel] ?? Globe;
        const colorCls = ACTION_COLORS[ev.action] ?? ACTION_COLORS.created;
        const isLast = idx === events.length - 1;

        return (
          <li key={ev.id} className="ml-3">
            <span
              className={`absolute -left-[11px] flex items-center justify-center h-5 w-5 rounded-full border ${colorCls}`}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>

            <div className="bg-white rounded-md border border-gray-200 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-900">
                    {ACTION_LABELS[ev.action] ?? ev.action}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {formatTimestamp(ev.createdAt)}
                    {ev.actorName ? ` • ${ev.actorName}` : ''}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 whitespace-nowrap">
                  <ChannelIcon className="h-2.5 w-2.5" />
                  {CHANNEL_LABELS[ev.channel] ?? ev.channel}
                </span>
              </div>

              {ev.notes && (
                <p className="text-[11px] text-gray-700 mt-1.5 whitespace-pre-wrap">{ev.notes}</p>
              )}

              {ev.evidence && (
                <p className="text-[11px] text-gray-500 mt-1 font-mono break-all">
                  Evidence ({ev.evidenceType ?? 'ref'}): {ev.evidence}
                </p>
              )}

              {!isLast && (
                <div className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide">
                  {ev.fromStatus ?? '—'} → {ev.toStatus}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
