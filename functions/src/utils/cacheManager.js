/**
 * Feature Library Cache Manager
 * 
 * Enhances existing Feature Library caching functionality.
 * Uses Firestore for cache storage (compatible with existing implementation).
 * 
 * IMPORTANT: This builds on the existing cache at systemConfig/featureLibraryCache
 * The existing getCachedFeatureContext() and refreshFeatureCache() in index.js
 * continue to work - this module provides additional capabilities.
 */

const admin = require('firebase-admin');

// Cache configuration
const CACHE_CONFIG = {
  TTL_HOURS: 8,
  CONFIG_DOC: 'systemConfig/featureLibraryCache',
  FEATURES_COLLECTION: 'features', // Primary collection (user's existing data)
  FEATURE_LIBRARY_COLLECTION: 'featureLibrary', // Alternative collection
  MIN_FEATURES_FOR_CACHE: 3, // Minimum features required
};

// System prompt for Feature Library context
const FEATURE_LIBRARY_SYSTEM_PROMPT = `You are a manufacturing assistant for Dawin Group, a custom millwork and furniture company in Uganda.
You have access to the complete Feature Library documenting manufacturing capabilities.

When answering questions:
1. Reference specific features by name and ID when relevant
2. Consider equipment requirements and material constraints
3. Note quality checkpoints for production planning
4. Suggest related features when they could benefit the project
5. Provide time and cost estimates when asked

Always cite feature IDs in your responses when referencing specific capabilities.
If a feature isn't in the library, suggest the closest alternative or explain what would be needed.`;

/**
 * Feature Library Cache Manager class
 */
class FeatureLibraryCacheManager {
  constructor(db = null) {
    this.db = db || admin.firestore();
    this.inMemoryCache = null;
    this.inMemoryCacheExpiry = null;
  }

  /**
   * Get or create the Feature Library cache
   * Returns cached context string for AI prompts
   * @returns {Promise<string|null>}
   */
  async getOrCreateCache() {
    // Check in-memory cache first (faster)
    if (this.inMemoryCache && this.inMemoryCacheExpiry && new Date() < this.inMemoryCacheExpiry) {
      return this.inMemoryCache;
    }

    try {
      const cacheDoc = await this.db.doc(CACHE_CONFIG.CONFIG_DOC).get();
      
      if (cacheDoc.exists) {
        const cache = cacheDoc.data();
        const now = Date.now();
        const expiresAt = cache.expiresAt?.toMillis() || 0;
        
        if (now < expiresAt && cache.contextSnapshot) {
          // Cache is valid, update in-memory cache
          this.inMemoryCache = cache.contextSnapshot;
          this.inMemoryCacheExpiry = new Date(expiresAt);
          return cache.contextSnapshot;
        }
      }

      // Cache doesn't exist or is expired - refresh it
      return await this.refreshCache('auto');
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  /**
   * Refresh the Feature Library cache
   * @param {string} trigger - What triggered the refresh (auto, manual, feature-update)
   * @returns {Promise<string|null>}
   */
  async refreshCache(trigger = 'manual') {
    try {
      console.log('Refreshing Feature Library cache, trigger:', trigger);

      // Try to get features from both collections
      let features = [];
      
      // First try the 'features' collection (primary)
      const featuresSnapshot = await this.db.collection(CACHE_CONFIG.FEATURES_COLLECTION).get();
      
      if (!featuresSnapshot.empty) {
        featuresSnapshot.forEach(doc => {
          const data = doc.data();
          features.push(this._normalizeFeature(doc.id, data));
        });
      }
      
      // If no features in primary, try featureLibrary collection
      if (features.length === 0) {
        const librarySnapshot = await this.db.collection(CACHE_CONFIG.FEATURE_LIBRARY_COLLECTION)
          .where('status', '==', 'active')
          .get();
        
        librarySnapshot.forEach(doc => {
          const data = doc.data();
          features.push(this._normalizeFeatureLibraryItem(doc.id, data));
        });
      }

      if (features.length < CACHE_CONFIG.MIN_FEATURES_FOR_CACHE) {
        console.log(`Only ${features.length} features found, cache not created`);
        return null;
      }

      // Build optimized context for AI
      const featureContext = {
        featureLibrary: {
          lastUpdated: new Date().toISOString(),
          totalFeatures: features.length,
          categories: [...new Set(features.map(f => f.category).filter(Boolean))],
          features: features,
        },
      };

      const contextJson = JSON.stringify(featureContext);
      const estimatedTokens = Math.ceil(contextJson.length / 4);

      // Store cache in Firestore
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (CACHE_CONFIG.TTL_HOURS * 60 * 60 * 1000)
      );

      await this.db.doc(CACHE_CONFIG.CONFIG_DOC).set({
        featureCount: features.length,
        tokenCount: estimatedTokens,
        createdAt: now,
        expiresAt: expiresAt,
        lastRefreshTrigger: trigger,
        contextSnapshot: contextJson,
        systemPrompt: FEATURE_LIBRARY_SYSTEM_PROMPT,
      });

      // Update in-memory cache
      this.inMemoryCache = contextJson;
      this.inMemoryCacheExpiry = expiresAt.toDate();

      console.log(`Cache refreshed: ${features.length} features, ~${estimatedTokens} tokens`);
      return contextJson;
    } catch (error) {
      console.error('Error refreshing cache:', error);
      return null;
    }
  }

  /**
   * Invalidate the cache (called when features are updated)
   */
  async invalidateCache() {
    try {
      // Clear in-memory cache
      this.inMemoryCache = null;
      this.inMemoryCacheExpiry = null;

      // Update Firestore to mark as invalidated (don't delete, keep metrics)
      await this.db.doc(CACHE_CONFIG.CONFIG_DOC).update({
        expiresAt: admin.firestore.Timestamp.now(), // Expire immediately
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRefreshTrigger: 'invalidated',
      });

      console.log('Feature Library cache invalidated');
      return true;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return false;
    }
  }

  /**
   * Get cache status without modifying it
   * @returns {Promise<object>}
   */
  async getCacheStatus() {
    try {
      const cacheDoc = await this.db.doc(CACHE_CONFIG.CONFIG_DOC).get();

      if (!cacheDoc.exists) {
        return {
          status: 'not-initialized',
          message: 'Feature Library cache has not been created yet',
          canRefresh: true,
        };
      }

      const cache = cacheDoc.data();
      const now = Date.now();
      const expiresAt = cache.expiresAt?.toMillis() || 0;
      const isExpired = now > expiresAt;

      return {
        status: isExpired ? 'expired' : 'active',
        featureCount: cache.featureCount || 0,
        tokenCount: cache.tokenCount || 0,
        createdAt: cache.createdAt?.toDate().toISOString(),
        expiresAt: cache.expiresAt?.toDate().toISOString(),
        lastRefreshTrigger: cache.lastRefreshTrigger,
        isExpired,
        hoursRemaining: isExpired ? 0 : Math.round((expiresAt - now) / (1000 * 60 * 60)),
        estimatedSavings: `${Math.round((cache.tokenCount || 0) * 0.75 / 1000)}K tokens saved per call`,
        hasInMemoryCache: !!this.inMemoryCache,
      };
    } catch (error) {
      console.error('Error getting cache status:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Normalize feature from 'features' collection format
   */
  _normalizeFeature(id, data) {
    return {
      id,
      name: data.name || 'Unknown',
      category: data.category || 'SPECIALTY',
      description: data.description?.substring(0, 200) || '',
      tags: data.tags || [],
      requiredAssets: data.requiredAssetIds?.length || 0,
      estimatedMinutes: data.estimatedMinutes || 0,
      isAvailable: data.isAvailable !== false,
    };
  }

  /**
   * Normalize feature from 'featureLibrary' collection format
   */
  _normalizeFeatureLibraryItem(id, data) {
    return {
      id,
      code: data.code,
      name: data.name || 'Unknown',
      category: data.category || 'SPECIALTY',
      subcategory: data.subcategory || null,
      qualityGrade: data.qualityGrade,
      estimatedHours: data.estimatedTime?.typical || 0,
      requiredEquipment: data.requiredEquipment || [],
      skillLevel: data.costFactors?.skillLevel || 'journeyman',
      tags: data.tags || [],
      description: data.description?.substring(0, 200) || '',
    };
  }

  /**
   * Get the system prompt for Feature Library context
   */
  getSystemPrompt() {
    return FEATURE_LIBRARY_SYSTEM_PROMPT;
  }
}

// Singleton instance
let cacheManagerInstance = null;

/**
 * Get or create the cache manager instance
 * @param {FirebaseFirestore.Firestore} db - Optional Firestore instance
 * @returns {FeatureLibraryCacheManager}
 */
function getCacheManager(db = null) {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new FeatureLibraryCacheManager(db);
  }
  return cacheManagerInstance;
}

/**
 * Helper function to get cached context (drop-in compatible with existing code)
 * @returns {Promise<string|null>}
 */
async function getCachedFeatureContextEnhanced() {
  const manager = getCacheManager();
  return await manager.getOrCreateCache();
}

module.exports = {
  FeatureLibraryCacheManager,
  getCacheManager,
  getCachedFeatureContextEnhanced,
  FEATURE_LIBRARY_SYSTEM_PROMPT,
  CACHE_CONFIG,
};
