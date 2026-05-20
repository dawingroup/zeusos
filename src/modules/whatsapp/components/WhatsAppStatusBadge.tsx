/**
 * WhatsAppStatusBadge - Shows delivery status of a message
 */

import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import type { MessageDeliveryStatus } from '../types';

interface Props {
  status: MessageDeliveryStatus;
}

const STATUS_CONFIG: Record<MessageDeliveryStatus, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-gray-400', label: 'Sending' },
  sent: { icon: Check, color: 'text-gray-400', label: 'Sent' },
  delivered: { icon: CheckCheck, color: 'text-gray-400', label: 'Delivered' },
  read: { icon: CheckCheck, color: 'text-blue-500', label: 'Read' },
  failed: { icon: AlertCircle, color: 'text-red-500', label: 'Failed' },
};

export function WhatsAppStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center ${config.color}`} title={config.label}>
      <Icon className="w-3.5 h-3.5" />
    </span>
  );
}
