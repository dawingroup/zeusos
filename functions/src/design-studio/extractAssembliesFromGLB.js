/**
 * extractAssembliesFromGLB — Cloud Function (HTTPS Callable)
 *
 * Parses GLB scene graph, identifies named groups,
 * maps to assembly types using DKB patterns.
 * Returns assembly structure for a cabinet.
 *
 * Timeout: 30s
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();

/**
 * Detect assembly type from a mesh/group name.
 */
function detectAssemblyType(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('door') || lower.includes('front_panel')) return 'door_assembly';
  if (lower.includes('drawer') && !lower.includes('front')) return 'drawer_box';
  if (lower.includes('drawer_front') || lower.includes('drawer-front')) return 'drawer_front';
  if (lower.includes('shelf') || lower.includes('shelv')) return 'shelf_pack';
  if (lower.includes('plinth') || lower.includes('kickboard')) return 'plinth_assembly';
  if (lower.includes('cornice') || lower.includes('pelmet')) return 'cornice_run';
  if (lower.includes('hinge') || lower.includes('handle') || lower.includes('slide')
    || lower.includes('runner') || lower.includes('cam_lock')) return 'hardware_kit';
  if (lower.includes('side') || lower.includes('bottom') || lower.includes('top_rail')
    || lower.includes('back') || lower.includes('carcass')) return 'carcass';
  return null;
}

const ASSEMBLY_NAMES = {
  carcass: 'Main Carcass',
  drawer_box: 'Drawer Box',
  door_assembly: 'Door Assembly',
  drawer_front: 'Drawer Front',
  shelf_pack: 'Shelf Pack',
  hardware_kit: 'Hardware Kit',
  plinth_assembly: 'Plinth Assembly',
  cornice_run: 'Cornice Run',
  panel_run: 'Panel Run',
  custom: 'Custom Assembly',
};

const extractAssembliesFromGLB = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 30,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    const { cabinetId, sceneId, meshNames, archetypeKey } = request.data || {};

    if (!cabinetId || !sceneId) {
      throw new HttpsError('invalid-argument', 'cabinetId and sceneId are required');
    }

    logger.info(`extractAssembliesFromGLB: cabinet=${cabinetId}, meshes=${(meshNames || []).length}`);

    // If archetypeKey provided, load expected hierarchy from DKB
    let expectedTypes = ['carcass', 'door_assembly', 'hardware_kit'];
    if (archetypeKey) {
      const archetypeSnap = await db.collection('designKnowledgeBase')
        .where('entryType', '==', 'product_archetype')
        .where('tags', 'array-contains', archetypeKey)
        .limit(1)
        .get();

      if (!archetypeSnap.empty) {
        const archData = archetypeSnap.docs[0].data();
        if (archData.typicalHardware) {
          // Infer assembly types from archetype hardware/component data
          expectedTypes = ['carcass'];
          for (const hw of archData.typicalHardware) {
            if (hw.family === 'hinge') expectedTypes.push('door_assembly');
            if (hw.family === 'drawer_slide') expectedTypes.push('drawer_box');
            if (hw.family === 'shelf_support') expectedTypes.push('shelf_pack');
            if (hw.family === 'leg_leveller') expectedTypes.push('plinth_assembly');
          }
          expectedTypes.push('hardware_kit');
          expectedTypes = [...new Set(expectedTypes)];
        }
      }
    }

    // Group meshes by detected assembly type
    const groups = {};
    for (const name of (meshNames || [])) {
      const type = detectAssemblyType(name) || 'custom';
      if (!groups[type]) groups[type] = [];
      groups[type].push(name);
    }

    // Ensure expected types exist
    for (const type of expectedTypes) {
      if (!groups[type]) groups[type] = [];
    }

    // Build assembly structures
    const assemblies = [];
    let sequence = 0;
    for (const [type, nodes] of Object.entries(groups)) {
      assemblies.push({
        id: `${cabinetId}-${type}-${sequence}`,
        cabinetId,
        assemblyType: type,
        assemblyCode: `${type}-${sequence + 1}`,
        displayName: ASSEMBLY_NAMES[type] || type,
        meshNodeIds: nodes,
        isComplete: nodes.length > 0,
        totalPartCount: nodes.length,
        sequence,
      });
      sequence++;
    }

    // Store assemblies on cabinet document
    const cabRef = db.collection('designScenes').doc(sceneId)
      .collection('cabinets').doc(cabinetId);

    await cabRef.update({
      assemblySummary: assemblies.map(a => ({
        id: a.id,
        assemblyType: a.assemblyType,
        displayName: a.displayName,
        partCount: a.totalPartCount,
        isComplete: a.isComplete,
      })),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Extracted ${assemblies.length} assemblies for cabinet ${cabinetId}`);

    return { cabinetId, assemblies };
  },
);

module.exports = { extractAssembliesFromGLB };
