/**
 * Procurement Timeline Component
 * Shows recent procurement activities
 */

import React from 'react';
import {
  ShoppingCart,
  Receipt,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'requisition' | 'po' | 'delivery' | 'approval';
  title: string;
  description: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'warning';
}

interface ProcurementTimelineProps {
  projectId: string;
}

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
};

export const ProcurementTimeline: React.FC<ProcurementTimelineProps> = ({ projectId: _projectId }) => {
  // Placeholder data - will be connected to real data
  const events: TimelineEvent[] = [
    {
      id: '1',
      type: 'delivery',
      title: 'Delivery Received',
      description: 'Cement delivery from Hima Cement',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'completed',
    },
    {
      id: '2',
      type: 'approval',
      title: 'PO Approved',
      description: 'PO-2024-0032 approved by PM',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: 'completed',
    },
    {
      id: '3',
      type: 'requisition',
      title: 'Requisition Created',
      description: 'REQ-2024-0048 for plumbing materials',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'pending',
    },
    {
      id: '4',
      type: 'po',
      title: 'PO Sent to Supplier',
      description: 'PO-2024-0031 sent to Roofings Ltd',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
      status: 'completed',
    },
    {
      id: '5',
      type: 'delivery',
      title: 'Delivery Delayed',
      description: 'Steel bars delivery delayed by 2 days',
      timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
      status: 'warning',
    },
  ];

  const getIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'requisition':
        return <ShoppingCart className="w-4 h-4" />;
      case 'po':
        return <Receipt className="w-4 h-4" />;
      case 'delivery':
        return <Truck className="w-4 h-4" />;
      case 'approval':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'warning':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Icon */}
            <div
              className={cn(
                'relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center',
                getStatusColor(event.status)
              )}
            >
              {event.status === 'warning' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                getIcon(event.type)
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-4', index === events.length - 1 && 'pb-0')}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">{event.title}</p>
                  <p className="text-xs text-gray-500">{event.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                  {formatRelativeTime(event.timestamp)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recent activities</p>
        </div>
      )}
    </div>
  );
};

export default ProcurementTimeline;
