/**
 * createMOsForScene — Cloud Function (HTTPS Callable)
 *
 * Creates one Manufacturing Order per cabinet in the scene.
 * Locks each cabinet on success with MDP and MO references.
 *
 * Timeout: 120s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

const createMOsForScene = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { sceneId, priority, projectId } = request.data || {};
    if (!sceneId) throw new HttpsError('invalid-argument', 'sceneId is required');

    const sceneRef = db.collection('designScenes').doc(sceneId);
    const sceneSnap = await sceneRef.get();
    if (!sceneSnap.exists) throw new HttpsError('not-found', `Scene ${sceneId} not found`);

    const cabinetsSnap = await sceneRef
      .collection('cabinets')
      .orderBy('sequence')
      .get();

    if (cabinetsSnap.empty) {
      throw new HttpsError('failed-precondition', 'Scene has no cabinets');
    }

    // Filter to unlocked cabinets only
    const unlockedCabs = cabinetsSnap.docs.filter(d => !d.data().isLocked);
    if (unlockedCabs.length === 0) {
      throw new HttpsError('failed-precondition', 'All cabinets are already locked');
    }

    logger.info(`createMOsForScene: ${unlockedCabs.length} cabinets to process`);

    const results = [];
    const errors = [];

    for (const cabDoc of unlockedCabs) {
      const data = cabDoc.data();
      const cabinetId = cabDoc.id;

      try {
        // Create MDP document
        const mdpData = {
          pddId: data.pddId,
          configuration: data.configuration || {},
          finishSelections: data.finishSelections || {},
          bom: data.computedBOM || [],
          pricingBreakdown: data.estimatedPrice || {},
          sceneId,
          cabinetId,
          cabinetCode: data.cabinetCode,
          status: 'generated',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };

        const mdpRef = await db.collection('manufacturingDataPackages').add(mdpData);

        // Create Manufacturing Order
        const moData = {
          type: 'manufacturing',
          status: 'draft',
          priority: priority || 'medium',
          projectId: projectId || sceneSnap.data().projectId || '',
          sceneId,
          cabinetId,
          cabinetCode: data.cabinetCode,
          displayName: data.displayName || data.cabinetCode,
          mdpId: mdpRef.id,
          bom: data.computedBOM || [],
          pricingBreakdown: data.estimatedPrice || {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const moRef = await db.collection('manufacturingOrders').add(moData);

        // Lock cabinet
        await cabDoc.ref.update({
          isLocked: true,
          mdpId: mdpRef.id,
          manufacturingOrderId: moRef.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        results.push({
          cabinetId,
          cabinetCode: data.cabinetCode,
          mdpId: mdpRef.id,
          moId: moRef.id,
        });

        logger.info(`MO created for cabinet ${data.cabinetCode}: ${moRef.id}`);
      } catch (err) {
        errors.push({
          cabinetId,
          cabinetCode: data.cabinetCode,
          error: err.message,
        });
        logger.error(`Failed to create MO for ${data.cabinetCode}: ${err.message}`);
      }
    }

    // Update scene status
    if (results.length > 0) {
      const allLocked = (cabinetsSnap.size - unlockedCabs.length + results.length) === cabinetsSnap.size;
      await sceneRef.update({
        status: allLocked ? 'in_production' : 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Fire business event
      await db.collection('businessEvents').add({
        type: 'scene.mos_created',
        sceneId,
        sceneName: sceneSnap.data().name,
        moCount: results.length,
        results,
        errors,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      sceneId,
      created: results.length,
      failed: errors.length,
      results,
      errors,
    };
  },
);

module.exports = { createMOsForScene };
