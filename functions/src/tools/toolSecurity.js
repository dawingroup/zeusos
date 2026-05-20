/**
 * Tool Security Module
 * Loads user permissions and scopes all tool queries by subsidiary + role.
 * Cached per request to avoid redundant Firestore reads.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Roles that can see financial data (cost breakdowns, margins, pricing)
const FINANCIAL_ROLES = ['owner', 'admin', 'manager'];

// Roles that can see all data across their accessible subsidiaries
const BROAD_ACCESS_ROLES = ['owner', 'admin'];

/**
 * Load user permissions from Firestore.
 * Returns a security context object used by all tool handlers.
 *
 * @param {string} userId - Firebase Auth UID
 * @param {string} companyId - Company identifier
 * @returns {Promise<SecurityContext>}
 */
async function loadUserContext(userId, companyId) {
  if (!userId) {
    throw new Error('User ID is required for security context');
  }

  // Look up the DawinUser document by uid field
  const usersSnap = await db.collection('users')
    .where('uid', '==', userId)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    // Fallback: try looking up by document ID
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        userId,
        companyId,
        globalRole: 'viewer',
        subsidiaryIds: [],
        moduleAccess: {},
        canSeeFinancials: false,
        hasBroadAccess: false,
      };
    }
    return buildContext(userDoc.data(), userId, companyId);
  }

  return buildContext(usersSnap.docs[0].data(), userId, companyId);
}

function buildContext(userData, userId, companyId) {
  const globalRole = userData.globalRole || 'viewer';
  const subsidiaryAccess = userData.subsidiaryAccess || [];

  // Extract accessible subsidiary IDs
  const subsidiaryIds = subsidiaryAccess
    .filter(sa => sa.hasAccess)
    .map(sa => sa.subsidiaryId);

  // Build module access map: { moduleId: { hasAccess, role } }
  const moduleAccess = {};
  for (const sa of subsidiaryAccess) {
    if (!sa.hasAccess) continue;
    for (const ma of (sa.modules || [])) {
      if (ma.hasAccess) {
        moduleAccess[ma.moduleId] = {
          hasAccess: true,
          role: ma.role || globalRole,
          subsidiaryId: sa.subsidiaryId,
        };
      }
    }
  }

  return {
    userId,
    companyId,
    globalRole,
    subsidiaryIds,
    moduleAccess,
    canSeeFinancials: FINANCIAL_ROLES.includes(globalRole),
    hasBroadAccess: BROAD_ACCESS_ROLES.includes(globalRole),
  };
}

/**
 * Apply subsidiary scoping to a Firestore query.
 * Adds a where clause for subsidiaryId if the user doesn't have broad access.
 *
 * @param {FirebaseFirestore.Query} query - Firestore query to scope
 * @param {SecurityContext} context - User's security context
 * @param {string} fieldName - Name of the subsidiary field (default: 'subsidiaryId')
 * @returns {FirebaseFirestore.Query}
 */
function scopeQuery(query, context, fieldName = 'subsidiaryId') {
  // Owners and admins see all data (within their company)
  if (context.hasBroadAccess) return query;

  // Others see only data from their accessible subsidiaries
  if (context.subsidiaryIds.length === 0) {
    // No subsidiary access — return impossible query
    return query.where(fieldName, '==', '__no_access__');
  }

  if (context.subsidiaryIds.length === 1) {
    return query.where(fieldName, '==', context.subsidiaryIds[0]);
  }

  // Firestore 'in' supports up to 30 values
  return query.where(fieldName, 'in', context.subsidiaryIds.slice(0, 30));
}

/**
 * Check if user has access to a specific module.
 *
 * @param {SecurityContext} context - User's security context
 * @param {string} moduleId - Module identifier
 * @returns {boolean}
 */
function hasModuleAccess(context, moduleId) {
  if (context.hasBroadAccess) return true;
  return !!(context.moduleAccess[moduleId] && context.moduleAccess[moduleId].hasAccess);
}

/**
 * Strip sensitive financial fields from a result object.
 * Used when the user doesn't have financial access.
 *
 * @param {object} data - Data object to sanitize
 * @returns {object} Sanitized data
 */
function stripFinancials(data, context) {
  if (context.canSeeFinancials) return data;
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = [
    'costBreakdown', 'margin', 'margins', 'profit', 'profitMargin',
    'unitCost', 'totalCost', 'laborCost', 'materialCost', 'markupPercentage',
    'revenue', 'netRevenue', 'grossProfit', 'netProfit', 'costPrice',
    'buyPrice', 'landedCost', 'exchangeRate', 'customsDuty',
    'priceHistory', 'supplierPricing', 'costEstimate',
  ];

  const sanitized = { ...data };
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[restricted]';
    }
  }
  return sanitized;
}

module.exports = {
  loadUserContext,
  scopeQuery,
  hasModuleAccess,
  stripFinancials,
  FINANCIAL_ROLES,
  BROAD_ACCESS_ROLES,
};
