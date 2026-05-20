/**
 * Client Firebase Collections Configuration
 */

export const CLIENT_COLLECTIONS = {
  // Main client collection
  CLIENTS: 'advisoryPlatform/advisory/clients',
  
  // Subcollections under each client
  CLIENT_STATUS_HISTORY: (clientId: string) => 
    `advisoryPlatform/advisory/clients/${clientId}/statusHistory`,
  CLIENT_COMMUNICATIONS: (clientId: string) => 
    `advisoryPlatform/advisory/clients/${clientId}/communications`,
  CLIENT_DOCUMENTS: (clientId: string) => 
    `advisoryPlatform/advisory/clients/${clientId}/documents`,
  CLIENT_ACTIVITY: (clientId: string) => 
    `advisoryPlatform/advisory/clients/${clientId}/activity`,
  
  // Mandates collection
  MANDATES: 'advisoryPlatform/advisory/mandates',
  MANDATE_HISTORY: (mandateId: string) => 
    `advisoryPlatform/advisory/mandates/${mandateId}/history`,
  
  // Risk assessments
  RISK_ASSESSMENTS: 'advisoryPlatform/advisory/riskAssessments',
  
  // Compliance records
  COMPLIANCE_RECORDS: 'advisoryPlatform/advisory/complianceRecords',
  KYC_RECORDS: 'advisoryPlatform/advisory/kycRecords',
  AML_CHECKS: 'advisoryPlatform/advisory/amlChecks',
} as const;

export const CLIENT_INDEXES = [
  // Compound indexes needed for common queries
  {
    collectionGroup: 'clients',
    fields: [
      { fieldPath: 'engagementId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'legalName', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'clients',
    fields: [
      { fieldPath: 'tier', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'legalName', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'clients',
    fields: [
      { fieldPath: 'relationshipManager.userId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'legalName', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'mandates',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'riskAssessments',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'completedAt', order: 'DESCENDING' }
    ]
  }
] as const;

export const CLIENT_SECURITY_RULES = `
// Advisory Client Rules
match /advisoryPlatform/advisory/clients/{clientId} {
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
  
  // Communications subcollection
  match /communications/{commId} {
    allow read, write: if request.auth != null;
  }
  
  // Documents subcollection
  match /documents/{docId} {
    allow read, write: if request.auth != null;
  }
  
  // Activity subcollection
  match /activity/{activityId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}

// Mandates collection
match /advisoryPlatform/advisory/mandates/{mandateId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
  
  match /history/{historyId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}

// Risk assessments collection
match /advisoryPlatform/advisory/riskAssessments/{assessmentId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update: if request.auth != null 
    && request.resource.data.reviewedBy == request.auth.uid;
  allow delete: if false;
}

// Compliance records
match /advisoryPlatform/advisory/complianceRecords/{recordId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
}

match /advisoryPlatform/advisory/kycRecords/{recordId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
}

match /advisoryPlatform/advisory/amlChecks/{checkId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
  allow delete: if false;
}
`;
