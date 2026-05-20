/**
 * Firebase collection paths for the Investment module
 */

// Base path for investment module
export const INVESTMENT_BASE_PATH = 'advisoryPlatform/investment';

// Collection paths
export const COLLECTION_PATHS = {
  // Main deal collection
  deals: `${INVESTMENT_BASE_PATH}/deals`,
  
  // Subcollections under deals
  dealActivity: (dealId: string) => `${INVESTMENT_BASE_PATH}/deals/${dealId}/activityLog`,
  dealDocuments: (dealId: string) => `${INVESTMENT_BASE_PATH}/deals/${dealId}/documents`,
  dealNotes: (dealId: string) => `${INVESTMENT_BASE_PATH}/deals/${dealId}/notes`,
  dealMeetings: (dealId: string) => `${INVESTMENT_BASE_PATH}/deals/${dealId}/meetings`,
  
  // Due diligence
  dueDiligence: `${INVESTMENT_BASE_PATH}/dueDiligence`,
  ddWorkstreams: (ddId: string) => `${INVESTMENT_BASE_PATH}/dueDiligence/${ddId}/workstreams`,
  ddFindings: (ddId: string) => `${INVESTMENT_BASE_PATH}/dueDiligence/${ddId}/findings`,
  
  // Financial models
  financialModels: `${INVESTMENT_BASE_PATH}/financialModels`,
  modelVersions: (modelId: string) => `${INVESTMENT_BASE_PATH}/financialModels/${modelId}/versions`,
  
  // Pipeline configuration
  pipelineConfig: `${INVESTMENT_BASE_PATH}/config/pipeline`,
  stageConfigs: `${INVESTMENT_BASE_PATH}/config/stages`,
  
  // Reporting
  portfolioSnapshots: `${INVESTMENT_BASE_PATH}/portfolioSnapshots`,
};

// Document IDs for config documents
export const CONFIG_DOCS = {
  pipelineSettings: 'settings',
  defaultStages: 'defaultStages',
};

// Firestore index suggestions for the deals collection
export const SUGGESTED_INDEXES = [
  {
    collection: 'advisoryPlatform/investment/deals',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'currentStage', order: 'ASCENDING' },
      { fieldPath: 'stageEnteredAt', order: 'ASCENDING' },
    ],
    description: 'For pipeline view queries',
  },
  {
    collection: 'advisoryPlatform/investment/deals',
    fields: [
      { fieldPath: 'engagementId', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
    description: 'For engagement deals queries',
  },
  {
    collection: 'advisoryPlatform/investment/deals',
    fields: [
      { fieldPath: 'currentStage', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'stageEnteredAt', order: 'ASCENDING' },
    ],
    description: 'For stage-based queries',
  },
  {
    collection: 'advisoryPlatform/investment/deals',
    fields: [
      { fieldPath: 'sector', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
    description: 'For sector-based filtering',
  },
];

// Security rules suggestions
export const SECURITY_RULES = `
// Investment module rules
match /advisoryPlatform/investment/{document=**} {
  // Allow read for authenticated users
  allow read: if request.auth != null;
  
  // Allow write for authenticated users with deal permissions
  allow write: if request.auth != null 
    && request.auth.token.role in ['admin', 'deal_lead', 'investment_committee'];
}

// Deal-specific rules
match /advisoryPlatform/investment/deals/{dealId} {
  // Allow read for deal team members
  allow read: if request.auth != null 
    && (request.auth.uid in resource.data.dealTeam.members 
        || request.auth.uid == resource.data.dealTeam.dealLead.userId);
  
  // Allow write for deal lead and admins
  allow write: if request.auth != null 
    && (request.auth.uid == resource.data.dealTeam.dealLead.userId
        || request.auth.token.role == 'admin');
}

// Activity log is append-only
match /advisoryPlatform/investment/deals/{dealId}/activityLog/{activityId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if false;
}
`;
