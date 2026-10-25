/**
 * Where an approvals-inbox row opens.
 *
 * A row a person cannot click is a row they have to go and find. Every
 * projector hands the ids its route needs (client / MSA / SOW for the
 * nested commercial pages); this resolves them through the shared
 * record-route registry and falls back to the nearest routed ancestor when
 * a denormalised id is missing on an older document.
 *
 * Returns null only when the record's page genuinely cannot be named from
 * what the row carries. `approvalRowHref.test.ts` pins that every kind the
 * projectors emit resolves, so a new projector cannot quietly add a dead
 * row.
 */

import { resolveRecordTarget } from '@/shared/navigation';
import type { ApprovalItem } from './types';

export function approvalRowHref(item: ApprovalItem): string | null {
  const { type, id, clientId, msaId, sowId, mediaPlanId } = item.entity;

  switch (type) {
    // Both IWO rows open the IWO workspace, where the ladder and the
    // acceptance criteria live.
    case 'iwo':
      return resolveRecordTarget('iwo', { id }).path;

    case 'sow': {
      const own = resolveRecordTarget('sow', { id, clientId, msaId }).path;
      if (own) return own;
      return clientId ? resolveRecordTarget('client', { id: clientId }).path : null;
    }

    case 'changeOrder': {
      const own = resolveRecordTarget('changeOrder', { id, clientId, msaId, sowId }).path;
      if (own) return own;
      const sow = sowId ? resolveRecordTarget('sow', { id: sowId, clientId, msaId }).path : null;
      if (sow) return sow;
      return clientId ? resolveRecordTarget('client', { id: clientId }).path : null;
    }

    case 'quote':
      return resolveRecordTarget('quote', { id }).path;

    // The two supplier-invoice collections have list pages, not detail pages.
    case 'talentInvoice':
      return '/talent/invoices';
    case 'mediaSupplierInvoice':
      return mediaPlanId ? `/media/${encodeURIComponent(mediaPlanId)}` : '/media';

    default:
      return resolveRecordTarget(type, { id, clientId, msaId, sowId }).path;
  }
}
