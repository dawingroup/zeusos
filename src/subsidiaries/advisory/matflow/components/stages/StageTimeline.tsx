/**
 * Stage Timeline Component
 * Displays chronological events for a stage
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Package,
  ClipboardCheck,
  MessageSquare,
  XCircle,
  Clock,
  Flag,
  Shield,
} from 'lucide-react';
import type { StageTimelineEvent, TimelineEventType } from '../../types/stageProgress';
import { useStageTimeline } from '../../hooks/useStageProgress';

interface StageTimelineProps {
  projectId: string;
  stageId: string;
  maxHeight?: string;
}

const eventConfig: Record<
  TimelineEventType,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  status_change: { icon: Flag, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  milestone_completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  milestone_overdue: { icon: Clock, color: 'text-red-600', bgColor: 'bg-red-100' },
  material_delivered: { icon: Package, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  blocker_added: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  blocker_resolved: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  approval_requested: { icon: ClipboardCheck, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  approval_granted: { icon: Shield, color: 'text-green-600', bgColor: 'bg-green-100' },
  approval_rejected: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  note_added: { icon: MessageSquare, color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const StageTimeline: React.FC<StageTimelineProps> = ({ 
  projectId, 
  stageId, 
  maxHeight = '400px' 
}) => {
  const { events, loading, error } = useStageTimeline(projectId, stageId);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load timeline</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No events yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight }}>
      <div className="relative p-4">
        {/* Timeline line */}
        <div className="absolute left-7 top-0 bottom-0 w-px bg-gray-200" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, index) => (
            <TimelineEventItem key={event.id} event={event} isFirst={index === 0} />
          ))}
        </div>
      </div>
    </div>
  );
};

interface TimelineEventItemProps {
  event: StageTimelineEvent;
  isFirst: boolean;
}

const TimelineEventItem: React.FC<TimelineEventItemProps> = ({ event, isFirst }) => {
  const config = eventConfig[event.type];
  const Icon = config.icon;
  const timestamp = event.timestamp.toDate();

  return (
    <div className="relative flex gap-3">
      {/* Icon */}
      <div
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${config.bgColor}`}
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{event.title}</p>
            {event.description && (
              <p className="text-sm text-gray-500 mt-0.5">
                {event.description}
              </p>
            )}
          </div>
          <time className="text-xs text-gray-400 whitespace-nowrap">
            {isFirst
              ? formatTimeAgo(timestamp)
              : formatDate(timestamp)}
          </time>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 mt-2">
          <div className="h-5 w-5 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-[10px] font-medium text-gray-600">
              {event.userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-gray-500">{event.userName}</span>
        </div>
      </div>
    </div>
  );
};

export default StageTimeline;
