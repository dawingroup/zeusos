# Prompt 1.5: QuickBooks Customer Sync

## Objective
Create Cloud Functions for QuickBooks Online integration with OAuth 2.0 authentication and customer synchronization.

## Prerequisites
- Completed Prompts 1.1-1.4
- QuickBooks Developer account with app credentials
- OAuth redirect URI configured in QuickBooks app settings

## Context
QuickBooks Online is used for invoicing and accounting. Customers need to be synced to QuickBooks to enable invoice creation from project estimates.

## Requirements

### 1. Create QuickBooks Types

Create file: `functions/src/integrations/quickbooks/types.ts`

```typescript
/**
 * QuickBooks Online API Types
 */

export interface QBOTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  x_refresh_token_expires_in: number;
  realm_id: string;
  created_at: number;
}

export interface QBOCustomer {
  Id?: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  ShipAddr?: {
    Line1?: string;
    Line2?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
    Country?: string;
  };
  Active?: boolean;
  Notes?: string;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QBOQueryResponse<T> {
  QueryResponse: {
    [key: string]: T[];
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
}

export interface QBOCreateResponse<T> {
  [key: string]: T;
}
```

### 2. Create QuickBooks OAuth Handler

Create file: `functions/src/integrations/quickbooks/auth.ts`

```typescript
/**
 * QuickBooks OAuth 2.0 Handler
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import type { QBOTokens } from './types';

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

const db = admin.firestore();

function getConfig() {
  const config = functions.config().quickbooks;
  if (!config?.client_id || !config?.client_secret) {
    throw new Error(
      'QuickBooks credentials not configured. Set with: firebase functions:config:set quickbooks.client_id="..." quickbooks.client_secret="..."'
    );
  }
  return {
    clientId: config.client_id,
    clientSecret: config.client_secret,
    redirectUri: config.redirect_uri || 'https://dawin-cutlist-processor.web.app/api/quickbooks/callback',
  };
}

/**
 * Generate OAuth authorization URL
 */
export const getAuthUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const config = getConfig();
  const state = Buffer.from(JSON.stringify({
    userId: context.auth.uid,
    timestamp: Date.now(),
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: config.redirectUri,
    state,
  });

  return {
    url: `${QBO_AUTH_URL}?${params.toString()}`,
  };
});

/**
 * Handle OAuth callback
 */
export const handleCallback = functions.https.onRequest(async (req, res) => {
  const { code, state, realmId, error } = req.query;

  if (error) {
    functions.logger.error('QuickBooks OAuth error:', error);
    res.redirect('/settings?qb_error=auth_failed');
    return;
  }

  if (!code || !state || !realmId) {
    res.redirect('/settings?qb_error=missing_params');
    return;
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    const { userId } = stateData;

    // Exchange code for tokens
    const config = getConfig();
    const tokenResponse = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json() as Omit<QBOTokens, 'realm_id' | 'created_at'>;

    // Store tokens in Firestore (encrypted in production)
    await db.collection('integrations').doc('quickbooks').set({
      ...tokens,
      realm_id: realmId,
      created_at: Date.now(),
      connected_by: userId,
      connected_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('QuickBooks connected successfully');
    res.redirect('/settings?qb_success=true');
  } catch (err) {
    functions.logger.error('QuickBooks callback error:', err);
    res.redirect('/settings?qb_error=token_exchange');
  }
});

/**
 * Refresh access token
 */
export async function refreshTokens(): Promise<QBOTokens> {
  const doc = await db.collection('integrations').doc('quickbooks').get();
  if (!doc.exists) {
    throw new Error('QuickBooks not connected');
  }

  const tokens = doc.data() as QBOTokens;
  const config = getConfig();

  // Check if token needs refresh (expires in less than 5 minutes)
  const expiresAt = tokens.created_at + tokens.expires_in * 1000;
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokens; // Token still valid
  }

  // Refresh the token
  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const newTokens = await response.json() as Omit<QBOTokens, 'realm_id' | 'created_at'>;

  const updatedTokens: QBOTokens = {
    ...newTokens,
    realm_id: tokens.realm_id,
    created_at: Date.now(),
  };

  await db.collection('integrations').doc('quickbooks').update(updatedTokens);

  return updatedTokens;
}

/**
 * Check connection status
 */
export const checkConnection = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const doc = await db.collection('integrations').doc('quickbooks').get();
    if (!doc.exists) {
      return { connected: false };
    }

    const tokens = doc.data() as QBOTokens;
    const refreshExpiresAt = tokens.created_at + tokens.x_refresh_token_expires_in * 1000;

    return {
      connected: true,
      realmId: tokens.realm_id,
      refreshTokenValid: Date.now() < refreshExpiresAt,
    };
  } catch (err) {
    return { connected: false, error: 'Failed to check connection' };
  }
});
```

### 3. Create QuickBooks Customer Service

Create file: `functions/src/integrations/quickbooks/customerSync.ts`

```typescript
/**
 * QuickBooks Customer Sync Service
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { refreshTokens } from './auth';
import type { QBOCustomer, QBOQueryResponse, QBOCreateResponse } from './types';

const db = admin.firestore();

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

async function qboRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const tokens = await refreshTokens();

  const response = await fetch(
    `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`,
    {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Find QuickBooks customer by display name
 */
async function findQBOCustomer(displayName: string): Promise<QBOCustomer | null> {
  const query = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`);
  const response = await qboRequest<QBOQueryResponse<QBOCustomer>>(
    `/query?query=${query}`
  );

  const customers = response.QueryResponse.Customer || [];
  return customers[0] || null;
}

/**
 * Create customer in QuickBooks
 */
async function createQBOCustomer(customer: QBOCustomer): Promise<QBOCustomer> {
  const response = await qboRequest<QBOCreateResponse<QBOCustomer>>(
    '/customer',
    {
      method: 'POST',
      body: JSON.stringify(customer),
    }
  );
  return response.Customer;
}

/**
 * Update customer in QuickBooks
 */
async function updateQBOCustomer(customer: QBOCustomer): Promise<QBOCustomer> {
  // QuickBooks requires SyncToken for updates
  const existing = await qboRequest<QBOCreateResponse<QBOCustomer>>(
    `/customer/${customer.Id}`
  );

  const response = await qboRequest<QBOCreateResponse<QBOCustomer>>(
    '/customer',
    {
      method: 'POST',
      body: JSON.stringify({
        ...customer,
        SyncToken: existing.Customer.MetaData?.LastUpdatedTime,
        sparse: true,
      }),
    }
  );
  return response.Customer;
}

/**
 * Convert Firestore customer to QuickBooks format
 */
function toQBOCustomer(firestoreCustomer: any): QBOCustomer {
  const qboCustomer: QBOCustomer = {
    DisplayName: `${firestoreCustomer.name} (${firestoreCustomer.code})`,
    CompanyName: firestoreCustomer.name,
  };

  if (firestoreCustomer.email) {
    qboCustomer.PrimaryEmailAddr = { Address: firestoreCustomer.email };
  }

  if (firestoreCustomer.phone) {
    qboCustomer.PrimaryPhone = { FreeFormNumber: firestoreCustomer.phone };
  }

  if (firestoreCustomer.billingAddress) {
    qboCustomer.BillAddr = {
      Line1: firestoreCustomer.billingAddress.street1,
      Line2: firestoreCustomer.billingAddress.street2,
      City: firestoreCustomer.billingAddress.city,
      CountrySubDivisionCode: firestoreCustomer.billingAddress.state,
      PostalCode: firestoreCustomer.billingAddress.postalCode,
      Country: firestoreCustomer.billingAddress.country,
    };
  }

  return qboCustomer;
}

/**
 * Sync customer to QuickBooks on create
 */
export const onCustomerCreatedQBO = functions.firestore
  .document('customers/{customerId}')
  .onCreate(async (snapshot, context) => {
    const customerId = context.params.customerId;
    const customer = snapshot.data();

    // Check if QuickBooks is connected
    const integrationDoc = await db.collection('integrations').doc('quickbooks').get();
    if (!integrationDoc.exists) {
      functions.logger.info('QuickBooks not connected, skipping sync');
      return;
    }

    functions.logger.info(`Syncing customer ${customerId} to QuickBooks`);

    try {
      const qboCustomer = toQBOCustomer(customer);

      // Check if customer exists in QBO
      const existing = await findQBOCustomer(qboCustomer.DisplayName!);

      let qboId: string;
      if (existing) {
        qboId = existing.Id!;
        functions.logger.info(`Found existing QuickBooks customer: ${qboId}`);
      } else {
        const created = await createQBOCustomer(qboCustomer);
        qboId = created.Id!;
        functions.logger.info(`Created QuickBooks customer: ${qboId}`);
      }

      // Update Firestore with QuickBooks ID
      await db.collection('customers').doc(customerId).update({
        'externalIds.quickbooksId': qboId,
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      functions.logger.error(`Failed to sync customer ${customerId} to QuickBooks:`, error);
      await db.collection('customers').doc(customerId).update({
        'syncStatus.quickbooks': 'failed',
        'syncStatus.quickbooksError': error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

/**
 * Manual sync callable function
 */
export const syncCustomerToQuickBooks = functions.https.onCall(
  async (data: { customerId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId } = data;
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data()!;

    try {
      const qboCustomer = toQBOCustomer(customer);
      let qboId = customer.externalIds?.quickbooksId;

      if (qboId) {
        // Update existing
        qboCustomer.Id = qboId;
        await updateQBOCustomer(qboCustomer);
      } else {
        // Create or find
        const existing = await findQBOCustomer(qboCustomer.DisplayName!);
        if (existing) {
          qboId = existing.Id!;
        } else {
          const created = await createQBOCustomer(qboCustomer);
          qboId = created.Id!;
        }

        await db.collection('customers').doc(customerId).update({
          'externalIds.quickbooksId': qboId,
        });
      }

      await db.collection('customers').doc(customerId).update({
        'syncStatus.quickbooks': 'synced',
        'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, quickbooksId: qboId };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to sync to QuickBooks'
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
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

// Katana Integration
export {
  onCustomerCreated,
  onCustomerUpdated,
  syncCustomerToKatana,
} from './integrations/katana/syncCustomer';

// QuickBooks Integration
export {
  getAuthUrl as qbGetAuthUrl,
  handleCallback as qbCallback,
  checkConnection as qbCheckConnection,
} from './integrations/quickbooks/auth';

export {
  onCustomerCreatedQBO,
  syncCustomerToQuickBooks,
} from './integrations/quickbooks/customerSync';
```

### 5. Configure QuickBooks Credentials

```bash
firebase functions:config:set quickbooks.client_id="YOUR_CLIENT_ID"
firebase functions:config:set quickbooks.client_secret="YOUR_CLIENT_SECRET"
firebase functions:config:set quickbooks.redirect_uri="https://us-central1-dawin-cutlist-processor.cloudfunctions.net/qbCallback"
```

## Validation Checklist

- [ ] OAuth flow redirects to QuickBooks authorization
- [ ] Callback handles tokens and stores in Firestore
- [ ] Token refresh works automatically
- [ ] Customer creation syncs to QuickBooks
- [ ] Manual sync callable function works
- [ ] Error handling logs failures

## Next Steps

After completing this prompt, proceed to:
- **Prompt 1.6**: Google Drive Folder Creation - Auto-create customer folders in Drive
