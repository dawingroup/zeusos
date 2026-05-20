/**
 * Push Notifications Cloud Functions
 * Send web push notifications for delivery updates, sync events, etc.
 */

const { onCall } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const webpush = require('web-push');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Define secrets for VAPID keys
const vapidPublicKey = defineSecret('VAPID_PUBLIC_KEY');
const vapidPrivateKey = defineSecret('VAPID_PRIVATE_KEY');

// VAPID subject (can be hardcoded as it's not sensitive)
const VAPID_SUBJECT = 'mailto:admin@dawinos.com';

// Initialize webpush lazily when secrets are available
let webpushInitialized = false;
function initializeWebpush() {
  if (webpushInitialized) return true;
  
  const publicKey = vapidPublicKey.value();
  const privateKey = vapidPrivateKey.value();
  
  if (publicKey && privateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
    webpushInitialized = true;
    console.log('[Push] VAPID keys configured');
    return true;
  }
  
  console.warn('[Push] VAPID keys not configured');
  return false;
}

/**
 * Send push notification to a specific user
 */
async function sendPushToUser(userId, payload) {
  if (!initializeWebpush()) {
    console.warn('[Push] Cannot send notification - VAPID keys not configured');
    return { success: false, error: 'VAPID keys not configured' };
  }

  try {
    // Get user's push subscription from Firestore
    const subscriptionDoc = await admin.firestore()
      .collection('push_subscriptions')
      .doc(userId)
      .get();

    if (!subscriptionDoc.exists) {
      console.log(`[Push] No subscription found for user ${userId}`);
      return { success: false, error: 'No subscription found' };
    }

    const subscriptionData = subscriptionDoc.data();
    const subscription = {
      endpoint: subscriptionData.endpoint,
      keys: subscriptionData.keys,
    };

    // Send the notification
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log(`[Push] Notification sent to user ${userId}`);
    
    return { success: true };
  } catch (error) {
    console.error(`[Push] Failed to send notification to user ${userId}:`, error);
    
    // If subscription is invalid, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await admin.firestore()
        .collection('push_subscriptions')
        .doc(userId)
        .delete();
      console.log(`[Push] Removed invalid subscription for user ${userId}`);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple users
 */
async function sendPushToUsers(userIds, payload) {
  const results = await Promise.allSettled(
    userIds.map(userId => sendPushToUser(userId, payload))
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;
  
  return { successful, failed, total: results.length };
}

/**
 * Send push notification to all project members
 */
async function sendPushToProject(projectId, payload, excludeUserId = null) {
  try {
    // Get project members
    const projectDoc = await admin.firestore()
      .collection('matflow_projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      return { success: false, error: 'Project not found' };
    }

    const project = projectDoc.data();
    const memberIds = [
      project.createdBy,
      ...(project.teamMembers || []).map(m => m.userId),
    ].filter(id => id && id !== excludeUserId);

    if (memberIds.length === 0) {
      return { success: true, message: 'No members to notify' };
    }

    return await sendPushToUsers(memberIds, payload);
  } catch (error) {
    console.error(`[Push] Failed to notify project ${projectId}:`, error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CLOUD FUNCTIONS
// ============================================================================

/**
 * HTTP endpoint to send a push notification
 * POST /sendPushNotification
 */
exports.sendPushNotification = onCall(
  { secrets: [vapidPublicKey, vapidPrivateKey], cors: ALLOWED_ORIGINS },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new Error('Must be authenticated');
    }

    const { userId, userIds, projectId, payload } = request.data;

    if (!payload) {
      throw new Error('Payload is required');
    }

    // Send to specific user
    if (userId) {
      return await sendPushToUser(userId, payload);
    }

    // Send to multiple users
    if (userIds && Array.isArray(userIds)) {
      return await sendPushToUsers(userIds, payload);
    }

    // Send to project members
    if (projectId) {
      return await sendPushToProject(projectId, payload, request.auth.uid);
    }

    throw new Error('Must provide userId, userIds, or projectId');
  }
);

/**
 * Trigger: Send notification when a delivery is logged
 */
exports.onDeliveryCreated = onDocumentCreated(
  {
    document: 'matflow_projects/{projectId}/deliveries/{deliveryId}',
    secrets: [vapidPublicKey, vapidPrivateKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    
    const delivery = snap.data();
    const { projectId, deliveryId } = event.params;

    // Get project name
    const projectDoc = await admin.firestore()
      .collection('matflow_projects')
      .doc(projectId)
      .get();
    
    const projectName = projectDoc.exists ? projectDoc.data().name : 'Project';

    const payload = {
      title: 'New Delivery Logged',
      body: `${delivery.materialName || 'Material'}: ${delivery.quantityReceived} ${delivery.unit || 'units'} from ${delivery.supplierName || 'supplier'}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `delivery-${deliveryId}`,
      data: {
        type: 'delivery',
        projectId,
        deliveryId,
        url: `/advisory/matflow/projects/${projectId}/deliveries/${deliveryId}`,
      },
    };

    // Notify project members (except the one who logged it)
    await sendPushToProject(projectId, payload, delivery.loggedBy);
    
    console.log(`[Push] Delivery notification sent for ${deliveryId}`);
  });

/**
 * Trigger: Send notification when procurement status changes
 */
exports.onProcurementStatusChange = onDocumentUpdated(
  {
    document: 'matflow_projects/{projectId}/procurement/{procurementId}',
    secrets: [vapidPublicKey, vapidPrivateKey],
  },
  async (event) => {
    const change = event.data;
    if (!change) return;
    
    const before = change.before.data();
    const after = change.after.data();
    const { projectId, procurementId } = event.params;

    // Only notify if status changed
    if (before.status === after.status) {
      return;
    }

    const payload = {
      title: `Procurement ${after.status}`,
      body: `${after.materialName || 'Item'} - ${after.status}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `procurement-${procurementId}`,
      data: {
        type: 'procurement',
        projectId,
        procurementId,
        status: after.status,
        url: `/advisory/matflow/projects/${projectId}/procurement`,
      },
    };

    // Notify the requestor
    if (after.requestedBy) {
      await sendPushToUser(after.requestedBy, payload);
    }

    console.log(`[Push] Procurement status notification sent for ${procurementId}`);
  });

/**
 * Trigger: Send notification for critical BOQ items
 */
exports.checkCriticalItems = onSchedule(
  {
    schedule: 'every 6 hours',
    secrets: [vapidPublicKey, vapidPrivateKey],
  },
  async () => {
    console.log('[Push] Checking for critical BOQ items...');

    // Find projects with critical items (< 20% procured)
    const projectsSnap = await admin.firestore()
      .collection('matflow_projects')
      .where('status', '==', 'active')
      .get();

    for (const projectDoc of projectsSnap.docs) {
      const projectId = projectDoc.id;
      const project = projectDoc.data();

      // Get BOQ items with low procurement
      const boqSnap = await admin.firestore()
        .collection('matflow_projects')
        .doc(projectId)
        .collection('boq_items')
        .get();

      const criticalItems = boqSnap.docs.filter(doc => {
        const item = doc.data();
        const progress = (item.procuredQuantity || 0) / (item.quantity || 1);
        return progress < 0.2 && item.quantity > 0;
      });

      if (criticalItems.length > 0) {
        const payload = {
          title: `${criticalItems.length} Critical Items`,
          body: `${project.name}: ${criticalItems.length} items below 20% procurement`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: `critical-${projectId}`,
          data: {
            type: 'critical',
            projectId,
            count: criticalItems.length,
            url: `/advisory/matflow/projects/${projectId}/boq?filter=critical`,
          },
        };

        await sendPushToProject(projectId, payload);
        console.log(`[Push] Critical items notification sent for project ${projectId}`);
      }
    }
  });

module.exports = {
  sendPushNotification: exports.sendPushNotification,
  onDeliveryCreated: exports.onDeliveryCreated,
  onProcurementStatusChange: exports.onProcurementStatusChange,
  checkCriticalItems: exports.checkCriticalItems,
};
