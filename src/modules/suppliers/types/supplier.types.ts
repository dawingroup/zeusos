/**
 * Supplier — generic directory entry for external 3rd-party vendors.
 *
 * Collection: supplier_orgs/{supplierId}
 *
 * The DawinOS Suppliers module (construction-focused: lumber, hardware,
 * millwork) was removed in Phase 1.C. This Phase 4 successor is purpose-
 * built for the marketing consortium: media houses, talent agencies,
 * production houses, print shops, and other one-off vendors.
 *
 * Linkage: `media_supplier_invoices.supplierOrgId` references this
 * collection; the procurement consumer (`onMediaSupplierInvoicePaid`)
 * carries the id forward into `purchase_orders.supplierOrgId`.
 *
 * Access model: staff read, parent-org write. The directory is shared
 * across all sub-brands so a media house registered once is reusable.
 */

import type { Timestamp } from 'firebase/firestore';

export type SupplierKind =
  | 'MEDIA_HOUSE'         // TV, radio, OOH, digital, print networks
  | 'TALENT_AGENCY'       // agencies that represent talent
  | 'PRODUCTION_HOUSE'    // shoot crews, post houses, studios
  | 'PRINT_SHOP'          // physical print production
  | 'TECH_VENDOR'         // SaaS, hosting, ad-tech
  | 'VENDOR_OTHER';       // catering, props, transport, misc

export type SupplierStatus =
  | 'ACTIVE'
  | 'INACTIVE'      // no longer engaged but kept for historical reference
  | 'BLACKLISTED';  // do not engage (compliance / quality / payment issues)

export type PaymentTerms =
  | 'ON_RECEIPT'
  | 'NET_15'
  | 'NET_30'
  | 'NET_60'
  | 'NET_90'
  | 'PREPAID';

export type CurrencyCode = 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';

export interface SupplierContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Supplier {
  id: string;
  /** Display name (e.g. "Next Media Services Ltd"). */
  name: string;
  kind: SupplierKind;
  status: SupplierStatus;
  /** Operating country (ISO 3166-1 alpha-2, e.g. "UG", "KE"). */
  countryCode?: string;
  /** Default invoicing currency. */
  currency: CurrencyCode;
  paymentTerms: PaymentTerms;
  /** Primary contact for AM / Finance follow-up. */
  primaryContact?: SupplierContact;
  /** Tax ID / TIN / VAT number — sensitive but not secret. */
  taxId?: string;
  /** Free-form address (Phase 5 may structure this). */
  address?: string;
  /** Internal notes — risks, capacity, preferred slots, etc. */
  notes?: string;
  /** Tags for ad-hoc filtering (e.g. ["radio", "luganda", "northern-uganda"]). */
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  /** Set when status moves to BLACKLISTED — captures the reason for audit. */
  blacklistedAt?: Timestamp | string;
  blacklistedBy?: string;
  blacklistReason?: string;
}
