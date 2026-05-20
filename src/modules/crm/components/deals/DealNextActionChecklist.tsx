/**
 * DealNextActionChecklist — surfaces "what's needed next" on a deal by
 * inspecting the deal's state + linked SO summary. Purely derived;
 * no Firestore reads. Designed to slot into the Deal detail page so
 * sales can see the outstanding tasks without flipping between modules.
 *
 * Heuristics:
 *   - lead → qualification stages: confirm site visit + quote
 *   - quotation / negotiation: send quote / follow up
 *   - won + no SO: create sales order
 *   - SO exists + open COs: chase client approval
 *   - SO exists + post-freeze CO: needs senior review
 *   - No design project: create one
 */

import { NavLink } from 'react-router-dom';
import { Circle, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { CRMDeal } from '../../types';

interface Props {
  deal: CRMDeal;
  hasLinkedProject: boolean;
  hasLinkedSalesOrder: boolean;
  linkedSalesOrderId?: string | null;
}

interface ChecklistItem {
  key: string;
  done: boolean;
  label: string;
  severity?: 'critical' | 'warning' | 'info';
  cta?: { label: string; to: string };
}

function buildChecklist(
  deal: CRMDeal,
  hasLinkedProject: boolean,
  hasLinkedSalesOrder: boolean,
  linkedSalesOrderId?: string | null,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const isClosedLost = deal.stage === 'lost';
  const isClosedWon = deal.stage === 'won';

  // ── Pipeline progression ───────────────────────────────────────────────
  if (!isClosedLost && !isClosedWon) {
    const stageOrder: CRMDeal['stage'][] = [
      'lead',
      'qualification',
      'site_visit',
      'design_proposal',
      'quotation',
      'negotiation',
    ];
    const currentIdx = stageOrder.indexOf(deal.stage);

    if (currentIdx >= 0 && currentIdx < 2) {
      items.push({
        key: 'qualify',
        done: currentIdx >= 1,
        label: currentIdx >= 1 ? 'Deal qualified' : 'Qualify the lead — confirm budget & timeline',
        severity: currentIdx >= 1 ? undefined : 'info',
      });
    }

    if (!deal.siteLocation?.address) {
      items.push({
        key: 'site-location',
        done: false,
        label: 'Add site address — required before booking a site visit',
        severity: 'info',
      });
    }

    if (!deal.expectedCloseDate) {
      items.push({
        key: 'close-date',
        done: false,
        label: 'Set expected close date — drives pipeline forecasting',
        severity: 'info',
      });
    }

    if (deal.stage === 'quotation' || deal.stage === 'negotiation') {
      items.push({
        key: 'follow-up',
        done: Boolean(deal.nextFollowUpDate),
        label: deal.nextFollowUpDate
          ? 'Follow-up scheduled'
          : 'Schedule a follow-up call — deal is in active negotiation',
        severity: deal.nextFollowUpDate ? undefined : 'warning',
      });
    }
  }

  // ── Design + Sales Order creation ──────────────────────────────────────
  items.push({
    key: 'project',
    done: hasLinkedProject,
    label: hasLinkedProject ? 'Design project created' : 'Create a design project for this deal',
    severity: hasLinkedProject ? undefined : 'info',
  });

  if (isClosedWon) {
    items.push({
      key: 'sales-order',
      done: hasLinkedSalesOrder,
      label: hasLinkedSalesOrder
        ? 'Sales order created'
        : 'Create the sales order — deal is won but no SO on file',
      severity: hasLinkedSalesOrder ? undefined : 'critical',
    });
  }

  // ── Change orders ──────────────────────────────────────────────────────
  const coSummary = deal.changeOrderSummary;
  if (hasLinkedSalesOrder && coSummary) {
    if (coSummary.openCount > 0 && linkedSalesOrderId) {
      items.push({
        key: 'co-pending',
        done: false,
        label: `${coSummary.openCount} change order${coSummary.openCount > 1 ? 's' : ''} awaiting approval`,
        severity: 'warning',
        cta: {
          label: 'Review change orders',
          to: `/sales-orders/${linkedSalesOrderId}?tab=change-orders`,
        },
      });
    }
    if (coSummary.hasPostFreezeCO) {
      items.push({
        key: 'co-post-freeze',
        done: false,
        label: 'A change order was raised after scope freeze — needs senior sign-off',
        severity: 'critical',
      });
    }
  }

  // ── Lost / won closure ─────────────────────────────────────────────────
  if (isClosedLost && !deal.closedReason) {
    items.push({
      key: 'loss-reason',
      done: false,
      label: 'Record the reason this deal was lost — feeds win/loss analysis',
      severity: 'info',
    });
  }

  return items;
}

export default function DealNextActionChecklist({
  deal,
  hasLinkedProject,
  hasLinkedSalesOrder,
  linkedSalesOrderId,
}: Props) {
  const items = buildChecklist(deal, hasLinkedProject, hasLinkedSalesOrder, linkedSalesOrderId);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">What&apos;s needed next</h3>
        <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Nothing pressing — deal is up to date.
        </p>
      </div>
    );
  }

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        What&apos;s needed next
        <span className="ml-2 text-xs text-gray-400 font-normal">
          {open.length} open · {done.length} complete
        </span>
      </h3>
      <ul className="space-y-1.5">
        {open.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
        {done.length > 0 && (
          <>
            <li className="text-[10px] uppercase text-gray-400 font-semibold pt-2">
              Completed
            </li>
            {done.map((item) => (
              <ChecklistRow key={item.key} item={item} />
            ))}
          </>
        )}
      </ul>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const severityClass =
    item.severity === 'critical'
      ? 'text-rose-700'
      : item.severity === 'warning'
        ? 'text-amber-700'
        : 'text-gray-700';
  return (
    <li className="flex items-start gap-2 text-xs">
      {item.done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
      ) : item.severity === 'critical' || item.severity === 'warning' ? (
        <AlertTriangle
          className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${severityClass}`}
        />
      ) : (
        <Circle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
      )}
      <div className={`flex-1 ${item.done ? 'text-gray-500 line-through' : severityClass}`}>
        {item.label}
        {item.cta && (
          <NavLink
            to={item.cta.to}
            className="ml-2 inline-flex items-center gap-0.5 text-indigo-600 hover:underline"
          >
            {item.cta.label}
            <ArrowRight className="h-3 w-3" />
          </NavLink>
        )}
      </div>
    </li>
  );
}
