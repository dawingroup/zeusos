import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

export function EmployeeCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    department?: string;
    jobTitle?: string;
    role?: string;
    email?: string;
    employeeId?: string;
    employmentStatus?: string;
  };
  const status = data.employmentStatus?.toLowerCase();
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={status ? <StatusPill tone={status === 'active' ? 'success' : 'neutral'}>{status}</StatusPill> : null}
    >
      <div className="font-medium truncate">{record.title}</div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.employeeId && <span className="font-mono">{data.employeeId}</span>}
        {data.jobTitle && <span>· {data.jobTitle}</span>}
        {data.department && <span>· {data.department}</span>}
      </div>
    </CardShell>
  );
}
