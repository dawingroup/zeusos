import { Inbox, Clock, Check, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  filter: 'all' | 'pending' | 'synced' | 'error';
}

export default function EmptyState({ filter }: EmptyStateProps) {
  const config = {
    all: {
      icon: Inbox,
      title: 'No clips yet',
      description: 'Start clipping images from any webpage',
    },
    pending: {
      icon: Clock,
      title: 'No pending clips',
      description: 'All clips have been synced',
    },
    synced: {
      icon: Check,
      title: 'No synced clips',
      description: 'Clips will appear here after syncing',
    },
    error: {
      icon: AlertCircle,
      title: 'No sync errors',
      description: 'All clips synced successfully',
    },
  };

  const { icon: Icon, title, description } = config[filter];

  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
      <Icon className="w-12 h-12 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}
