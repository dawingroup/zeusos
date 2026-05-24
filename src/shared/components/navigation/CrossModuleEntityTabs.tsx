/**
 * Header strip: quick navigation between linked CRM deal, design project,
 * sales order, and manufacturing order detail pages.
 */

import { NavLink } from 'react-router-dom';
import { Briefcase, Factory, FileText, FolderOpen } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface CrossModuleEntityLinks {
  dealId?: string | null;
  designProjectId?: string | null;
  salesOrderId?: string | null;
  manufacturingOrderId?: string | null;
}

const ITEMS: {
  key: string;
  label: string;
  shortLabel: string;
  icon: typeof Briefcase;
  to: (m: CrossModuleEntityLinks) => string | null;
}[] = [
  {
    key: 'crm_deal',
    label: 'CRM deal',
    shortLabel: 'Deal',
    icon: Briefcase,
    to: (m) => (m.dealId ? `/crm/deals/${m.dealId}` : null),
  },
  {
    key: 'design_project',
    label: 'Design project',
    shortLabel: 'Design',
    icon: FolderOpen,
    to: (m) => (m.designProjectId ? `/design/project/${m.designProjectId}` : null),
  },
  {
    key: 'sales_order',
    label: 'Sales order',
    shortLabel: 'SO',
    icon: FileText,
    to: (m) => (m.salesOrderId ? `/sales-orders/${m.salesOrderId}` : null),
  },
  {
    key: 'manufacturing_order',
    label: 'Manufacturing order',
    shortLabel: 'MO',
    icon: Factory,
    to: (m) => (m.manufacturingOrderId ? `/manufacturing/orders/${m.manufacturingOrderId}` : null),
  },
];

export function CrossModuleEntityTabs({
  links,
  className,
}: {
  links: CrossModuleEntityLinks;
  className?: string;
}) {
  return (
    <nav
      aria-label="Related records"
      className={cn(
        'flex flex-wrap gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sunken)]/90 p-1 shadow-sm',
        className,
      )}
    >
      {ITEMS.map(({ key, label, shortLabel, icon: Icon, to }) => {
        const href = to(links);
        const base =
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3';

        if (href) {
          return (
            <NavLink
              key={key}
              to={href}
              end
              className={({ isActive }) =>
                cn(
                  base,
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground',
                )
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </NavLink>
          );
        }

        return (
          <span
            key={key}
            className={cn(base, 'cursor-not-allowed text-[var(--fg-tertiary)] opacity-60')}
            title={`No ${label.toLowerCase()} linked`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </span>
        );
      })}
    </nav>
  );
}
