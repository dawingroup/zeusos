// Persistent pill sub-navigation for the Operations section.
// Wraps all /finance/operations/* sub-pages so pills remain visible.

import { Outlet } from 'react-router-dom';
import {
  Wallet,
  FileText,
  Receipt,
  PieChart,
  ClipboardCheck,
  RotateCcw,
  Shield,
  Scale,
} from 'lucide-react';
import { SubNavPills, type SubNavPill } from '../SubNavPills';

const OPS_NAV: SubNavPill[] = [
  { id: 'landing', label: 'Summary', icon: Wallet, path: '/finance/operations' },
  { id: 'invoices', label: 'Invoices', icon: FileText, path: '/finance/operations/invoices' },
  { id: 'bills', label: 'Bills', icon: Receipt, path: '/finance/operations/bills' },
  { id: 'budgets', label: 'Budgets', icon: PieChart, path: '/finance/operations/budgets' },
  { id: 'expenses', label: 'Expenses', icon: Wallet, path: '/finance/operations/expenses' },
  { id: 'accountability', label: 'Accountability', icon: ClipboardCheck, path: '/finance/operations/accountability' },
  { id: 'refunds', label: 'Refunds', icon: RotateCcw, path: '/finance/operations/refunds' },
  { id: 'tax', label: 'Tax', icon: Shield, path: '/finance/operations/tax-compliance' },
  { id: 'reconciliations', label: 'Reconcile', icon: Scale, path: '/finance/operations/reconciliations' },
];

export function OperationsLayout() {
  return (
    <div className="space-y-5">
      <SubNavPills pills={OPS_NAV} />
      <Outlet />
    </div>
  );
}
