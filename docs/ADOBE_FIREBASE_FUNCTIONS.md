# Adobe Integration - Firebase Functions

> **Supplementary implementation for server-side Adobe API authentication and webhooks**

---

## Overview

Adobe APIs require server-side authentication to protect client secrets. This document provides the Firebase Functions implementation for:

1. Token generation endpoints
2. Webhook handlers for Adobe Sign
3. Proxy endpoints for sensitive operations

---

## 1. Token Generation Function

**File: `functions/src/adobe/token.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Configuration from environment
const config = {
  pdfServices: {
    clientId: process.env.ADOBE_CLIENT_ID,
    clientSecret: process.env.ADOBE_CLIENT_SECRET,
    orgId: process.env.ADOBE_ORG_ID,
    technicalAccountId: process.env.ADOBE_TECHNICAL_ACCOUNT_ID,
    privateKey: process.env.ADOBE_PRIVATE_KEY,
  },
  sign: {
    clientId: process.env.ADOBE_SIGN_CLIENT_ID,
    clientSecret: process.env.ADOBE_SIGN_CLIENT_SECRET,
    refreshToken: process.env.ADOBE_SIGN_REFRESH_TOKEN,
    baseUri: process.env.ADOBE_SIGN_BASE_URI || 'https://api.na1.adobesign.com',
  },
  firefly: {
    clientId: process.env.ADOBE_FIREFLY_CLIENT_ID,
    clientSecret: process.env.ADOBE_FIREFLY_CLIENT_SECRET,
  },
};

// Token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get Adobe API token
 */
export const getAdobeToken = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { service } = data;

  // Check cache
  const cached = tokenCache.get(service);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return { accessToken: cached.token, expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000) };
  }

  let token: { accessToken: string; expiresIn: number };

  switch (service) {
    case 'pdf-services':
      token = await getPdfServicesToken();
      break;
    case 'sign':
      token = await getSignToken();
      break;
    case 'firefly':
      token = await getFireflyToken();
      break;
    default:
      throw new functions.https.HttpsError('invalid-argument', `Unknown service: ${service}`);
  }

  // Cache token
  tokenCache.set(service, {
    token: token.accessToken,
    expiresAt: Date.now() + token.expiresIn * 1000,
  });

  return token;
});

/**
 * Get PDF Services token using JWT
 */
async function getPdfServicesToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret, orgId, technicalAccountId, privateKey } = config.pdfServices;

  if (!clientId || !clientSecret || !orgId || !technicalAccountId || !privateKey) {
    throw new functions.https.HttpsError('failed-precondition', 'PDF Services not configured');
  }

  // Create JWT
  const jwtPayload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    iss: orgId,
    sub: technicalAccountId,
    aud: `https://ims-na1.adobelogin.com/c/${clientId}`,
    'https://ims-na1.adobelogin.com/s/ent_documentcloud_sdk': true,
  };

  const jwtToken = jwt.sign(jwtPayload, privateKey.replace(/\\n/g, '\n'), { algorithm: 'RS256' });

  // Exchange JWT for access token
  const response = await fetch('https://ims-na1.adobelogin.com/ims/exchange/jwt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      jwt_token: jwtToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new functions.https.HttpsError('internal', `Token exchange failed: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get Adobe Sign token using refresh token
 */
async function getSignToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret, refreshToken, baseUri } = config.sign;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new functions.https.HttpsError('failed-precondition', 'Adobe Sign not configured');
  }

  const response = await fetch(`${baseUri}/oauth/v2/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new functions.https.HttpsError('internal', `Sign token refresh failed: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Get Firefly token using client credentials
 */
async function getFireflyToken(): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = config.firefly;

  if (!clientId || !clientSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Firefly not configured');
  }

  const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'openid,AdobeID,firefly_enterprise,firefly_api,ff_apis',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new functions.https.HttpsError('internal', `Firefly token failed: ${error}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}
```

---

## 2. Adobe Sign Webhooks

**File: `functions/src/adobe/sign-webhooks.ts`**

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

// Webhook secret for signature verification
const WEBHOOK_SECRET = process.env.ADOBE_SIGN_WEBHOOK_SECRET;

interface SignWebhookPayload {
  webhookId: string;
  webhookName: string;
  webhookNotificationId: string;
  webhookUrlInfo: {
    url: string;
  };
  webhookScope: string;
  webhookNotificationApplicableUsers: Array<{
    id: string;
    email: string;
    role: string;
    payloadApplicable: boolean;
  }>;
  event: string;
  subEvent: string;
  eventDate: string;
  eventResourceType: string;
  eventResourceParentType: string;
  eventResourceParentId: string;
  participantUserId: string;
  participantUserEmail: string;
  actingUserId: string;
  actingUserEmail: string;
  actingUserIpAddress: string;
  initiatingUserId: string;
  initiatingUserEmail: string;
  agreement?: {
    id: string;
    name: string;
    status: string;
    ccs?: string[];
    deviceInfo?: {
      applicationDescription: string;
      deviceDescription: string;
    };
  };
}

/**
 * Adobe Sign webhook handler
 */
export const adobeSignWebhook = functions.https.onRequest(async (req, res) => {
  // Verify webhook signature
  if (WEBHOOK_SECRET) {
    const signature = req.headers['x-adobesign-clientid'];
    if (signature !== WEBHOOK_SECRET) {
      console.error('Invalid webhook signature');
      res.status(401).send('Unauthorized');
      return;
    }
  }

  // Handle verification request (Adobe Sign sends this to verify webhook URL)
  if (req.method === 'GET') {
    const clientId = req.headers['x-adobesign-clientid'];
    if (clientId) {
      res.setHeader('X-AdobeSign-ClientId', clientId);
      res.status(200).send('OK');
      return;
    }
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const payload = req.body as SignWebhookPayload;

    console.log('Adobe Sign webhook received:', {
      event: payload.event,
      subEvent: payload.subEvent,
      agreementId: payload.agreement?.id,
      agreementName: payload.agreement?.name,
    });

    // Process based on event type
    switch (payload.event) {
      case 'AGREEMENT_CREATED':
        await handleAgreementCreated(payload);
        break;

      case 'AGREEMENT_ACTION_COMPLETED':
        await handleAgreementActionCompleted(payload);
        break;

      case 'AGREEMENT_WORKFLOW_COMPLETED':
        await handleAgreementCompleted(payload);
        break;

      case 'AGREEMENT_RECALLED':
      case 'AGREEMENT_REJECTED':
        await handleAgreementCancelled(payload);
        break;

      case 'AGREEMENT_EXPIRED':
        await handleAgreementExpired(payload);
        break;

      default:
        console.log('Unhandled event type:', payload.event);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal error');
  }
});

/**
 * Handle agreement created event
 */
async function handleAgreementCreated(payload: SignWebhookPayload): Promise<void> {
  if (!payload.agreement) return;

  // Find linked document in Firestore
  const linkedDoc = await findLinkedDocument(payload.agreement.id);
  if (!linkedDoc) {
    console.log('No linked document found for agreement:', payload.agreement.id);
    return;
  }

  // Update document status
  await linkedDoc.ref.update({
    'signatureStatus.status': 'out_for_signature',
    'signatureStatus.sentAt': admin.firestore.FieldValue.serverTimestamp(),
    'signatureStatus.agreementId': payload.agreement.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await logSignatureActivity(linkedDoc.id, 'sent', payload);
}

/**
 * Handle agreement action completed (someone signed)
 */
async function handleAgreementActionCompleted(payload: SignWebhookPayload): Promise<void> {
  if (!payload.agreement) return;

  const linkedDoc = await findLinkedDocument(payload.agreement.id);
  if (!linkedDoc) return;

  // Update participant status
  const currentStatus = linkedDoc.data()?.signatureStatus || {};
  const participants = currentStatus.participants || [];

  const participantIndex = participants.findIndex(
    (p: any) => p.email === payload.participantUserEmail
  );

  if (participantIndex >= 0) {
    participants[participantIndex] = {
      ...participants[participantIndex],
      status: 'signed',
      signedAt: new Date(payload.eventDate),
    };
  }

  await linkedDoc.ref.update({
    'signatureStatus.participants': participants,
    'signatureStatus.lastActionAt': admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await logSignatureActivity(linkedDoc.id, 'participant_signed', payload);
}

/**
 * Handle agreement completed (all signatures collected)
 */
async function handleAgreementCompleted(payload: SignWebhookPayload): Promise<void> {
  if (!payload.agreement) return;

  const linkedDoc = await findLinkedDocument(payload.agreement.id);
  if (!linkedDoc) return;

  // Update document status
  await linkedDoc.ref.update({
    'signatureStatus.status': 'completed',
    'signatureStatus.completedAt': admin.firestore.FieldValue.serverTimestamp(),
    'status': 'signed', // Update main document status
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Download and store signed document
  await downloadAndStoreSignedDocument(payload.agreement.id, linkedDoc);

  // Log activity
  await logSignatureActivity(linkedDoc.id, 'completed', payload);

  // Send notifications
  await sendSignatureCompletedNotification(linkedDoc);
}

/**
 * Handle agreement cancelled
 */
async function handleAgreementCancelled(payload: SignWebhookPayload): Promise<void> {
  if (!payload.agreement) return;

  const linkedDoc = await findLinkedDocument(payload.agreement.id);
  if (!linkedDoc) return;

  const status = payload.event === 'AGREEMENT_REJECTED' ? 'rejected' : 'cancelled';

  await linkedDoc.ref.update({
    'signatureStatus.status': status,
    'signatureStatus.cancelledAt': admin.firestore.FieldValue.serverTimestamp(),
    'signatureStatus.cancelledBy': payload.actingUserEmail,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await logSignatureActivity(linkedDoc.id, status, payload);
}

/**
 * Handle agreement expired
 */
async function handleAgreementExpired(payload: SignWebhookPayload): Promise<void> {
  if (!payload.agreement) return;

  const linkedDoc = await findLinkedDocument(payload.agreement.id);
  if (!linkedDoc) return;

  await linkedDoc.ref.update({
    'signatureStatus.status': 'expired',
    'signatureStatus.expiredAt': admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await logSignatureActivity(linkedDoc.id, 'expired', payload);
}

/**
 * Find linked document by agreement ID
 */
async function findLinkedDocument(
  agreementId: string
): Promise<admin.firestore.DocumentSnapshot | null> {
  // Check quotes
  let query = await db
    .collection('quotes')
    .where('signatureStatus.agreementId', '==', agreementId)
    .limit(1)
    .get();

  if (!query.empty) {
    return query.docs[0];
  }

  // Check contracts
  query = await db
    .collection('contracts')
    .where('signatureStatus.agreementId', '==', agreementId)
    .limit(1)
    .get();

  if (!query.empty) {
    return query.docs[0];
  }

  // Check HR documents
  query = await db
    .collection('hrDocuments')
    .where('signatureStatus.agreementId', '==', agreementId)
    .limit(1)
    .get();

  if (!query.empty) {
    return query.docs[0];
  }

  return null;
}

/**
 * Download and store signed document
 */
async function downloadAndStoreSignedDocument(
  agreementId: string,
  linkedDoc: admin.firestore.DocumentSnapshot
): Promise<void> {
  try {
    // Get token
    const token = await getSignAccessToken();

    // Get signed document URL
    const baseUri = process.env.ADOBE_SIGN_BASE_URI || 'https://api.na1.adobesign.com';
    const response = await fetch(
      `${baseUri}/api/rest/v6/agreements/${agreementId}/combinedDocument`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to download signed document: ${response.statusText}`);
    }

    const pdfBuffer = await response.buffer();

    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const fileName = `signed-documents/${linkedDoc.ref.parent.id}/${linkedDoc.id}_signed.pdf`;
    const file = bucket.file(fileName);

    await file.save(pdfBuffer, {
      contentType: 'application/pdf',
      metadata: {
        agreementId,
        documentId: linkedDoc.id,
        signedAt: new Date().toISOString(),
      },
    });

    // Get download URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });

    // Update document with signed PDF URL
    await linkedDoc.ref.update({
      'signatureStatus.signedDocumentUrl': url,
      'signatureStatus.signedDocumentPath': fileName,
    });
  } catch (error) {
    console.error('Failed to download signed document:', error);
  }
}

/**
 * Log signature activity
 */
async function logSignatureActivity(
  documentId: string,
  action: string,
  payload: SignWebhookPayload
): Promise<void> {
  await db.collection('signatureActivity').add({
    documentId,
    action,
    agreementId: payload.agreement?.id,
    agreementName: payload.agreement?.name,
    participantEmail: payload.participantUserEmail,
    actingUserEmail: payload.actingUserEmail,
    eventDate: payload.eventDate,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Send notification when signature is completed
 */
async function sendSignatureCompletedNotification(
  linkedDoc: admin.firestore.DocumentSnapshot
): Promise<void> {
  const data = linkedDoc.data();
  if (!data) return;

  // Get document creator
  const creatorId = data.createdBy;
  if (!creatorId) return;

  // Add notification
  await db.collection('notifications').add({
    userId: creatorId,
    type: 'signature_completed',
    title: 'Document Signed',
    message: `"${data.name || linkedDoc.id}" has been signed by all parties.`,
    documentId: linkedDoc.id,
    documentType: linkedDoc.ref.parent.id,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Get Sign access token
 */
async function getSignAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken, baseUri } = {
    clientId: process.env.ADOBE_SIGN_CLIENT_ID,
    clientSecret: process.env.ADOBE_SIGN_CLIENT_SECRET,
    refreshToken: process.env.ADOBE_SIGN_REFRESH_TOKEN,
    baseUri: process.env.ADOBE_SIGN_BASE_URI || 'https://api.na1.adobesign.com',
  };

  const response = await fetch(`${baseUri}/oauth/v2/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken!,
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}
```

---

## 3. Functions Index

**File: `functions/src/adobe/index.ts`**

```typescript
export { getAdobeToken } from './token';
export { adobeSignWebhook } from './sign-webhooks';
```

**Update: `functions/src/index.ts`**

```typescript
// Add to existing exports
export * from './adobe';
```

---

## 4. Deployment Configuration

**Update: `firebase.json`**

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ]
  }
}
```

**Environment Variables (Firebase Console or CLI)**

```bash
# Set environment variables
firebase functions:config:set \
  adobe.pdf_services.client_id="xxx" \
  adobe.pdf_services.client_secret="xxx" \
  adobe.pdf_services.org_id="xxx" \
  adobe.pdf_services.technical_account_id="xxx" \
  adobe.pdf_services.private_key="xxx" \
  adobe.sign.client_id="xxx" \
  adobe.sign.client_secret="xxx" \
  adobe.sign.refresh_token="xxx" \
  adobe.sign.base_uri="https://api.na1.adobesign.com" \
  adobe.sign.webhook_secret="xxx" \
  adobe.firefly.client_id="xxx" \
  adobe.firefly.client_secret="xxx"

# Deploy functions
firebase deploy --only functions
```

---

## 5. Register Webhook with Adobe Sign

After deploying the webhook function, register it with Adobe Sign:

```bash
# Get your webhook URL
WEBHOOK_URL="https://us-central1-YOUR_PROJECT.cloudfunctions.net/adobeSignWebhook"

# Register webhook via Adobe Sign API
curl -X POST "https://api.na1.adobesign.com/api/rest/v6/webhooks" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DawinOS Signature Webhook",
    "scope": "ACCOUNT",
    "state": "ACTIVE",
    "webhookSubscriptionEvents": [
      "AGREEMENT_CREATED",
      "AGREEMENT_ACTION_COMPLETED",
      "AGREEMENT_WORKFLOW_COMPLETED",
      "AGREEMENT_RECALLED",
      "AGREEMENT_REJECTED",
      "AGREEMENT_EXPIRED"
    ],
    "webhookUrlInfo": {
      "url": "'"$WEBHOOK_URL"'"
    },
    "applicationName": "DawinOS",
    "applicationDisplayName": "Dawin Operating System"
  }'
```

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-25
