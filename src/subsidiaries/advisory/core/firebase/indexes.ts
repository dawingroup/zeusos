/**
 * FIRESTORE INDEX DEFINITIONS
 * 
 * These indexes need to be created in the Firebase Console or via CLI.
 * This file documents the required indexes and can generate the config.
 */

/**
 * Index field definition
 */
export interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

/**
 * Index definition
 */
export interface IndexDefinition {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: IndexField[];
}

/**
 * Required composite indexes for advisory platform
 */
export const REQUIRED_INDEXES: IndexDefinition[] = [
  // ─────────────────────────────────────────────────────────────────
  // ENGAGEMENTS
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'engagements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'domain', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'engagements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'clientId', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'engagements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'country', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'engagements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'engagements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'team.leadId', order: 'ASCENDING' },
      { fieldPath: 'updatedAt', order: 'DESCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // CLIENTS
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'clients',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'displayName', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'clients',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'relationshipStatus', order: 'ASCENDING' },
      { fieldPath: 'displayName', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'clients',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'relationshipManagerId', order: 'ASCENDING' },
      { fieldPath: 'displayName', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'clients',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'relationshipManagerId', order: 'ASCENDING' },
      { fieldPath: 'relationshipStatus', order: 'ASCENDING' },
      { fieldPath: 'displayName', order: 'ASCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // FUNDERS
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'funders',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'funders',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'relationshipStatus', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // FUNDING SOURCES (subcollection)
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'fundingSources',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'funderId', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'fundingSources',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'category', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // APPROVAL REQUESTS (subcollection with collection group)
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'approvalRequests',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'requestedAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'approvalRequests',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'requestedAt', order: 'DESCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // COVENANTS (subcollection)
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'covenants',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'isActive', order: 'ASCENDING' },
      { fieldPath: 'currentStatus', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'covenants',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'isActive', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'covenants',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'currentStatus', order: 'ASCENDING' },
      { fieldPath: 'isActive', order: 'ASCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // REPORT SUBMISSIONS (subcollection)
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'reportSubmissions',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'dueDate', order: 'ASCENDING' },
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────
  // DISBURSEMENTS (subcollection)
  // ─────────────────────────────────────────────────────────────────
  {
    collectionGroup: 'disbursements',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'disbursementNumber', order: 'DESCENDING' },
    ],
  },
];

/**
 * Generate firestore.indexes.json content
 */
export function generateIndexConfig(): { indexes: object[]; fieldOverrides: object[] } {
  return {
    indexes: REQUIRED_INDEXES.map(index => ({
      collectionGroup: index.collectionGroup,
      queryScope: index.queryScope,
      fields: index.fields.map(field => {
        const result: { fieldPath: string; order?: string; arrayConfig?: string } = {
          fieldPath: field.fieldPath,
        };
        if (field.order) result.order = field.order;
        if (field.arrayConfig) result.arrayConfig = field.arrayConfig;
        return result;
      }),
    })),
    fieldOverrides: [],
  };
}

/**
 * Get indexes for a specific collection
 */
export function getIndexesForCollection(collectionName: string): IndexDefinition[] {
  return REQUIRED_INDEXES.filter(index => index.collectionGroup === collectionName);
}

/**
 * Get all collection group indexes
 */
export function getCollectionGroupIndexes(): IndexDefinition[] {
  return REQUIRED_INDEXES.filter(index => index.queryScope === 'COLLECTION_GROUP');
}

/**
 * Log index creation commands
 */
export function logIndexCreationCommands(): void {
  console.log('Firebase Index Creation Commands:');
  console.log('================================');
  console.log('');
  console.log('Deploy all indexes:');
  console.log('  firebase deploy --only firestore:indexes');
  console.log('');
  console.log('Or create manually in Firebase Console:');
  console.log('  https://console.firebase.google.com/project/_/firestore/indexes');
  console.log('');
  console.log(`Total indexes to create: ${REQUIRED_INDEXES.length}`);
}
