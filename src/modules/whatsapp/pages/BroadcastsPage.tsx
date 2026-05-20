/**
 * BroadcastsPage - WhatsApp broadcast campaign management
 * Create and track bulk template message sends
 */

import { useState } from 'react';
import { Megaphone, Plus, Loader2, Users, CheckCircle2, AlertCircle, Clock, Send } from 'lucide-react';
import { useBroadcasts } from '../hooks/useBroadcasts';
import { CreateBroadcastDialog } from '../components/CreateBroadcastDialog';
import type { WhatsAppBroadcast, BroadcastStatus } from '../types';

const statusConfig: Record<BroadcastStatus, { label: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  sending: { label: 'Sending', color: 'bg-yellow-100 text-yellow-700', icon: Send },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function BroadcastsPage() {
  const { broadcasts, loading } = useBroadcasts();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Broadcasts</h2>
          <p className="text-sm text-muted-foreground">
            Send template messages to multiple contacts at once
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Broadcast List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border rounded-lg bg-gray-50">
          <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium">No broadcasts yet</p>
          <p className="text-xs mt-1">Create your first broadcast to send template messages in bulk</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((broadcast) => (
            <BroadcastCard key={broadcast.id} broadcast={broadcast} />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateBroadcastDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}

function BroadcastCard({ broadcast }: { broadcast: WhatsAppBroadcast }) {
  const config = statusConfig[broadcast.status];
  const StatusIcon = config.icon;
  const totalAudience = broadcast.audience.totalCount || broadcast.audience.phones?.length || 0;

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">{broadcast.name}</h3>
          <p className="text-sm text-gray-500">
            Template: <span className="font-medium">{broadcast.templateName}</span>
          </p>
        </div>
        <span className={`flex items-center gap-1 text-xs rounded px-2 py-1 font-medium ${config.color}`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {totalAudience} recipients
        </span>
        {broadcast.status !== 'draft' && (
          <>
            <span className="text-green-600">{broadcast.sentCount} sent</span>
            <span className="text-blue-600">{broadcast.deliveredCount} delivered</span>
            <span className="text-purple-600">{broadcast.readCount} read</span>
            {broadcast.failedCount > 0 && (
              <span className="text-red-600">{broadcast.failedCount} failed</span>
            )}
          </>
        )}
      </div>

      {broadcast.createdByName && (
        <p className="text-xs text-gray-400 mt-2">Created by {broadcast.createdByName}</p>
      )}
    </div>
  );
}
