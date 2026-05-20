/**
 * validateSceneForProduction — Cloud Function (HTTPS Callable)
 *
 * Bulk validates all parts in a scene. Returns processability
 * issues by cabinet. Required check before bulk MO creation.
 *
 * Timeout: 30s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

const validateSceneForProduction = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { sceneId } = request.data || {};
    if (!sceneId) throw new HttpsError('invalid-argument', 'sceneId is required');

    const sceneSnap = await db.collection('designScenes').doc(sceneId).get();
    if (!sceneSnap.exists) throw new HttpsError('not-found', `Scene ${sceneId} not found`);

    const cabinetsSnap = await db.collection('designScenes').doc(sceneId)
      .collection('cabinets').orderBy('sequence').get();

    const issuesByCabinet = {};
    let totalIssues = 0;

    for (const cabDoc of cabinetsSnap.docs) {
      const data = cabDoc.data();
      const issues = [];

      // Check cabinet has PDD
      if (!data.pddId) issues.push('No PDD assigned');

      // Check cabinet has BOM
      if (!data.computedBOM || data.computedBOM.length === 0) {
        issues.push('No BOM computed — run constraint validation first');
      }

      // Check cabinet has GLB
      if (!data.glbUrl) issues.push('No 3D model (GLB) generated');

      // Check assembly summary
      const assemblySummary = data.assemblySummary || [];
      const incomplete = assemblySummary.filter(a => !a.isComplete);
      if (incomplete.length > 0) {
        issues.push(`${incomplete.length} incomplete assembl${incomplete.length === 1 ? 'y' : 'ies'}`);
      }

      // Check ModelPackage exists and confidence is acceptable
      if (!data.packageId) {
        issues.push('Model not processed yet — run AI processing first');
      } else if (typeof data.groupingConfidence === 'number' && data.groupingConfidence < 0.7) {
        issues.push(`Grouping confidence is low (${Math.round(data.groupingConfidence * 100)}%) — review assemblies before production`);
      }

      if (issues.length > 0) {
        issuesByCabinet[cabDoc.id] = {
          cabinetCode: data.cabinetCode || cabDoc.id,
          displayName: data.displayName || '',
          issues,
        };
        totalIssues += issues.length;
      }
    }

    const ready = totalIssues === 0;

    logger.info(`Scene ${sceneId} validation: ${ready ? 'READY' : `${totalIssues} issues`}`);

    return {
      sceneId,
      ready,
      totalCabinets: cabinetsSnap.size,
      totalIssues,
      issuesByCabinet,
    };
  },
);

module.exports = { validateSceneForProduction };
