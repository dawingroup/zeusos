/**
 * Semantic Matcher
 * AI-powered formula matching using semantic analysis
 * 
 * NOTE: Full implementation requires Genkit configuration.
 * This is a stub that provides the interface for future AI integration.
 */

import type { StandardFormula } from '../../types';

/**
 * Semantic match result structure
 */
export interface SemanticMatchResult {
  suggestions: Array<{
    formulaCode: string;
    confidence: number;
    reasoning: string;
    alternativeReasons?: string[];
  }>;
  categoryPrediction?: string;
  ambiguityNotes?: string;
}

/**
 * Semantic matching options
 */
interface SemanticMatchOptions {
  maxSuggestions?: number;
  minConfidence?: number;
}

/**
 * Keyword-based semantic similarity (fallback when AI is not available)
 */
function calculateSemanticSimilarity(
  description: string,
  formula: StandardFormula
): number {
  const descWords = new Set(
    description.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
  
  const formulaText = `${formula.name} ${formula.description || ''} ${formula.category}`;
  const formulaWords = new Set(
    formulaText.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
  
  // Calculate Jaccard similarity
  const intersection = [...descWords].filter(w => formulaWords.has(w)).length;
  const union = new Set([...descWords, ...formulaWords]).size;
  
  return union > 0 ? intersection / union : 0;
}

/**
 * Generate reasoning based on matching keywords
 */
function generateReasoning(
  description: string,
  formula: StandardFormula
): string {
  const descLower = description.toLowerCase();
  const reasons: string[] = [];
  
  // Check for category matches
  if (descLower.includes(formula.category.toLowerCase())) {
    reasons.push(`Category match: ${formula.category}`);
  }
  
  // Check for specific keywords
  const keywords = formula.name.toLowerCase().split(/\s+/);
  const matchingKeywords = keywords.filter(kw => 
    kw.length > 3 && descLower.includes(kw)
  );
  
  if (matchingKeywords.length > 0) {
    reasons.push(`Keyword matches: ${matchingKeywords.join(', ')}`);
  }
  
  // Check for unit compatibility
  if (formula.outputUnit && descLower.includes(formula.outputUnit.toLowerCase())) {
    reasons.push(`Unit compatible: ${formula.outputUnit}`);
  }
  
  return reasons.length > 0 
    ? reasons.join('; ')
    : 'General semantic similarity based on description analysis';
}

/**
 * Perform semantic matching using local similarity algorithms
 * (Fallback when Genkit/AI is not available)
 */
export async function matchSemantically(
  description: string,
  _unit: string, // Reserved for future AI-based unit matching
  formulas: StandardFormula[],
  options?: SemanticMatchOptions
): Promise<SemanticMatchResult> {
  const { maxSuggestions = 3, minConfidence = 0.3 } = options || {};
  
  // Calculate similarity scores for all formulas
  const scored = formulas.map(formula => ({
    formula,
    similarity: calculateSemanticSimilarity(description, formula),
  }));
  
  // Sort by similarity
  scored.sort((a, b) => b.similarity - a.similarity);
  
  // Build suggestions
  const suggestions = scored
    .filter(s => s.similarity >= minConfidence * 0.5) // Adjust threshold for local matching
    .slice(0, maxSuggestions)
    .map(s => ({
      formulaCode: s.formula.code,
      confidence: Math.min(0.85, s.similarity * 1.5), // Scale up but cap
      reasoning: generateReasoning(description, s.formula),
    }));
  
  // Predict category from highest scoring match
  const topMatch = scored[0];
  const categoryPrediction = topMatch ? topMatch.formula.category : undefined;
  
  return {
    suggestions,
    categoryPrediction,
    ambiguityNotes: suggestions.length === 0 
      ? 'No strong semantic matches found. Consider manual formula selection.'
      : undefined,
  };
}

/**
 * Batch semantic matching for multiple items
 */
export async function matchSemanticBatch(
  items: Array<{ description: string; unit: string; id: string }>,
  formulas: StandardFormula[],
  options?: SemanticMatchOptions
): Promise<Map<string, SemanticMatchResult>> {
  const results = new Map<string, SemanticMatchResult>();
  
  // Process items (could be parallelized in future with real AI)
  for (const item of items) {
    const result = await matchSemantically(
      item.description,
      item.unit,
      formulas,
      options
    );
    results.set(item.id, result);
  }
  
  return results;
}
