/**
 * Shopify sample-order webhook handler.
 *
 * The storefront posts a sample request from /finishes/{handle} → DawinOS
 * persists to `sampleRequests` and routes to the marketing inbox.
 *
 * Per schema §4.10:
 *   { request_id, finish_handle, quantity, contact_name, contact_phone,
 *     delivery_addr, submitted_at, channel }
 *
 * HMAC: X-Dawin-Signature (sha256=hex), verified against
 * systemConfig/shopifyConfig.webhookSecret.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { verifyRequest } = require('./_shopifyHmac');

const COLLECTION = 'sampleRequests';

function generateTicketId() {
  const now = new Date();
  const yr = String(now.getUTCFullYear()).slice(-2);
  const week = Math.ceil((((now - new Date(now.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SMP·${yr}W${String(week).padStart(2, '0')}·${rand}`;
}

const shopifySampleOrder = onRequest(
  { cors: ALLOWED_ORIGINS, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const sig = await verifyRequest(req);
    if (!sig.ok) {
      logger.warn('shopifySampleOrder.bad-signature', sig);
      res.status(401).send('Unauthorized');
      return;
    }

    const db = getFirestore();
    try {
      const body = req.body || {};
      if (!body.finish_handle && !body.finishHandle) {
        res.status(400).json({ error: 'finish_handle is required' });
        return;
      }
      if (!body.contact_phone && !body.contactPhone && !body.contact_email) {
        res.status(400).json({ error: 'contact_phone or contact_email is required' });
        return;
      }

      const finishHandle = body.finish_handle || body.finishHandle;

      // Dedup by request_id
      if (body.request_id) {
        const existing = await db.collection(COLLECTION)
          .where('externalRequestId', '==', body.request_id)
          .limit(1).get();
        if (!existing.empty) {
          res.status(200).json({ status: 'duplicate', ticket_id: existing.docs[0].data().ticketId });
          return;
        }
      }

      const ticketId = generateTicketId();
      const docRef = db.collection(COLLECTION).doc();
      await docRef.set({
        ticketId,
        externalRequestId: body.request_id || null,
        finishHandle,
        quantity: Number(body.quantity) || 1,
        contactName: body.contact_name || body.contactName || '',
        contactPhone: body.contact_phone || body.contactPhone || '',
        contactEmail: body.contact_email || body.contactEmail || '',
        deliveryAddress: body.delivery_addr || body.deliveryAddress || '',
        channel: body.channel || 'web',
        status: 'received',
        subsidiaryId: 'finishes',
        submittedAt: body.submitted_at ? new Date(body.submitted_at) : FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'shopify-form',
      });

      logger.info('shopifySampleOrder.received', { ticketId, finishHandle });
      res.status(201).json({ ticket_id: ticketId, received_at: new Date().toISOString() });
    } catch (err) {
      logger.error('shopifySampleOrder.failed', { error: err.message });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = { shopifySampleOrder };
