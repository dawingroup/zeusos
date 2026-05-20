# Prompt 1.4: Katana Customer Sync

## Objective
Create a Cloud Function to sync customer data with Katana MRP, enabling bidirectional customer management between the cutlist processor and Katana.

## Prerequisites
- Completed Prompts 1.1-1.3 (Customer data model, hooks, and UI)
- Katana MRP API key configured in Firebase environment

## Context
Katana MRP (katanamrp.com) is the manufacturing resource planning system used for production. Customers created in our system need to be synced to Katana for sales orders and production tracking.

## Requirements

### 1. Create Katana Service Types

Create file: `functions/src/integrations/katana/types.ts`

```typescript
/**
 * Katana MRP API Types
 * Based on Katana API v1 documentation
 */

export interface KatanaCustomer {
  id: number;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  default_currency?: string;
  addresses?: KatanaAddress[];
  created_at: string;
  updated_at: string;
}

export interface KatanaAddress {
  id: number;
  name: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  is_default_billing: boolean;
  is_default_shipping: boolean;
}

export interface KatanaCustomerCreate {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  default_currency?: string;
  addresses?: Omit<KatanaAddress, 'id'>[];
}

export interface KatanaCustomerUpdate {
  name?: string;
  code?: string;
  email?: string;
  phone?: string;
}

export interface KatanaApiResponse<T> {
  data: T;
}

export interface KatanaListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
  };
}
```

### 2. Create Katana API Client

Create file: `functions/src/integrations/katana/client.ts`

```typescript
/**
 * Katana MRP API Client
 * Handles authentication and API calls to Katana
 */

import * as functions from 'firebase-functions';
import fetch from 'node-fetch';
import type {
  KatanaCustomer,
  KatanaCustomerCreate,
  KatanaCustomerUpdate,
  KatanaApiResponse,
  KatanaListResponse,
} from './types';

const KATANA_API_BASE = 'https://api.katanamrp.com/v1';

function getApiKey(): string {
  const apiKey = functions.config().katana?.api_key;
  if (!apiKey) {
    throw new Error('Katana API key not configured. Set with: firebase functions:config:set katana.api_key="YOUR_KEY"');
  }
  return apiKey;
}

async function katanaRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  
  const response = await fetch(`${KATANA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Katana API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

/**
 * List all customers from Katana
 */
export async function listKatanaCustomers(
  page = 1,
  perPage = 100
): Promise<KatanaListResponse<KatanaCustomer>> {
  return katanaRequest<KatanaListResponse<KatanaCustomer>>(
    `/customers?page=${page}&per_page=${perPage}`
  );
}

/**
 * Get a single customer by ID
 */
export async function getKatanaCustomer(
  customerId: number
): Promise<KatanaCustomer> {
  const response = await katanaRequest<KatanaApiResponse<KatanaCustomer>>(
    `/customers/${customerId}`
  );
  return response.data;
}

/**
 * Find customer by code
 */
export async function findKatanaCustomerByCode(
  code: string
): Promise<KatanaCustomer | null> {
  const response = await katanaRequest<KatanaListResponse<KatanaCustomer>>(
    `/customers?search=${encodeURIComponent(code)}`
  );
  return response.data.find((c) => c.code === code) || null;
}

/**
 * Create a new customer in Katana
 */
export async function createKatanaCustomer(
  data: KatanaCustomerCreate
): Promise<KatanaCustomer> {
  const response = await katanaRequest<KatanaApiResponse<KatanaCustomer>>(
    '/customers',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Update an existing customer in Katana
 */
export async function updateKatanaCustomer(
  customerId: number,
  data: KatanaCustomerUpdate
): Promise<KatanaCustomer> {
  const response = await katanaRequest<KatanaApiResponse<KatanaCustomer>>(
    `/customers/${customerId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Delete a customer from Katana
 */
export async function deleteKatanaCustomer(customerId: number): Promise<void> {
  await katanaRequest(`/customers/${customerId}`, {
    method: 'DELETE',
  });
}
```

### 3. Create Sync Cloud Function

Create file: `functions/src/integrations/katana/syncCustomer.ts`

```typescript
/**
 * Katana Customer Sync Function
 * Syncs customer data to Katana MRP when customers are created or updated
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  createKatanaCustomer,
  updateKatanaCustomer,
  findKatanaCustomerByCode,
} from './client';
import type { KatanaCustomerCreate } from './types';

const db = admin.firestore();

interface FirestoreCustomer {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  billingAddress?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  externalIds: {
    katanaId?: string;
    quickbooksId?: string;
    driveFolderId?: string;
  };
}

/**
 * Convert Firestore customer to Katana format
 */
function toKatanaCustomer(customer: FirestoreCustomer): KatanaCustomerCreate {
  const katanaData: KatanaCustomerCreate = {
    name: customer.name,
    code: customer.code,
    email: customer.email,
    phone: customer.phone,
    default_currency: 'USD',
  };

  if (customer.billingAddress) {
    katanaData.addresses = [
      {
        name: 'Billing',
        address_1: customer.billingAddress.street1,
        address_2: customer.billingAddress.street2,
        city: customer.billingAddress.city,
        state: customer.billingAddress.state,
        zip: customer.billingAddress.postalCode,
        country: customer.billingAddress.country,
        is_default_billing: true,
        is_default_shipping: false,
      },
    ];
  }

  return katanaData;
}

/**
 * Sync customer to Katana on create
 */
export const onCustomerCreated = functions.firestore
  .document('customers/{customerId}')
  .onCreate(async (snapshot, context) => {
    const customerId = context.params.customerId;
    const customer = snapshot.data() as FirestoreCustomer;

    functions.logger.info(`Syncing new customer ${customerId} to Katana`);

    try {
      // Check if customer already exists in Katana (by code)
      const existingKatana = await findKatanaCustomerByCode(customer.code);

      let katanaId: string;

      if (existingKatana) {
        // Link to existing Katana customer
        katanaId = existingKatana.id.toString();
        functions.logger.info(`Found existing Katana customer: ${katanaId}`);
      } else {
        // Create new customer in Katana
        const katanaCustomer = await createKatanaCustomer(toKatanaCustomer(customer));
        katanaId = katanaCustomer.id.toString();
        functions.logger.info(`Created Katana customer: ${katanaId}`);
      }

      // Update Firestore with Katana ID
      await db.collection('customers').doc(customerId).update({
        'externalIds.katanaId': katanaId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Customer ${customerId} synced to Katana successfully`);
    } catch (error) {
      functions.logger.error(`Failed to sync customer ${customerId} to Katana:`, error);
      // Don't throw - we don't want to fail the Firestore write
      // Instead, mark for retry
      await db.collection('customers').doc(customerId).update({
        'syncStatus.katana': 'failed',
        'syncStatus.katanaError': error instanceof Error ? error.message : 'Unknown error',
        'syncStatus.katanaLastAttempt': admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Sync customer to Katana on update
 */
export const onCustomerUpdated = functions.firestore
  .document('customers/{customerId}')
  .onUpdate(async (change, context) => {
    const customerId = context.params.customerId;
    const before = change.before.data() as FirestoreCustomer;
    const after = change.after.data() as FirestoreCustomer;

    // Skip if only sync status changed (avoid infinite loop)
    const relevantFields = ['name', 'email', 'phone', 'billingAddress'];
    const hasRelevantChanges = relevantFields.some(
      (field) => JSON.stringify((before as any)[field]) !== JSON.stringify((after as any)[field])
    );

    if (!hasRelevantChanges) {
      return;
    }

    const katanaId = after.externalIds?.katanaId;
    if (!katanaId) {
      functions.logger.warn(`Customer ${customerId} has no Katana ID, skipping update sync`);
      return;
    }

    functions.logger.info(`Syncing updated customer ${customerId} to Katana`);

    try {
      await updateKatanaCustomer(parseInt(katanaId, 10), {
        name: after.name,
        email: after.email,
        phone: after.phone,
      });

      await db.collection('customers').doc(customerId).update({
        'syncStatus.katana': 'synced',
        'syncStatus.katanaLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Customer ${customerId} update synced to Katana`);
    } catch (error) {
      functions.logger.error(`Failed to sync customer ${customerId} update to Katana:`, error);
      await db.collection('customers').doc(customerId).update({
        'syncStatus.katana': 'failed',
        'syncStatus.katanaError': error instanceof Error ? error.message : 'Unknown error',
        'syncStatus.katanaLastAttempt': admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Manual sync trigger (callable function)
 */
export const syncCustomerToKatana = functions.https.onCall(
  async (data: { customerId: string }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId } = data;
    if (!customerId) {
      throw new functions.https.HttpsError('invalid-argument', 'customerId is required');
    }

    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data() as FirestoreCustomer;

    try {
      let katanaId = customer.externalIds?.katanaId;

      if (katanaId) {
        // Update existing
        await updateKatanaCustomer(parseInt(katanaId, 10), {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        });
      } else {
        // Create new
        const existingKatana = await findKatanaCustomerByCode(customer.code);
        if (existingKatana) {
          katanaId = existingKatana.id.toString();
        } else {
          const katanaCustomer = await createKatanaCustomer(toKatanaCustomer(customer));
          katanaId = katanaCustomer.id.toString();
        }

        await db.collection('customers').doc(customerId).update({
          'externalIds.katanaId': katanaId,
        });
      }

      await db.collection('customers').doc(customerId).update({
        'syncStatus.katana': 'synced',
        'syncStatus.katanaLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, katanaId };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to sync customer'
      );
    }
  }
);
```

### 4. Export Functions

Update file: `functions/src/index.ts`

```typescript
/**
 * Cloud Functions Index
 * Export all Cloud Functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Katana Integration
export {
  onCustomerCreated,
  onCustomerUpdated,
  syncCustomerToKatana,
} from './integrations/katana/syncCustomer';
```

### 5. Configure Katana API Key

Run in terminal:
```bash
firebase functions:config:set katana.api_key="YOUR_KATANA_API_KEY"
```

## Validation Checklist

- [ ] Cloud Functions deploy without errors
- [ ] Creating a customer triggers Katana sync
- [ ] Updating a customer syncs changes to Katana
- [ ] Katana ID is stored in Firestore after sync
- [ ] Sync failures are logged and tracked
- [ ] Manual sync callable function works

## Next Steps

After completing this prompt, proceed to:
- **Prompt 1.5**: QuickBooks Customer Sync - OAuth integration for QuickBooks Online
