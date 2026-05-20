/**
 * Holding Firebase Collections Configuration
 * 
 * Defines Firestore collection paths and security rules
 */

// Collection paths
export const HOLDING_COLLECTIONS = {
  holdings: 'advisoryPlatform/advisory/holdings',
  transactions: (holdingId: string) => 
    `advisoryPlatform/advisory/holdings/${holdingId}/transactions`,
  valuations: (holdingId: string) => 
    `advisoryPlatform/advisory/holdings/${holdingId}/valuations`,
  income: (holdingId: string) => 
    `advisoryPlatform/advisory/holdings/${holdingId}/income`,
  statusHistory: (holdingId: string) => 
    `advisoryPlatform/advisory/holdings/${holdingId}/statusHistory`,
} as const;

// Firestore indexes required
export const HOLDING_INDEXES = [
  {
    collection: 'advisoryPlatform/advisory/holdings',
    fields: [
      { fieldPath: 'portfolioId', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/holdings',
    fields: [
      { fieldPath: 'underlyingAsset.dealId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/holdings',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'transactions',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'effectiveDate', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'valuations',
    fields: [
      { fieldPath: 'valuationDate', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'income',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'paymentDate', order: 'DESCENDING' },
    ],
  },
] as const;

// Security rules for holding collections
export const HOLDING_SECURITY_RULES = `
// Holding Rules
match /advisoryPlatform/advisory/holdings/{holdingId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.createdBy == request.auth.uid;
  allow update: if request.auth != null;
  allow delete: if false; // Soft delete only
  
  // Transactions subcollection
  match /transactions/{txnId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null 
      && request.resource.data.status in ['approved', 'completed', 'cancelled'];
    allow delete: if false;
  }
  
  // Valuations subcollection
  match /valuations/{valId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null;
    allow delete: if false;
  }
  
  // Income subcollection
  match /income/{incomeId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null;
    allow delete: if false;
  }
  
  // Status history subcollection
  match /statusHistory/{historyId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}
`;

// Data validation helpers
export const HOLDING_VALIDATION = {
  validTypes: [
    'equity',
    'preferred_equity',
    'mezzanine',
    'senior_debt',
    'subordinated_debt',
    'convertible',
    'fund_interest',
    'co_investment',
    'warrant',
    'royalty',
    'hybrid',
    'other',
  ],
  
  validStatuses: [
    'pipeline',
    'committed',
    'partially_funded',
    'fully_funded',
    'active',
    'impaired',
    'workout',
    'partially_realized',
    'fully_realized',
    'written_off',
  ],
  
  validStages: [
    'greenfield',
    'brownfield',
    'operational',
    'mature',
    'turnaround',
  ],
  
  validTransactionTypes: [
    'initial_acquisition',
    'follow_on',
    'partial_realization',
    'full_realization',
    'dividend_recap',
    'refinancing',
    'write_down',
    'write_up',
    'impairment',
    'reversal',
    'fx_adjustment',
    'reclassification',
    'conversion',
    'transfer',
    'other',
  ],
  
  validIncomeTypes: [
    'dividend',
    'preferred_dividend',
    'interest',
    'pik_interest',
    'principal_repayment',
    'management_fee',
    'directors_fee',
    'arrangement_fee',
    'commitment_fee',
    'exit_fee',
    'distribution',
    'capital_return',
    'royalty',
    'other',
  ],
  
  validValuationMethodologies: [
    'dcf',
    'comparable_companies',
    'precedent_transactions',
    'asset_based',
    'earnings_multiple',
    'revenue_multiple',
    'book_value',
    'replacement_cost',
    'recent_transaction',
    'quoted_price',
    'nav',
    'yield_based',
    'option_pricing',
    'independent_valuation',
  ],
} as const;
