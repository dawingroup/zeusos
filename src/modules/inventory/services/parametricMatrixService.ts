/**
 * Parametric Matrix Service
 *
 * Rule-based engine for automatic item/kit selection based on
 * project-level defaults and design-item-level overrides.
 *
 * Resolution flow:
 *   Project Defaults (hardwareTier = 'premium')
 *   + Cabinet Overrides (doorType = 'inset', hingeDegrees = '110')
 *   → Merged Variables
 *   → Match against ParametricRule conditions (by priority)
 *   → Result: selected item/kit ID
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ParametricRule,
  ParametricCondition,
  ProjectParametricDefaults,
  DesignItemParametricOverrides,
} from '../types/parametricMatrix';

const RULES_COLLECTION = 'parametricRules';
const rulesRef = collection(db, RULES_COLLECTION);

// ============================================
// Types
// ============================================

export interface ParametricRuleInput {
  name: string;
  description?: string;
  conditions: ParametricCondition[];
  resultItemId: string;
  resultSku: string;
  resultName: string;
  resultQuantityPerUnit?: number;
  priority: number;
  isActive: boolean;
  subsidiaryId?: string;
}

export interface ParametricSelectionResult {
  ruleId: string;
  ruleName: string;
  resultItemId: string;
  resultSku: string;
  resultName: string;
  quantityPerUnit: number;
  matchedConditions: ParametricCondition[];
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new parametric rule
 */
export async function createParametricRule(
  input: ParametricRuleInput,
  userId: string,
): Promise<string> {
  if (input.conditions.length === 0) {
    throw new Error('A parametric rule must have at least one condition');
  }

  const now = serverTimestamp();
  const ruleData = {
    ...input,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  const docRef = await addDoc(rulesRef, ruleData);
  return docRef.id;
}

/**
 * Update an existing parametric rule
 */
export async function updateParametricRule(
  ruleId: string,
  updates: Partial<ParametricRuleInput>,
): Promise<void> {
  await updateDoc(doc(rulesRef, ruleId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a parametric rule
 */
export async function deleteParametricRule(ruleId: string): Promise<void> {
  await deleteDoc(doc(rulesRef, ruleId));
}

/**
 * Get a single parametric rule by ID
 */
export async function getParametricRule(ruleId: string): Promise<ParametricRule | null> {
  const snap = await getDoc(doc(rulesRef, ruleId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ParametricRule;
}

/**
 * Get all parametric rules, optionally filtered by subsidiary
 */
export async function getParametricRules(
  subsidiaryId?: string,
): Promise<ParametricRule[]> {
  let q;
  if (subsidiaryId) {
    q = query(
      rulesRef,
      where('isActive', '==', true),
      orderBy('priority', 'asc'),
    );
  } else {
    q = query(rulesRef, orderBy('priority', 'asc'));
  }

  const snap = await getDocs(q);
  const rules = snap.docs.map(d => ({ id: d.id, ...d.data() } as ParametricRule));

  // Client-side filter for subsidiary (supports global + subsidiary-scoped rules)
  if (subsidiaryId) {
    return rules.filter(r => !r.subsidiaryId || r.subsidiaryId === subsidiaryId);
  }
  return rules;
}

/**
 * Get all rules (including inactive) for the admin editor
 */
export async function getAllParametricRules(): Promise<ParametricRule[]> {
  const q = query(rulesRef, orderBy('priority', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ParametricRule));
}

// ============================================
// Resolution Engine
// ============================================

/**
 * Merge project defaults with design-item overrides into a flat variable map.
 * Item-level overrides take precedence over project defaults.
 */
export function mergeParametricVariables(
  projectDefaults: ProjectParametricDefaults,
  itemOverrides?: DesignItemParametricOverrides,
): Record<string, string> {
  const merged: Record<string, string> = {};

  // Start with project defaults
  for (const [key, value] of Object.entries(projectDefaults)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  // Override with item-level values
  if (itemOverrides) {
    for (const [key, value] of Object.entries(itemOverrides)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Evaluate whether a single condition matches the given variables.
 */
function evaluateCondition(
  condition: ParametricCondition,
  variables: Record<string, string>,
): boolean {
  const actualValue = variables[condition.variable];
  if (actualValue === undefined) return false;

  switch (condition.operator) {
    case 'equals':
      return actualValue === condition.value;
    case 'not_equals':
      return actualValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actualValue);
    default:
      return false;
  }
}

/**
 * Evaluate whether all conditions in a rule match the given variables.
 */
function evaluateRule(
  rule: ParametricRule,
  variables: Record<string, string>,
): boolean {
  if (!rule.isActive) return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every(c => evaluateCondition(c, variables));
}

/**
 * Resolve a single parametric selection from merged variables.
 * Returns the highest-priority matching rule, or null if no rule matches.
 *
 * Rules are evaluated in priority order (lower number = higher priority).
 * The first matching rule wins.
 */
export async function resolveParametricSelection(
  projectDefaults: ProjectParametricDefaults,
  itemOverrides?: DesignItemParametricOverrides,
  subsidiaryId?: string,
): Promise<ParametricSelectionResult | null> {
  const variables = mergeParametricVariables(projectDefaults, itemOverrides);
  const rules = await getParametricRules(subsidiaryId);

  for (const rule of rules) {
    if (evaluateRule(rule, variables)) {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        resultItemId: rule.resultItemId,
        resultSku: rule.resultSku,
        resultName: rule.resultName,
        quantityPerUnit: rule.resultQuantityPerUnit ?? 1,
        matchedConditions: rule.conditions,
      };
    }
  }

  return null;
}

/**
 * Resolve all matching parametric selections (not just the first).
 * Useful for generating a complete hardware BOM where multiple rules
 * fire for different hardware categories (hinges, slides, handles, etc.).
 *
 * Groups rules by their first condition variable to avoid conflicts
 * within the same category, returning only the highest-priority match per group.
 */
export async function resolveAllParametricSelections(
  projectDefaults: ProjectParametricDefaults,
  itemOverrides?: DesignItemParametricOverrides,
  subsidiaryId?: string,
): Promise<ParametricSelectionResult[]> {
  const variables = mergeParametricVariables(projectDefaults, itemOverrides);
  const rules = await getParametricRules(subsidiaryId);

  // Track which "categories" we've already matched (by first condition variable)
  const matchedCategories = new Set<string>();
  const results: ParametricSelectionResult[] = [];

  for (const rule of rules) {
    if (!evaluateRule(rule, variables)) continue;

    // Use the first condition's variable as the "category" key
    const categoryKey = rule.conditions[0]?.variable ?? 'default';

    if (!matchedCategories.has(categoryKey)) {
      matchedCategories.add(categoryKey);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        resultItemId: rule.resultItemId,
        resultSku: rule.resultSku,
        resultName: rule.resultName,
        quantityPerUnit: rule.resultQuantityPerUnit ?? 1,
        matchedConditions: rule.conditions,
      });
    }
  }

  return results;
}

/**
 * Preview what a set of variables would resolve to, without persisting anything.
 * Useful for the parametric matrix editor to test rules.
 */
export async function previewParametricResolution(
  variables: Record<string, string>,
): Promise<{ matched: ParametricSelectionResult[]; unmatched: ParametricRule[] }> {
  const allRules = await getAllParametricRules();
  const matched: ParametricSelectionResult[] = [];
  const unmatched: ParametricRule[] = [];

  for (const rule of allRules) {
    if (evaluateRule(rule, variables)) {
      matched.push({
        ruleId: rule.id,
        ruleName: rule.name,
        resultItemId: rule.resultItemId,
        resultSku: rule.resultSku,
        resultName: rule.resultName,
        quantityPerUnit: rule.resultQuantityPerUnit ?? 1,
        matchedConditions: rule.conditions,
      });
    } else if (rule.isActive) {
      unmatched.push(rule);
    }
  }

  return { matched, unmatched };
}
