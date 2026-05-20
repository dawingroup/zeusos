/**
 * ScopeChangeOrderBanner — small header strip on the Design Project
 * page showing scope version, CO counts, and shortcuts into the
 * linked SalesOrder's Change Orders tab.
 *
 * Hidden entirely when the project has no linked SO and no COs. When
 * there's a linked SO but no COs yet, we still show the scope version
 * indicator so users can see the scope is locked/v1.
 */

import { Link } from 'react-router-dom';
import { GitBranch, FilePlus, CheckCircle2, AlertTriangle, ExternalLink, Lock } from 'lucide-react';
import type { DesignProjectCOContext } from '../../services/changeOrderContextService';

interface Props {
  context: DesignProjectCOContext;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ScopeChangeOrderBanner({ context, currency = 'UGX' }: Props) {
  if (!context.salesOrderId && context.totalCount === 0) {
    // Nothing interesting to show — hide entirely
    return null;
  }

  const { salesOrderId, salesOrderNumber, scopeVersion, scopeFrozen, totalCount } = context;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <GitBranch className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-gray-900">Scope v{scopeVersion}</span>
          {scopeFrozen && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <Lock className="h-2.5 w-2.5" />
              Frozen
            </span>
          )}
        </div>

        {totalCount > 0 && (
          <div className="h-5 w-px bg-gray-200" aria-hidden />
        )}

        {context.openCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <FilePlus className="h-3 w-3" />
            {context.openCount} open change order{context.openCount > 1 ? 's' : ''}
            {context.totalPendingValue !== 0 && (
              <span className="ml-1 text-amber-600">
                ({context.totalPendingValue >= 0 ? '+' : ''}
                {formatCurrency(context.totalPendingValue, currency)})
              </span>
            )}
          </span>
        )}

        {context.approvedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            {context.approvedCount} approved
            {context.totalApprovedValue !== 0 && (
              <span className="ml-1 text-emerald-600">
                ({context.totalApprovedValue >= 0 ? '+' : ''}
                {formatCurrency(context.totalApprovedValue, currency)})
              </span>
            )}
          </span>
        )}

        {context.hasPostFreezeCO && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            Post-freeze change order
          </span>
        )}

        {salesOrderId === null && totalCount === 0 && (
          <span className="text-xs text-gray-500">No sales order linked</span>
        )}
      </div>

      {salesOrderId && (
        <Link
          to={`/sales-orders/${salesOrderId}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200"
          title={salesOrderNumber ?? undefined}
        >
          {salesOrderNumber ?? 'View SO'}
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
