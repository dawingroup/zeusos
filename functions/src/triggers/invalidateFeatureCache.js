/**
 * Feature Cache Invalidation Trigger
 * 
 * Automatically invalidates the Feature Library cache when features are updated.
 * This ensures AI assistants always have access to the latest feature data.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getCacheManager } = require('../utils/cacheManager');

/**
 * Trigger: Invalidate cache when any feature in 'features' collection is written
 * (create, update, or delete)
 */
exports.onFeatureWritten = onDocumentWritten('features/{featureId}', async (event) => {
  const featureId = event.params.featureId;
  const changeType = !event.data.before.exists ? 'created' 
    : !event.data.after.exists ? 'deleted' 
    : 'updated';

  console.log(`Feature ${changeType}: ${featureId}`);

  try {
    const cacheManager = getCacheManager();
    await cacheManager.invalidateCache();
    console.log(`Feature Library cache invalidated due to feature ${changeType}`);
  } catch (error) {
    console.error('Error invalidating cache on feature change:', error);
    // Don't throw - cache invalidation shouldn't break feature operations
  }
});

/**
 * Trigger: Invalidate cache when any feature in 'featureLibrary' collection is written
 * (for the alternative collection structure)
 */
exports.onFeatureLibraryWritten = onDocumentWritten('featureLibrary/{featureId}', async (event) => {
  const featureId = event.params.featureId;
  const changeType = !event.data.before.exists ? 'created' 
    : !event.data.after.exists ? 'deleted' 
    : 'updated';

  console.log(`FeatureLibrary ${changeType}: ${featureId}`);

  try {
    const cacheManager = getCacheManager();
    await cacheManager.invalidateCache();
    console.log(`Feature Library cache invalidated due to featureLibrary ${changeType}`);
  } catch (error) {
    console.error('Error invalidating cache on featureLibrary change:', error);
  }
});
