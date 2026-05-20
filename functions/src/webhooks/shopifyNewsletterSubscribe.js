/**
 * Newsletter subscribe webhook.
 *
 * Triggered by Shopify native `customers/create` (or `customers/update`)
 * webhook scoped to customers tagged `newsletter`. Persists to
 * `newsletterSubscribers` and (best-effort) joins them to the marketing
 * default newsletter audience.
 *
 * HMAC: X-Shopify-Hmac-Sha256 (Shopify-native).
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { verifyRequest } = require('./_shopifyHmac');

const COLLECTION = 'newsletterSubscribers';

const shopifyNewsletterSubscribe = onRequest(
  { cors: ALLOWED_ORIGINS, region: 'us-central1' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const sig = await verifyRequest(req);
    if (!sig.ok) {
      logger.warn('shopifyNewsletterSubscribe.bad-signature', sig);
      res.status(401).send('Unauthorized');
      return;
    }

    const db = getFirestore();
    try {
      const customer = req.body || {};
      const tags = String(customer.tags || '').toLowerCase().split(',').map((t) => t.trim());
      if (!tags.includes('newsletter')) {
        // Not a newsletter-tagged event — accept but no-op.
        res.status(200).json({ status: 'ignored', reason: 'no newsletter tag' });
        return;
      }
      const email = customer.email;
      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }

      // Upsert by email
      const docId = `email_${email.toLowerCase()}`;
      const ref = db.collection(COLLECTION).doc(docId);
      const snap = await ref.get();
      const now = FieldValue.serverTimestamp();
      const data = {
        email,
        shopifyCustomerId: String(customer.id || ''),
        firstName: customer.first_name || customer.firstName || '',
        lastName: customer.last_name || customer.lastName || '',
        phone: customer.phone || '',
        acceptsMarketing: customer.accepts_marketing !== false,
        locale: customer.locale || null,
        tags,
        subsidiaryId: 'finishes',
        source: 'shopify-customer-newsletter',
        updatedAt: now,
      };
      if (!snap.exists) {
        data.subscribedAt = now;
        data.createdAt = now;
        data.status = 'active';
      }
      await ref.set(data, { merge: true });

      logger.info('shopifyNewsletterSubscribe.upserted', { email });
      res.status(201).json({ status: 'subscribed', email });
    } catch (err) {
      logger.error('shopifyNewsletterSubscribe.failed', { error: err.message });
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

module.exports = { shopifyNewsletterSubscribe };
