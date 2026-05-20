/**
 * Asset Status Sync Trigger
 * Firestore trigger that updates Feature availability when Asset status changes
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

/**
 * Trigger: When an asset document is updated
 * If status changes, recalculate availability for all features that require this asset
 */
exports.onAssetStatusChange = onDocumentUpdated(
  'assets/{assetId}',
  async (event) => {
    const assetId = event.params.assetId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // Check if status changed
    if (beforeData.status === afterData.status) {
      console.log(`Asset ${assetId}: Status unchanged, skipping`);
      return null;
    }

    console.log(`Asset ${assetId}: Status changed from ${beforeData.status} to ${afterData.status}`);

    const assetDisplayName = afterData.nickname || `${afterData.brand} ${afterData.model}`;
    const isNowUnavailable = ['MAINTENANCE', 'REPAIR', 'BROKEN', 'RETIRED'].includes(afterData.status);

    try {
      // Find all features that require this asset
      // NOTE: Legacy 'features' collection deprecated - use featureLibrary only
      // TODO: Run migration script to move any remaining legacy features
      
      // Check featureLibrary collection - by asset name in requiredEquipment
      const featureLibrarySnapshot = await db
        .collection('featureLibrary')
        .where('requiredEquipment', 'array-contains', assetDisplayName)
        .get();

      // Also check by source asset ID for AI-created features
      const featureLibraryBySourceSnapshot = await db
        .collection('featureLibrary')
        .where('_sourceAsset.assetId', '==', assetId)
        .get();

      const totalFeatures = featureLibrarySnapshot.size + featureLibraryBySourceSnapshot.size;
      
      if (totalFeatures === 0) {
        console.log(`No features require asset ${assetId} (${assetDisplayName})`);
        return null;
      }

      console.log(`Found ${featureLibrarySnapshot.size} features (by name), ${featureLibraryBySourceSnapshot.size} features (by source) for asset ${assetId}`);

      // Process each feature
      const batch = db.batch();

      // Process featureLibrary features (by equipment name)
      const processedIds = new Set();
      for (const featureDoc of featureLibrarySnapshot.docs) {
        processedIds.add(featureDoc.id);
        const feature = featureDoc.data();
        const featureRef = featureDoc.ref;

        // Determine new status based on asset status
        const newStatus = isNowUnavailable ? 'in-development' : 'active';
        const statusReason = isNowUnavailable 
          ? `${assetDisplayName} is ${afterData.status}`
          : 'All required equipment operational';

        console.log(`FeatureLibrary ${feature.name}: status=${newStatus}, reason=${statusReason}`);

        batch.update(featureRef, {
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          _lastStatusCheck: {
            assetId,
            assetName: assetDisplayName,
            assetStatus: afterData.status,
            checkedAt: new Date().toISOString(),
          },
        });
      }

      // Process featureLibrary features (by source asset ID) - avoid duplicates
      for (const featureDoc of featureLibraryBySourceSnapshot.docs) {
        if (processedIds.has(featureDoc.id)) continue; // Skip if already processed
        
        const feature = featureDoc.data();
        const featureRef = featureDoc.ref;

        const newStatus = isNowUnavailable ? 'in-development' : 'active';
        const statusReason = isNowUnavailable 
          ? `${assetDisplayName} is ${afterData.status}`
          : 'All required equipment operational';

        console.log(`FeatureLibrary (by source) ${feature.name}: status=${newStatus}`);

        batch.update(featureRef, {
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          _lastStatusCheck: {
            assetId,
            assetName: assetDisplayName,
            assetStatus: afterData.status,
            checkedAt: new Date().toISOString(),
          },
        });
      }

      // Commit all updates
      await batch.commit();
      console.log(`Updated ${totalFeatures} features for asset ${assetId}`);

      // If this is a CNC machine becoming unavailable, warn active projects
      if (afterData.category === 'CNC' && isNowUnavailable) {
        await warnActiveProjects(assetId, assetDisplayName, afterData.status);
      }

      // If asset is back to ACTIVE, clear warnings from projects
      if (afterData.status === 'ACTIVE' && beforeData.status !== 'ACTIVE') {
        await clearAssetWarnings(assetId);
      }

      return { updated: totalFeatures };

    } catch (error) {
      console.error('Error syncing asset status to features:', error);
      throw error;
    }
  }
);

/**
 * Calculate feature availability based on all required assets
 */
async function calculateFeatureAvailability(requiredAssetIds, changedAssetId, changedAssetStatus, changedAssetName) {
  const unavailableAssets = [];
  const maintenanceAssets = [];

  for (const assetId of requiredAssetIds) {
    let status;
    let displayName;

    if (assetId === changedAssetId) {
      // Use the new status for the changed asset
      status = changedAssetStatus;
      displayName = changedAssetName;
    } else {
      // Fetch status for other assets
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (!assetDoc.exists) {
        unavailableAssets.push(`Unknown asset (${assetId})`);
        continue;
      }
      const assetData = assetDoc.data();
      status = assetData.status;
      displayName = assetData.nickname || `${assetData.brand} ${assetData.model}`;
    }

    // Check status
    switch (status) {
      case 'BROKEN':
        unavailableAssets.push(`${displayName} is broken`);
        break;
      case 'MAINTENANCE':
        maintenanceAssets.push(`${displayName} is in maintenance`);
        break;
      case 'RETIRED':
        unavailableAssets.push(`${displayName} has been retired`);
        break;
      // ACTIVE and CHECKED_OUT are considered available
    }
  }

  // Determine availability
  if (unavailableAssets.length > 0) {
    return {
      isAvailable: false,
      reason: unavailableAssets.join('; '),
    };
  }

  if (maintenanceAssets.length > 0) {
    return {
      isAvailable: false,
      reason: maintenanceAssets.join('; '),
    };
  }

  return {
    isAvailable: true,
    reason: 'All required assets are operational',
  };
}

/**
 * Warn active projects when a CNC machine becomes unavailable
 */
async function warnActiveProjects(assetId, assetName, status) {
  try {
    // Find projects in active stages that might be affected
    const projectsSnapshot = await db
      .collection('designProjects')
      .where('stage', 'in', [3, 4, 5]) // PRE_PRODUCTION, PRODUCTION, IN_PRODUCTION
      .get();

    if (projectsSnapshot.empty) {
      console.log('No active projects to warn');
      return;
    }

    console.log(`Warning ${projectsSnapshot.size} active projects about CNC ${assetName}`);

    const batch = db.batch();
    const now = new Date().toISOString();

    for (const projectDoc of projectsSnapshot.docs) {
      const project = projectDoc.data();
      const warnings = project.activeWarnings || [];

      // Check if warning already exists for this asset
      const existingIndex = warnings.findIndex(w => w.assetId === assetId);
      if (existingIndex >= 0) {
        // Update existing warning
        warnings[existingIndex] = {
          type: 'ASSET_UNAVAILABLE',
          assetId,
          assetName,
          message: `CNC "${assetName}" is now ${status}`,
          status,
          createdAt: now,
        };
      } else {
        // Add new warning
        warnings.push({
          type: 'ASSET_UNAVAILABLE',
          assetId,
          assetName,
          message: `CNC "${assetName}" is now ${status}`,
          status,
          createdAt: now,
        });
      }

      batch.update(projectDoc.ref, {
        activeWarnings: warnings,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`Added warnings to ${projectsSnapshot.size} projects`);

  } catch (error) {
    console.error('Error warning projects:', error);
    // Don't throw - this is a secondary operation
  }
}

/**
 * Clear asset warnings from all projects when asset becomes available again
 */
async function clearAssetWarnings(assetId) {
  try {
    // Find all projects with warnings for this asset
    const projectsSnapshot = await db
      .collection('designProjects')
      .where('activeWarnings', '!=', null)
      .get();

    if (projectsSnapshot.empty) {
      return;
    }

    const batch = db.batch();
    let updatedCount = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const project = projectDoc.data();
      const warnings = project.activeWarnings || [];
      
      // Filter out warnings for this asset
      const filteredWarnings = warnings.filter(w => w.assetId !== assetId);
      
      if (filteredWarnings.length !== warnings.length) {
        batch.update(projectDoc.ref, {
          activeWarnings: filteredWarnings,
          updatedAt: FieldValue.serverTimestamp(),
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`Cleared warnings from ${updatedCount} projects for asset ${assetId}`);
    }

  } catch (error) {
    console.error('Error clearing warnings:', error);
    // Don't throw - this is a secondary operation
  }
}
