/**
 * Result Summarizer Utility
 * Prevents token overflow by pruning large Firestore results
 * before returning them as tool_result content to Claude.
 */

// Maximum items in a list result
const MAX_LIST_ITEMS = 10;

// Maximum depth for nested objects
const MAX_DEPTH = 3;

// Maximum string field length
const MAX_STRING_LENGTH = 500;

// Fields to always strip (internal metadata, not useful for AI reasoning)
const STRIP_FIELDS = [
  'embedding', 'embeddings', 'vectorEmbedding',
  '__v', '_rev',
];

// Timestamp fields to format rather than include raw
const TIMESTAMP_FIELDS = [
  'createdAt', 'updatedAt', 'lastModifiedAt', 'lastAccessedAt',
  'deletedAt', 'archivedAt',
];

/**
 * Summarize a tool result to keep it within token budget.
 *
 * @param {any} result - Raw result from Firestore
 * @param {object} options - Summarization options
 * @param {number} options.maxItems - Max list items (default: 10)
 * @param {string[]} options.keyFields - Priority fields to always include
 * @returns {any} Summarized result
 */
function summarizeResult(result, options = {}) {
  const maxItems = options.maxItems || MAX_LIST_ITEMS;
  const keyFields = options.keyFields || null;

  if (result === null || result === undefined) return result;

  // Handle arrays
  if (Array.isArray(result)) {
    const totalCount = result.length;
    const items = result.slice(0, maxItems).map(item =>
      pruneObject(item, 0, keyFields)
    );

    if (totalCount <= maxItems) {
      return items;
    }

    return {
      totalCount,
      showing: maxItems,
      items,
      truncated: true,
      note: `Showing ${maxItems} of ${totalCount} results. Ask for more specific filters to narrow down.`,
    };
  }

  // Handle single objects
  if (typeof result === 'object') {
    return pruneObject(result, 0, keyFields);
  }

  return result;
}

/**
 * Prune a single object, removing deeply nested structures and large fields.
 */
function pruneObject(obj, depth, keyFields) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (depth > MAX_DEPTH) return '[nested]';

  // Handle Firestore Timestamp objects
  if (obj._seconds !== undefined && obj._nanoseconds !== undefined) {
    return new Date(obj._seconds * 1000).toISOString();
  }
  if (obj.toDate && typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip internal fields
    if (STRIP_FIELDS.includes(key)) continue;

    // Format timestamps
    if (TIMESTAMP_FIELDS.includes(key) && value) {
      if (typeof value === 'object' && value._seconds) {
        result[key] = new Date(value._seconds * 1000).toISOString();
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else {
        result[key] = value;
      }
      continue;
    }

    // Handle nested arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        result[key] = [];
      } else if (value.length <= 5) {
        result[key] = value.map(item => pruneObject(item, depth + 1, null));
      } else {
        result[key] = {
          count: value.length,
          sample: value.slice(0, 3).map(item => pruneObject(item, depth + 1, null)),
          truncated: true,
        };
      }
      continue;
    }

    // Handle nested objects
    if (typeof value === 'object' && value !== null) {
      result[key] = pruneObject(value, depth + 1, null);
      continue;
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      result[key] = value.substring(0, MAX_STRING_LENGTH) + '...';
      continue;
    }

    result[key] = value;
  }

  // If keyFields specified, prioritize those
  if (keyFields && depth === 0) {
    const prioritized = {};
    for (const kf of keyFields) {
      if (result[kf] !== undefined) {
        prioritized[kf] = result[kf];
      }
    }
    // Add remaining fields
    for (const [k, v] of Object.entries(result)) {
      if (!(k in prioritized)) {
        prioritized[k] = v;
      }
    }
    return prioritized;
  }

  return result;
}

module.exports = {
  summarizeResult,
  pruneObject,
  MAX_LIST_ITEMS,
};
