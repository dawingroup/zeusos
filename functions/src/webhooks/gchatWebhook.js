/**
 * Google Chat Webhook Handler
 * Receives events from Google Chat when users interact with the bot
 *
 * Events: ADDED_TO_SPACE, MESSAGE, CARD_CLICKED, REMOVED_FROM_SPACE
 * Authentication: Bearer token from Google (verified via google-auth-library)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  SPACES: 'gchatSpaces',
  CONFIG: 'systemConfig',
};

// Google Chat sends requests with a Bearer token signed by Google
const CHAT_ISSUER = 'chat@system.gserviceaccount.com';

/**
 * Verify the Bearer token from Google Chat
 * @param {string} token - Bearer token from Authorization header
 * @returns {Promise<boolean>} Whether the token is valid
 */
async function verifyGoogleChatToken(token) {
  if (!token) return false;

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
    });
    const payload = ticket.getPayload();
    return payload?.email === CHAT_ISSUER;
  } catch (err) {
    logger.warn('Google Chat token verification failed', { error: err.message });
    return false;
  }
}

/**
 * Handle bot being added to a space
 */
async function handleBotAddedToSpace(event) {
  const space = event.space;
  if (!space?.name) return;

  const spaceId = space.name.replace('spaces/', '');

  await db.collection(COLLECTIONS.SPACES).doc(spaceId).set(
    {
      spaceName: space.name,
      displayName: space.displayName || 'Direct Message',
      spaceType: space.spaceType || space.type || 'SPACE',
      description: space.spaceDetails?.description || '',
      type: 'general',
      members: [],
      memberCount: 0,
      status: 'active',
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageText: 'Bot added to space',
      unreadCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  logger.info('Bot added to Google Chat space', { spaceName: space.name });
}

/**
 * Handle an inbound message from a user
 */
async function handleInboundMessage(event) {
  const space = event.space;
  const message = event.message;
  const user = event.user;

  if (!space?.name || !message) return;

  const spaceId = space.name.replace('spaces/', '');
  const messageId = message.name?.split('/').pop() || admin.firestore().collection('_').doc().id;

  // Store the message
  await db
    .collection(COLLECTIONS.SPACES)
    .doc(spaceId)
    .collection('messages')
    .doc(messageId)
    .set({
      id: messageId,
      gchatMessageName: message.name || '',
      direction: 'inbound',
      senderType: 'human',
      senderEmail: user?.email || '',
      senderName: user?.displayName || user?.email || 'Unknown',
      messageType: message.cardsV2 ? 'card' : 'text',
      textContent: message.argumentText || message.text || '',
      cardPayload: message.cardsV2 || null,
      threadName: message.thread?.name || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Update space metadata
  await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageText: (message.argumentText || message.text || '').substring(0, 200),
    unreadCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Google Chat message received', {
    spaceName: space.name,
    senderEmail: user?.email,
  });
}

/**
 * Handle a card button click / interaction
 * Returns an updated card or action response
 */
function handleCardInteraction(event) {
  const action = event.action;
  const actionName = action?.actionMethodName || '';

  logger.info('Google Chat card interaction', {
    actionName,
    spaceName: event.space?.name,
  });

  switch (actionName) {
    case 'acknowledge_incident':
      return {
        actionResponse: {
          type: 'UPDATE_MESSAGE',
        },
        cardsV2: [
          {
            cardId: 'incident-acknowledged',
            card: {
              header: {
                title: 'Incident Acknowledged',
                subtitle: `by ${event.user?.displayName || 'Unknown'}`,
              },
              sections: [
                {
                  widgets: [
                    {
                      decoratedText: {
                        text: `Acknowledged at ${new Date().toISOString()}`,
                        startIcon: { knownIcon: 'CONFIRMATION_NUMBER_ICON' },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

    case 'resolve_incident':
      return {
        actionResponse: {
          type: 'UPDATE_MESSAGE',
        },
        cardsV2: [
          {
            cardId: 'incident-resolved',
            card: {
              header: {
                title: 'Incident Resolved',
                subtitle: `by ${event.user?.displayName || 'Unknown'}`,
              },
              sections: [
                {
                  widgets: [
                    {
                      decoratedText: {
                        text: `Resolved at ${new Date().toISOString()}`,
                        startIcon: { knownIcon: 'CONFIRMATION_NUMBER_ICON' },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

    default:
      return {
        actionResponse: { type: 'NEW_MESSAGE' },
        text: `Action "${actionName}" received.`,
      };
  }
}

/**
 * Handle bot being removed from a space
 */
async function handleBotRemovedFromSpace(event) {
  const space = event.space;
  if (!space?.name) return;

  const spaceId = space.name.replace('spaces/', '');

  await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
    status: 'archived',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Bot removed from Google Chat space', { spaceName: space.name });
}

/**
 * Google Chat Webhook - HTTP endpoint
 * Receives all Chat events (messages, card interactions, space events)
 */
const gchatWebhook = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify the Google Chat token
    const token = req.headers.authorization?.split('Bearer ')[1];
    const isValid = await verifyGoogleChatToken(token);
    if (!isValid) {
      logger.warn('Google Chat webhook authentication failed');
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const event = req.body;
    const eventType = event.type;

    logger.info('Google Chat webhook received', { type: eventType, space: event.space?.name });

    try {
      switch (eventType) {
        case 'ADDED_TO_SPACE':
          await handleBotAddedToSpace(event);
          return res.status(200).json({ text: 'Hello! DawinOS bot is ready to assist your team.' });

        case 'MESSAGE':
          await handleInboundMessage(event);
          return res.status(200).json({});

        case 'CARD_CLICKED':
          const cardResponse = handleCardInteraction(event);
          return res.status(200).json(cardResponse);

        case 'REMOVED_FROM_SPACE':
          await handleBotRemovedFromSpace(event);
          return res.status(200).json({});

        default:
          logger.info('Unhandled Google Chat event type', { eventType });
          return res.status(200).json({});
      }
    } catch (err) {
      logger.error('Error processing Google Chat webhook', { error: err.message, stack: err.stack });
      return res.status(200).json({ text: 'An error occurred processing your request.' });
    }
  }
);

module.exports = {
  gchatWebhook,
};
