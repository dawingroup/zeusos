/**
 * Module Link Badge
 * Shows which module a KPI is linked to with a navigation link.
 */

import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { ModuleLinkage } from '../../constants/kpiLibrary.constants';

const MODULE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  finance: { label: 'Finance', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  hr: { label: 'HR', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  manufacturing: { label: 'Manufacturing', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  sales: { label: 'Sales', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
  operations: { label: 'Operations', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

interface ModuleLinkBadgeProps {
  linkage: ModuleLinkage;
  showLink?: boolean;
  size?: 'sm' | 'md';
}

export function ModuleLinkBadge({ linkage, showLink = true, size = 'sm' }: ModuleLinkBadgeProps) {
  const config = MODULE_CONFIG[linkage.module] || {
    label: linkage.module,
    color: 'text-muted-foreground',
    bg: 'bg-[var(--bg-sunken)] border-[var(--border-subtle)]',
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${config.bg} ${config.color} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
      {linkage.autoComputable && (
        <span className="text-[10px] opacity-70">(auto)</span>
      )}
      {showLink && linkage.dataSourcePath && (
        <ExternalLink className="w-3 h-3 opacity-60" />
      )}
    </span>
  );

  if (showLink && linkage.dataSourcePath) {
    return (
      <Link to={linkage.dataSourcePath} className="hover:opacity-80 transition-opacity">
        {badge}
      </Link>
    );
  }

  return badge;
}
