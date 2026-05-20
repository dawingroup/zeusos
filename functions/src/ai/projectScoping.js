/**
 * Unified Project Scoping AI
 *
 * Hybrid Regex + LLM approach for deliverable extraction from design briefs.
 * Combines structured pattern matching with LLM intelligence for maximum accuracy.
 *
 * Features:
 * - Step 1: Fast regex extraction for structured patterns (32 rooms, each with wardrobe)
 * - Step 2: LLM validation & enhancement with full strategy context
 * - Step 3: Confidence scoring with reasoning and ambiguities
 * - Step 4: Budget tier multipliers for pricing hints
 * - Room-based deliverable generation using hospitality ontology
 * - Feature Library matching for manufacturability
 * - Google Search grounding for trend research
 * - Strategy context enrichment (budget tier, space parameters, material preferences)
 *
 * Based on Comprehensive AI Architecture specification + Strategy Enhancement Plan.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Import utilities
const { getCacheManager } = require('../utils/cacheManager');
const { checkRateLimit } = require('../utils/rateLimiter');

// ============================================
// Room Type Ontology (Hospitality Standards)
// ============================================

const ROOM_ONTOLOGY = {
  guest_room_standard: {
    name: 'Standard Guest Room',
    items: [
      { type: 'wardrobe', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bed_frame', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'nightstand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'desk_unit', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'tv_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'luggage_bench', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'bathroom_vanity', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'desk_chair', category: 'PROCURED', subcategory: 'seating', quantity: 1 },
      { type: 'bathroom_mirror', category: 'PROCURED', subcategory: 'fixtures', quantity: 1 },
    ]
  },
  guest_room_suite: {
    name: 'Suite / Junior Suite',
    items: [
      { type: 'wardrobe', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bed_frame', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'nightstand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'desk_unit', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'tv_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'minibar_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'coffee_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'sofa', category: 'PROCURED', subcategory: 'seating', quantity: 1 },
      { type: 'bathroom_vanity', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bathroom_vanity_double', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
    ]
  },
  master_bedroom: {
    name: 'Master Bedroom (Residential)',
    items: [
      { type: 'wardrobe', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bed_frame', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'nightstand', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'dresser', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'vanity_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
    ]
  },
  kitchen: {
    name: 'Kitchen',
    items: [
      { type: 'base_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 6 },
      { type: 'wall_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 4 },
      { type: 'tall_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 2 },
      { type: 'island', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'countertop', category: 'PROCURED', subcategory: 'surfaces', quantity: 1 },
    ]
  },
  restaurant_dining: {
    name: 'Restaurant Dining Area',
    items: [
      { type: 'dining_table_2seat', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 4 },
      { type: 'dining_table_4seat', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 8 },
      { type: 'banquette_seating', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'host_station', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'service_station', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'dining_chair', category: 'PROCURED', subcategory: 'seating', quantity: 40 },
    ]
  },
  reception_lobby: {
    name: 'Reception / Lobby',
    items: [
      { type: 'reception_desk', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'lobby_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 2 },
      { type: 'display_unit', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'lounge_seating', category: 'PROCURED', subcategory: 'seating', quantity: 4 },
    ]
  },
  office: {
    name: 'Office Space',
    items: [
      { type: 'desk_workstation', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'credenza', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'bookshelf', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'meeting_table', category: 'MANUFACTURED', subcategory: 'furniture', quantity: 1 },
      { type: 'office_chair', category: 'PROCURED', subcategory: 'seating', quantity: 1 },
    ]
  },
  retail: {
    name: 'Retail Space',
    items: [
      { type: 'display_counter', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'wall_display', category: 'MANUFACTURED', subcategory: 'fixtures', quantity: 4 },
      { type: 'floor_display', category: 'MANUFACTURED', subcategory: 'fixtures', quantity: 2 },
      { type: 'checkout_counter', category: 'MANUFACTURED', subcategory: 'casework', quantity: 1 },
      { type: 'storage_cabinet', category: 'MANUFACTURED', subcategory: 'casework', quantity: 2 },
    ]
  },
};

// ============================================
// Entity Extraction Patterns
// ============================================

const MULTIPLIER_PATTERNS = [
  /(\d+)\s*(?:guest\s*)?rooms?\s*,?\s*each\s+(?:with|having|containing)/gi,
  /(\d+)\s*(?:guest\s*)?rooms?\s+with/gi,
  /(\d+)\s*(?:standard|deluxe|suite|junior)\s*(?:guest\s*)?rooms?/gi,
  /(\d+)\s*offices?\s*,?\s*each\s+with/gi,
  /(\d+)\s*(?:bed)?rooms?/gi,
  /(\d+)\s*kitchens?/gi,
  /(\d+)\s*bathrooms?/gi,
  /per\s+(?:room|unit|space)/gi,
];

const ITEM_PATTERNS = [
  { pattern: /wardrobe|closet|armoire/gi, type: 'wardrobe' },
  { pattern: /desk(?:\s+area)?|work\s*station/gi, type: 'desk_unit' },
  { pattern: /bathroom\s*vanity|vanity\s*unit/gi, type: 'bathroom_vanity' },
  { pattern: /bed\s*frame|headboard/gi, type: 'bed_frame' },
  { pattern: /nightstand|bedside\s*table/gi, type: 'nightstand' },
  { pattern: /tv\s*(?:unit|console|stand)/gi, type: 'tv_unit' },
  { pattern: /reception\s*desk|front\s*desk/gi, type: 'reception_desk' },
  { pattern: /kitchen\s*cabinet|base\s*cabinet/gi, type: 'base_cabinet' },
  { pattern: /wall\s*cabinet|upper\s*cabinet/gi, type: 'wall_cabinet' },
  { pattern: /island|kitchen\s*island/gi, type: 'island' },
  { pattern: /dining\s*table/gi, type: 'dining_table' },
  { pattern: /coffee\s*table/gi, type: 'coffee_table' },
  { pattern: /bookshelf|bookcase/gi, type: 'bookshelf' },
  { pattern: /credenza|sideboard/gi, type: 'credenza' },
  { pattern: /display\s*(?:unit|cabinet|case)/gi, type: 'display_unit' },
];

// ============================================
// Strategy Context Integration
// ============================================

/**
 * Fetch project strategy from Firestore
 * @param {string} projectId
 * @returns {Promise<Object|null>} Project strategy data
 */
async function fetchProjectStrategy(projectId) {
  if (!projectId) return null;

  try {
    const strategyDoc = await db.collection('projectStrategy').doc(projectId).get();
    if (!strategyDoc.exists) return null;

    return {
      id: strategyDoc.id,
      ...strategyDoc.data(),
    };
  } catch (error) {
    console.warn('Failed to fetch project strategy:', error.message);
    return null;
  }
}

/**
 * Build unified AI context from strategy, customer intelligence, and brief
 * @param {Object} strategy - Project strategy
 * @param {string} briefText - Design brief text
 * @returns {Object} Unified context for LLM
 */
function buildStrategyAIContext(strategy, briefText) {
  if (!strategy) return null;

  return {
    projectContext: {
      type: strategy.projectContext?.type,
      location: strategy.projectContext?.location,
      country: strategy.projectContext?.country,
      timeline: strategy.projectContext?.timeline,
    },
    spaceParameters: strategy.spaceParameters ? {
      totalArea: strategy.spaceParameters.totalArea,
      areaUnit: strategy.spaceParameters.areaUnit,
      spaceType: strategy.spaceParameters.spaceType,
      circulationPercent: strategy.spaceParameters.circulationPercent,
    } : null,
    budgetFramework: strategy.budgetFramework ? {
      tier: strategy.budgetFramework.tier,
      targetAmount: strategy.budgetFramework.targetAmount,
      currency: strategy.budgetFramework.currency,
      priorities: strategy.budgetFramework.priorities,
    } : null,
    materialPreferences: strategy.projectContext?.style?.materialPreferences || [],
    avoidMaterials: strategy.projectContext?.style?.avoidMaterials || [],
    qualityExpectations: strategy.projectContext?.requirements?.qualityExpectations,
    designBrief: briefText,
  };
}

// ============================================
// Confidence Scoring
// ============================================

/**
 * Calculate confidence score with reasoning
 * @param {Object} deliverable
 * @param {Object} extractionMethod - How item was extracted
 * @returns {Object} Confidence with reasoning
 */
function calculateConfidence(deliverable, extractionMethod) {
  let score = 0.5; // Base score
  const reasoning = [];
  const ambiguities = [];

  // Boost for regex pattern match
  if (extractionMethod.method === 'regex') {
    score += 0.25;
    reasoning.push('Extracted via structured pattern matching');
  }

  // Boost for template/ontology match
  if (deliverable.roomType && ROOM_ONTOLOGY[deliverable.roomType]) {
    score += 0.15;
    reasoning.push(`Matched to ${ROOM_ONTOLOGY[deliverable.roomType].name} template`);
  }

  // Boost for Feature Library match
  if (deliverable.manufacturing?.capabilityVerified) {
    score += 0.1;
    reasoning.push('Verified against Feature Library');
  } else if (deliverable.category === 'MANUFACTURED') {
    ambiguities.push('No Feature Library match - custom fabrication required');
  }

  // Boost for LLM validation
  if (extractionMethod.llmValidated) {
    score += 0.1;
    reasoning.push('Validated by AI model');
  }

  // Penalty for missing specifications
  if (!deliverable.specifications || !deliverable.specifications.dimensions) {
    score -= 0.05;
    ambiguities.push('Dimensions need clarification');
  }

  // Penalty for custom items
  if (deliverable.itemType === 'custom') {
    score -= 0.15;
    ambiguities.push('Custom item requires detailed specification');
  }

  // Clamp score between 0 and 1
  score = Math.max(0, Math.min(1, score));

  return {
    score: Math.round(score * 100) / 100,
    reasoning: reasoning.join('; '),
    ambiguities,
    extractionMethod: extractionMethod.method,
  };
}

// ============================================
// Scoping AI Functions
// ============================================

/**
 * Extract entities and multipliers from brief text
 * @param {string} briefText
 * @returns {Object} Extracted entities
 */
function extractEntities(briefText) {
  const entities = {
    roomGroups: [],
    explicitItems: [],
    quantities: {},
    projectType: null,
    location: null,
  };

  // Detect project type
  if (/hotel|hospitality|resort/i.test(briefText)) {
    entities.projectType = 'hospitality';
  } else if (/restaurant|cafe|dining/i.test(briefText)) {
    entities.projectType = 'restaurant';
  } else if (/office|workspace|corporate/i.test(briefText)) {
    entities.projectType = 'office';
  } else if (/residential|home|house|apartment/i.test(briefText)) {
    entities.projectType = 'residential';
  } else if (/retail|shop|store/i.test(briefText)) {
    entities.projectType = 'retail';
  }

  // Extract location
  const locationMatch = briefText.match(/(?:in|at|for)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|\s+(?:with|featuring|including))/);
  if (locationMatch) {
    entities.location = locationMatch[1].trim();
  }

  // Extract room quantities with multipliers
  const roomPatterns = [
    { pattern: /(\d+)\s*(?:standard\s+)?guest\s*rooms?/gi, type: 'guest_room_standard' },
    { pattern: /(\d+)\s*(?:junior\s+)?suites?/gi, type: 'guest_room_suite' },
    { pattern: /(\d+)\s*(?:master\s+)?bedrooms?/gi, type: 'master_bedroom' },
    { pattern: /(\d+)\s*kitchens?/gi, type: 'kitchen' },
    { pattern: /(\d+)\s*offices?/gi, type: 'office' },
    { pattern: /reception|lobby/gi, type: 'reception_lobby', quantity: 1 },
    { pattern: /restaurant|dining\s*area/gi, type: 'restaurant_dining', quantity: 1 },
  ];

  for (const { pattern, type, quantity } of roomPatterns) {
    let match;
    while ((match = pattern.exec(briefText)) !== null) {
      const qty = quantity || parseInt(match[1], 10);
      if (qty > 0) {
        entities.roomGroups.push({
          type,
          quantity: qty,
          source: match[0],
        });
      }
    }
  }

  // Extract explicit items mentioned
  for (const { pattern, type } of ITEM_PATTERNS) {
    if (pattern.test(briefText)) {
      entities.explicitItems.push(type);
    }
  }

  return entities;
}

/**
 * Expand room groups into deliverables using ontology
 * @param {Object} entities - Extracted entities
 * @returns {Array} Expanded deliverables
 */
function expandToDeliverables(entities) {
  const deliverables = [];
  let deliverableId = 1;

  for (const roomGroup of entities.roomGroups) {
    const template = ROOM_ONTOLOGY[roomGroup.type];
    if (!template) continue;

    for (const item of template.items) {
      const totalQuantity = item.quantity * roomGroup.quantity;
      
      deliverables.push({
        id: `del_${String(deliverableId++).padStart(3, '0')}`,
        name: `${formatItemName(item.type)} - ${template.name}`,
        itemType: item.type,
        category: item.category,
        subcategory: item.subcategory,
        roomType: roomGroup.type,
        roomTypeName: template.name,
        quantity: totalQuantity,
        unitQuantityPerRoom: item.quantity,
        roomCount: roomGroup.quantity,
        specifications: null, // To be enhanced
        manufacturing: null,  // To be matched with Feature Library
        procurement: null,    // For PROCURED items
        aiMetadata: {
          confidenceScore: 0.85,
          sourceReferences: [
            { type: 'template_match', template: roomGroup.type },
            { type: 'brief_extraction', text: roomGroup.source },
          ],
          requiresClarification: false,
        },
      });
    }
  }

  return deliverables;
}

/**
 * Format item type to readable name
 */
function formatItemName(itemType) {
  return itemType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Match deliverables against Feature Library
 * @param {Array} deliverables
 * @param {Object} featureLibrary - Parsed feature library
 * @returns {Array} Enhanced deliverables
 */
function matchFeatureLibrary(deliverables, featureLibrary) {
  if (!featureLibrary?.features) return deliverables;

  for (const deliverable of deliverables) {
    if (deliverable.category !== 'MANUFACTURED') continue;

    // Find matching features
    const matchingFeatures = featureLibrary.features.filter(feature => {
      const nameMatch = feature.name?.toLowerCase().includes(deliverable.itemType.replace(/_/g, ' '));
      const categoryMatch = feature.category?.toLowerCase() === deliverable.subcategory?.toLowerCase();
      return nameMatch || categoryMatch;
    });

    if (matchingFeatures.length > 0) {
      deliverable.manufacturing = {
        featureLibraryMatches: matchingFeatures.slice(0, 3).map(f => ({
          featureId: f.id,
          featureName: f.name,
          category: f.category,
        })),
        capabilityVerified: true,
        estimatedHoursPerUnit: matchingFeatures[0].estimatedMinutes ? matchingFeatures[0].estimatedMinutes / 60 : 4,
      };
      deliverable.aiMetadata.confidenceScore = Math.min(0.95, deliverable.aiMetadata.confidenceScore + 0.1);
    } else {
      deliverable.manufacturing = {
        featureLibraryMatches: [],
        capabilityVerified: false,
        note: 'No direct Feature Library match - manual specification required',
      };
      deliverable.aiMetadata.requiresClarification = true;
    }
  }

  return deliverables;
}

/**
 * Generate summary statistics
 */
function generateSummary(deliverables) {
  const summary = {
    totalDeliverables: deliverables.length,
    totalUnits: deliverables.reduce((sum, d) => sum + d.quantity, 0),
    byCategory: {
      MANUFACTURED: 0,
      PROCURED: 0,
      DOCUMENT: 0,
    },
    byRoomType: {},
    estimatedTotalHours: 0,
    itemsRequiringClarification: 0,
  };

  for (const del of deliverables) {
    summary.byCategory[del.category] = (summary.byCategory[del.category] || 0) + del.quantity;
    summary.byRoomType[del.roomTypeName] = (summary.byRoomType[del.roomTypeName] || 0) + del.quantity;
    
    if (del.manufacturing?.estimatedHoursPerUnit) {
      summary.estimatedTotalHours += del.manufacturing.estimatedHoursPerUnit * del.quantity;
    }
    
    if (del.aiMetadata?.requiresClarification) {
      summary.itemsRequiringClarification++;
    }
  }

  return summary;
}

// ============================================
// Main Cloud Function
// ============================================

/**
 * Unified Project Scoping AI
 * Combines brief analysis with strategy research
 */
const projectScoping = onCall({
  memory: '2GiB',
  timeoutSeconds: 180,
  secrets: [GEMINI_API_KEY],
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const {
    briefText,
    projectId,
    projectName,
    projectType: explicitProjectType,
    location: explicitLocation,
    includeResearch = true,
    customerId,
    strategyId, // Optional: explicit strategy ID
  } = request.data;

  // 2. Validate input
  if (!briefText || typeof briefText !== 'string' || briefText.length < 20) {
    throw new HttpsError('invalid-argument', 'Brief text must be at least 20 characters');
  }

  // 3. Rate limiting
  try {
    const rateResult = await checkRateLimit(userId, 'ai', db);
    if (!rateResult.allowed) {
      throw new HttpsError('resource-exhausted', 
        `Rate limit exceeded. Resets at ${rateResult.resetAt.toISOString()}`);
    }
  } catch (error) {
    if (error.code === 'resource-exhausted') throw error;
    console.warn('Rate limit check failed, proceeding:', error.message);
  }

  console.log('Project Scoping request:', { 
    projectId,
    projectName,
    briefLength: briefText.length,
    includeResearch,
  });

  try {
    const startTime = Date.now();

    // 4. Fetch Project Strategy (if available)
    console.log('Phase 0: Fetching project strategy...');
    const strategy = await fetchProjectStrategy(strategyId || projectId);
    const strategyContext = strategy ? buildStrategyAIContext(strategy, briefText) : null;

    if (strategyContext) {
      console.log(`Strategy loaded: Budget tier ${strategyContext.budgetFramework?.tier}, Space: ${strategyContext.spaceParameters?.totalArea} ${strategyContext.spaceParameters?.areaUnit}`);
    } else {
      console.log('No strategy context available - using defaults');
    }

    // 5. Entity Extraction (Step 1: Regex)
    console.log('Phase 1: Entity extraction (regex)...');
    const entities = extractEntities(briefText);
    entities.projectType = explicitProjectType || strategyContext?.projectContext?.type || entities.projectType;
    entities.location = explicitLocation || strategyContext?.projectContext?.location || entities.location || 'East Africa';

    console.log(`Extracted: ${entities.roomGroups.length} room groups, type: ${entities.projectType}`);

    // 5. Template Expansion
    console.log('Phase 2: Template expansion...');
    let deliverables = expandToDeliverables(entities);
    console.log(`Expanded to ${deliverables.length} deliverable types`);

    // 6. Feature Library Matching
    console.log('Phase 3: Feature Library matching...');
    const cacheManager = getCacheManager(db);
    const featureContextJson = await cacheManager.getOrCreateCache();
    let featureLibrary = null;
    
    if (featureContextJson) {
      try {
        featureLibrary = JSON.parse(featureContextJson);
      } catch (e) {
        console.warn('Failed to parse feature library cache');
      }
    }
    
    deliverables = matchFeatureLibrary(deliverables, featureLibrary?.featureLibrary);

    // 7. AI Enhancement with Gemini (structured output + optional research)
    console.log('Phase 4: AI enhancement...');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    
    const modelConfig = {
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    // Add search grounding if research requested
    if (includeResearch) {
      modelConfig.tools = [{ googleSearch: {} }];
    }

    const model = genAI.getGenerativeModel(modelConfig);

    // Build context-aware prompt
    const strategyContextStr = strategyContext ? `
STRATEGY CONTEXT:
- Budget Tier: ${strategyContext.budgetFramework?.tier || 'standard'} (economy=0.7x, standard=1.0x, premium=1.5x, luxury=2.5x)
- Target Budget: ${strategyContext.budgetFramework?.targetAmount ? `${strategyContext.budgetFramework.targetAmount} ${strategyContext.budgetFramework.currency}` : 'Not specified'}
- Space: ${strategyContext.spaceParameters?.totalArea || 'Not specified'} ${strategyContext.spaceParameters?.areaUnit || ''}
- Space Type: ${strategyContext.spaceParameters?.spaceType || 'Not specified'}
- Material Preferences: ${strategyContext.materialPreferences?.join(', ') || 'None specified'}
- Materials to Avoid: ${strategyContext.avoidMaterials?.join(', ') || 'None specified'}
- Quality Expectations: ${strategyContext.qualityExpectations || 'Standard'}
` : 'STRATEGY CONTEXT: Not available - using defaults';

    const enhancementPrompt = `You are a design-to-production manufacturing expert for Dawin Group (custom millwork company in ${entities.location}).

PROJECT BRIEF:
${briefText}

${strategyContextStr}

REGEX-EXTRACTED DELIVERABLES (${deliverables.length} types, ${deliverables.reduce((s, d) => s + d.quantity, 0)} total units):
${JSON.stringify(deliverables.slice(0, 20).map(d => ({
  id: d.id,
  name: d.name,
  itemType: d.itemType,
  category: d.category,
  quantity: d.quantity,
  roomCount: d.roomCount,
})), null, 2)}

PROJECT TYPE: ${entities.projectType || 'custom'}
LOCATION: ${entities.location}

HYBRID EXTRACTION TASKS:
1. **Validation**: Review the regex-extracted deliverables. Are they accurate? Any duplicates or errors?
2. **LLM Extraction**: Scan the brief for items the regex patterns MISSED (especially natural language descriptions, specialty items, or unique custom elements)
3. **Specifications**: For each item (regex + LLM extracted), suggest:
   - Dimensions (in mm) - use space parameters and budget tier as guidance
   - Materials - align with material preferences from strategy
   - Finish - align with quality expectations
   - Complexity (low/medium/high)
4. **Budget Tier Hints**: Apply budget tier multiplier to pricing suggestions (e.g., luxury = 2.5x standard cost)
5. **Ambiguities**: Flag any items needing client clarification (vague descriptions, conflicting requirements)
${includeResearch ? '6. **Trend Research**: Research current design trends for this project type and location (use Google Search)' : ''}

Return a JSON object with:
{
  "validation": {
    "extractedCorrectly": true/false,
    "regexAccuracy": "high|medium|low",
    "duplicates": ["item IDs that are duplicates"],
    "corrections": ["any corrections needed to regex results"]
  },
  "llmExtractedItems": [
    {
      "name": "item name from brief",
      "category": "MANUFACTURED|PROCURED|DESIGN_DOCUMENT|CONSTRUCTION",
      "quantity": number,
      "reasoning": "why regex missed this",
      "confidence": "high|medium|low"
    }
  ],
  "specifications": {
    "itemType": {
      "suggestedDimensions": {"width": number, "height": number, "depth": number},
      "suggestedMaterial": "material name (from preferences if available)",
      "suggestedFinish": "finish type",
      "complexity": "low|medium|high",
      "estimatedCostMultiplier": number (based on budget tier)
    }
  },
  "ambiguities": [
    {
      "itemType": "item type or 'general'",
      "question": "clarification needed",
      "severity": "critical|important|minor"
    }
  ],
  "trendInsights": ${includeResearch ? '["current trends for this project type"]' : 'null'},
  "recommendations": ["strategic recommendations considering budget tier and quality expectations"]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: enhancementPrompt }] }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

    // Parse AI enhancement
    let aiEnhancement = null;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiEnhancement = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse AI enhancement response');
    }

    // Apply AI enhancements to deliverables
    if (aiEnhancement?.specifications) {
      for (const deliverable of deliverables) {
        const specs = aiEnhancement.specifications[deliverable.itemType];
        if (specs) {
          deliverable.specifications = {
            dimensions: specs.suggestedDimensions || null,
            material: specs.suggestedMaterial || null,
            finish: specs.suggestedFinish || null,
            complexity: specs.complexity || 'medium',
            estimatedCostMultiplier: specs.estimatedCostMultiplier || 1.0,
          };

          // Update confidence with enhanced scoring
          const confidence = calculateConfidence(deliverable, {
            method: 'regex',
            llmValidated: true,
          });
          deliverable.aiMetadata.confidenceScore = confidence.score;
          deliverable.aiMetadata.reasoning = confidence.reasoning;
          deliverable.aiMetadata.ambiguities = confidence.ambiguities;
          deliverable.aiMetadata.extractionMethod = 'hybrid-regex';
        }
      }
    }

    // Add LLM-extracted items (Step 2: LLM catches what regex missed)
    if (aiEnhancement?.llmExtractedItems?.length > 0) {
      let nextId = deliverables.length + 1;
      for (const llmItem of aiEnhancement.llmExtractedItems) {
        const newDeliverable = {
          id: `del_llm_${String(nextId++).padStart(3, '0')}`,
          name: llmItem.name,
          itemType: llmItem.itemType || 'custom',
          category: llmItem.category || 'MANUFACTURED',
          subcategory: 'specialty',
          quantity: llmItem.quantity || 1,
          specifications: null,
          manufacturing: { capabilityVerified: false },
          aiMetadata: {
            confidenceScore: llmItem.confidence === 'high' ? 0.8 : llmItem.confidence === 'medium' ? 0.65 : 0.5,
            sourceReferences: [{
              type: 'llm_extraction',
              text: llmItem.name,
              reasoning: llmItem.reasoning,
            }],
            reasoning: llmItem.reasoning || 'Extracted via LLM (regex missed)',
            ambiguities: llmItem.confidence === 'low' ? ['Low confidence - needs verification'] : [],
            requiresClarification: llmItem.confidence !== 'high',
            extractionMethod: 'hybrid-llm',
          },
        };

        // Apply strategy context if available
        if (strategyContext) {
          newDeliverable.strategyContext = {
            budgetTier: strategyContext.budgetFramework?.tier || 'standard',
            scopingConfidence: newDeliverable.aiMetadata.confidenceScore,
          };
        }

        deliverables.push(newDeliverable);
      }
    }

    // Add strategy context to all regex-extracted deliverables
    if (strategyContext) {
      for (const deliverable of deliverables) {
        if (!deliverable.strategyContext) {
          deliverable.strategyContext = {
            budgetTier: strategyContext.budgetFramework?.tier || 'standard',
            spaceMultiplier: deliverable.roomCount || 1,
            scopingConfidence: deliverable.aiMetadata?.confidenceScore || 0.75,
            deliverableType: deliverable.itemType,
          };
        }
      }
    }

    // 8. Generate summary
    const summary = generateSummary(deliverables);
    const processingTime = Date.now() - startTime;

    // 9. Save to Firestore if projectId provided
    if (projectId) {
      try {
        await db.collection('designProjects').doc(projectId).collection('aiScoping').add({
          userId,
          briefText: briefText.substring(0, 2000),
          entitiesExtracted: entities,
          deliverablesCount: deliverables.length,
          summary,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          processingTimeMs: processingTime,
        });
      } catch (saveError) {
        console.error('Error saving scoping results:', saveError);
      }
    }

    // 10. Return structured response
    return {
      projectId,
      projectName: projectName || 'Untitled Project',
      generatedAt: new Date().toISOString(),
      aiModel: 'gemini-2.0-flash-hybrid',
      processingTimeMs: processingTime,

      // Strategy integration
      strategyContext: strategyContext ? {
        budgetTier: strategyContext.budgetFramework?.tier,
        targetBudget: strategyContext.budgetFramework?.targetAmount,
        spaceArea: strategyContext.spaceParameters?.totalArea,
        spaceUnit: strategyContext.spaceParameters?.areaUnit,
        materialPreferences: strategyContext.materialPreferences,
        qualityExpectations: strategyContext.qualityExpectations,
      } : null,

      // Extraction results
      entities,
      deliverables,
      summary,

      // Hybrid extraction metadata
      extractionMetadata: {
        regexExtracted: deliverables.filter(d => d.aiMetadata?.extractionMethod?.includes('regex')).length,
        llmExtracted: deliverables.filter(d => d.aiMetadata?.extractionMethod?.includes('llm')).length,
        regexAccuracy: aiEnhancement?.validation?.regexAccuracy || 'medium',
        averageConfidence: deliverables.reduce((sum, d) => sum + (d.aiMetadata?.confidenceScore || 0), 0) / deliverables.length || 0,
      },

      // AI enhancement details
      aiEnhancement: {
        validation: aiEnhancement?.validation || null,
        ambiguities: aiEnhancement?.ambiguities || [],
        trendInsights: aiEnhancement?.trendInsights || null,
        recommendations: aiEnhancement?.recommendations || [],
        searchQueries: groundingMetadata?.webSearchQueries || [],
      },

      usageMetadata: {
        inputTokens: result.response.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
        groundedSearch: includeResearch,
      },
    };

  } catch (error) {
    console.error('Project Scoping error:', error);
    throw new HttpsError('internal', `Scoping failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  projectScoping,
  // Export helpers for testing
  extractEntities,
  expandToDeliverables,
  matchFeatureLibrary,
  generateSummary,
  calculateConfidence,
  fetchProjectStrategy,
  buildStrategyAIContext,
  ROOM_ONTOLOGY,
};
