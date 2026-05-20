/**
 * Track Campaign Engagement Cloud Function
 * Listens to WhatsApp message status changes and updates campaign metrics
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CAMPAIGNS: 'marketingCampaigns',
  CONVERSATIONS: 'whatsappConversations',
};

/**
 * Update campaign send status based on message status
 */
async function updateSendStatus(campaignId, zokoMessageId, status, timestamp) {
  // Find the send record by zokoMessageId
  const sendsSnapshot = await db
    .collection(COLLECTIONS.CAMPAIGNS)
    .doc(campaignId)
    .collection('sends')
    .where('zokoMessageId', '==', zokoMessageId)
    .limit(1)
    .get();

  if (sendsSnapshot.empty) {
    logger.warn('Send record not found for message', { campaignId, zokoMessageId });
    return null;
  }

  const sendDoc = sendsSnapshot.docs[0];
  const sendData = sendDoc.data();

  // Only update if this is a newer status
  const statusHierarchy = ['sent', 'delivered', 'read', 'replied'];
  const currentStatusIndex = statusHierarchy.indexOf(sendData.status);
  const newStatusIndex = statusHierarchy.indexOf(status);

  if (newStatusIndex > currentStatusIndex) {
    const updates = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status === 'delivered') {
      updates.deliveredAt = timestamp || admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'read') {
      updates.readAt = timestamp || admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'replied') {
      updates.repliedAt = timestamp || admin.firestore.FieldValue.serverTimestamp();
    }

    await sendDoc.ref.update(updates);

    logger.info('Send status updated', {
      campaignId,
      sendId: sendDoc.id,
      oldStatus: sendData.status,
      newStatus: status,
    });

    return { sendId: sendDoc.id, oldStatus: sendData.status, newStatus: status };
  }

  return null;
}

/**
 * Recalculate campaign metrics from all sends
 */
async function recalculateCampaignMetrics(campaignId) {
  const sendsSnapshot = await db
    .collection(COLLECTIONS.CAMPAIGNS)
    .doc(campaignId)
    .collection('sends')
    .get();

  const sends = sendsSnapshot.docs.map(doc => doc.data());

  const metrics = {
    totalSent: sends.length,
    totalReached: sends.filter(s => s.status === 'delivered' || s.status === 'read' || s.status === 'replied').length,
    totalEngagements: sends.filter(s => s.status === 'replied').length,
    whatsappDelivered: sends.filter(s => s.status === 'delivered' || s.status === 'read' || s.status === 'replied').length,
    whatsappRead: sends.filter(s => s.status === 'read' || s.status === 'replied').length,
    whatsappReplied: sends.filter(s => s.status === 'replied').length,
  };

  // Calculate rates
  metrics.engagementRate = metrics.totalSent > 0
    ? metrics.totalEngagements / metrics.totalSent
    : 0;

  // Update campaign
  await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).update({
    metrics,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Campaign metrics updated', { campaignId, metrics });
  return metrics;
}

/**
 * Track Campaign Engagement - Firestore Trigger
 *
 * Listens to changes in whatsappConversations/{conversationId}/messages
 * and updates campaign send records and metrics
 */
const trackCampaignEngagement = onDocumentWritten(
  {
    document: 'whatsappConversations/{conversationId}/messages/{messageId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    const messageId = event.params.messageId;
    const conversationId = event.params.conversationId;

    // Get message data
    const messageData = event.data?.after?.data();
    if (!messageData) {
      // Message was deleted
      return;
    }

    // Only track outbound messages with zokoMessageId
    if (messageData.direction !== 'outbound' || !messageData.zokoMessageId) {
      return;
    }

    const zokoMessageId = messageData.zokoMessageId;
    const messageStatus = messageData.status;

    logger.info('Processing message status change', {
      messageId,
      conversationId,
      zokoMessageId,
      status: messageStatus,
    });

    try {
      // Find all campaign sends with this zokoMessageId
      const campaignsSnapshot = await db.collectionGroup('sends')
        .where('zokoMessageId', '==', zokoMessageId)
        .get();

      if (campaignsSnapshot.empty) {
        // This message is not part of any campaign
        return;
      }

      // Update all matching campaign sends
      const campaignIds = new Set();
      for (const sendDoc of campaignsSnapshot.docs) {
        const sendData = sendDoc.data();
        const campaignId = sendData.campaignId;
        campaignIds.add(campaignId);

        // Update send status based on message status
        const timestamp = messageData.updatedAt || admin.firestore.FieldValue.serverTimestamp();
        await updateSendStatus(campaignId, zokoMessageId, messageStatus, timestamp);
      }

      // Recalculate metrics for all affected campaigns
      for (const campaignId of campaignIds) {
        await recalculateCampaignMetrics(campaignId);
      }

      logger.info('Campaign engagement tracking completed', {
        zokoMessageId,
        affectedCampaigns: Array.from(campaignIds),
      });
    } catch (error) {
      logger.error('Failed to track campaign engagement', {
        messageId,
        zokoMessageId,
        error: error.message,
        stack: error.stack,
      });
      // Don't throw - we don't want to retry indefinitely
    }
  }
);

/**
 * Track Inbound Replies - Firestore Trigger
 *
 * Separately tracks when customers reply to campaign messages
 */
const trackCampaignReplies = onDocumentWritten(
  {
    document: 'whatsappConversations/{conversationId}/messages/{messageId}',
    region: 'us-central1',
    memory: '256MiB',
  },
  async (event) => {
    const messageId = event.params.messageId;
    const conversationId = event.params.conversationId;

    // Get message data
    const messageData = event.data?.after?.data();
    if (!messageData) {
      return;
    }

    // Only track inbound messages (customer replies)
    if (messageData.direction !== 'inbound') {
      return;
    }

    logger.info('Processing customer reply', {
      messageId,
      conversationId,
    });

    try {
      // Find recent campaign sends to this conversation
      const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const campaignSendsSnapshot = await db.collectionGroup('sends')
        .where('conversationId', '==', conversationId)
        .where('sentAt', '>', recentCutoff)
        .get();

      if (campaignSendsSnapshot.empty) {
        // No recent campaign sends to this conversation
        return;
      }

      // Update all matching sends to 'replied' status
      const campaignIds = new Set();
      for (const sendDoc of campaignSendsSnapshot.docs) {
        const sendData = sendDoc.data();

        // Only update if not already marked as replied
        if (sendData.status !== 'replied') {
          await sendDoc.ref.update({
            status: 'replied',
            repliedAt: messageData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          campaignIds.add(sendData.campaignId);

          logger.info('Send marked as replied', {
            campaignId: sendData.campaignId,
            sendId: sendDoc.id,
          });
        }
      }

      // Recalculate metrics for affected campaigns
      for (const campaignId of campaignIds) {
        await recalculateCampaignMetrics(campaignId);
      }

      logger.info('Campaign reply tracking completed', {
        conversationId,
        affectedCampaigns: Array.from(campaignIds),
      });
    } catch (error) {
      logger.error('Failed to track campaign reply', {
        messageId,
        conversationId,
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

module.exports = {
  trackCampaignEngagement,
  trackCampaignReplies,
};
