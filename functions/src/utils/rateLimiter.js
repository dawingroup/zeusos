/**
 * Rate Limiter for AI Functions
 * 
 * Tracks requests per user in Firestore to prevent abuse.
 * Uses a sliding window approach with hourly limits.
 * 
 * Collection: rateLimits/{userId}
 * Document structure:
 * {
 *   ai: { count: number, windowStart: Timestamp },
 *   search: { count: number, windowStart: Timestamp },
 *   lastRequest: Timestamp
 * }
 */

const admin = require('firebase-admin');

// Rate limit configurations
const RATE_LIMITS = {
  ai: {
    maxRequests: 100,      // 100 AI requests per hour (single-item enhancements)
    windowMs: 60 * 60 * 1000, // 1 hour in milliseconds
  },
  audit: {
    maxRequests: 20,       // 20 batch audit calls per hour
    windowMs: 60 * 60 * 1000,
  },
  search: {
    maxRequests: 20,       // 20 grounded searches per hour
    windowMs: 60 * 60 * 1000,
  },
  image: {
    maxRequests: 30,       // 30 image analyses per hour
    windowMs: 60 * 60 * 1000,
  },
};

/**
 * Check if a user has exceeded their rate limit
 * @param {string} userId - Firebase Auth user ID
 * @param {'ai' | 'audit' | 'search' | 'image'} limitType - Type of rate limit to check
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date, current: number}>}
 */
async function checkRateLimit(userId, limitType = 'ai', db = null) {
  if (!db) {
    db = admin.firestore();
  }

  const config = RATE_LIMITS[limitType] || RATE_LIMITS.ai;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const rateLimitRef = db.collection('rateLimits').doc(userId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const data = doc.exists ? doc.data() : {};
      
      const limitData = data[limitType] || { count: 0, windowStart: now };
      
      // Check if we're in a new window
      if (limitData.windowStart < windowStart) {
        // Reset the window
        limitData.count = 0;
        limitData.windowStart = now;
      }

      const allowed = limitData.count < config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - limitData.count - (allowed ? 1 : 0));
      const resetAt = new Date(limitData.windowStart + config.windowMs);

      if (allowed) {
        // Increment the counter
        limitData.count += 1;
        
        transaction.set(rateLimitRef, {
          [limitType]: limitData,
          lastRequest: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      return {
        allowed,
        remaining,
        resetAt,
        current: limitData.count,
      };
    });

    return result;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if rate limiting fails
    // This prevents rate limiter errors from blocking legitimate users
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
      current: 0,
      error: error.message,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 * @param {string} userId - Firebase Auth user ID
 * @param {'ai' | 'audit' | 'search' | 'image'} limitType - Type of rate limit
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @returns {Promise<{remaining: number, resetAt: Date, current: number}>}
 */
async function getRateLimitStatus(userId, limitType = 'ai', db = null) {
  if (!db) {
    db = admin.firestore();
  }

  const config = RATE_LIMITS[limitType] || RATE_LIMITS.ai;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    const doc = await db.collection('rateLimits').doc(userId).get();
    const data = doc.exists ? doc.data() : {};
    const limitData = data[limitType] || { count: 0, windowStart: now };

    // Check if we're in a new window
    if (limitData.windowStart < windowStart) {
      return {
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs),
        current: 0,
      };
    }

    return {
      remaining: Math.max(0, config.maxRequests - limitData.count),
      resetAt: new Date(limitData.windowStart + config.windowMs),
      current: limitData.count,
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
      current: 0,
      error: error.message,
    };
  }
}

/**
 * Reset rate limits for a user (admin function)
 * @param {string} userId - Firebase Auth user ID
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 */
async function resetRateLimits(userId, db = null) {
  if (!db) {
    db = admin.firestore();
  }

  await db.collection('rateLimits').doc(userId).delete();
}

/**
 * Middleware-style rate limit check that throws HttpsError
 * @param {string} userId - Firebase Auth user ID
 * @param {'ai' | 'audit' | 'search' | 'image'} limitType - Type of rate limit
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @throws {Error} If rate limit exceeded
 */
async function enforceRateLimit(userId, limitType = 'ai', db = null) {
  const result = await checkRateLimit(userId, limitType, db);
  
  if (!result.allowed) {
    const error = new Error(
      `Rate limit exceeded. You have made ${result.current} requests. ` +
      `Limit resets at ${result.resetAt.toISOString()}`
    );
    error.code = 'resource-exhausted';
    error.details = {
      limitType,
      current: result.current,
      limit: RATE_LIMITS[limitType]?.maxRequests || 100,
      resetAt: result.resetAt,
    };
    throw error;
  }
  
  return result;
}

module.exports = {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimits,
  enforceRateLimit,
  RATE_LIMITS,
};
