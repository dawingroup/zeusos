/**
 * Shared utilities for Market Intelligence functions
 * DawinOS v2.0 - Common helpers for AI-driven competitive intelligence
 */

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein-inspired approach for fuzzy matching
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Remove common suffixes/prefixes for company names
  const cleanName = (name) => {
    return name
      .replace(/\b(ltd|limited|inc|incorporated|corp|corporation|llc|plc|pty|co)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const clean1 = cleanName(s1);
  const clean2 = cleanName(s2);

  if (clean1 === clean2) return 0.95;
  if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.85;

  // Calculate Levenshtein distance
  const matrix = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  );

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLength);
}

/**
 * Find best matching competitor using fuzzy matching
 * Returns { competitor, confidence, isExactMatch }
 */
function findBestCompetitorMatch(competitorName, competitors) {
  if (!competitorName || !competitors || competitors.length === 0) {
    return { competitor: null, confidence: 0, isExactMatch: false };
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const competitor of competitors) {
    // Null safety check
    if (!competitor || !competitor.name) continue;

    const score = calculateStringSimilarity(competitorName, competitor.name);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = competitor;
    }
  }

  // Confidence thresholds:
  // 1.0 = exact match
  // 0.9+ = very high confidence (substring match)
  // 0.85+ = high confidence (cleaned match)
  // 0.7+ = acceptable match (fuzzy)
  // <0.7 = too uncertain

  const isExactMatch = bestScore === 1.0;
  const isAcceptable = bestScore >= 0.7;

  return {
    competitor: isAcceptable ? bestMatch : null,
    confidence: bestScore,
    isExactMatch,
  };
}

/**
 * Parse JSON from Gemini response
 * Handles responses wrapped in markdown code blocks or plain text
 */
function parseGeminiJSON(text) {
  // Try direct JSON parse
  try {
    return JSON.parse(text);
  } catch (_) {
    // noop
  }

  // Try extracting from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch (_) {
      // noop
    }
  }

  // Try finding JSON object in text
  const objMatch = text.match(/(\{[\s\S]*\})/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[1]);
    } catch (_) {
      // noop
    }
  }

  // Try finding JSON array in text
  const arrMatch = text.match(/(\[[\s\S]*\])/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[1]);
    } catch (_) {
      // noop
    }
  }

  return null;
}

/**
 * Map finding category to competitive move type
 */
function mapFindingCategoryToMoveType(category) {
  const mapping = {
    product_launch: 'product_launch',
    partnership: 'partnership',
    expansion: 'expansion',
    pricing: 'price_change',
    hiring: 'talent_hire',
    marketing: 'marketing_campaign',
    technology: 'technology_launch',
    leadership: 'leadership_change',
    funding: 'funding_round',
    regulatory: 'regulatory_filing',
    other: 'market_entry',
  };
  return mapping[category] || 'market_entry';
}

module.exports = {
  calculateStringSimilarity,
  findBestCompetitorMatch,
  parseGeminiJSON,
  mapFindingCategoryToMoveType,
};
