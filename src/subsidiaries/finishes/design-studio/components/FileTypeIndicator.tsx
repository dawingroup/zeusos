/**
 * FileTypeIndicator — Icon + Badge for file type display
 */

import { Box, Layers, Table2, FileType } from 'lucide-react';
import { Badge } from '@/core/components/ui/badge';

const EXT_CONFIG: Record<string, { icon: typeof Box; color: string; label: string }> = {
  '.3ds': { icon: Box, color: 'text-blue-500', label: '3DS' },
  '.dxf': { icon: Layers, color: 'text-purple-500', label: 'DXF' },
  '.csv': { icon: Table2, color: 'text-emerald-500', label: 'CSV' },
};

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileTypeIndicatorProps {
  fileName: string;
  iconSize?: string;
  showBadge?: boolean;
}

export default function FileTypeIndicator({
  fileName,
  iconSize = 'w-4 h-4',
  showBadge = true,
}: FileTypeIndicatorProps) {
  const ext = getFileExtension(fileName);
  const config = EXT_CONFIG[ext];
  const Icon = config?.icon || FileType;
  const color = config?.color || 'text-muted-foreground';

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`${iconSize} ${color} flex-shrink-0`} />
      {showBadge && config && (
        <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 font-medium ${color} border-current/30`}>
          {config.label}
        </Badge>
      )}
    </span>
  );
}
