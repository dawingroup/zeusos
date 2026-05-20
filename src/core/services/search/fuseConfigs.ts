/**
 * Per-type Fuse.js configurations for Global Search V2.
 *
 * Each entry tunes which fields are indexed, their relative weights,
 * and the matching threshold. Lower threshold = stricter (fewer results).
 *
 * Fuse score is a distance: 0 = perfect match, 1 = no match. We multiply
 * by weight, so a heavy weight on `name` means a name match dominates a
 * weaker secondary-field match. See https://www.fusejs.io/api/options.html
 */

import type { IFuseOptions } from 'fuse.js';
import type { IndexedRecord } from './types';
import type { SearchConfig } from '@/integration/constants/navigation.constants';

type FuseConfig = IFuseOptions<IndexedRecord>;

/**
 * IMPORTANT: Fuse keys reference paths inside `IndexedRecord`. We index
 * `title`, `subtitle`, and selected fields under `data.*`. The values
 * here MUST match the per-type normalizer in `searchIndex.ts`.
 */
export const FUSE_CONFIGS: Record<string, FuseConfig> = {
  customer: {
    keys: [
      { name: 'title', weight: 0.5 },        // name
      { name: 'data.code', weight: 0.25 },
      { name: 'data.phone', weight: 0.15 },
      { name: 'data.email', weight: 0.1 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  customer_contact: {
    keys: [
      { name: 'title', weight: 0.5 },        // contact name
      { name: 'data.email', weight: 0.25 },
      { name: 'data.phone', weight: 0.15 },
      { name: 'data.role', weight: 0.1 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  sales_order: {
    keys: [
      { name: 'title', weight: 0.45 },          // orderNumber
      { name: 'subtitle', weight: 0.30 },        // customerName
      { name: 'data.title', weight: 0.15 },      // SO title field
      { name: 'data.status', weight: 0.10 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  crm_deal: {
    keys: [
      { name: 'title', weight: 0.40 },           // deal title
      { name: 'subtitle', weight: 0.30 },        // customerName
      { name: 'data.dealNumber', weight: 0.20 },
      { name: 'data.stage', weight: 0.10 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  inventory_item: {
    keys: [
      { name: 'data.sku', weight: 0.45 },
      { name: 'title', weight: 0.40 },           // name
      { name: 'data.category', weight: 0.10 },
      { name: 'data.classification', weight: 0.05 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  finish_library: {
    keys: [
      { name: 'title', weight: 0.50 },
      { name: 'data.code', weight: 0.25 },
      { name: 'data.category', weight: 0.15 },
      { name: 'data.supplier', weight: 0.10 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  manufacturing_order: {
    keys: [
      { name: 'title', weight: 0.45 },           // moNumber
      { name: 'subtitle', weight: 0.30 },        // productName
      { name: 'data.orderNumber', weight: 0.15 },
      { name: 'data.status', weight: 0.10 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  purchase_order: {
    keys: [
      { name: 'title', weight: 0.45 },           // poNumber
      { name: 'subtitle', weight: 0.30 },        // supplierName
      { name: 'data.reference', weight: 0.15 },
      { name: 'data.status', weight: 0.10 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  design_project: {
    keys: [
      { name: 'title', weight: 0.50 },
      { name: 'subtitle', weight: 0.25 },        // clientName
      { name: 'data.projectCode', weight: 0.15 },
      { name: 'data.status', weight: 0.10 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  construction_order: {
    keys: [
      { name: 'title', weight: 0.45 },           // orderNumber
      { name: 'subtitle', weight: 0.35 },        // projectName
      { name: 'data.status', weight: 0.20 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  employee: {
    keys: [
      { name: 'title', weight: 0.55 },           // first + last
      { name: 'data.email', weight: 0.20 },
      { name: 'data.employeeId', weight: 0.15 },
      { name: 'data.department', weight: 0.10 },
    ],
    threshold: 0.30,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  department: {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'data.code', weight: 0.4 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },

  document: {
    keys: [
      { name: 'title', weight: 0.5 },
      { name: 'data.category', weight: 0.25 },
      { name: 'data.type', weight: 0.15 },
      { name: 'data.tags', weight: 0.1 },
    ],
    threshold: 0.40,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  },
};

/**
 * Fall back to a generic config built from SearchConfig.searchFields when a
 * type isn't enumerated above. Keeps the system forward-compatible — any
 * new SearchConfig works out of the box.
 */
export function configForType(searchConfig: SearchConfig): FuseConfig {
  const explicit = FUSE_CONFIGS[searchConfig.type];
  if (explicit) return explicit;

  const keys = searchConfig.searchFields.map((name) => ({
    // Generic fallback indexes everything under `data.*`. Title/subtitle
    // are the explicit short paths; here we just route through `data`.
    name: name === searchConfig.displayField ? 'title'
        : name === searchConfig.subtitleField ? 'subtitle'
        : `data.${name}`,
    weight: 1 / searchConfig.searchFields.length,
  }));

  return {
    keys,
    threshold: 0.4,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true,
  };
}
