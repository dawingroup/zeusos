/**
 * Confidence Scorer
 * 
 * Calculates confidence scores for AI-parsed BOQ data.
 */

import type {
  ConfidenceScore,
  ConfidenceFactor,
  ConfidenceLevel,
  ParsedItem,
  ParsedSection,
} from '../types/parsing';

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate overall confidence score from multiple factors
 */
export const calculateOverallConfidence = (factors: ConfidenceFactor[]): number => {
  if (factors.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    const impact = factor.impact === 'positive' ? 1 : factor.impact === 'negative' ? -1 : 0;
    weightedSum += (factor.weight * impact);
    totalWeight += factor.weight;
  }

  // Normalize to 0-1 range
  const baseScore = 0.5;
  const adjustment = totalWeight > 0 ? weightedSum / totalWeight * 0.5 : 0;
  
  return Math.max(0, Math.min(1, baseScore + adjustment));
};

/**
 * Calculate field-level confidence for an item
 */
export const calculateFieldConfidence = (
  item: Partial<ParsedItem>,
  _sourceData: Record<string, any>
): Record<string, number> => {
  const fieldConfidence: Record<string, number> = {};

  // Item number confidence
  if (item.itemNumber) {
    fieldConfidence.itemNumber = evaluateItemNumber(item.itemNumber);
  }

  // Description confidence
  if (item.description) {
    fieldConfidence.description = evaluateDescription(item.description);
  }

  // Quantity confidence
  if (item.quantity !== undefined) {
    fieldConfidence.quantity = evaluateQuantity(item.quantity, item.unit || '');
  }

  // Unit confidence
  if (item.unit) {
    fieldConfidence.unit = evaluateUnit(item.unit);
  }

  // Rate confidence
  if (item.unitRate !== undefined) {
    fieldConfidence.unitRate = evaluateRate(item.unitRate, item.quantity || 0);
  }

  return fieldConfidence;
};

/**
 * Calculate item-level confidence score
 */
export const calculateItemConfidence = (
  item: Partial<ParsedItem>,
  sourceData: Record<string, any>
): ConfidenceScore => {
  const factors: ConfidenceFactor[] = [];
  const fields = calculateFieldConfidence(item, sourceData);

  // Check for complete data
  if (item.description && item.description.length > 10) {
    factors.push({
      factor: 'description_complete',
      impact: 'positive',
      weight: 0.2,
      reason: 'Description is complete and detailed',
    });
  } else if (!item.description || item.description.length < 5) {
    factors.push({
      factor: 'description_missing',
      impact: 'negative',
      weight: 0.3,
      reason: 'Description is missing or too short',
    });
  }

  // Check quantity validity
  if (item.quantity !== undefined && item.quantity > 0) {
    factors.push({
      factor: 'quantity_valid',
      impact: 'positive',
      weight: 0.15,
      reason: 'Quantity is valid and positive',
    });
  } else {
    factors.push({
      factor: 'quantity_invalid',
      impact: 'negative',
      weight: 0.25,
      reason: 'Quantity is missing or invalid',
    });
  }

  // Check rate validity
  if (item.unitRate !== undefined && item.unitRate > 0) {
    factors.push({
      factor: 'rate_valid',
      impact: 'positive',
      weight: 0.15,
      reason: 'Rate is valid and positive',
    });
  } else {
    factors.push({
      factor: 'rate_invalid',
      impact: 'negative',
      weight: 0.2,
      reason: 'Rate is missing or invalid',
    });
  }

  // Check calculation consistency
  if (item.quantity !== undefined && item.unitRate !== undefined && item.totalAmount !== undefined) {
    const calculated = item.quantity * item.unitRate;
    const variance = Math.abs(calculated - item.totalAmount) / Math.max(calculated, 1);
    
    if (variance < 0.01) {
      factors.push({
        factor: 'calculation_consistent',
        impact: 'positive',
        weight: 0.2,
        reason: 'Quantity × Rate = Total (consistent)',
      });
    } else {
      factors.push({
        factor: 'calculation_mismatch',
        impact: 'negative',
        weight: 0.25,
        reason: `Calculation mismatch: ${(variance * 100).toFixed(1)}% variance`,
      });
    }
  }

  // Check unit standardization
  if (item.unit && isStandardUnit(item.unit)) {
    factors.push({
      factor: 'unit_standard',
      impact: 'positive',
      weight: 0.1,
      reason: 'Unit is standard format',
    });
  } else if (item.unit) {
    factors.push({
      factor: 'unit_nonstandard',
      impact: 'neutral',
      weight: 0.05,
      reason: 'Unit may need normalization',
    });
  }

  const overall = calculateWeightedAverage(Object.values(fields));

  return {
    overall,
    fields,
    factors,
  };
};

/**
 * Calculate section-level confidence
 */
export const calculateSectionConfidence = (
  section: Partial<ParsedSection>,
  items: ParsedItem[]
): ConfidenceScore => {
  const factors: ConfidenceFactor[] = [];

  // Section name validity
  if (section.name && section.name.length > 3) {
    factors.push({
      factor: 'name_valid',
      impact: 'positive',
      weight: 0.15,
      reason: 'Section name is valid',
    });
  }

  // Category assignment
  if (section.category && (section.category as string) !== 'other') {
    factors.push({
      factor: 'category_assigned',
      impact: 'positive',
      weight: 0.15,
      reason: 'Category properly identified',
    });
  }

  // Item count
  if (items.length > 0) {
    factors.push({
      factor: 'has_items',
      impact: 'positive',
      weight: 0.2,
      reason: `Section contains ${items.length} items`,
    });
  } else {
    factors.push({
      factor: 'no_items',
      impact: 'negative',
      weight: 0.3,
      reason: 'Section has no items',
    });
  }

  // Average item confidence
  if (items.length > 0) {
    const avgItemConfidence = items.reduce((sum, item) => 
      sum + (item.confidence?.overall || 0), 0
    ) / items.length;

    if (avgItemConfidence >= 0.8) {
      factors.push({
        factor: 'items_high_confidence',
        impact: 'positive',
        weight: 0.3,
        reason: `Items have high average confidence (${(avgItemConfidence * 100).toFixed(0)}%)`,
      });
    } else if (avgItemConfidence < 0.5) {
      factors.push({
        factor: 'items_low_confidence',
        impact: 'negative',
        weight: 0.3,
        reason: `Items have low average confidence (${(avgItemConfidence * 100).toFixed(0)}%)`,
      });
    }
  }

  const overall = calculateOverallConfidence(factors);

  return {
    overall,
    fields: {},
    factors,
  };
};

// ============================================================================
// FIELD EVALUATION HELPERS
// ============================================================================

const evaluateItemNumber = (itemNumber: string): number => {
  if (!itemNumber) return 0;
  
  // Check if it matches common patterns
  const patterns = [
    /^\d+(\.\d+)*$/, // 1, 1.1, 1.1.1
    /^[A-Z]\d+$/, // A1, B2
    /^\d+[a-z]?$/, // 1, 1a, 2b
    /^[A-Z]+\d+\.\d+$/, // A1.1, B2.3
  ];

  for (const pattern of patterns) {
    if (pattern.test(itemNumber)) {
      return 0.95;
    }
  }

  // Has some structure but non-standard
  if (/\d/.test(itemNumber)) {
    return 0.7;
  }

  return 0.4;
};

const evaluateDescription = (description: string): number => {
  if (!description) return 0;
  
  const length = description.length;
  let score = 0.5;

  // Length scoring
  if (length >= 20 && length <= 500) {
    score += 0.2;
  } else if (length >= 10) {
    score += 0.1;
  }

  // Contains construction keywords
  const constructionKeywords = [
    'concrete', 'steel', 'formwork', 'reinforcement', 'excavation',
    'plaster', 'paint', 'tile', 'pipe', 'wire', 'cable', 'brick',
    'block', 'sand', 'cement', 'aggregate', 'rebar', 'mesh'
  ];

  const lowerDesc = description.toLowerCase();
  const keywordCount = constructionKeywords.filter(kw => lowerDesc.includes(kw)).length;
  
  if (keywordCount > 0) {
    score += Math.min(0.2, keywordCount * 0.05);
  }

  // Contains specifications (dimensions, grades)
  if (/\d+\s*(mm|m|kg|mpa|grade)/i.test(description)) {
    score += 0.1;
  }

  return Math.min(1, score);
};

const evaluateQuantity = (quantity: number, unit: string): number => {
  if (quantity === undefined || quantity === null) return 0;
  if (quantity < 0) return 0.1;
  if (quantity === 0) return 0.3;

  // Check for reasonable ranges based on unit
  const unitLower = unit.toLowerCase();
  
  if (['m²', 'sqm', 'm2'].includes(unitLower)) {
    // Area: typically 1 to 100,000 m²
    if (quantity > 0 && quantity < 100000) return 0.9;
    if (quantity >= 100000) return 0.6; // Unusually large
  }

  if (['m³', 'cum', 'm3'].includes(unitLower)) {
    // Volume: typically 0.1 to 10,000 m³
    if (quantity > 0 && quantity < 10000) return 0.9;
  }

  if (['nr', 'no', 'pcs', 'nos'].includes(unitLower)) {
    // Count: typically whole numbers
    if (Number.isInteger(quantity)) return 0.95;
    return 0.7;
  }

  // General positive quantity
  if (quantity > 0) return 0.8;

  return 0.5;
};

const evaluateUnit = (unit: string): number => {
  if (!unit) return 0;
  
  const standardUnits = [
    'm', 'm²', 'm³', 'mm', 'cm', 'km',
    'kg', 't', 'tonnes',
    'nr', 'no', 'pcs', 'nos',
    'l.s.', 'ls', 'item', 'sum',
    'lm', 'rm',
    'l', 'litres', 'liters',
    'hr', 'day', 'week', 'month',
  ];

  const unitLower = unit.toLowerCase().replace(/[.\s]/g, '');
  
  // Exact match
  for (const std of standardUnits) {
    if (std.toLowerCase().replace(/[.\s]/g, '') === unitLower) {
      return 0.95;
    }
  }

  // Partial match
  for (const std of standardUnits) {
    if (unitLower.includes(std.toLowerCase().replace(/[.\s]/g, ''))) {
      return 0.8;
    }
  }

  // Unknown but has some structure
  if (unit.length <= 10) {
    return 0.5;
  }

  return 0.3;
};

const evaluateRate = (rate: number, _quantity: number): number => {
  if (rate === undefined || rate === null) return 0;
  if (rate < 0) return 0.1;
  if (rate === 0) return 0.4; // Could be valid for some items

  // Check for reasonable rate ranges (UGX)
  // Typical construction rates: 1,000 to 10,000,000 UGX per unit
  if (rate >= 100 && rate <= 50000000) {
    return 0.9;
  }

  if (rate < 100) {
    return 0.5; // Very low rate
  }

  if (rate > 50000000) {
    return 0.6; // Very high rate
  }

  return 0.7;
};

const isStandardUnit = (unit: string): boolean => {
  const standardUnits = [
    'm', 'm²', 'm³', 'mm', 'cm', 'kg', 't',
    'nr', 'no', 'pcs', 'l.s.', 'ls', 'item',
    'lm', 'rm', 'l', 'hr', 'day'
  ];

  const unitLower = unit.toLowerCase().replace(/[.\s]/g, '');
  return standardUnits.some(std => 
    std.toLowerCase().replace(/[.\s]/g, '') === unitLower
  );
};

const calculateWeightedAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

// ============================================================================
// CONFIDENCE LEVEL HELPERS
// ============================================================================

/**
 * Get confidence level from score
 */
export const getConfidenceLevel = (score: number): ConfidenceLevel => {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  if (score >= 0.45) return 'low';
  return 'very_low';
};

/**
 * Get review status based on confidence
 */
export const getReviewStatus = (confidence: number): 'auto_approved' | 'pending' | 'needs_review' => {
  if (confidence >= 0.90) return 'auto_approved';
  if (confidence >= 0.70) return 'pending';
  return 'needs_review';
};

/**
 * Get color for confidence level
 */
export const getConfidenceColor = (level: ConfidenceLevel): string => {
  switch (level) {
    case 'high': return 'green';
    case 'medium': return 'yellow';
    case 'low': return 'orange';
    case 'very_low': return 'red';
  }
};

export default {
  calculateOverallConfidence,
  calculateFieldConfidence,
  calculateItemConfidence,
  calculateSectionConfidence,
  getConfidenceLevel,
  getReviewStatus,
  getConfidenceColor,
};
