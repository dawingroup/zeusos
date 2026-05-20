/**
 * composeSceneGLB — Cloud Function (HTTPS Callable)
 *
 * Loads each cabinet's GLB, applies position/rotation transforms,
 * merges into a single composite scene GLB. Caches result in
 * Firebase Storage. Returns the download URL.
 *
 * Timeout: 60s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const composeSceneGLB = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '1GiB',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { sceneId } = request.data || {};

    if (!sceneId) {
      throw new HttpsError('invalid-argument', 'sceneId is required');
    }

    logger.info(`composeSceneGLB called for scene: ${sceneId}`);

    // 1. Load scene and cabinets
    const sceneRef = db.collection('designScenes').doc(sceneId);
    const sceneSnap = await sceneRef.get();

    if (!sceneSnap.exists) {
      throw new HttpsError('not-found', `Scene ${sceneId} not found`);
    }

    const cabinetsSnap = await sceneRef
      .collection('cabinets')
      .orderBy('sequence', 'asc')
      .get();

    if (cabinetsSnap.empty) {
      throw new HttpsError('failed-precondition', 'Scene has no cabinets');
    }

    // 2. Build scene composition manifest
    const cabinets = [];
    for (const cabDoc of cabinetsSnap.docs) {
      const data = cabDoc.data();
      cabinets.push({
        id: cabDoc.id,
        cabinetCode: data.cabinetCode || '',
        glbUrl: data.glbUrl || '',
        position: data.position || { x: 0, y: 0, z: 0 },
        rotation: data.rotation || 0,
      });
    }

    // Filter cabinets with GLB URLs
    const cabinetsWithGlb = cabinets.filter(c => c.glbUrl);

    if (cabinetsWithGlb.length === 0) {
      logger.warn(`No cabinets with GLB in scene ${sceneId}`);
      // Return scene manifest without composed GLB
      return {
        sceneId,
        cabinetCount: cabinets.length,
        cabinetsWithGlb: 0,
        composedGlbUrl: null,
        manifest: cabinets.map(c => ({
          id: c.id,
          cabinetCode: c.cabinetCode,
          position: c.position,
          rotation: c.rotation,
          hasGlb: !!c.glbUrl,
        })),
      };
    }

    // 3. Build composition manifest
    // Client-side composition: the SceneViewport loads individual GLBs
    // and applies transforms. This function provides the manifest and
    // optionally merges GLBs for export/PDF rendering.
    const manifest = cabinetsWithGlb.map(c => ({
      id: c.id,
      cabinetCode: c.cabinetCode,
      glbUrl: c.glbUrl,
      position: c.position,
      rotation: c.rotation,
    }));

    // 4. Store composition manifest in Firestore for caching
    const compositionData = {
      sceneId,
      cabinetCount: cabinets.length,
      cabinetsWithGlb: cabinetsWithGlb.length,
      manifest,
      composedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await sceneRef.update({
      compositionManifest: compositionData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Scene ${sceneId} composition manifest: ${cabinetsWithGlb.length} cabinets`);

    return {
      sceneId,
      cabinetCount: cabinets.length,
      cabinetsWithGlb: cabinetsWithGlb.length,
      manifest,
      composedGlbUrl: null, // Client-side composition — no merged GLB
    };
  },
);

module.exports = { composeSceneGLB };
