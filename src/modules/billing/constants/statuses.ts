/**
 * Status enums + UI display metadata for both invoice flavours.
 */

import type {
  ClientInvoiceStatus,
} from '../types/client-invoice.types';
import type {
  InterCompanyInvoiceStatus,
} from '../types/intercompany-invoice.types';

export const CLIENT_INVOICE_STATUSES: ClientInvoiceStatus[] = [
  'DRAFT',
  'ISSUED',
  'PART_PAID',
  'PAID',
  'VOID',
];

export const INTERCOMPANY_INVOICE_STATUSES: InterCompanyInvoiceStatus[] = [
  'DRAFT',
  'RAISED',
  'POSTED',
  'SETTLED',
  'VOID',
];

export const CLIENT_INVOICE_STATUS_LABEL: Record<ClientInvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PART_PAID: 'Partially paid',
  PAID: 'Paid',
  VOID: 'Void',
};

export const INTERCOMPANY_INVOICE_STATUS_LABEL: Record<InterCompanyInvoiceStatus, string> = {
  DRAFT: 'Draft',
  RAISED: 'Raised',
  POSTED: 'Posted to GL',
  SETTLED: 'Settled',
  VOID: 'Void',
};
