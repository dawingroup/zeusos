/**
 * Meta WhatsApp Webhook Verification & Security
 * Handles webhook challenge verification and HMAC-SHA256 signature validation
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */

const crypto = require('crypto');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

const META_WEBHOOK_VERIFY_TOKEN = defineSecret('META_WEBHOOK_VERIFY_TOKEN');

/**
 * Handle Meta's webhook verification challenge
 * Meta sends a GET request with hub.mode, hub.verify_token, hub.challenge
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {boolean} Whether the verification was handled
 */
function verifyWebhookChallenge(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') {
    return false;
  }

  const expectedToken = META_WEBHOOK_VERIFY_TOKEN.value();
  if (token !== expectedToken) {
    logger.warn('Webhook verification failed: token mismatch');
    res.status(403).send('Verification failed');
    return true;
  }

  logger.info('Webhook verification successful');
  res.status(200).send(challenge);
  return true;
}

/**
 * Validate the HMAC-SHA256 signature of an incoming webhook payload
 * The signature is in the X-Hub-Signature-256 header
 *
 * @param {object} req - Express request object (must have rawBody)
 * @param {string} appSecret - Meta App Secret
 * @returns {boolean} Whether the signature is valid
 */
function validateSignature(req, appSecret) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Webhook missing X-Hub-Signature-256 header');
    return false;
  }

  // Firebase Cloud Functions provides rawBody
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    logger.warn('Webhook signature validation failed');
  }

  return isValid;
}

module.exports = {
  META_WEBHOOK_VERIFY_TOKEN,
  verifyWebhookChallenge,
  validateSignature,
};
