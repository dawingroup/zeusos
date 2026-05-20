/**
 * Gemini Prompt Templates for BOQ Parsing
 * 
 * Structured prompts for AI-powered BOQ document parsing.
 */

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const BOQ_PARSER_SYSTEM_PROMPT = `You are an expert construction Bill of Quantities (BOQ) parser specializing in East African construction projects, particularly in Uganda.

Your role is to:
1. Analyze BOQ documents and extract structured data
2. Identify sections, items, quantities, and rates
3. Normalize units and formats to standard construction conventions
4. Flag ambiguous or potentially incorrect entries
5. Suggest corrections based on construction industry knowledge

Key knowledge areas:
- Standard construction BOQ formats (FIDIC, NRM, SMM7)
- Uganda building regulations and standards
- East African construction terminology and units
- Common BOQ categories: preliminaries, substructure, superstructure, finishes, services, external works
- Standard measurement units: m, m², m³, kg, tonnes, nr (number), item, lump sum

Always respond with valid JSON matching the specified schema.`;

// ============================================================================
// PARSING PROMPTS
// ============================================================================

export const EXCEL_ANALYSIS_PROMPT = `Analyze this Excel BOQ data and identify the structure.

Excel Data:
{excelData}

Identify:
1. Header row location
2. Data start row
3. Section indicators (rows that define new sections)
4. Column mapping (which columns contain which fields)
5. Currency and unit formats used
6. Any data quality issues

Respond with JSON:
{
  "headerRow": number,
  "dataStartRow": number,
  "sectionIndicatorRows": number[],
  "columnMapping": {
    "itemNumber": { "column": string|number, "confidence": number },
    "description": { "column": string|number, "confidence": number },
    "unit": { "column": string|number, "confidence": number },
    "quantity": { "column": string|number, "confidence": number },
    "laborRate": { "column": string|number, "confidence": number },
    "materialRate": { "column": string|number, "confidence": number },
    "equipmentRate": { "column": string|number, "confidence": number },
    "unitRate": { "column": string|number, "confidence": number },
    "totalAmount": { "column": string|number, "confidence": number }
  },
  "detectedCurrency": string,
  "detectedUnits": string[],
  "qualityIssues": string[],
  "overallConfidence": number
}`;

export const SECTION_PARSING_PROMPT = `Parse the following BOQ section data into structured format.

Section Data:
{sectionData}

Column Mapping:
{columnMapping}

Context:
- Project: {projectName}
- Previous sections: {previousSections}

Parse each row and return:
{
  "section": {
    "code": string,
    "name": string,
    "category": "preliminaries"|"substructure"|"superstructure"|"finishes"|"services"|"external_works"|"contingencies"|"other",
    "confidence": number
  },
  "items": [
    {
      "tempId": string,
      "itemNumber": string,
      "description": string,
      "specification": string|null,
      "quantity": number,
      "unit": string,
      "laborRate": number|null,
      "materialRate": number|null,
      "equipmentRate": number|null,
      "unitRate": number,
      "totalAmount": number,
      "confidence": {
        "overall": number,
        "fields": {
          "description": number,
          "quantity": number,
          "unit": number,
          "unitRate": number
        }
      },
      "flags": string[],
      "suggestions": [
        {
          "type": "correction"|"completion"|"normalization",
          "field": string,
          "currentValue": any,
          "suggestedValue": any,
          "reason": string,
          "confidence": number
        }
      ]
    }
  ],
  "subtotal": number,
  "parseMetadata": {
    "rowsProcessed": number,
    "itemsExtracted": number,
    "itemsWithIssues": number
  }
}

Guidelines:
- Normalize all units to standard abbreviations (m, m², m³, kg, nr, item, l.s.)
- Flag quantities that seem unusually high or low
- Identify potential calculation errors (quantity × rate ≠ total)
- Suggest missing data where inferable from context
- Preserve original descriptions but normalize formatting`;

export const MATERIAL_MATCHING_PROMPT = `Match these BOQ item descriptions to materials in the library.

BOQ Items:
{items}

Material Library:
{materialLibrary}

For each item, find the best matching material and alternatives.

Return:
{
  "matches": [
    {
      "itemId": string,
      "itemDescription": string,
      "bestMatch": {
        "materialId": string,
        "materialName": string,
        "matchScore": number,
        "matchType": "exact"|"fuzzy"|"category"|"none",
        "matchReason": string
      },
      "alternatives": [
        {
          "materialId": string,
          "materialName": string,
          "matchScore": number,
          "matchReason": string
        }
      ],
      "rateComparison": {
        "parsedRate": number,
        "libraryRate": number|null,
        "variance": number|null,
        "varianceFlag": "normal"|"high"|"very_high"|null
      }
    }
  ],
  "unmatchedItems": string[],
  "suggestedNewMaterials": [
    {
      "name": string,
      "category": string,
      "basedOnItem": string
    }
  ]
}

Matching guidelines:
- Score 0.9+ for exact or near-exact matches
- Score 0.7-0.9 for same material type with minor variation
- Score 0.5-0.7 for category matches
- Score <0.5 for weak matches
- Consider Uganda market terminology variations
- Flag rate variances >20% as "high", >50% as "very_high"`;

// ============================================================================
// VALIDATION PROMPTS
// ============================================================================

export const VALIDATION_PROMPT = `Validate the parsed BOQ data for construction accuracy.

Parsed BOQ:
{parsedBOQ}

Project Context:
{projectContext}

Perform validation:
1. Check mathematical consistency (qty × rate = total)
2. Verify unit appropriateness for item type
3. Flag unrealistic quantities or rates
4. Identify missing required items for project type
5. Check section categorization accuracy

Return:
{
  "isValid": boolean,
  "validationScore": number,
  "issues": [
    {
      "severity": "error"|"warning"|"info",
      "category": "calculation"|"unit"|"quantity"|"rate"|"categorization"|"completeness",
      "itemId": string|null,
      "message": string,
      "suggestedFix": string|null
    }
  ],
  "recommendations": [
    {
      "type": "missing_item"|"rate_review"|"quantity_check",
      "message": string,
      "priority": "high"|"medium"|"low"
    }
  ],
  "summary": {
    "totalItems": number,
    "itemsWithErrors": number,
    "itemsWithWarnings": number,
    "calculationAccuracy": number
  }
}`;

// ============================================================================
// UNIT NORMALIZATION PROMPT
// ============================================================================

export const UNIT_NORMALIZATION_PROMPT = `Normalize these construction measurement units to standard format.

Units to normalize:
{units}

Standard unit mappings:
- Length: m (meters), mm (millimeters), cm (centimeters)
- Area: m² (square meters), sqm, sq.m
- Volume: m³ (cubic meters), cum, cu.m
- Weight: kg (kilograms), t (tonnes)
- Count: nr (number), no., pcs (pieces)
- Lump sum: l.s., LS, item, sum
- Linear: lm (linear meter), rm (running meter)

Return:
{
  "normalizations": [
    {
      "original": string,
      "normalized": string,
      "confidence": number,
      "conversionFactor": number|null
    }
  ]
}`;

// ============================================================================
// CATEGORY DETECTION PROMPT
// ============================================================================

export const CATEGORY_DETECTION_PROMPT = `Categorize these BOQ section names into standard construction categories.

Sections:
{sections}

Standard Categories:
- preliminaries: Site setup, temporary works, insurances, bonds
- substructure: Excavation, foundations, ground floor slabs, basement
- superstructure: Columns, beams, walls, suspended slabs, roof structure
- finishes: Plastering, painting, tiling, flooring, ceilings
- services: Plumbing, electrical, HVAC, fire protection
- external_works: Landscaping, paving, drainage, fencing, gates
- provisional: PC sums, provisional sums, contingencies
- other: Items not fitting other categories

Return:
{
  "categorizations": [
    {
      "sectionName": string,
      "category": string,
      "confidence": number,
      "reasoning": string
    }
  ]
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a parsing prompt by replacing placeholders with values
 */
export const buildParsingPrompt = (
  template: string,
  variables: Record<string, any>
): string => {
  let prompt = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const stringValue = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
    prompt = prompt.replace(new RegExp(placeholder, 'g'), stringValue);
  }
  return prompt;
};

/**
 * Extract JSON from AI response text
 */
export const extractJSON = (response: string): any => {
  // Try to find JSON block in response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Continue to try other patterns
    }
  }

  // Try to extract raw JSON object
  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (e) {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  throw new Error('No JSON found in AI response');
};

/**
 * Validate JSON response against expected schema
 */
export const validateResponse = (
  response: any,
  requiredFields: string[]
): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];

  for (const field of requiredFields) {
    const parts = field.split('.');
    let current = response;

    for (const part of parts) {
      if (current === undefined || current === null || !(part in current)) {
        missing.push(field);
        break;
      }
      current = current[part];
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Clean and normalize text for consistent parsing
 */
export const normalizeText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
    .trim();
};

/**
 * Generate unique temporary ID for parsed items
 */
export const generateTempId = (sectionIndex: number, itemIndex: number): string => {
  return `temp-${sectionIndex}-${itemIndex}-${Date.now()}`;
};

export default {
  BOQ_PARSER_SYSTEM_PROMPT,
  EXCEL_ANALYSIS_PROMPT,
  SECTION_PARSING_PROMPT,
  MATERIAL_MATCHING_PROMPT,
  VALIDATION_PROMPT,
  UNIT_NORMALIZATION_PROMPT,
  CATEGORY_DETECTION_PROMPT,
  buildParsingPrompt,
  extractJSON,
  validateResponse,
  normalizeText,
  generateTempId,
};
