/**
 * WhatsAppWindowBanner - Shows the 24-hour messaging window status
 */

import { Clock, AlertTriangle, Lock } from 'lucide-react';
import type { WindowState } from '../types';

interface Props {
  windowState: WindowState;
}

function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

export function WhatsAppWindowBanner({ windowState }: Props) {
  if (!windowState.expiresAt) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 text-sm border-b">
        <Lock className="w-4 h-4" />
        <span>No messaging window. Send a template message to start a conversation.</span>
      </div>
    );
  }

  if (!windowState.isOpen) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-sm border-b">
        <Lock className="w-4 h-4" />
        <span>Messaging window closed. Use a template message to re-engage the customer.</span>
      </div>
    );
  }

  if (windowState.isExpiringSoon) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm border-b">
        <AlertTriangle className="w-4 h-4" />
        <span>Window expiring soon &mdash; {formatTimeRemaining(windowState.timeRemainingMs)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm border-b">
      <Clock className="w-4 h-4" />
      <span>Messaging window open &mdash; {formatTimeRemaining(windowState.timeRemainingMs)}</span>
    </div>
  );
}
