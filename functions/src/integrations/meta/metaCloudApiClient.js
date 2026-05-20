/**
 * Meta WhatsApp Cloud API Client
 * Direct integration with Meta's Graph API for WhatsApp Business
 *
 * API docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Base URL: https://graph.facebook.com/v21.0
 */

const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const fetch = require('node-fetch');

const META_WHATSAPP_ACCESS_TOKEN = defineSecret('META_WHATSAPP_ACCESS_TOKEN');
const META_WHATSAPP_PHONE_NUMBER_ID = defineSecret('META_WHATSAPP_PHONE_NUMBER_ID');
const META_WHATSAPP_BUSINESS_ACCOUNT_ID = defineSecret('META_WHATSAPP_BUSINESS_ACCOUNT_ID');
const META_WHATSAPP_APP_SECRET = defineSecret('META_WHATSAPP_APP_SECRET');

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/** Per-request timeout in ms (45 seconds) */
const META_FETCH_TIMEOUT_MS = 45_000;

/**
 * Fetch with a timeout via AbortController.
 * Throws with a clear message if the request takes too long.
 */
function fetchWithTimeout(url, options = {}, timeoutMs = META_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

/**
 * Make an authenticated request to the Meta Graph API
 * @param {string} endpoint - API endpoint (e.g. '/{phone_number_id}/messages')
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries on failure
 * @returns {Promise<object>} API response data
 */
async function metaRequest(endpoint, options = {}, retries = 2) {
  const accessToken = META_WHATSAPP_ACCESS_TOKEN.value();
  if (!accessToken) {
    throw new Error('META_WHATSAPP_ACCESS_TOKEN secret is not configured');
  }

  const url = `${META_BASE_URL}${endpoint}`;
  const fetchOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
        logger.warn(`Meta API rate limited, waiting ${retryAfter}s before retry`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(`Meta API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.metaError = data.error || data;
        throw error;
      }

      return data;
    } catch (err) {
      if (attempt === retries) {
        logger.error('Meta API request failed after retries', {
          endpoint,
          error: err.message,
          metaError: err.metaError,
        });
        throw err;
      }
      logger.warn(`Meta API attempt ${attempt + 1} failed, retrying...`, {
        endpoint,
        error: err.message,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Send a text message via WhatsApp Cloud API
 * @param {string} phoneNumber - Recipient phone (format: countrycode+number e.g. '256XXXXXXXXX')
 * @param {string} text - Message text
 * @returns {Promise<object>} Send result with messages[0].id
 */
async function sendTextMessage(phoneNumber, text) {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp text message via Meta', { phoneNumber: phoneNumber.substring(0, 6) + '...' });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  });
}

/**
 * Send a template message via WhatsApp Cloud API
 * Template messages can be sent anytime (no 24-hour window restriction)
 * @param {string} phoneNumber - Recipient phone
 * @param {string} templateName - Meta template name
 * @param {string} languageCode - Template language code (e.g. 'en')
 * @param {Array} components - Template components with parameters
 * @returns {Promise<object>} Send result
 */
async function sendTemplateMessage(phoneNumber, templateName, languageCode = 'en', components = []) {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp template message via Meta', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
    templateName,
  });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    }),
  });
}

/**
 * Send an image message via WhatsApp Cloud API
 * @param {string} phoneNumber - Recipient phone
 * @param {string} imageUrl - Public URL of the image
 * @param {string} caption - Image caption
 * @returns {Promise<object>} Send result
 */
async function sendImageMessage(phoneNumber, imageUrl, caption = '') {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp image message via Meta', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
  });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'image',
      image: { link: imageUrl, caption },
    }),
  });
}

/**
 * Send an interactive message via WhatsApp Cloud API (buttons or lists)
 * @param {string} phoneNumber - Recipient phone
 * @param {object} interactive - Interactive message payload
 * @returns {Promise<object>} Send result
 */
async function sendInteractiveMessage(phoneNumber, interactive) {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp interactive message via Meta', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
    type: interactive.type,
  });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'interactive',
      interactive,
    }),
  });
}

/**
 * Send a location message via WhatsApp Cloud API
 * @param {string} phoneNumber - Recipient phone
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {string} name - Location name
 * @param {string} address - Location address
 * @returns {Promise<object>} Send result
 */
async function sendLocationMessage(phoneNumber, latitude, longitude, name = '', address = '') {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp location message via Meta', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
  });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'location',
      location: { latitude, longitude, name, address },
    }),
  });
}

/**
 * Mark a message as read
 * @param {string} messageId - The wamid of the message to mark as read
 * @returns {Promise<object>} Result
 */
async function markMessageRead(messageId) {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
}

/**
 * Get available WhatsApp message templates from Meta
 * @param {number} limit - Max templates to fetch per page
 * @returns {Promise<Array>} List of templates
 */
async function getTemplates(limit = 100) {
  const businessAccountId = META_WHATSAPP_BUSINESS_ACCOUNT_ID.value();
  const allTemplates = [];
  let url = `/${businessAccountId}/message_templates?limit=${limit}`;

  while (url) {
    const data = await metaRequest(url, { method: 'GET' });
    if (data.data) {
      allTemplates.push(...data.data);
    }
    // Handle pagination
    url = data.paging?.next ? data.paging.next.replace(META_BASE_URL, '') : null;
  }

  return allTemplates;
}

/**
 * Create a message template in Meta Business Manager
 * Submits a template for Meta's approval process
 * @param {string} name - Template name (lowercase, underscores only)
 * @param {string} category - UTILITY, MARKETING, or AUTHENTICATION
 * @param {string} languageCode - Language code e.g. 'en'
 * @param {Array} components - Template components (HEADER, BODY, FOOTER, BUTTONS)
 * @returns {Promise<object>} Created template with id, status, category
 */
async function createTemplate(name, category, languageCode, components) {
  const businessAccountId = META_WHATSAPP_BUSINESS_ACCOUNT_ID.value();
  logger.info('Creating WhatsApp template via Meta', { name, category, languageCode });

  return metaRequest(`/${businessAccountId}/message_templates`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      category,
      language: languageCode,
      components,
    }),
  });
}

/**
 * Delete a message template from Meta Business Manager
 * @param {string} templateName - Template name to delete
 * @returns {Promise<object>} Deletion result
 */
async function deleteTemplate(templateName) {
  const businessAccountId = META_WHATSAPP_BUSINESS_ACCOUNT_ID.value();
  logger.info('Deleting WhatsApp template via Meta', { templateName });

  return metaRequest(`/${businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}`, {
    method: 'DELETE',
  });
}

/**
 * Send a document message via WhatsApp Cloud API
 * @param {string} phoneNumber - Recipient phone
 * @param {string} documentUrl - Public URL of the document
 * @param {string} caption - Document caption
 * @param {string} filename - Display filename
 * @returns {Promise<object>} Send result
 */
async function sendDocumentMessage(phoneNumber, documentUrl, caption = '', filename = '') {
  const phoneNumberId = META_WHATSAPP_PHONE_NUMBER_ID.value();
  logger.info('Sending WhatsApp document message via Meta', {
    phoneNumber: phoneNumber.substring(0, 6) + '...',
    filename,
  });

  return metaRequest(`/${phoneNumberId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'document',
      document: {
        link: documentUrl,
        ...(caption ? { caption } : {}),
        ...(filename ? { filename } : {}),
      },
    }),
  });
}

/**
 * Upload media to Meta via the Resumable Upload API for use in template headers.
 * Downloads the image from a URL, uploads it to Meta, returns a header_handle.
 * @param {string} imageUrl - Publicly accessible URL of the image
 * @returns {Promise<string>} header_handle string for use in template creation
 */
async function uploadMediaForTemplate(imageUrl) {
  const accessToken = META_WHATSAPP_ACCESS_TOKEN.value();

  // 1. Download the image
  const imageResponse = await fetchWithTimeout(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image from URL: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.buffer();
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  const fileLength = imageBuffer.length;

  logger.info('Downloaded image for Meta upload', { fileLength, contentType });

  // 2. Get the App ID from the access token
  const appRes = await fetchWithTimeout(`${META_BASE_URL}/app?access_token=${accessToken}`);
  const appData = await appRes.json();
  if (!appData.id) {
    throw new Error(`Could not determine Meta App ID: ${JSON.stringify(appData.error || appData)}`);
  }
  const appId = appData.id;

  // 3. Create an upload session
  const sessionRes = await fetchWithTimeout(
    `${META_BASE_URL}/${appId}/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}&access_token=${accessToken}`,
    { method: 'POST' }
  );
  const sessionData = await sessionRes.json();
  if (!sessionData.id) {
    throw new Error(`Failed to create upload session: ${JSON.stringify(sessionData.error || sessionData)}`);
  }
  const uploadSessionId = sessionData.id;
  logger.info('Created Meta upload session', { uploadSessionId });

  // 4. Upload the file data
  const uploadRes = await fetchWithTimeout(`${META_BASE_URL}/${uploadSessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
    },
    body: imageBuffer,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.h) {
    throw new Error(`Failed to upload file to Meta: ${JSON.stringify(uploadData.error || uploadData)}`);
  }

  logger.info('Uploaded image to Meta successfully', {
    handle: uploadData.h.substring(0, 40) + '...',
  });

  return uploadData.h;
}

/**
 * Upload a raw buffer to Meta via the Resumable Upload API.
 * Used when we generate a PDF in-memory and don't have a URL.
 * @param {Buffer} buffer - File contents
 * @param {string} contentType - MIME type (e.g. 'application/pdf')
 * @returns {Promise<string>} header_handle string
 */
async function uploadBufferToMeta(buffer, contentType) {
  const accessToken = META_WHATSAPP_ACCESS_TOKEN.value();
  const fileLength = buffer.length;

  logger.info('Uploading buffer to Meta', { fileLength, contentType });

  // 1. Get the App ID
  const appRes = await fetchWithTimeout(`${META_BASE_URL}/app?access_token=${accessToken}`);
  const appData = await appRes.json();
  if (!appData.id) {
    throw new Error(`Could not determine Meta App ID: ${JSON.stringify(appData.error || appData)}`);
  }

  // 2. Create an upload session
  const sessionRes = await fetchWithTimeout(
    `${META_BASE_URL}/${appData.id}/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}&access_token=${accessToken}`,
    { method: 'POST' }
  );
  const sessionData = await sessionRes.json();
  if (!sessionData.id) {
    throw new Error(`Failed to create upload session: ${JSON.stringify(sessionData.error || sessionData)}`);
  }

  // 3. Upload the file data
  const uploadRes = await fetchWithTimeout(`${META_BASE_URL}/${sessionData.id}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: '0',
    },
    body: buffer,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData.h) {
    throw new Error(`Failed to upload buffer to Meta: ${JSON.stringify(uploadData.error || uploadData)}`);
  }

  logger.info('Uploaded buffer to Meta successfully', {
    handle: uploadData.h.substring(0, 40) + '...',
  });

  return uploadData.h;
}

/**
 * Generate a minimal valid PDF buffer.
 * Used as a sample document when submitting DOCUMENT-header templates to Meta.
 * @param {string} title - Title text to embed in the PDF
 * @returns {Buffer} Valid PDF file contents
 */
function generateMinimalPdf(title) {
  // Build a minimal but valid PDF 1.4 with a single page
  const text = title || 'Sample Document';
  const streamContent = `BT /F1 16 Tf 72 700 Td (${text}) Tj ET`;
  const streamLength = Buffer.byteLength(streamContent);

  const objects = [];
  // obj 1: catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // obj 2: pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  // obj 3: page
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj'
  );
  // obj 4: content stream
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`
  );
  // obj 5: font
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj'
  );

  let body = '%PDF-1.4\n';
  const offsets = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body));
    body += obj + '\n';
  }

  const xrefOffset = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body);
}

// Export secrets so Cloud Functions that use this client can declare them
module.exports = {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  META_WHATSAPP_BUSINESS_ACCOUNT_ID,
  META_WHATSAPP_APP_SECRET,
  metaRequest,
  sendTextMessage,
  sendTemplateMessage,
  sendImageMessage,
  sendInteractiveMessage,
  sendLocationMessage,
  markMessageRead,
  getTemplates,
  createTemplate,
  deleteTemplate,
  sendDocumentMessage,
  uploadMediaForTemplate,
  uploadBufferToMeta,
  generateMinimalPdf,
};
