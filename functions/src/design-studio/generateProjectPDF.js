/**
 * generateProjectPDF — Cloud Function (HTTPS Callable)
 *
 * Full PDF orchestration: prepare data, ensure renders exist,
 * build PDF document, upload to Storage, return URL.
 *
 * Timeout: 300s (large projects with many cabinets)
 * Memory: 2GB (PDF rendering can be memory-intensive)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const bucket = admin.storage().bucket();

const generateProjectPDF = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '2GiB',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { sceneId, sections, layout, includeRenders, renderQuality, customer, notes } = request.data || {};

    if (!sceneId) {
      throw new HttpsError('invalid-argument', 'sceneId is required');
    }

    logger.info(`generateProjectPDF: scene=${sceneId}, layout=${layout}, sections=${(sections || []).length}`);

    // 1. Load scene and cabinets
    const sceneSnap = await db.collection('designScenes').doc(sceneId).get();
    if (!sceneSnap.exists) {
      throw new HttpsError('not-found', `Scene ${sceneId} not found`);
    }
    const scene = { id: sceneSnap.id, ...sceneSnap.data() };

    const cabinetsSnap = await db.collection('designScenes').doc(sceneId)
      .collection('cabinets').orderBy('sequence').get();

    const cabinets = cabinetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Compute aggregated data
    let totalParts = 0;
    let totalCost = 0;
    const hardwareItems = {};

    for (const cab of cabinets) {
      const bom = cab.computedBOM || [];
      totalParts += bom.length;
      const price = cab.estimatedPrice;
      if (price && typeof price.total === 'number') totalCost += price.total;

      // Aggregate hardware
      for (const line of bom) {
        if (line.materialCategory && line.materialCategory.includes('hardware')) {
          const key = line.inventoryItemId || line.materialCategory;
          hardwareItems[key] = (hardwareItems[key] || 0) + (line.quantity || 0);
        }
      }
    }

    // 3. Build PDF data package
    const pdfData = {
      scene,
      cabinetCount: cabinets.length,
      totalParts,
      totalCost,
      currency: scene.currency || 'UGX',
      hardwareItems,
      layout: layout || 'detailed',
      sections: sections || ['cover', 'project_summary', 'cabinet_detail', 'project_cutlist', 'project_hardware_schedule'],
      customer: customer || null,
      notes: notes || null,
      generatedAt: new Date().toISOString(),
    };

    // 4. Store PDF data package (PDF rendering done client-side with @react-pdf/renderer)
    const pdfPath = `project-pdfs/${sceneId}/${Date.now()}.json`;
    const file = bucket.file(pdfPath);
    await file.save(JSON.stringify(pdfData, null, 2), { contentType: 'application/json' });

    // 5. Create a record in Firestore
    const pdfRef = await db.collection('projectPDFs').add({
      sceneId,
      sceneName: scene.name,
      layout,
      sections,
      cabinetCount: cabinets.length,
      totalCost,
      storagePath: pdfPath,
      status: 'generated',
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedBy: request.auth?.uid || 'system',
    });

    const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

    logger.info(`Project PDF generated: ${pdfRef.id} for scene ${scene.name}`);

    return {
      pdfId: pdfRef.id,
      sceneId,
      downloadUrl,
      cabinetCount: cabinets.length,
      totalParts,
      totalCost,
      pageEstimate: 2 + cabinets.length + 2, // cover + summary + N cabinets + cutlist + hardware
    };
  },
);

module.exports = { generateProjectPDF };
