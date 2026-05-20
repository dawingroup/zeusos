/**
 * Aggregate Campaign Analytics Cloud Function
 * Scheduled function that aggregates campaign metrics for efficient dashboard queries
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CAMPAIGNS: 'marketingCampaigns',
  ANALYTICS: 'campaignAnalytics',
};

/**
 * Calculate aggregated metrics for a company
 */
async function aggregateCompanyMetrics(companyId) {
  // Get all campaigns for the company
  const campaignsSnapshot = await db
    .collection(COLLECTIONS.CAMPAIGNS)
    .where('companyId', '==', companyId)
    .get();

  if (campaignsSnapshot.empty) {
    return null;
  }

  const campaigns = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Calculate overall metrics
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

  const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics?.totalSent || 0), 0);
  const totalReached = campaigns.reduce((sum, c) => sum + (c.metrics?.totalReached || 0), 0);
  const totalEngagements = campaigns.reduce((sum, c) => sum + (c.metrics?.totalEngagements || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.metrics?.totalConversions || 0), 0);

  const avgEngagementRate = totalSent > 0 ? totalEngagements / totalSent : 0;
  const avgConversionRate = totalSent > 0 ? totalConversions / totalSent : 0;

  // WhatsApp-specific metrics
  const whatsappCampaigns = campaigns.filter(
    c => c.campaignType === 'whatsapp' || c.campaignType === 'hybrid'
  );
  const totalWhatsAppDelivered = whatsappCampaigns.reduce(
    (sum, c) => sum + (c.metrics?.whatsappDelivered || 0),
    0
  );
  const totalWhatsAppRead = whatsappCampaigns.reduce(
    (sum, c) => sum + (c.metrics?.whatsappRead || 0),
    0
  );
  const totalWhatsAppReplied = whatsappCampaigns.reduce(
    (sum, c) => sum + (c.metrics?.whatsappReplied || 0),
    0
  );

  // Calculate metrics by campaign type
  const metricsByType = {
    whatsapp: calculateTypeMetrics(campaigns.filter(c => c.campaignType === 'whatsapp')),
    social_media: calculateTypeMetrics(campaigns.filter(c => c.campaignType === 'social_media')),
    product_promotion: calculateTypeMetrics(campaigns.filter(c => c.campaignType === 'product_promotion')),
    hybrid: calculateTypeMetrics(campaigns.filter(c => c.campaignType === 'hybrid')),
  };

  // Top performing campaigns (by engagement rate)
  const topCampaigns = campaigns
    .filter(c => c.metrics?.totalSent > 0)
    .sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate)
    .slice(0, 10)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.campaignType,
      status: c.status,
      sent: c.metrics.totalSent,
      engagementRate: c.metrics.engagementRate,
      conversionRate: c.metrics.conversionRate,
    }));

  // Recent campaigns (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCampaigns = campaigns.filter(c => {
    const createdAt = c.createdAt?.toDate?.() || new Date(0);
    return createdAt >= thirtyDaysAgo;
  });

  return {
    companyId,
    period: 'all_time',
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),

    // Overview metrics
    totalCampaigns,
    activeCampaigns,
    completedCampaigns,

    // Performance metrics
    totalSent,
    totalReached,
    totalEngagements,
    totalConversions,
    avgEngagementRate,
    avgConversionRate,

    // WhatsApp metrics
    totalWhatsAppDelivered,
    totalWhatsAppRead,
    totalWhatsAppReplied,
    whatsappDeliveryRate: totalSent > 0 ? totalWhatsAppDelivered / totalSent : 0,
    whatsappReadRate: totalWhatsAppDelivered > 0 ? totalWhatsAppRead / totalWhatsAppDelivered : 0,
    whatsappReplyRate: totalWhatsAppDelivered > 0 ? totalWhatsAppReplied / totalWhatsAppDelivered : 0,

    // Metrics by type
    metricsByType,

    // Top performers
    topCampaigns,

    // Recent activity
    recentCampaignsCount: recentCampaigns.length,
    last30DaysSent: recentCampaigns.reduce((sum, c) => sum + (c.metrics?.totalSent || 0), 0),
    last30DaysEngagements: recentCampaigns.reduce((sum, c) => sum + (c.metrics?.totalEngagements || 0), 0),
  };
}

/**
 * Calculate metrics for campaigns of a specific type
 */
function calculateTypeMetrics(campaigns) {
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((sum, c) => sum + (c.metrics?.totalSent || 0), 0);
  const totalEngagements = campaigns.reduce((sum, c) => sum + (c.metrics?.totalEngagements || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.metrics?.totalConversions || 0), 0);

  return {
    totalCampaigns,
    totalSent,
    totalEngagements,
    totalConversions,
    avgEngagementRate: totalSent > 0 ? totalEngagements / totalSent : 0,
    avgConversionRate: totalSent > 0 ? totalConversions / totalSent : 0,
  };
}

/**
 * Aggregate Campaign Analytics - Scheduled Function
 * Runs daily at 2 AM UTC to aggregate campaign metrics
 */
const aggregateCampaignAnalytics = onSchedule(
  {
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes
  },
  async (event) => {
    logger.info('Starting campaign analytics aggregation');

    try {
      // Get all unique company IDs from campaigns
      const campaignsSnapshot = await db.collection(COLLECTIONS.CAMPAIGNS).get();
      const companyIds = new Set();
      campaignsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.companyId) {
          companyIds.add(data.companyId);
        }
      });

      logger.info(`Found ${companyIds.size} companies with campaigns`);

      // Aggregate metrics for each company
      const results = [];
      for (const companyId of companyIds) {
        try {
          const metrics = await aggregateCompanyMetrics(companyId);

          if (metrics) {
            // Store aggregated metrics
            const docId = `${companyId}_all_time`;
            await db.collection(COLLECTIONS.ANALYTICS).doc(docId).set(metrics, { merge: true });

            results.push({ companyId, success: true });
            logger.info(`Aggregated metrics for company: ${companyId}`);
          }
        } catch (error) {
          logger.error(`Failed to aggregate metrics for company: ${companyId}`, {
            error: error.message,
          });
          results.push({ companyId, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Campaign analytics aggregation completed', {
        totalCompanies: companyIds.size,
        successCount,
        failureCount,
      });

      return {
        success: true,
        totalCompanies: companyIds.size,
        successCount,
        failureCount,
        results,
      };
    } catch (error) {
      logger.error('Campaign analytics aggregation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
);

/**
 * Manual Trigger for Aggregation - Callable Function
 * Allows manual triggering of analytics aggregation for testing
 */
const triggerCampaignAnalytics = require('firebase-functions/v2/https').onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new Error('Unauthenticated');
    }

    // Check if user is admin
    const userRecord = await admin.auth().getUser(uid);
    const claims = userRecord.customClaims || {};
    if (!claims.admin && claims.role !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    logger.info('Manual analytics aggregation triggered', { uid });

    try {
      // Get company ID from request or aggregate for all
      const { companyId } = request.data || {};

      if (companyId) {
        // Aggregate for specific company
        const metrics = await aggregateCompanyMetrics(companyId);
        if (metrics) {
          const docId = `${companyId}_all_time`;
          await db.collection(COLLECTIONS.ANALYTICS).doc(docId).set(metrics, { merge: true });
          return { success: true, companyId, metrics };
        }
        return { success: false, companyId, error: 'No campaigns found' };
      } else {
        // Aggregate for all companies (similar to scheduled function)
        const campaignsSnapshot = await db.collection(COLLECTIONS.CAMPAIGNS).get();
        const companyIds = new Set();
        campaignsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.companyId) companyIds.add(data.companyId);
        });

        const results = [];
        for (const cId of companyIds) {
          try {
            const metrics = await aggregateCompanyMetrics(cId);
            if (metrics) {
              const docId = `${cId}_all_time`;
              await db.collection(COLLECTIONS.ANALYTICS).doc(docId).set(metrics, { merge: true });
              results.push({ companyId: cId, success: true });
            }
          } catch (error) {
            results.push({ companyId: cId, success: false, error: error.message });
          }
        }

        return {
          success: true,
          totalCompanies: companyIds.size,
          results,
        };
      }
    } catch (error) {
      logger.error('Manual analytics aggregation failed', { error: error.message });
      throw new Error(`Aggregation failed: ${error.message}`);
    }
  }
);

module.exports = {
  aggregateCampaignAnalytics,
  triggerCampaignAnalytics,
};
