/**
 * FUND LOCATION TYPES
 *
 * Dynamic fund locations per program: International HQ (USD treasury)
 * and local program offices (UGX disbursement points).
 * Available funds tracked per location.
 */

import { Timestamp } from 'firebase/firestore';
import type { Money } from '../../core/types/money';
import type { TransactionExchangeRate } from './exchange-rate';

// ─────────────────────────────────────────────────────────────────
// FUND LOCATION
// ─────────────────────────────────────────────────────────────────

export type FundLocationType = 'international_hq' | 'regional_office' | 'field_office';

export const FUND_LOCATION_TYPE_CONFIG: Record<FundLocationType, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  international_hq: {
    label: 'International HQ',
    description: 'Main treasury holding program budget in USD',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  regional_office: {
    label: 'Regional Office',
    description: 'Regional coordination office',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  field_office: {
    label: 'Field Office',
    description: 'Local program implementation office',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
};

/**
 * Firestore document in `advisory_programs/{programId}/fund_locations`.
 */
export interface FundLocation {
  id: string;
  programId: string;
  name: string;                     // e.g. "Geneva HQ", "Kampala Program Office"
  type: FundLocationType;
  currency: string;                 // Primary operating currency (HQ='USD', field='UGX')
  country: string;
  region?: string;
  isActive: boolean;
  isTreasury: boolean;              // true for the main HQ that holds program budget
  contactPerson?: string;
  contactEmail?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// FUND LOCATION BALANCE (Computed)
// ─────────────────────────────────────────────────────────────────

/**
 * Balance snapshot — derived from transfers + payments, not stored directly.
 */
export interface FundLocationBalance {
  locationId: string;
  locationName: string;
  locationType: FundLocationType;
  currency: string;
  totalReceived: number;            // Sum of inbound transfers
  totalDisbursed: number;           // Sum of payments made from this location
  totalPending: number;             // Approved but not yet paid
  availableBalance: number;         // received - disbursed - pending
  lastUpdated: Date;
}

// ─────────────────────────────────────────────────────────────────
// BANK FEE CONFIGURATION
// ─────────────────────────────────────────────────────────────────

/** Bank fees & transaction costs rate applied per transfer line item */
export const BANK_FEE_RATE = 0.004; // 0.4%

// ─────────────────────────────────────────────────────────────────
// TRANSFER LINE ITEM (per-project breakdown)
// ─────────────────────────────────────────────────────────────────

export interface TransferLineItem {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  grantAmount: number;              // Gross transfer amount (inclusive of bank fee)
  bankFee: number;                  // Auto-extracted: grantAmount * BANK_FEE_RATE / (1 + BANK_FEE_RATE)
  lineTotal: number;                // Net to project: grantAmount - bankFee
}

// ─────────────────────────────────────────────────────────────────
// FUND TRANSFER
// ─────────────────────────────────────────────────────────────────

export type FundTransferStatus = 'pending' | 'confirmed' | 'cancelled';

/**
 * Transfer between locations (e.g. HQ → field office disbursement).
 * Firestore document in `advisory_programs/{programId}/fund_transfers`.
 */
export interface FundTransfer {
  id: string;
  programId: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  amount: Money;                    // Total amount in source currency
  exchangeRate?: TransactionExchangeRate; // If cross-currency transfer
  convertedAmount?: Money;          // Amount in receiving location's currency
  reference: string;                // Transfer reference number
  purpose: string;
  status: FundTransferStatus;
  transferDate: Date;
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  budgetPeriodId?: string;          // Which calendar year
  lineItems?: TransferLineItem[];   // Per-project breakdown (optional for backwards compat)
  createdBy: string;
  createdAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function getFundLocationTypeLabel(type: FundLocationType): string {
  return FUND_LOCATION_TYPE_CONFIG[type].label;
}

export function getFundLocationTypeColor(type: FundLocationType): string {
  return `${FUND_LOCATION_TYPE_CONFIG[type].color} ${FUND_LOCATION_TYPE_CONFIG[type].bgColor}`;
}

export function getTransferStatusColor(status: FundTransferStatus): string {
  const colors: Record<FundTransferStatus, string> = {
    pending: 'text-amber-600 bg-amber-100',
    confirmed: 'text-green-600 bg-green-100',
    cancelled: 'text-gray-600 bg-gray-100',
  };
  return colors[status];
}

/** Extract bank fee from gross amount (grant amount is inclusive of the 0.4% fee) */
export function calculateBankFee(grossAmount: number): number {
  return Math.round((grossAmount * BANK_FEE_RATE / (1 + BANK_FEE_RATE)) * 100) / 100;
}

export function calculateTransferTotal(lineItems: TransferLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
}
