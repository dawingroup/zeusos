export {
  taxTreatmentFor,
  jurisdictionForOrg,
  type Jurisdiction,
} from './tax-treatment.service';

export {
  getEffectiveRate,
  convertMinor,
  type FXLookupOptions,
} from './fx-rate.service';

export {
  firestoreAuditGLAdapter,
  resolveAdapter,
  buildICJournalEntries,
  type GLAdapter,
} from './gl-adapter.service';

export { qboGLAdapter } from './gl-adapter.qbo';

export {
  raiseFromIWOClosed,
  getInterCompanyInvoice,
  listInterCompanyInvoices,
  type RaiseFromIWOClosedInput,
} from './intercompany-invoice.service';

export {
  generateClientInvoice,
  issueClientInvoice,
  recordClientPayment,
  getClientInvoice,
  listClientInvoices,
  type GenerateClientInvoiceInput,
} from './client-invoice.service';

export {
  generateClientInvoiceFromQuote,
  type GenerateClientInvoiceFromQuoteInput,
} from './client-invoice-from-quote.service';

export {
  toClientFacingInvoice,
  toClientFacingLine,
  clientFriendlyDescription,
} from './client-friendly';

export {
  hasBillingAdminScope,
  type BillingAccessContext,
} from './billing-scope.service';
