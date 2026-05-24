import { Check, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface SyncBadgeProps {
  status: 'pending' | 'syncing' | 'synced' | 'error';
}

export function SyncBadge({ status }: SyncBadgeProps) {
  const config = {
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    },
    syncing: {
      icon: Loader2,
      label: 'Syncing',
      className: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    },
    synced: {
      icon: Check,
      label: 'Synced',
      className: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      className: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
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
