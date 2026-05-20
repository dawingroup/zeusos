/**
 * Portfolio Firebase Collections Configuration
 * 
 * Defines Firestore collection paths and security rules
 */

// Collection paths
export const PORTFOLIO_COLLECTIONS = {
  portfolios: 'advisoryPlatform/advisory/portfolios',
  statusHistory: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/statusHistory`,
  navHistory: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/navHistory`,
  allocations: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/allocations`,
  capitalTransactions: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/capitalTransactions`,
  cashForecasts: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/cashForecasts`,
  bankAccounts: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/bankAccounts`,
  valuationRecords: (portfolioId: string) => 
    `advisoryPlatform/advisory/portfolios/${portfolioId}/valuationRecords`,
} as const;

// Firestore indexes required
export const PORTFOLIO_INDEXES = [
  {
    collection: 'advisoryPlatform/advisory/portfolios',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/portfolios',
    fields: [
      { fieldPath: 'engagementId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/portfolios',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'navHistory',
    fields: [
      { fieldPath: 'valuationDate', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'capitalTransactions',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'allocations',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'effectiveDate', order: 'DESCENDING' },
    ],
  },
] as const;

// Security rules for portfolio collections
export const PORTFOLIO_SECURITY_RULES = `
// Portfolio Rules
match /advisoryPlatform/advisory/portfolios/{portfolioId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.createdBy == request.auth.uid;
  allow update: if request.auth != null;
  allow delete: if false; // Soft delete only
  
  // Status history subcollection
  match /statusHistory/{historyId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
  
  // NAV history subcollection
  match /navHistory/{navId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null 
      && request.resource.data.status in ['final', 'audited'];
    allow delete: if false;
  }
  
  // Allocations subcollection
  match /allocations/{allocId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null;
    allow delete: if false;
  }
  
  // Capital transactions subcollection
  match /capitalTransactions/{txnId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null 
      && request.resource.data.status in ['pending', 'completed', 'cancelled'];
    allow delete: if false;
  }
  
  // Cash forecasts subcollection
  match /cashForecasts/{forecastId} {
    allow read: if request.auth != null;
    allow create, update: if request.auth != null;
    allow delete: if request.auth != null;
  }
  
  // Bank accounts subcollection
  match /bankAccounts/{accountId} {
    allow read: if request.auth != null;
    allow create, update: if request.auth != null;
    allow delete: if false; // Soft delete only
  }
  
  // Valuation records subcollection
  match /valuationRecords/{recordId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update: if request.auth != null 
      && request.resource.data.approvedBy == request.auth.uid;
    allow delete: if false;
  }
}
`;

// Data validation helpers
export const PORTFOLIO_VALIDATION = {
  validStatuses: [
    'formation',
    'fundraising',
    'investing',
    'fully_invested',
    'harvesting',
    'wind_down',
    'closed',
    'terminated',
  ],
  
  validTypes: [
    'fund',
    'sma',
    'co_investment',
    'fund_of_funds',
    'direct',
    'advisory',
    'model',
  ],
  
  validStrategies: [
    'core',
    'core_plus',
    'value_add',
    'opportunistic',
    'greenfield',
    'brownfield',
    'distressed',
    'sector_specific',
    'diversified',
  ],
  
  validStructures: [
    'open_ended',
    'closed_ended',
    'evergreen',
    'hybrid',
  ],
  
  validNavStatuses: [
    'draft',
    'preliminary',
    'final',
    'audited',
  ],
  
  validTransactionTypes: [
    'capital_call',
    'distribution',
    'recallable_distribution',
    'equalisation',
    'fee_payment',
    'expense_payment',
    'transfer',
    'redemption',
    'subscription',
  ],
} as const;
