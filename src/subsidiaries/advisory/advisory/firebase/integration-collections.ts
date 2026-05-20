/**
 * Integration Collections Configuration
 * 
 * Firestore collection structure for cross-module integration.
 */

// Collection paths
export const INTEGRATION_COLLECTIONS = {
  crossModuleLinks: 'advisoryPlatform/crossModuleLinks',
  
  dealConversions: 'advisoryPlatform/advisory/dealConversions',
  projectHoldingLinks: 'advisoryPlatform/advisory/projectHoldingLinks',
  capitalDeployments: 'advisoryPlatform/advisory/capitalDeployments',
  portfolioDealAllocations: 'advisoryPlatform/advisory/portfolioDealAllocations',
  
  coInvestors: 'advisoryPlatform/advisory/coInvestors',
  coInvestmentOpportunities: 'advisoryPlatform/advisory/coInvestmentOpportunities',
  coInvestmentVehicles: 'advisoryPlatform/advisory/coInvestmentVehicles',
  syndicationWorkflows: 'advisoryPlatform/advisory/syndicationWorkflows',
  
  unifiedAssetViews: 'advisoryPlatform/advisory/unifiedAssetViews',
  assetAggregations: 'advisoryPlatform/advisory/assetAggregations',
  dashboardCache: 'advisoryPlatform/advisory/dashboardCache',
} as const;

// Required Firestore indexes
export const INTEGRATION_INDEXES = [
  {
    collection: 'advisoryPlatform/crossModuleLinks',
    fields: [
      { fieldPath: 'sourceType', order: 'ASCENDING' },
      { fieldPath: 'sourceId', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/crossModuleLinks',
    fields: [
      { fieldPath: 'targetType', order: 'ASCENDING' },
      { fieldPath: 'targetId', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/dealConversions',
    fields: [
      { fieldPath: 'dealId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/dealConversions',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/capitalDeployments',
    fields: [
      { fieldPath: 'holdingId', order: 'ASCENDING' },
      { fieldPath: 'deploymentDate', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/capitalDeployments',
    fields: [
      { fieldPath: 'projectId', order: 'ASCENDING' },
      { fieldPath: 'deploymentDate', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/portfolioDealAllocations',
    fields: [
      { fieldPath: 'portfolioId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/portfolioDealAllocations',
    fields: [
      { fieldPath: 'dealId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/unifiedAssetViews',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/unifiedAssetViews',
    fields: [
      { fieldPath: 'location.country', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/coInvestors',
    fields: [
      { fieldPath: 'isActive', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/coInvestmentOpportunities',
    fields: [
      { fieldPath: 'dealId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/coInvestmentOpportunities',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'expectedCloseDate', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'advisoryPlatform/advisory/syndicationWorkflows',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'targetCloseDate', order: 'ASCENDING' },
    ],
  },
] as const;

// Security rules for integration collections
export const INTEGRATION_SECURITY_RULES = `
// Cross-Module Links Rules
match /advisoryPlatform/crossModuleLinks/{linkId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}

// Deal Conversions Rules
match /advisoryPlatform/advisory/dealConversions/{conversionId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false; // Archive only
}

// Capital Deployments Rules
match /advisoryPlatform/advisory/capitalDeployments/{deploymentId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Portfolio-Deal Allocations Rules
match /advisoryPlatform/advisory/portfolioDealAllocations/{allocationId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Project-Holding Links Rules
match /advisoryPlatform/advisory/projectHoldingLinks/{linkId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}

// Co-Investors Rules
match /advisoryPlatform/advisory/coInvestors/{coInvestorId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Co-Investment Opportunities Rules
match /advisoryPlatform/advisory/coInvestmentOpportunities/{opportunityId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Co-Investment Vehicles Rules
match /advisoryPlatform/advisory/coInvestmentVehicles/{vehicleId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Syndication Workflows Rules
match /advisoryPlatform/advisory/syndicationWorkflows/{workflowId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Unified Asset Views Rules
match /advisoryPlatform/advisory/unifiedAssetViews/{assetId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}

// Asset Aggregations Rules (cached)
match /advisoryPlatform/advisory/assetAggregations/{aggregationId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}

// Dashboard Cache Rules
match /advisoryPlatform/advisory/dashboardCache/{cacheId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if request.auth != null;
}
`;

// Validation helpers
export const INTEGRATION_VALIDATION = {
  validLinkTypes: [
    'deal_to_holding',
    'holding_to_project',
    'portfolio_to_deal',
    'project_to_deal',
    'engagement_to_portfolio',
    'program_to_project',
  ],
  
  validConversionStatuses: [
    'pending_approval',
    'partially_approved',
    'fully_approved',
    'converting',
    'completed',
    'cancelled',
  ],
  
  validDeploymentTypes: [
    'initial_investment',
    'milestone_payment',
    'cost_overrun',
    'scope_expansion',
    'working_capital',
    'contingency',
  ],
  
  validDeploymentStatuses: [
    'planned',
    'committed',
    'disbursed',
    'cancelled',
  ],
  
  validAllocationStatuses: [
    'indicative',
    'committed',
    'invested',
    'exited',
  ],
  
  validCoInvestorTypes: [
    'dfi',
    'pension_fund',
    'insurance',
    'family_office',
    'sovereign_wealth',
    'endowment',
    'corporate',
    'other_fund',
    'individual',
  ],
  
  validOpportunityStatuses: [
    'preparing',
    'marketing',
    'soft_circle',
    'final_circle',
    'closed',
    'cancelled',
  ],
  
  validVehicleStatuses: [
    'forming',
    'open',
    'closed',
    'investing',
    'harvesting',
    'liquidated',
  ],
  
  validSyndicationStages: [
    'preparation',
    'teaser_distribution',
    'nda_collection',
    'info_memo_distribution',
    'management_meetings',
    'due_diligence',
    'term_negotiation',
    'commitment_collection',
    'documentation',
    'closing',
  ],
  
  validAssetStatuses: [
    'pipeline',
    'development',
    'construction',
    'commissioning',
    'operational',
    'distressed',
    'exited',
  ],
} as const;
