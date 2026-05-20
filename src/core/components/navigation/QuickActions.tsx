import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { QUICK_ACTIONS } from '@/integration/constants/modules.constants';

export interface QuickActionsProps {
  max?: number;
}

export function QuickActions({ max = 8 }: QuickActionsProps) {
  const navigate = useNavigate();

  const actions = useMemo(() => QUICK_ACTIONS.slice(0, max), [max]);

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          onClick={() => navigate(action.path)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
