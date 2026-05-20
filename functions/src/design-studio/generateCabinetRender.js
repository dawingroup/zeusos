/**
 * generateCabinetRender — Cloud Function (HTTPS Callable)
 *
 * Generates a high-resolution render of a single cabinet.
 * In production, uses headless-gl for server-side Three.js rendering.
 * Current implementation generates a placeholder and stores render URL.
 *
 * Timeout: 45s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const generateCabinetRender = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 45,
    memory: '1GiB',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { sceneId, cabinetId, preset } = request.data || {};

    if (!sceneId || !cabinetId) {
      throw new HttpsError('invalid-argument', 'sceneId and cabinetId are required');
    }

    logger.info(`generateCabinetRender: scene=${sceneId}, cabinet=${cabinetId}, preset=${preset || 'product_catalog'}`);

    // Load cabinet data
    const cabRef = db.collection('designScenes').doc(sceneId)
      .collection('cabinets').doc(cabinetId);
    const cabSnap = await cabRef.get();

    if (!cabSnap.exists) {
      throw new HttpsError('not-found', `Cabinet ${cabinetId} not found in scene ${sceneId}`);
    }

    const cabData = cabSnap.data();

    if (!cabData.glbUrl) {
      throw new HttpsError('failed-precondition', 'Cabinet has no GLB model');
    }

    // In production, this would:
    // 1. Load the GLB using Three.js with headless-gl
    // 2. Set up product_catalog render preset (white bg, soft lighting, 3/4 view)
    // 3. Render to an offscreen canvas (800×600)
    // 4. Export as PNG
    // 5. Upload to Firebase Storage
    // For now, create a reference to the expected storage path

    const renderPath = `cabinet-renders/${sceneId}/${cabinetId}-${preset || 'product_catalog'}.png`;
    const renderUrl = `https://storage.googleapis.com/${bucket.name}/${renderPath}`;

    // Update cabinet with render URL
    await cabRef.update({
      renderUrl,
      renderPreset: preset || 'product_catalog',
      renderGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Render reference stored for cabinet ${cabData.cabinetCode}: ${renderPath}`);

    return {
      cabinetId,
      cabinetCode: cabData.cabinetCode,
      renderUrl,
      preset: preset || 'product_catalog',
    };
  },
);

module.exports = { generateCabinetRender };
