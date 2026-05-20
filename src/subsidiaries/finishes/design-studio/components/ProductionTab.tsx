/**
 * ProductionTab — Right drawer panel showing MO production context
 *
 * Displays: MO header with status badge, horizontal stage stepper,
 * BOM table with stock availability badges, and linked documents.
 */

import { Factory, Package, AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import type { ProductionContext, StockBadge } from '../types/workshop-viewer.types';

// Stage pipeline order matching manufacturing module constants
const STAGE_PIPELINE = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'] as const;

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  cutting: 'Cutting',
  assembly: 'Assembly',
  finishing: 'Finishing',
  qc: 'QC',
  ready: 'Ready',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  'pending-approval': 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-emerald-100 text-emerald-700',
  'on-hold': 'bg-orange-100 text-orange-700',
  'partially-complete': 'bg-cyan-100 text-cyan-700',
  completed: 'bg-green-100 text-green-700',
  'closed-out': 'bg-gray-200 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  'pending-approval': 'Pending Approval',
  approved: 'Approved',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  'partially-complete': 'Partially Complete',
  completed: 'Completed',
  'closed-out': 'Closed Out',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  urgent: 'text-red-600',
};

const BADGE_CONFIG: Record<StockBadge, { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-green-100', text: 'text-green-700', label: 'In Stock' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' },
  out_of_stock: { bg: 'bg-red-100', text: 'text-red-600', label: 'No Stock' },
};

interface ProductionTabProps {
  production: ProductionContext;
}

export default function ProductionTab({ production }: ProductionTabProps) {
  const currentStageIdx = STAGE_PIPELINE.indexOf(
    production.currentStage as typeof STAGE_PIPELINE[number],
  );

  return (
    <div className="flex flex-col gap-3 p-2 text-xs">
      {/* MO Header */}
      <div className="flex items-start gap-2">
        <Factory className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{production.orderNumber}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                STATUS_COLORS[production.status] || 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABELS[production.status] || production.status}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5">
            {production.itemName}
            {production.quantity > 1 && ` x${production.quantity}`}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`font-medium capitalize ${PRIORITY_COLORS[production.priority] || ''}`}>
              {production.priority}
            </span>
            {production.targetCompletionDate && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {new Date(production.targetCompletionDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stage Stepper */}
      <div className="border rounded-lg p-2 bg-muted/20">
        <div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
          Production Stage
        </div>
        <div className="flex items-center gap-0.5">
          {STAGE_PIPELINE.map((stage, idx) => {
            const isPast = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            const isFuture = idx > currentStageIdx;
            return (
              <div key={stage} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold
                      ${isPast ? 'bg-green-500 text-white' : ''}
                      ${isCurrent ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : ''}
                      ${isFuture ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {isPast ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={`text-[8px] mt-0.5 text-center leading-tight ${
                      isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {STAGE_LABELS[stage] || stage}
                  </span>
                </div>
                {idx < STAGE_PIPELINE.length - 1 && (
                  <div
                    className={`h-px flex-shrink-0 w-2 mt-[-10px] ${
                      isPast ? 'bg-green-500' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOM Table */}
      {production.bomEntries.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-2 py-1.5 bg-muted/30 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Bill of Materials ({production.bomEntries.length})
            </span>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {production.bomEntries.map((entry) => {
              const badge = BADGE_CONFIG[entry.stockBadge];
              return (
                <div key={entry.id} className="px-2 py-1.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{entry.itemName}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {entry.sku && <span>{entry.sku} · </span>}
                      {entry.quantityRequired} {entry.unit}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Stock summary */}
          {(() => {
            const outOfStock = production.bomEntries.filter(e => e.stockBadge === 'out_of_stock').length;
            const partial = production.bomEntries.filter(e => e.stockBadge === 'partial').length;
            if (outOfStock === 0 && partial === 0) return null;
            return (
              <div className="px-2 py-1.5 bg-amber-50 border-t border-amber-200 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[10px] text-amber-700">
                  {outOfStock > 0 && `${outOfStock} item${outOfStock > 1 ? 's' : ''} out of stock`}
                  {outOfStock > 0 && partial > 0 && ', '}
                  {partial > 0 && `${partial} partially available`}
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* Linked Documents */}
      {production.linkedDocuments.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-2 py-1.5 bg-muted/30 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Documents ({production.linkedDocuments.length})
            </span>
          </div>
          <div className="divide-y divide-border">
            {production.linkedDocuments.map((d) => (
              <div key={d.id} className="px-2 py-1.5 flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-[9px] text-muted-foreground">{d.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
