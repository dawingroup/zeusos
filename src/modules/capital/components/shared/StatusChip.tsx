import React from 'react';
import { Badge } from '@/core/components/ui/badge';

interface StatusChipProps {
  label: string;
  color?: string;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  label,
  color,
  variant = 'default',
  className,
}) => {
  return (
    <Badge
      variant={variant}
      className={className}
      style={color ? { backgroundColor: color, color: '#fff', borderColor: color } : undefined}
    >
      {label}
    </Badge>
  );
};

export default StatusChip;
