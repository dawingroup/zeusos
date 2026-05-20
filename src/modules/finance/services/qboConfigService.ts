/**
 * QuickBooks Configuration Service
 * Manages account mappings and QBO settings
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  QBOConfig,
  QBOAccountMapping,
  QBOConfigValidation,
  QBOAccountInfo,
  QBOAccountsByClassification,
  QBOItemInfo,
  QBOItemResolutionEntry,
} from '../types/qboConfig.types';
import { validateQBOConfig, DEFAULT_QBO_CONFIG } from '../types/qboConfig.types';

const CONFIG_DOC_PATH = 'integrations/quickbooks_config';

// ============================================================================
// CONFIGURATION CRUD
// ============================================================================

/**
 * Get QuickBooks configuration
 */
export async function getQBOConfig(): Promise<QBOConfig | null> {
  try {
    const docSnap = await getDoc(doc(db, CONFIG_DOC_PATH));

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data() as QBOConfig;
  } catch (error) {
    console.error('[QBOConfigService] Error fetching config:', error);
    throw error;
  }
}

/**
 * Save QuickBooks configuration
 */
export async function saveQBOConfig(
  config: Partial<QBOConfig>,
  userId: string
): Promise<QBOConfig> {
  try {
    // Validate configuration
    const validation = validateQBOConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Get existing config to merge
    const existing = await getQBOConfig();

    // Merge with defaults and existing
    const fullConfig = {
      ...DEFAULT_QBO_CONFIG,
      ...existing,
      ...config,
      isConfigured: validation.isValid,
      lastUpdatedAt: serverTimestamp() as any,
      lastUpdatedBy: userId,
    };

    // If this is the first time configuring, set configuredAt
    if (!existing?.configuredAt) {
      fullConfig.configuredAt = serverTimestamp() as any;
      fullConfig.configuredBy = userId;
    }

    // Save to Firestore
    await setDoc(doc(db, CONFIG_DOC_PATH), fullConfig, { merge: true });

    return fullConfig as QBOConfig;
  } catch (error) {
    console.error('[QBOConfigService] Error saving config:', error);
    throw error;
  }
}

/**
 * Update account mapping
 */
export async function updateAccountMapping(
  mapping: Partial<QBOAccountMapping>,
  userId: string
): Promise<void> {
  try {
    const existing = await getQBOConfig();

    const updatedMapping: QBOAccountMapping = {
      ...(existing?.accountMapping || {}),
      ...mapping,
    } as QBOAccountMapping;

    await saveQBOConfig(
      {
        accountMapping: updatedMapping,
      },
      userId
    );
  } catch (error) {
    console.error('[QBOConfigService] Error updating account mapping:', error);
    throw error;
  }
}

/**
 * @deprecated Replaced by automatic item resolution with fuzzy matching.
 * Items are now resolved DawinOS → QBO automatically.
 */
export async function updateServiceItemMapping(
  serviceItemMapping: Record<string, string>,
  userId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, CONFIG_DOC_PATH), {
      serviceItemMapping,
      lastUpdatedAt: serverTimestamp(),
      lastUpdatedBy: userId,
    });
  } catch (error) {
    console.error('[QBOConfigService] Error updating service item mapping:', error);
    throw error;
  }
}

/**
 * Update feature flags
 */
export async function updateFeatureFlags(
  features: Partial<QBOConfig['features']>,
  userId: string
): Promise<void> {
  try {
    const existing = await getQBOConfig();

    const updatedFeatures = {
      ...(existing?.features || DEFAULT_QBO_CONFIG.features),
      ...features,
    };

    await updateDoc(doc(db, CONFIG_DOC_PATH), {
      features: updatedFeatures,
      lastUpdatedAt: serverTimestamp(),
      lastUpdatedBy: userId,
    });
  } catch (error) {
    console.error('[QBOConfigService] Error updating feature flags:', error);
    throw error;
  }
}

/**
 * Validate current configuration
 */
export async function validateCurrentConfig(): Promise<QBOConfigValidation> {
  try {
    const config = await getQBOConfig();

    if (!config) {
      return {
        isValid: false,
        errors: ['No configuration found'],
        warnings: [],
      };
    }

    return validateQBOConfig(config);
  } catch (error) {
    console.error('[QBOConfigService] Error validating config:', error);
    return {
      isValid: false,
      errors: ['Failed to validate configuration'],
      warnings: [],
    };
  }
}

// ============================================================================
// QUICKBOOKS ACCOUNTS HELPER
// ============================================================================

/**
 * Get QuickBooks accounts organized by classification
 * Fetches from qbo_accounts collection (populated by QBO sync)
 */
export async function getQBOAccountsByClassification(
  companyId: string
): Promise<QBOAccountsByClassification> {
  try {
    const snapshot = await getDocs(
      collection(db, 'companies', companyId, 'qbo_accounts')
    );

    if (snapshot.empty) {
      return {
        Asset: [],
        Liability: [],
        Equity: [],
        Revenue: [],
        Expense: [],
      };
    }

    const accounts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Group by classification
    const grouped: QBOAccountsByClassification = {
      Asset: [],
      Liability: [],
      Equity: [],
      Revenue: [],
      Expense: [],
    };

    for (const account of accounts as QBOAccountInfo[]) {
      if (account.active && account.classification in grouped) {
        grouped[account.classification as keyof QBOAccountsByClassification].push(account);
      }
    }

    // Sort each group by name
    for (const key in grouped) {
      grouped[key as keyof QBOAccountsByClassification].sort((a, b) =>
        a.fullyQualifiedName.localeCompare(b.fullyQualifiedName)
      );
    }

    return grouped;
  } catch (error) {
    console.error('[QBOConfigService] Error fetching QBO accounts:', error);
    throw error;
  }
}

/**
 * Get QuickBooks items (products & services) for service item mapping dropdowns
 */
export async function getQBOItems(
  companyId: string
): Promise<QBOItemInfo[]> {
  try {
    const snapshot = await getDocs(
      collection(db, 'companies', companyId, 'qbo_items')
    );

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as QBOItemInfo)
      .filter((item) => item.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[QBOConfigService] Error fetching QBO items:', error);
    return [];
  }
}

/**
 * Get suggested account mappings based on account names
 * Attempts to auto-match common account names
 */
export async function getSuggestedAccountMappings(
  companyId: string
): Promise<Partial<QBOAccountMapping>> {
  try {
    const accounts = await getQBOAccountsByClassification(companyId);

    const suggestions: Partial<QBOAccountMapping> = {};

    // Helper to find account by name pattern
    const findByPattern = (
      accountList: QBOAccountInfo[],
      patterns: string[]
    ): string | undefined => {
      for (const pattern of patterns) {
        const found = accountList.find((acc) =>
          acc.name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (found) return found.id;
      }
      return undefined;
    };

    // Accounts Payable
    suggestions.accountsPayable = findByPattern(accounts.Liability, [
      'accounts payable',
      'a/p',
      'payables',
    ]);

    // Accounts Receivable
    suggestions.accountsReceivable = findByPattern(accounts.Asset, [
      'accounts receivable',
      'a/r',
      'receivables',
    ]);

    // Inventory
    suggestions.inventory = findByPattern(accounts.Asset, [
      'inventory',
      'inventory asset',
      'stock',
    ]);

    // COGS
    suggestions.cogs = findByPattern(accounts.Expense, [
      'cost of goods sold',
      'cogs',
      'cost of sales',
    ]);

    // Revenue
    suggestions.revenue = findByPattern(accounts.Revenue, [
      'sales revenue',
      'sales',
      'revenue',
      'income',
    ]);

    // Work in Progress
    suggestions.workInProgress = findByPattern(accounts.Asset, [
      'work in progress',
      'wip',
      'work-in-progress',
    ]);

    // Expenses
    suggestions.shippingExpense = findByPattern(accounts.Expense, [
      'shipping',
      'freight',
      'delivery',
    ]);

    suggestions.customsExpense = findByPattern(accounts.Expense, [
      'customs',
      'import fees',
    ]);

    suggestions.dutiesExpense = findByPattern(accounts.Expense, [
      'duties',
      'import duty',
    ]);

    suggestions.insuranceExpense = findByPattern(accounts.Expense, [
      'insurance',
    ]);

    suggestions.handlingExpense = findByPattern(accounts.Expense, [
      'handling',
      'handling fees',
    ]);

    // Overhead
    suggestions.overhead = findByPattern(accounts.Expense, [
      'overhead',
      'operating expense',
      'general overhead',
    ]);

    // Manufacturing Overhead
    suggestions.manufacturingOverhead = findByPattern(accounts.Expense, [
      'manufacturing overhead',
      'factory overhead',
      'production overhead',
      'manufacturing expense',
    ]);

    return suggestions;
  } catch (error) {
    console.error('[QBOConfigService] Error getting suggested mappings:', error);
    return {};
  }
}

// ============================================================================
// ITEM RESOLUTION LOG
// ============================================================================

/**
 * Get item resolution log entries for review.
 */
export async function getItemResolutionLog(options?: {
  status?: QBOItemResolutionEntry['status'];
  maxResults?: number;
}): Promise<QBOItemResolutionEntry[]> {
  try {
    const colRef = collection(db, 'integrations', 'qbo_item_cache', 'resolution_log');
    const constraints: Parameters<typeof query>[1][] = [
      orderBy('resolvedAt', 'desc'),
      limit(options?.maxResults || 100),
    ];

    if (options?.status) {
      constraints.unshift(where('status', '==', options.status));
    }

    const snapshot = await getDocs(query(colRef, ...constraints));

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as QBOItemResolutionEntry[];
  } catch (error) {
    console.error('[QBOConfigService] Error fetching resolution log:', error);
    return [];
  }
}

/**
 * Approve a fuzzy-matched item resolution.
 */
export async function approveResolution(
  entryId: string,
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, 'integrations', 'qbo_item_cache', 'resolution_log', entryId);
    await updateDoc(docRef, {
      status: 'user-approved',
      reviewedBy: userId,
      reviewedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[QBOConfigService] Error approving resolution:', error);
    throw error;
  }
}

/**
 * Reject a fuzzy-matched item resolution and optionally remap to a different QBO item.
 */
export async function rejectResolution(
  entryId: string,
  userId: string,
  alternativeQboItemId?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'integrations', 'qbo_item_cache', 'resolution_log', entryId);
    const entrySnap = await getDoc(docRef);

    if (!entrySnap.exists()) {
      throw new Error(`Resolution entry ${entryId} not found`);
    }

    const entry = entrySnap.data() as QBOItemResolutionEntry;

    await updateDoc(docRef, {
      status: 'user-rejected',
      reviewedBy: userId,
      reviewedAt: serverTimestamp(),
    });

    // If an alternative QBO item was provided, update the cache entry
    if (alternativeQboItemId && entry.dawinosSku) {
      const cacheKey = entry.dawinosSku.replace(/[/\\]/g, '_').replace(/\s+/g, '_').substring(0, 200).toLowerCase();
      const cacheRef = doc(db, 'integrations', 'qbo_item_cache', 'items', cacheKey);
      await updateDoc(cacheRef, {
        qboItemId: alternativeQboItemId,
        matchType: 'linked',
        matchScore: null,
        lastUsedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[QBOConfigService] Error rejecting resolution:', error);
    throw error;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize QBO configuration with defaults and suggested mappings
 */
export async function initializeQBOConfig(
  companyId: string,
  userId: string
): Promise<QBOConfig> {
  try {
    // Check if already initialized
    const existing = await getQBOConfig();
    if (existing?.isConfigured) {
      return existing;
    }

    // Get suggested mappings
    const suggestions = await getSuggestedAccountMappings(companyId);

    // Create initial config with suggestions
    const initialConfig: Partial<QBOConfig> = {
      ...DEFAULT_QBO_CONFIG,
      accountMapping: suggestions as QBOAccountMapping,
      configuredAt: serverTimestamp() as any,
      configuredBy: userId,
      isConfigured: false, // Still needs user confirmation
    };

    return await saveQBOConfig(initialConfig, userId);
  } catch (error) {
    console.error('[QBOConfigService] Error initializing config:', error);
    throw error;
  }
}
