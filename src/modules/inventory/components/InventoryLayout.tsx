/**
 * Inventory Layout
 * Tab-based navigation for Inventory module sub-pages.
 * Follows the ManufacturingLayout pattern.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const INVENTORY_TABS: TabNavItem[] = [
  { id: 'items', label: 'Inventory', path: '/inventory', icon: 'Package', exact: true },
  { id: 'adjustments', label: 'Stock Adjustments', path: '/inventory/adjustments', icon: 'SwapVert' },
  { id: 'finishes', label: 'Finish Library', path: '/inventory/finishes', icon: 'Palette' },
  { id: 'offcuts', label: 'Offcut Library', path: '/inventory/offcuts', icon: 'Recycle' },
  { id: 'issues', label: 'Issue from Stores', path: '/inventory/issues', icon: 'PackageOpen' },
  { id: 'categories', label: 'Categories', path: '/inventory/categories', icon: 'FolderTree' },
];

export default function InventoryLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Inventory"
        subtitle="Stock & Finish Management"
        tabs={INVENTORY_TABS}
        accentColor="indigo"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
