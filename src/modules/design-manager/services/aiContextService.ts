/**
 * AI Context Service
 * Manages shared context across AI tools with change detection
 *
 * Features:
 * - Tracks data snapshots for each section (Design Items)
 * - Detects when data changes between AI sessions
 * - Provides unified context to all AI tools
 * - Stores AI outputs with their source data snapshots
 * - Builds unified AI context for Strategy Canvas
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useMemo } from 'react';
import type { DesignItem } from '../types';
import type {
  StrategyAIContext,
  ProjectStrategy,
} from '../types/strategy';

export interface DataSnapshot {
  timestamp: number;
  hash: string;
  data: Record<string, any>;
}

export interface AIOutput {
  id: string;
  toolName: string;
  timestamp: number;
  output: any;
  sourceSnapshot: DataSnapshot;
  isStale: boolean;
}

export interface AIContext {
  designItemId: string;
  projectId: string;
  lastUpdated: number;
  
  // Current data snapshots by section
  snapshots: {
    overview?: DataSnapshot;
    parameters?: DataSnapshot;
    parts?: DataSnapshot;
    files?: DataSnapshot;
    ragStatus?: DataSnapshot;
  };
  
  // AI outputs with their source snapshots
  outputs: AIOutput[];
  
  // Change flags
  changesDetected: {
    overview: boolean;
    parameters: boolean;
    parts: boolean;
    files: boolean;
    ragStatus: boolean;
  };
}

/**
 * Simple hash function for detecting data changes
 */
function hashData(data: any): string {
  if (!data || typeof data !== 'object') {
    return String(data || 'empty');
  }
  try {
    const keys = Object.keys(data).sort();
    const str = JSON.stringify(data, keys);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  } catch {
    return 'error';
  }
}

/**
 * Extract relevant data from a design item for a specific section
 */
function extractSectionData(item: DesignItem, section: string): Record<string, any> {
  switch (section) {
    case 'overview':
      return {
        name: item.name,
        description: item.description,
        category: item.category,
        priority: item.priority,
        currentStage: item.currentStage,
        sourcingType: (item as any).sourcingType,
      };
    case 'parameters':
      return (item as any).parameters || {};
    case 'parts':
      return { parts: (item as any).parts || [] };
    case 'ragStatus':
      return item.ragStatus || {};
    default:
      return {};
  }
}

/**
 * Create a snapshot of section data
 */
function createSnapshot(data: Record<string, any>): DataSnapshot {
  return {
    timestamp: Date.now(),
    hash: hashData(data),
    data,
  };
}

/**
 * Load AI context from Firestore
 */
export async function loadAIContext(designItemId: string, _projectId: string): Promise<AIContext | null> {
  try {
    const contextRef = doc(db, 'aiContext', designItemId);
    const snapshot = await getDoc(contextRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as AIContext;
    }
    return null;
  } catch (error) {
    console.error('Error loading AI context:', error);
    return null;
  }
}

/**
 * Save AI context to Firestore
 */
export async function saveAIContext(context: AIContext): Promise<void> {
  try {
    const contextRef = doc(db, 'aiContext', context.designItemId);
    await setDoc(contextRef, {
      ...context,
      lastUpdated: Date.now(),
    }, { merge: true });
  } catch (error) {
    console.error('Error saving AI context:', error);
  }
}

/**
 * Update context with current item data and detect changes
 */
export function updateContextWithItem(
  context: AIContext | null, 
  item: DesignItem,
  projectId: string
): AIContext {
  const sections = ['overview', 'parameters', 'parts', 'ragStatus'] as const;
  
  const newContext: AIContext = context || {
    designItemId: item.id,
    projectId,
    lastUpdated: Date.now(),
    snapshots: {},
    outputs: [],
    changesDetected: {
      overview: false,
      parameters: false,
      parts: false,
      files: false,
      ragStatus: false,
    },
  };
  
  // Check each section for changes
  for (const section of sections) {
    const currentData = extractSectionData(item, section);
    const currentHash = hashData(currentData);
    const previousSnapshot = newContext.snapshots[section];
    
    if (!previousSnapshot) {
      // First time - no change detected
      newContext.snapshots[section] = createSnapshot(currentData);
      newContext.changesDetected[section] = false;
    } else if (previousSnapshot.hash !== currentHash) {
      // Data has changed
      newContext.changesDetected[section] = true;
      // Mark relevant outputs as stale
      newContext.outputs = newContext.outputs.map(output => {
        if (output.sourceSnapshot.hash === previousSnapshot.hash) {
          return { ...output, isStale: true };
        }
        return output;
      });
    }
  }
  
  return newContext;
}

/**
 * Record an AI output with its source snapshot
 */
export function recordAIOutput(
  context: AIContext,
  toolName: string,
  output: any,
  sourceSections: string[]
): AIContext {
  // Create combined snapshot from source sections
  const combinedData: Record<string, any> = {};
  for (const section of sourceSections) {
    const snapshot = context.snapshots[section as keyof typeof context.snapshots];
    if (snapshot) {
      combinedData[section] = snapshot.data;
    }
  }
  
  const aiOutput: AIOutput = {
    id: `${toolName}-${Date.now()}`,
    toolName,
    timestamp: Date.now(),
    output,
    sourceSnapshot: createSnapshot(combinedData),
    isStale: false,
  };
  
  // Clear change flags for used sections
  const updatedChanges = { ...context.changesDetected };
  for (const section of sourceSections) {
    updatedChanges[section as keyof typeof updatedChanges] = false;
  }
  
  // Update snapshots to current
  const updatedSnapshots = { ...context.snapshots };
  for (const section of sourceSections) {
    const data = combinedData[section];
    if (data) {
      updatedSnapshots[section as keyof typeof updatedSnapshots] = createSnapshot(data);
    }
  }
  
  return {
    ...context,
    snapshots: updatedSnapshots,
    outputs: [...context.outputs.slice(-9), aiOutput], // Keep last 10 outputs
    changesDetected: updatedChanges,
    lastUpdated: Date.now(),
  };
}

/**
 * Get the latest output for a specific tool
 */
export function getLatestOutput(context: AIContext, toolName: string): AIOutput | null {
  const toolOutputs = context.outputs.filter(o => o.toolName === toolName);
  return toolOutputs.length > 0 ? toolOutputs[toolOutputs.length - 1] : null;
}

/**
 * Check if any sections have changes that affect a tool
 */
export function hasRelevantChanges(
  context: AIContext, 
  relevantSections: string[]
): boolean {
  return relevantSections.some(
    section => context.changesDetected[section as keyof typeof context.changesDetected]
  );
}

/**
 * Get a summary of changes for display
 */
export function getChangeSummary(context: AIContext): string[] {
  const changes: string[] = [];
  const labels: Record<string, string> = {
    overview: 'Overview information',
    parameters: 'Parameters & specifications',
    parts: 'Parts list',
    files: 'Attached files',
    ragStatus: 'RAG status',
  };

  for (const [section, hasChange] of Object.entries(context.changesDetected)) {
    if (hasChange) {
      changes.push(labels[section] || section);
    }
  }

  return changes;
}

// ============================================
// Strategy Canvas AI Context Functions
// ============================================

/**
 * Build unified AI context from strategy and project data
 * Aggregates all relevant context for AI tools
 */
export function buildUnifiedStrategyAIContext(
  strategy: ProjectStrategy | null,
  customerIntelligence?: {
    segment?: string;
    materialPreferences?: string[];
    preferredSuppliers?: string[];
    qualityExpectations?: string;
    priceSensitivity?: number;
  }
): StrategyAIContext | null {
  if (!strategy) return null;

  const projectContext = strategy.projectContext;

  // Merge material preferences from both sources and de-duplicate
  const mergedMaterialPreferences = Array.from(
    new Set([
      ...(projectContext?.style?.materialPreferences || []),
      ...(customerIntelligence?.materialPreferences || []),
    ])
  );

  return {
    customer: {
      name: projectContext?.customer?.name || '',
      company: projectContext?.customer?.company,
      industry: projectContext?.customer?.industry,
      segment: customerIntelligence?.segment,
      materialPreferences: mergedMaterialPreferences.length > 0 ? mergedMaterialPreferences : undefined,
      preferredSuppliers: customerIntelligence?.preferredSuppliers,
      qualityExpectations: customerIntelligence?.qualityExpectations,
      priceSensitivity: customerIntelligence?.priceSensitivity,
      previousProjects: projectContext?.customer?.previousProjects,
      preferredStyle: projectContext?.customer?.preferredStyle,
    },

    project: {
      type: projectContext?.project?.type || '',
      subType: projectContext?.project?.subType,
      location: projectContext?.project?.location || '',
      country: projectContext?.project?.country || '',
      region: projectContext?.project?.region,
    },

    timeline: projectContext?.timeline ? {
      startDate: projectContext.timeline.startDate,
      targetCompletion: projectContext.timeline.targetCompletion,
      urgency: projectContext.timeline.urgency,
      milestones: projectContext.timeline.milestones,
    } : undefined,

    style: projectContext?.style ? {
      primary: projectContext.style.primary,
      secondary: projectContext.style.secondary,
      colorPreferences: projectContext.style.colorPreferences,
      materialPreferences: projectContext.style.materialPreferences,
      avoidStyles: projectContext.style.avoidStyles,
      inspirationNotes: projectContext.style.inspirationNotes,
    } : undefined,

    targetUsers: projectContext?.targetUsers ? {
      demographic: projectContext.targetUsers.demographic,
      capacity: projectContext.targetUsers.capacity,
      usagePattern: projectContext.targetUsers.usagePattern,
      specialNeeds: projectContext.targetUsers.specialNeeds,
    } : undefined,

    requirements: projectContext?.requirements ? {
      sustainability: projectContext.requirements.sustainability,
      localSourcing: projectContext.requirements.localSourcing,
      accessibilityCompliant: projectContext.requirements.accessibilityCompliant,
      brandGuidelines: projectContext.requirements.brandGuidelines,
      customFinishes: projectContext.requirements.customFinishes,
      notes: projectContext.requirements.notes,
    } : undefined,

    challenges: strategy.challenges || {
      painPoints: [],
      goals: [],
      constraints: [],
    },

    spaceParameters: strategy.spaceParameters,

    budgetFramework: strategy.budgetFramework,

    designBrief: strategy.designBrief,

    researchFindings: strategy.researchFindings || [],
  };
}

/**
 * Extract key context summary for AI prompts
 * Returns a concise text summary of the context
 */
export function extractStrategyContextSummary(context: StrategyAIContext): string {
  const parts: string[] = [];

  // Project basics
  if (context.project.type) {
    parts.push(`Project Type: ${context.project.type}${context.project.subType ? ` (${context.project.subType})` : ''}`);
  }

  if (context.project.location) {
    parts.push(`Location: ${context.project.location}, ${context.project.country}`);
  }

  // Space
  if (context.spaceParameters) {
    parts.push(
      `Space: ${context.spaceParameters.totalArea} ${context.spaceParameters.areaUnit} (${context.spaceParameters.spaceType})`
    );
  }

  // Budget
  if (context.budgetFramework) {
    parts.push(`Budget Tier: ${context.budgetFramework.tier}`);
    if (context.budgetFramework.targetAmount) {
      parts.push(
        `Target Budget: ${context.budgetFramework.currency} ${context.budgetFramework.targetAmount.toLocaleString()}`
      );
    }
  }

  // Style
  if (context.style?.primary) {
    parts.push(`Style: ${context.style.primary}${context.style.secondary ? ` / ${context.style.secondary}` : ''}`);
  }

  // Materials
  if (context.customer.materialPreferences && context.customer.materialPreferences.length > 0) {
    parts.push(`Preferred Materials: ${context.customer.materialPreferences.join(', ')}`);
  }

  // Constraints
  if (context.challenges.constraints.length > 0) {
    parts.push(`Constraints: ${context.challenges.constraints.join('; ')}`);
  }

  // Goals
  if (context.challenges.goals.length > 0) {
    parts.push(`Goals: ${context.challenges.goals.join('; ')}`);
  }

  return parts.join('\n');
}

/**
 * Check if context is sufficient for AI processing
 * Returns validation result with missing required fields
 */
export function validateStrategyAIContext(context: StrategyAIContext): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!context.project.type) {
    missingFields.push('Project type');
  }

  if (!context.project.location) {
    missingFields.push('Project location');
  }

  if (!context.spaceParameters?.totalArea || context.spaceParameters.totalArea <= 0) {
    missingFields.push('Space area');
  }

  if (!context.budgetFramework?.tier) {
    missingFields.push('Budget tier');
  }

  // Warnings for missing optional but helpful fields
  if (!context.designBrief || context.designBrief.length < 20) {
    warnings.push('Design brief is very short or missing');
  }

  if (!context.style?.primary) {
    warnings.push('Style preferences not specified');
  }

  if (context.challenges.goals.length === 0) {
    warnings.push('No project goals defined');
  }

  if (!context.customer.materialPreferences || context.customer.materialPreferences.length === 0) {
    warnings.push('No material preferences specified');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

/**
 * Infer budget tier from price sensitivity
 * Helper for customer intelligence integration
 */
export function inferBudgetTierFromPriceSensitivity(
  priceSensitivity: number | undefined
): 'economy' | 'standard' | 'premium' | 'luxury' | undefined {
  if (priceSensitivity === undefined) return undefined;

  // priceSensitivity: 0 = not sensitive (luxury), 1 = very sensitive (economy)
  if (priceSensitivity <= 0.25) return 'luxury';
  if (priceSensitivity <= 0.5) return 'premium';
  if (priceSensitivity <= 0.75) return 'standard';
  return 'economy';
}

/**
 * Hook for unified AI context with automatic updates
 * Memoizes context building for performance
 */
export function useUnifiedStrategyAIContext(
  strategy: ProjectStrategy | null,
  customerIntelligence?: {
    segment?: string;
    materialPreferences?: string[];
    preferredSuppliers?: string[];
    qualityExpectations?: string;
    priceSensitivity?: number;
  }
): {
  context: StrategyAIContext | null;
  summary: string;
  validation: {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  };
  isReady: boolean;
} {
  const context = useMemo(
    () => buildUnifiedStrategyAIContext(strategy, customerIntelligence),
    [strategy, customerIntelligence]
  );

  const summary = useMemo(
    () => (context ? extractStrategyContextSummary(context) : ''),
    [context]
  );

  const validation = useMemo(
    () => (context ? validateStrategyAIContext(context) : {
      isValid: false,
      missingFields: ['Strategy not loaded'],
      warnings: [],
    }),
    [context]
  );

  return {
    context,
    summary,
    validation,
    isReady: context !== null && validation.isValid,
  };
}

/**
 * Hook for customer intelligence suggestions
 * Returns auto-population suggestions based on customer history
 */
export function useCustomerIntelligenceSuggestions(
  customerIntelligence?: {
    segment?: string;
    materialPreferences?: string[];
    preferredSuppliers?: string[];
    qualityExpectations?: string;
    priceSensitivity?: number;
  },
  currentStrategy?: Partial<ProjectStrategy>
): {
  hasSuggestions: boolean;
  suggestions: {
    materialPreferences?: string[];
    budgetTier?: 'economy' | 'standard' | 'premium' | 'luxury';
    qualityLevel?: string;
    qualityExpectations?: string;
    suppliers?: string[];
  };
  canApply: boolean;
} {
  const suggestions = useMemo(() => {
    if (!customerIntelligence) return {};

    const result: any = {};

    // Material preferences not in current strategy
    if (customerIntelligence.materialPreferences && customerIntelligence.materialPreferences.length > 0) {
      const currentMaterials = currentStrategy?.projectContext?.style?.materialPreferences || [];
      const newMaterials = customerIntelligence.materialPreferences.filter(
        (mat) => !currentMaterials.includes(mat)
      );
      if (newMaterials.length > 0) {
        result.materialPreferences = newMaterials;
      }
    }

    // Budget tier inference
    if (customerIntelligence.priceSensitivity !== undefined) {
      const inferredTier = inferBudgetTierFromPriceSensitivity(customerIntelligence.priceSensitivity);
      if (inferredTier && inferredTier !== currentStrategy?.budgetFramework?.tier) {
        result.budgetTier = inferredTier;
      }
    }

    // Quality expectations
    if (customerIntelligence.qualityExpectations) {
      result.qualityLevel = customerIntelligence.qualityExpectations;
      result.qualityExpectations = customerIntelligence.qualityExpectations;
    }

    // Preferred suppliers
    if (customerIntelligence.preferredSuppliers && customerIntelligence.preferredSuppliers.length > 0) {
      result.suppliers = customerIntelligence.preferredSuppliers;
    }

    return result;
  }, [customerIntelligence, currentStrategy]);

  const hasSuggestions = Object.keys(suggestions).length > 0;
  const canApply = hasSuggestions && !!currentStrategy;

  return {
    hasSuggestions,
    suggestions,
    canApply,
  };
}

/**
 * Apply customer intelligence suggestions to strategy
 * Returns updated strategy with suggestions applied
 */
export function applyCustomerIntelligenceSuggestions(
  currentStrategy: ProjectStrategy,
  suggestions: {
    materialPreferences?: string[];
    budgetTier?: 'economy' | 'standard' | 'premium' | 'luxury';
    qualityLevel?: string;
    qualityExpectations?: string;
    suppliers?: string[];
  }
): Partial<ProjectStrategy> {
  const updates: Record<string, any> = {};

  // Update material preferences
  if (suggestions.materialPreferences) {
    const existingMaterials = currentStrategy.projectContext?.style?.materialPreferences || [];
    updates.projectContext = {
      ...currentStrategy.projectContext,
      style: {
        ...currentStrategy.projectContext?.style,
        primary: currentStrategy.projectContext?.style?.primary || '',
        materialPreferences: [
          ...existingMaterials,
          ...suggestions.materialPreferences,
        ],
      },
    };
  }

  // Update budget tier
  if (suggestions.budgetTier) {
    updates.budgetFramework = {
      ...currentStrategy.budgetFramework,
      tier: suggestions.budgetTier,
    };
  }

  // Update requirements with quality level
  if (suggestions.qualityLevel) {
    updates.projectContext = {
      ...updates.projectContext,
      ...currentStrategy.projectContext,
      requirements: {
        ...currentStrategy.projectContext?.requirements,
        notes: suggestions.qualityLevel,
      },
    };
  }

  return updates;
}
