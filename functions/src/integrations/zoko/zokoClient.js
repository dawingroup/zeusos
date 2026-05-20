/**
 * Zoko WhatsApp API Client
 * Shared client for all Zoko API interactions
 *
 * API docs: https://docs.zoko.io
 * Base URL: https://chat.zoko.io/v2
 * Auth: apikey header
 */

const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const fetch = require('node-fetch');

const ZOKO_API_KEY = defineSecret('ZOKO_API_KEY');
const ZOKO_BASE_URL = 'https://chat.zoko.io/v2';

/**
 * Make an authenticated request to the Zoko API
 * @param {string} endpoint - API endpoint (e.g. '/message')
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries on failure
 * @returns {Promise<object>} API response data
 */
async function zokoRequest(endpoint, options = {}, retries = 2) {
  const apiKey = ZOKO_API_KEY.value();
  if (!apiKey) {
    throw new Error('ZOKO_API_KEY secret is not configured');
  }

  const url = `${ZOKO_BASE_URL}${endpoint}`;
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        logger.warn(`Zoko rate limited, waiting ${retryAfter}s before retry`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(`Zoko API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.zokoError = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (attempt === retries) {
        logger.error('Zoko API request failed after retries', {
          endpoint,
          error: err.message,
          zokoError: err.zokoError,
        });
        throw err;
      }
      logger.warn(`Zoko API attempt ${attempt + 1} failed, retrying...`, {
        endpoint,
        error: err.message,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Send a text message via WhatsApp
 * @param {string} phoneNumber - Recipient phone (format: countrycode+number e.g. '256XXXXXXXXX')
 * @param {string} text - Message text
 * @returns {Promise<object>} Send result with messageId
 */
async function sendTextMessage(phoneNumber, text) {
  logger.info('Sending WhatsApp text message', { phoneNumber: phoneNumber.substring(0, 6) + '...' });

  return zokoRequest('/message', {
    method: 'POST',
    body: JSON.stringify({
      channel: 'whatsapp',
      recipient: phoneNumber,
      type: 'text',
      message: text,
    }),
  });
}

/**
 * Send a template message via WhatsApp
 * Template messages can be sent anytime (no 24-hour window restriction)
 * @param {string} phoneNumber - Recipient phone
 * @param {string} templateId - Zoko template ID
 * @param {object} params - Template parameter values
 * @returns {Promise<object>} Send result
 */
async function sendTemplateMessage(phoneNumber, templateId, params = {}) {
  logger.info('Sending WhatsApp template message', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
    templateId,
  });

  return zokoRequest('/message/template', {
    method: 'POST',
    body: JSON.stringify({
      channel: 'whatsapp',
      recipient: phoneNumber,
      templateId,
      params,
    }),
  });
}

/**
 * Send an image message via WhatsApp
 * @param {string} phoneNumber - Recipient phone
 * @param {string} imageUrl - Public URL of the image
 * @param {string} caption - Image caption
 * @returns {Promise<object>} Send result
 */
async function sendImageMessage(phoneNumber, imageUrl, caption = '') {
  logger.info('Sending WhatsApp image message', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
  });

  return zokoRequest('/message', {
    method: 'POST',
    body: JSON.stringify({
      channel: 'whatsapp',
      recipient: phoneNumber,
      type: 'image',
      url: imageUrl,
      caption,
    }),
  });
}

/**
 * Get message history for a contact
 * @param {string} messageId - Zoko message ID
 * @returns {Promise<object>} Message history
 */
async function getMessageHistory(messageId) {
  return zokoRequest(`/message/${messageId}/history`, { method: 'GET' });
}

/**
 * Get available WhatsApp message templates
 * @returns {Promise<Array>} List of templates
 */
async function getTemplates() {
  return zokoRequest('/templates', { method: 'GET' });
}

/**
 * Register a webhook URL with Zoko
 * @param {string} webhookUrl - Public URL to receive webhook events
 * @returns {Promise<object>} Registration result
 */
async function registerWebhook(webhookUrl) {
  logger.info('Registering Zoko webhook', { webhookUrl });

  return zokoRequest('/webhook', {
    method: 'POST',
    body: JSON.stringify({
      url: webhookUrl,
    }),
  });
}

// Export the secret so Cloud Functions that use this client can declare it
module.exports = {
  ZOKO_API_KEY,
  zokoRequest,
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  getMessageHistory,
  getTemplates,
  registerWebhook,
};
