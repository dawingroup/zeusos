/**
 * Design Item Enhancement AI
 * 
 * Refines individual deliverables with:
 * - Specification inference (dimensions, materials, finishes)
 * - DfM validation against Feature Library
 * - Inventory verification
 * - Supplier discovery for non-inventory items
 * - Alternative generation with cost optimization
 * 
 * Based on Comprehensive AI Architecture specification.
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
const { getMemoryContext } = require('../utils/memoryLoader');

// ============================================
// DfM Rules Engine
// ============================================

const DFM_RULES = [
  {
    id: 'min-panel-thickness',
    category: 'material',
    check: (specs) => {
      if (specs.dimensions?.width > 600 && specs.material?.thickness < 18) {
        return {
          severity: 'warning',
          rule: 'min-panel-thickness',
          description: 'Panel width exceeds 600mm with thickness under 18mm. Risk of sagging.',
          suggestedFix: 'Increase panel thickness to 18mm or add support rails.',
        };
      }
      return null;
    },
  },
  {
    id: 'max-sheet-dimension',
    category: 'material',
    check: (specs) => {
      const maxDim = Math.max(specs.dimensions?.width || 0, specs.dimensions?.height || 0);
      if (maxDim > 2440) {
        return {
          severity: 'error',
          rule: 'max-sheet-dimension',
          description: 'Dimension exceeds standard sheet size (2440mm). Requires joinery or special material.',
          suggestedFix: 'Split into panels or source oversized sheets.',
        };
      }
      return null;
    },
  },
  {
    id: 'grain-direction',
    category: 'material',
    check: (specs) => {
      if (specs.material?.grainDirection && !specs.grainDirectionSpecified) {
        return {
          severity: 'info',
          rule: 'grain-direction',
          description: 'Material has grain but direction not specified.',
          suggestedFix: 'Specify grain direction for visual consistency.',
        };
      }
      return null;
    },
  },
  {
    id: 'hardware-clearance',
    category: 'hardware',
    check: (specs) => {
      if (specs.hardware?.some(h => h.type === 'drawer_slide') && specs.dimensions?.depth < 350) {
        return {
          severity: 'warning',
          rule: 'hardware-clearance',
          description: 'Depth may be insufficient for standard drawer slides.',
          suggestedFix: 'Verify slide compatibility or increase depth to 350mm+.',
        };
      }
      return null;
    },
  },
  {
    id: 'edge-banding-compatibility',
    category: 'finish',
    check: (specs) => {
      if (specs.material?.type === 'mdf' && !specs.edgeBanding) {
        return {
          severity: 'info',
          rule: 'edge-banding-compatibility',
          description: 'MDF requires edge treatment to prevent moisture damage.',
          suggestedFix: 'Add PVC or veneer edge banding specification.',
        };
      }
      return null;
    },
  },
];

/**
 * Run DfM validation on specifications
 * @param {Object} specifications
 * @returns {Array} Validation results
 */
function runDfMValidation(specifications) {
  const results = [];
  
  for (const rule of DFM_RULES) {
    const result = rule.check(specifications);
    if (result) {
      results.push(result);
    }
  }
  
  return results;
}

// ============================================
// Supplier Discovery (Mock - would integrate with real APIs)
// ============================================

const SUPPLIER_DATABASE = {
  quartz_countertop: [
    {
      supplier: 'Foshan Stone Materials Co.',
      platform: 'alibaba',
      unitPriceUsd: 285,
      moq: 10,
      leadTimeDays: 21,
      shippingDays: 14,
    },
    {
      supplier: 'Xiamen Dalei Stone',
      platform: 'alibaba',
      unitPriceUsd: 245,
      moq: 20,
      leadTimeDays: 18,
      shippingDays: 14,
    },
  ],
  hardware_hinges: [
    {
      supplier: 'Blum East Africa',
      platform: 'direct',
      unitPriceUsd: 8.50,
      moq: 50,
      leadTimeDays: 7,
      shippingDays: 3,
    },
    {
      supplier: 'Hettich Kenya',
      platform: 'direct',
      unitPriceUsd: 7.20,
      moq: 100,
      leadTimeDays: 10,
      shippingDays: 5,
    },
  ],
  drawer_slides: [
    {
      supplier: 'Blum East Africa',
      platform: 'direct',
      unitPriceUsd: 25,
      moq: 20,
      leadTimeDays: 7,
      shippingDays: 3,
    },
  ],
  upholstery_fabric: [
    {
      supplier: 'Warwick Fabrics SA',
      platform: 'direct',
      unitPriceUsd: 45,
      moq: 30,
      leadTimeDays: 14,
      shippingDays: 7,
    },
  ],
};

/**
 * Find suppliers for a procurement item
 * @param {string} itemType
 * @param {number} quantity
 * @returns {Array} Supplier options
 */
function findSuppliers(itemType, quantity) {
  // Normalize item type for lookup
  const normalized = itemType.toLowerCase().replace(/\s+/g, '_');
  
  const suppliers = SUPPLIER_DATABASE[normalized] || [];
  
  return suppliers.map(s => ({
    ...s,
    totalLeadTime: s.leadTimeDays + s.shippingDays,
    meetsQuantity: quantity >= s.moq,
    estimatedTotal: s.unitPriceUsd * Math.max(quantity, s.moq),
    confidence: 0.85,
  }));
}

// ============================================
// Specification Inference
// ============================================

const DEFAULT_SPECIFICATIONS = {
  wardrobe: {
    dimensions: { width: 1200, height: 2400, depth: 600 },
    material: { type: 'melamine_mdf', thickness: 18, grainDirection: false },
    finish: { type: 'laminate', sheen: 'matte' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 6 },
      { type: 'hanging_rail', quantity: 1 },
      { type: 'shelf_support', quantity: 12 },
    ],
    estimatedHours: 6,
  },
  bathroom_vanity: {
    dimensions: { width: 900, height: 850, depth: 550 },
    material: { type: 'moisture_resistant_mdf', thickness: 18, grainDirection: false },
    finish: { type: 'lacquer', sheen: 'semi-gloss' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 2 },
      { type: 'drawer_slide', quantity: 2 },
    ],
    estimatedHours: 5,
  },
  desk_unit: {
    dimensions: { width: 1400, height: 750, depth: 700 },
    material: { type: 'veneer_mdf', thickness: 25, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'satin' },
    hardware: [
      { type: 'drawer_slide', quantity: 4 },
      { type: 'cable_grommet', quantity: 2 },
    ],
    estimatedHours: 8,
  },
  reception_desk: {
    dimensions: { width: 2400, height: 1100, depth: 800 },
    material: { type: 'veneer_plywood', thickness: 25, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'gloss' },
    hardware: [
      { type: 'drawer_slide', quantity: 4 },
      { type: 'cable_grommet', quantity: 4 },
    ],
    estimatedHours: 16,
  },
  nightstand: {
    dimensions: { width: 500, height: 550, depth: 450 },
    material: { type: 'veneer_mdf', thickness: 18, grainDirection: true },
    finish: { type: 'lacquer', sheen: 'matte' },
    hardware: [
      { type: 'drawer_slide', quantity: 2 },
    ],
    estimatedHours: 3,
  },
  tv_unit: {
    dimensions: { width: 1600, height: 500, depth: 450 },
    material: { type: 'melamine_mdf', thickness: 18, grainDirection: false },
    finish: { type: 'laminate', sheen: 'matte' },
    hardware: [
      { type: 'soft_close_hinge', quantity: 4 },
      { type: 'cable_grommet', quantity: 2 },
    ],
    estimatedHours: 5,
  },
};

/**
 * Infer specifications for an item type
 * @param {string} itemType
 * @param {Object} context - Project context for customization
 * @returns {Object} Inferred specifications
 */
function inferSpecifications(itemType, context = {}) {
  const defaults = DEFAULT_SPECIFICATIONS[itemType];
  if (!defaults) {
    return {
      dimensions: null,
      material: null,
      finish: null,
      hardware: [],
      estimatedHours: 4, // Default estimate
      note: 'No default specifications available - requires manual input',
    };
  }

  // Apply context adjustments
  const specs = JSON.parse(JSON.stringify(defaults));

  // Adjust for budget tier
  if (context.budgetTier === 'premium' || context.budgetTier === 'luxury') {
    specs.material.type = specs.material.type.replace('melamine', 'veneer');
    specs.finish.type = 'lacquer';
    specs.finish.sheen = 'gloss';
  }

  // Adjust for hospitality (more durable)
  if (context.projectType === 'hospitality') {
    specs.finish.type = 'commercial_grade_lacquer';
    specs.hardware = specs.hardware.map(h => ({
      ...h,
      grade: 'commercial',
    }));
  }

  return specs;
}

// ============================================
// Main Cloud Function
// ============================================

/**
 * Design Item Enhancement AI
 * Refines individual deliverables with full specifications
 */
const designItemEnhancement = onCall({
  memory: '1GiB',
  timeoutSeconds: 120,
  secrets: [GEMINI_API_KEY],
}, async (request) => {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const userId = request.auth.uid;
  const { 
    deliverable,      // Single deliverable to enhance
    projectContext,   // Project-level context
    customerId,       // For customer intelligence
    companyId,        // For memory context
    includeSuppliers = true,
  } = request.data;

  // 2. Validate input
  if (!deliverable || !deliverable.itemType) {
    throw new HttpsError('invalid-argument', 'Deliverable with itemType is required');
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
  }

  console.log('Design Item Enhancement:', { 
    itemType: deliverable.itemType,
    category: deliverable.category,
    quantity: deliverable.quantity,
  });

  try {
    const startTime = Date.now();
    const enhanced = { ...deliverable };

    // 4. Infer specifications if not provided
    if (!enhanced.specifications || !enhanced.specifications.dimensions) {
      enhanced.specifications = inferSpecifications(
        deliverable.itemType,
        projectContext || {}
      );
    }

    // 5. Run DfM validation
    const dfmResults = runDfMValidation(enhanced.specifications);
    enhanced.dfmValidation = {
      passed: dfmResults.filter(r => r.severity === 'error').length === 0,
      issues: dfmResults,
      checkedAt: new Date().toISOString(),
    };

    // 6. Feature Library matching
    const cacheManager = getCacheManager(db);
    const featureContextJson = await cacheManager.getOrCreateCache();
    
    if (featureContextJson && deliverable.category === 'MANUFACTURED') {
      try {
        const featureLibrary = JSON.parse(featureContextJson);
        const features = featureLibrary?.featureLibrary?.features || [];
        
        const matches = features.filter(f => {
          const nameMatch = f.name?.toLowerCase().includes(
            deliverable.itemType.replace(/_/g, ' ')
          );
          return nameMatch;
        });

        enhanced.manufacturing = {
          featureLibraryMatches: matches.slice(0, 3).map(f => ({
            featureId: f.id,
            featureName: f.name,
            category: f.category,
          })),
          capabilityVerified: matches.length > 0,
          estimatedHoursPerUnit: enhanced.specifications?.estimatedHours || 4,
          estimatedTotalHours: (enhanced.specifications?.estimatedHours || 4) * deliverable.quantity,
        };
      } catch (e) {
        console.warn('Failed to match Feature Library');
      }
    }

    // 7. Supplier discovery for PROCURED items
    if (deliverable.category === 'PROCURED' && includeSuppliers) {
      const suppliers = findSuppliers(deliverable.itemType, deliverable.quantity);
      
      enhanced.procurement = {
        supplierOptions: suppliers,
        recommendedSupplier: suppliers.find(s => s.meetsQuantity) || suppliers[0] || null,
        inventoryStatus: 'NOT_AVAILABLE',
        procurementPathway: suppliers.length > 0 ? 'supplier_sourcing' : 'manual_sourcing',
      };
    }

    // 8. Load business memory context (non-blocking)
    let memoryPrompt = '';
    let memoryCount = 0;
    if (companyId) {
      try {
        const memCtx = await getMemoryContext(companyId, 'design_enhancement', 8);
        memoryPrompt = memCtx.prompt;
        memoryCount = memCtx.count;
        if (memoryCount > 0) {
          console.log(`Business memory loaded: ${memoryCount} memories for design enhancement`);
        }
      } catch (err) {
        console.warn('Memory load failed (non-blocking):', err.message);
      }
    }

    // 9. AI-powered enhancement with Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });

    let enhancementPrompt = `You are a manufacturing specification expert.

Enhance this deliverable specification:
${JSON.stringify(enhanced, null, 2)}

PROJECT CONTEXT: ${JSON.stringify(projectContext || {}, null, 2)}

Provide:
1. Any specification refinements needed
2. Material alternatives with cost implications
3. Hardware recommendations
4. Quality grade suggestions (AWI Economy/Custom/Premium)
5. Estimated cost range (USD)

Return JSON:
{
  "refinements": ["list of specification refinements"],
  "materialAlternatives": [{"original": "x", "alternative": "y", "costDiff": "+10%"}],
  "hardwareRecommendations": ["specific hardware suggestions"],
  "qualityGrade": "economy|custom|premium",
  "estimatedCostRange": {"min": 0, "max": 0, "currency": "USD"},
  "notes": ["additional notes"]
}`;

    // Inject business memory context
    if (memoryPrompt) {
      enhancementPrompt += memoryPrompt;
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: enhancementPrompt }] }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        enhanced.aiEnhancement = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse AI enhancement');
    }

    // 10. Update confidence score
    const hasSpecs = !!enhanced.specifications?.dimensions;
    const hasDfm = enhanced.dfmValidation?.passed;
    const hasManufacturing = enhanced.manufacturing?.capabilityVerified;
    
    enhanced.aiMetadata = {
      ...enhanced.aiMetadata,
      confidenceScore: 0.5 + (hasSpecs ? 0.2 : 0) + (hasDfm ? 0.15 : 0) + (hasManufacturing ? 0.15 : 0),
      enhancedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };

    enhanced.memoryCount = memoryCount;
    return enhanced;

  } catch (error) {
    console.error('Design Item Enhancement error:', error);
    throw new HttpsError('internal', `Enhancement failed: ${error.message}`);
  }
});

// ============================================
// Exports
// ============================================

module.exports = {
  designItemEnhancement,
  // Export helpers
  runDfMValidation,
  inferSpecifications,
  findSuppliers,
  DFM_RULES,
  DEFAULT_SPECIFICATIONS,
};
