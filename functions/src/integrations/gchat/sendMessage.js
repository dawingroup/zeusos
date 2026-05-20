/**
 * Google Chat - Send Message Cloud Functions
 * Callable functions for sending messages to Google Chat spaces
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const gchatClient = require('./gchatClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  SPACES: 'gchatSpaces',
};

/**
 * Send a message to a Google Chat space
 */
const sendGChatMessage = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { spaceId, text, cardsV2, threadKey } = request.data;

    if (!spaceId) {
      throw new HttpsError('invalid-argument', 'Space ID is required');
    }
    if (!text && !cardsV2) {
      throw new HttpsError('invalid-argument', 'Message text or cards required');
    }

    try {
      const spaceDoc = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get();
      if (!spaceDoc.exists) {
        throw new HttpsError('not-found', 'Space not found');
      }

      const spaceData = spaceDoc.data();
      let result;

      if (cardsV2) {
        result = await gchatClient.sendCardMessage(spaceData.spaceName, cardsV2, threadKey);
      } else {
        result = await gchatClient.sendMessage(spaceData.spaceName, text, threadKey);
      }

      // Store outbound message in Firestore
      const messageId = result.name?.split('/').pop() || db.collection('_').doc().id;
      await db
        .collection(COLLECTIONS.SPACES)
        .doc(spaceId)
        .collection('messages')
        .doc(messageId)
        .set({
          id: messageId,
          gchatMessageName: result.name || '',
          direction: 'outbound',
          senderType: 'bot',
          senderEmail: request.auth.token.email || '',
          senderName: request.auth.token.name || 'DawinOS Bot',
          messageType: cardsV2 ? 'card' : 'text',
          textContent: text || '',
          cardPayload: cardsV2 || null,
          threadName: result.thread?.name || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update space metadata
      await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageText: (text || '[Card]').substring(0, 200),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        messageName: result.name,
        messageId,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('Failed to send Google Chat message', { error: err.message });
      throw new HttpsError('internal', 'Failed to send message');
    }
  }
);

/**
 * Create a new Google Chat space with optional members
 */
const createGChatSpace = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { displayName, description, members = [], type = 'general', projectId } = request.data;

    if (!displayName) {
      throw new HttpsError('invalid-argument', 'Display name is required');
    }

    try {
      const space = await gchatClient.createSpace(displayName, 'SPACE', description || '');

      // Add members
      const addedMembers = [];
      for (const email of members) {
        try {
          await gchatClient.createMember(space.name, email);
          addedMembers.push(email);
        } catch (err) {
          logger.warn('Failed to add member', { email, error: err.message });
        }
      }

      // Store in Firestore
      const spaceId = space.name.replace('spaces/', '');
      await db.collection(COLLECTIONS.SPACES).doc(spaceId).set({
        spaceName: space.name,
        displayName,
        spaceType: 'SPACE',
        description: description || '',
        type,
        projectId: projectId || null,
        members: addedMembers,
        memberCount: addedMembers.length,
        status: 'active',
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        lastMessageText: 'Space created',
        unreadCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
      });

      return {
        success: true,
        spaceName: space.name,
        spaceId,
        membersAdded: addedMembers,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('Failed to create Google Chat space', { error: err.message });
      throw new HttpsError('internal', 'Failed to create space');
    }
  }
);

/**
 * Add or remove members from a Google Chat space
 */
const manageGChatMembers = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { spaceId, action, email } = request.data;

    if (!spaceId || !action || !email) {
      throw new HttpsError('invalid-argument', 'Space ID, action, and email are required');
    }

    try {
      const spaceDoc = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get();
      if (!spaceDoc.exists) {
        throw new HttpsError('not-found', 'Space not found');
      }

      const spaceData = spaceDoc.data();

      if (action === 'add') {
        await gchatClient.createMember(spaceData.spaceName, email);
        await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
          members: admin.firestore.FieldValue.arrayUnion(email),
          memberCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (action === 'remove') {
        // Note: We'd need the member resource name to remove
        // For now, update Firestore
        await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
          members: admin.firestore.FieldValue.arrayRemove(email),
          memberCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        throw new HttpsError('invalid-argument', 'Action must be "add" or "remove"');
      }

      return { success: true, action, email };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('Failed to manage Google Chat members', { error: err.message });
      throw new HttpsError('internal', 'Failed to manage members');
    }
  }
);

module.exports = {
  sendGChatMessage,
  createGChatSpace,
  manageGChatMembers,
};
