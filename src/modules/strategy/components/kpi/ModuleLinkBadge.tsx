/**
 * Module Link Badge
 * Shows which module a KPI is linked to with a navigation link.
 */

import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { ModuleLinkage } from '../../constants/kpiLibrary.constants';

const MODULE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  finance: { label: 'Finance', color: 'text-[var(--rag-green)]', bg: 'bg-[var(--rag-green-soft)] border-[var(--rag-green)]' },
  hr: { label: 'HR', color: 'text-[var(--rag-blue)]', bg: 'bg-[var(--rag-blue-soft)] border-[var(--rag-blue)]' },
  manufacturing: { label: 'Manufacturing', color: 'text-[var(--rag-amber)]', bg: 'bg-[var(--rag-amber-soft)] border-[var(--rag-amber)]' },
  sales: { label: 'Sales', color: 'text-[var(--rag-red)]', bg: 'bg-[var(--rag-red-soft)] border-[var(--rag-red)]' },
  operations: { label: 'Operations', color: 'text-[var(--rag-blue)]', bg: 'bg-[var(--rag-blue-soft)] border-[var(--rag-blue)]' },
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
