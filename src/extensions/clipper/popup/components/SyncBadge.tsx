import { Check, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface SyncBadgeProps {
  status: 'pending' | 'syncing' | 'synced' | 'error';
}

export function SyncBadge({ status }: SyncBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-yellow-100 text-yellow-700',
    },
    syncing: {
      icon: Loader2,
      label: 'Syncing',
      className: 'bg-blue-100 text-blue-700',
    },
    synced: {
      icon: Check,
      label: 'Synced',
      className: 'bg-green-100 text-green-700',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      className: 'bg-red-100 text-red-700',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}
