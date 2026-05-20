/**
 * Performance Collections Configuration
 * 
 * Firestore collection structure for performance tracking.
 */

// Collection paths
export const PERFORMANCE_COLLECTIONS = {
  performanceSnapshots: 'advisoryPlatform/advisory/performanceSnapshots',
  performanceHistory: 'advisoryPlatform/advisory/performanceHistory',
  
  benchmarks: 'advisoryPlatform/advisory/benchmarks',
  benchmarkData: (benchmarkId: string) =>
    `advisoryPlatform/advisory/benchmarks/${benchmarkId}/data`,
  benchmarkAssignments: 'advisoryPlatform/advisory/benchmarkAssignments',
  
  pmeAnalyses: 'advisoryPlatform/advisory/pmeAnalyses',
  
  peerUniverses: 'advisoryPlatform/advisory/peerUniverses',
  peerUniverseData: (universeId: string) =>
    `advisoryPlatform/advisory/peerUniverses/${universeId}/data`,
  
  customPeerGroups: 'advisoryPlatform/advisory/customPeerGroups',
  peerRankings: 'advisoryPlatform/advisory/peerRankings',
  
  attributions: 'advisoryPlatform/advisory/attributions',
  
  portfolioCashFlows: (portfolioId: string) =>
    `advisoryPlatform/advisory/portfolios/${portfolioId}/cashFlows`,
  
  holdingTransactions: (holdingId: string) =>
    `advisoryPlatform/advisory/holdings/${holdingId}/transactions`
} as const;

// Indexes required
export const PERFORMANCE_INDEXES = [
  {
    collection: 'advisoryPlatform/advisory/performanceSnapshots',
    fields: [
      { fieldPath: 'scope', order: 'ASCENDING' },
      { fieldPath: 'scopeId', order: 'ASCENDING' },
      { fieldPath: 'asOfDate', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/performanceSnapshots',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'asOfDate', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'benchmarkData',
    fields: [
      { fieldPath: 'benchmarkId', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/benchmarkAssignments',
    fields: [
      { fieldPath: 'scope', order: 'ASCENDING' },
      { fieldPath: 'scopeId', order: 'ASCENDING' },
      { fieldPath: 'effectiveFrom', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/peerRankings',
    fields: [
      { fieldPath: 'portfolioId', order: 'ASCENDING' },
      { fieldPath: 'asOfDate', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/peerRankings',
    fields: [
      { fieldPath: 'universeId', order: 'ASCENDING' },
      { fieldPath: 'asOfDate', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/attributions',
    fields: [
      { fieldPath: 'scope', order: 'ASCENDING' },
      { fieldPath: 'scopeId', order: 'ASCENDING' },
      { fieldPath: 'endDate', order: 'DESCENDING' }
    ]
  },
  {
    collection: 'advisoryPlatform/advisory/pmeAnalyses',
    fields: [
      { fieldPath: 'portfolioId', order: 'ASCENDING' },
      { fieldPath: 'benchmarkId', order: 'ASCENDING' },
      { fieldPath: 'calculatedAt', order: 'DESCENDING' }
    ]
  }
] as const;

// Security rules for performance collections
export const PERFORMANCE_SECURITY_RULES = `
// Performance Snapshots Rules
match /advisoryPlatform/advisory/performanceSnapshots/{snapshotId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null 
    && request.resource.data.status in ['draft', 'preliminary', 'final', 'audited'];
  allow delete: if false; // Archive only
}

// Performance History Rules
match /advisoryPlatform/advisory/performanceHistory/{historyId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false; // Immutable
}

// Benchmarks Rules
match /advisoryPlatform/advisory/benchmarks/{benchmarkId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
  
  match /data/{dataId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}

// Benchmark Assignments Rules
match /advisoryPlatform/advisory/benchmarkAssignments/{assignmentId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}

// PME Analyses Rules
match /advisoryPlatform/advisory/pmeAnalyses/{analysisId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false;
}

// Peer Universes Rules
match /advisoryPlatform/advisory/peerUniverses/{universeId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
  
  match /data/{dataId} {
    allow read: if request.auth != null;
    allow create, update: if request.auth != null;
    allow delete: if false;
  }
}

// Custom Peer Groups Rules
match /advisoryPlatform/advisory/customPeerGroups/{groupId} {
  allow read: if request.auth != null 
    && (resource.data.isPublic == true 
        || resource.data.createdBy == request.auth.uid
        || request.auth.uid in resource.data.sharedWith);
  allow create: if request.auth != null;
  allow update: if request.auth != null 
    && resource.data.createdBy == request.auth.uid;
  allow delete: if request.auth != null 
    && resource.data.createdBy == request.auth.uid;
}

// Peer Rankings Rules
match /advisoryPlatform/advisory/peerRankings/{rankingId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false;
}

// Attribution Rules
match /advisoryPlatform/advisory/attributions/{attributionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false;
}
`;

// Validation helpers
export const PERFORMANCE_VALIDATION = {
  validScopes: [
    'holding',
    'portfolio',
    'client',
    'engagement',
    'strategy',
    'sector',
    'geography',
    'vintage',
    'firm'
  ],
  
  validSnapshotStatuses: [
    'draft',
    'preliminary',
    'final',
    'audited'
  ],
  
  validReturnPeriods: [
    'mtd',
    'qtd',
    'ytd',
    'since_inception',
    'trailing_1m',
    'trailing_3m',
    'trailing_6m',
    'trailing_1y',
    'trailing_3y',
    'trailing_5y',
    'trailing_10y',
    'custom'
  ],
  
  validBenchmarkTypes: [
    'public_index',
    'infrastructure_index',
    'custom_benchmark',
    'peer_universe',
    'absolute_return',
    'risk_free_rate',
    'inflation'
  ],
  
  validPmeMethods: [
    'long_nickels',
    'kaplan_schoar',
    'pme_plus',
    'direct_alpha'
  ],
  
  validPeerUniverseCategories: [
    'infrastructure',
    'private_equity',
    'real_estate',
    'private_debt',
    'venture_capital',
    'natural_resources',
    'fund_of_funds',
    'custom'
  ]
} as const;
