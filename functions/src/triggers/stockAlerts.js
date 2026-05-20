/**
 * Stock Alert Triggers - DawinOS v2.0
 * Scheduled function to scan for low stock levels and emit alerts
 * Runs every 6 hours
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Scheduled: Check for low stock levels every 6 hours
 * Scans stockLevels collection for items below reorder level
 * Creates business events for stock_level_critical alerts
 */
exports.checkLowStockLevels = onSchedule(
  {
    schedule: 'every 6 hours',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    logger.info('Starting low stock level scan...');

    try {
      // Get all stock levels that have a reorder level set
      const stockLevelsSnap = await db.collection('stockLevels')
        .where('reorderLevel', '>', 0)
        .get();

      if (stockLevelsSnap.empty) {
        logger.info('No stock levels with reorder thresholds found.');
        return;
      }

      let alertCount = 0;
      const batch = db.batch();

      for (const doc of stockLevelsSnap.docs) {
        const sl = doc.data();

        // Check if available quantity is at or below reorder level
        if (sl.quantityAvailable <= sl.reorderLevel) {
          // Check if we already emitted an alert for this item recently (within 24 hours)
          const recentAlerts = await db.collection('businessEvents')
            .where('eventType', '==', 'stock_level_critical')
            .where('entityId', '==', sl.inventoryItemId)
            .where('createdAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .limit(1)
            .get();

          if (!recentAlerts.empty) {
            // Already alerted within 24 hours, skip
            continue;
          }

          // Create business event
          const eventRef = db.collection('businessEvents').doc();
          batch.set(eventRef, {
            eventType: 'stock_level_critical',
            category: 'inventory',
            severity: sl.quantityAvailable <= 0 ? 'critical' : 'high',
            sourceModule: 'manufacturing',
            subsidiary: 'finishes',
            entityType: 'inventory_item',
            entityId: sl.inventoryItemId,
            entityName: sl.itemName || sl.sku,
            projectId: null,
            projectName: null,
            title: `Low Stock Alert: ${sl.itemName || sl.sku}`,
            description: `Stock level critical at warehouse ${sl.warehouseId}. Available: ${sl.quantityAvailable}, Reorder Level: ${sl.reorderLevel}. On Hand: ${sl.quantityOnHand}, Reserved: ${sl.quantityReserved}.`,
            previousState: null,
            currentState: {
              quantityOnHand: sl.quantityOnHand,
              quantityReserved: sl.quantityReserved,
              quantityAvailable: sl.quantityAvailable,
              reorderLevel: sl.reorderLevel,
            },
            changedFields: [],
            triggeredBy: 'system',
            triggeredByName: 'Stock Alert System',
            metadata: {
              sku: sl.sku,
              warehouseId: sl.warehouseId,
              quantityOnHand: sl.quantityOnHand,
              quantityReserved: sl.quantityReserved,
              quantityAvailable: sl.quantityAvailable,
              reorderLevel: sl.reorderLevel,
              shortfall: sl.reorderLevel - sl.quantityAvailable,
            },
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            processedAt: null,
          });

          alertCount++;
        }
      }

      if (alertCount > 0) {
        await batch.commit();
        logger.info(`Created ${alertCount} low stock alerts.`);
      } else {
        logger.info('No low stock items found.');
      }
    } catch (error) {
      logger.error('Error scanning low stock levels:', error);
      throw error;
    }
  }
);
