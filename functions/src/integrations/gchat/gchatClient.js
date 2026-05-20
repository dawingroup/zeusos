/**
 * Google Chat API Client
 * Middleware for internal team communication via Google Workspace Chat
 *
 * API docs: https://developers.google.com/workspace/chat/api/reference/rest
 * Base URL: https://chat.googleapis.com/v1
 *
 * Uses Application Default Credentials (ADC) with chat.bot scope.
 * The Chat app must be registered in Google Workspace Admin Console.
 */

const { GoogleAuth } = require('google-auth-library');
const { logger } = require('firebase-functions');
const fetch = require('node-fetch');

const GCHAT_BASE_URL = 'https://chat.googleapis.com/v1';

let authClient = null;

/**
 * Get an authenticated client for Google Chat API
 * Uses ADC (Application Default Credentials) - works in Firebase Cloud Functions
 */
async function getAuthClient() {
  if (!authClient) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });
    authClient = await auth.getClient();
  }
  return authClient;
}

/**
 * Make an authenticated request to the Google Chat API
 * @param {string} endpoint - API endpoint (e.g. '/spaces')
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries on failure
 * @returns {Promise<object>} API response data
 */
async function gchatRequest(endpoint, options = {}, retries = 2) {
  const client = await getAuthClient();
  const accessToken = (await client.getAccessToken()).token;

  const url = endpoint.startsWith('http') ? endpoint : `${GCHAT_BASE_URL}${endpoint}`;
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
        logger.warn(`Google Chat API rate limited, waiting ${retryAfter}s before retry`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(`Google Chat API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.gchatError = data.error || data;
        throw error;
      }

      return data;
    } catch (err) {
      if (attempt === retries) {
        logger.error('Google Chat API request failed after retries', {
          endpoint,
          error: err.message,
          gchatError: err.gchatError,
        });
        throw err;
      }
      logger.warn(`Google Chat API attempt ${attempt + 1} failed, retrying...`, {
        endpoint,
        error: err.message,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Create a new Google Chat space
 * @param {string} displayName - Space display name
 * @param {string} spaceType - 'SPACE' for group, 'DIRECT_MESSAGE' for DM
 * @param {string} description - Space description
 * @returns {Promise<object>} Created space resource
 */
async function createSpace(displayName, spaceType = 'SPACE', description = '') {
  logger.info('Creating Google Chat space', { displayName, spaceType });

  return gchatRequest('/spaces', {
    method: 'POST',
    body: JSON.stringify({
      displayName,
      spaceType,
      singleUserBotDm: false,
      ...(description ? { spaceDetails: { description } } : {}),
    }),
  });
}

/**
 * Get a Google Chat space by name
 * @param {string} spaceName - Space resource name (e.g. 'spaces/AAAA...')
 * @returns {Promise<object>} Space resource
 */
async function getSpace(spaceName) {
  return gchatRequest(`/${spaceName}`, { method: 'GET' });
}

/**
 * List all spaces the bot has access to
 * @returns {Promise<Array>} List of space resources
 */
async function listSpaces() {
  const allSpaces = [];
  let pageToken = '';

  do {
    const url = `/spaces${pageToken ? `?pageToken=${pageToken}` : ''}`;
    const data = await gchatRequest(url, { method: 'GET' });
    if (data.spaces) {
      allSpaces.push(...data.spaces);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return allSpaces;
}

/**
 * Add a member (user or bot) to a space
 * @param {string} spaceName - Space resource name
 * @param {string} userEmail - Email address of the user to add
 * @returns {Promise<object>} Created membership resource
 */
async function createMember(spaceName, userEmail) {
  logger.info('Adding member to Google Chat space', { spaceName, userEmail });

  return gchatRequest(`/${spaceName}/members`, {
    method: 'POST',
    body: JSON.stringify({
      member: {
        name: `users/${userEmail}`,
        type: 'HUMAN',
      },
    }),
  });
}

/**
 * Remove a member from a space
 * @param {string} memberName - Member resource name (e.g. 'spaces/AAAA/members/BBBB')
 * @returns {Promise<object>} Empty response on success
 */
async function removeMember(memberName) {
  logger.info('Removing member from Google Chat space', { memberName });
  return gchatRequest(`/${memberName}`, { method: 'DELETE' });
}

/**
 * Send a text message to a space
 * @param {string} spaceName - Space resource name
 * @param {string} text - Message text (supports formatting)
 * @param {string} threadKey - Optional thread key for thread replies
 * @returns {Promise<object>} Created message resource
 */
async function sendMessage(spaceName, text, threadKey = null) {
  logger.info('Sending message to Google Chat space', { spaceName });

  const messageBody = { text };
  if (threadKey) {
    messageBody.thread = { threadKey };
  }

  const url = `/${spaceName}/messages${threadKey ? '?messageReplyOption=REPLY_MESSAGE_OR_FAIL' : ''}`;
  return gchatRequest(url, {
    method: 'POST',
    body: JSON.stringify(messageBody),
  });
}

/**
 * Send a card message to a space
 * Uses Google Chat Card v2 format
 * @param {string} spaceName - Space resource name
 * @param {Array} cardsV2 - Array of Card v2 objects
 * @param {string} threadKey - Optional thread key
 * @returns {Promise<object>} Created message resource
 */
async function sendCardMessage(spaceName, cardsV2, threadKey = null) {
  logger.info('Sending card message to Google Chat space', { spaceName });

  const messageBody = { cardsV2 };
  if (threadKey) {
    messageBody.thread = { threadKey };
  }

  const url = `/${spaceName}/messages${threadKey ? '?messageReplyOption=REPLY_MESSAGE_OR_FAIL' : ''}`;
  return gchatRequest(url, {
    method: 'POST',
    body: JSON.stringify(messageBody),
  });
}

/**
 * Update an existing message
 * @param {string} messageName - Message resource name
 * @param {string} text - Updated text
 * @param {Array} cardsV2 - Updated cards
 * @returns {Promise<object>} Updated message resource
 */
async function updateMessage(messageName, text = null, cardsV2 = null) {
  const updateMask = [];
  const body = {};

  if (text !== null) {
    body.text = text;
    updateMask.push('text');
  }
  if (cardsV2 !== null) {
    body.cardsV2 = cardsV2;
    updateMask.push('cardsV2');
  }

  return gchatRequest(`/${messageName}?updateMask=${updateMask.join(',')}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * List messages in a space
 * @param {string} spaceName - Space resource name
 * @param {number} pageSize - Max messages per page
 * @returns {Promise<Array>} List of message resources
 */
async function listMessages(spaceName, pageSize = 25) {
  const data = await gchatRequest(`/${spaceName}/messages?pageSize=${pageSize}`, { method: 'GET' });
  return data.messages || [];
}

module.exports = {
  gchatRequest,
  createSpace,
  getSpace,
  listSpaces,
  createMember,
  removeMember,
  sendMessage,
  sendCardMessage,
  updateMessage,
  listMessages,
};
